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
  return { version, vendorId, productId, customFlow, discovery, discriminator, passcode, raw: t };
}

export function hex4(n) {
  return "0x" + n.toString(16).toUpperCase().padStart(4, "0");
}
