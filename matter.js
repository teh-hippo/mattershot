// Decode a Matter onboarding payload ("MT:..." QR string) into its fields.
// Reference: Matter Core Specification, "Onboarding Payload" packed binary structure.

const BASE38 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-.";

export function base38Decode(str) {
  const bytes = [];
  let i = 0;
  while (i < str.length) {
    const remaining = str.length - i;
    let charCount, byteCount;
    if (remaining >= 5) { charCount = 5; byteCount = 3; }
    else if (remaining === 4) { charCount = 4; byteCount = 2; }
    else if (remaining === 2) { charCount = 2; byteCount = 1; }
    else throw new Error(`invalid base38 length remainder: ${remaining}`);
    let value = 0;
    for (let k = charCount - 1; k >= 0; k--) {
      const idx = BASE38.indexOf(str[i + k]);
      if (idx < 0) throw new Error(`invalid base38 character: ${str[i + k]}`);
      value = value * 38 + idx;
    }
    for (let b = 0; b < byteCount; b++) bytes.push((value >> (8 * b)) & 0xff);
    i += charCount;
  }
  return Uint8Array.from(bytes);
}

function makeBitReader(bytes) {
  let bit = 0;
  return (numBits) => {
    let value = 0;
    for (let n = 0; n < numBits; n++) {
      const b = (bytes[bit >> 3] >> (bit & 7)) & 1;
      value |= b << n;
      bit++;
    }
    return value >>> 0;
  };
}

export function parseMatterPayload(text) {
  const t = String(text || "").trim();
  if (!t.startsWith("MT:")) throw new Error('Not a Matter QR code (missing "MT:" prefix).');
  const bytes = base38Decode(t.slice(3));
  if (bytes.length < 11) throw new Error("Matter payload too short.");
  const read = makeBitReader(bytes);
  const version = read(3);
  const vendorId = read(16);
  const productId = read(16);
  const customFlow = read(2);
  const discovery = read(8);
  const discriminator = read(12);
  const passcode = read(27);
  return { type: "matter", version, vendorId, productId, customFlow, discovery, discriminator, passcode, raw: t };
}

export function hex4(n) {
  return "0x" + n.toString(16).toUpperCase().padStart(4, "0");
}

// ---- Manual pairing code (Matter Core spec, 5.1.4) -------------------------
// Verhoeff check-digit tables.
const V_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6], [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4], [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const V_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2], [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];
const V_INV = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];

function verhoeff(numStr) {
  let c = 0;
  const a = numStr.split("").reverse();
  for (let i = 0; i < a.length; i++) c = V_D[c][V_P[(i + 1) % 8][parseInt(a[i], 10)]];
  return V_INV[c];
}

// Returns the digits of the manual pairing code (11 for standard flow, 21 with VID/PID).
export function manualPairingCode({ discriminator, passcode, vendorId, productId, customFlow }) {
  const vidpid = customFlow ? 1 : 0;
  const shortDisc = (discriminator >> 8) & 0xf;
  const d0 = (vidpid << 2) | ((shortDisc >> 2) & 0x3);
  const g1 = ((shortDisc & 0x3) << 14) | (passcode & 0x3fff);
  const g2 = (passcode >> 14) & 0x1fff;
  let digits = String(d0) + String(g1).padStart(5, "0") + String(g2).padStart(4, "0");
  if (vidpid) digits += String(vendorId).padStart(5, "0") + String(productId).padStart(5, "0");
  return digits + String(verhoeff(digits));
}

// Groups the 11-digit standard code as NNNN-NNN-NNNN (longer codes grouped in fours).
export function formatPairingCode(code) {
  if (code.length === 11) return `${code.slice(0, 4)}-${code.slice(4, 7)}-${code.slice(7)}`;
  return code.replace(/(.{4})/g, "$1-").replace(/-$/, "");
}
