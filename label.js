// Compose a Matter-style label as a self-contained SVG: brand mark + wordmark,
// the regenerated QR, the manual pairing code, and our own fields.

const W = 380;        // label width (user units)
const PAD = 30;       // inner padding
const QR_SIZE = 248;  // drawn QR size including quiet zone
const QUIET = 4;      // quiet-zone modules

const SANS = "'Avenir Next','Segoe UI Variable','Segoe UI',system-ui,-apple-system,Roboto,sans-serif";
const MONO = "ui-monospace,'SF Mono','Cascadia Code','Roboto Mono','Courier New',monospace";

let _mctx;
function measure(text, font) {
  if (!_mctx) _mctx = document.createElement("canvas").getContext("2d");
  _mctx.font = font;
  return _mctx.measureText(text).width;
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
}

// 8-point sparkle approximating the Matter brand mark.
function sparkle(cx, cy, R) {
  const pts = 8, inner = R * 0.42;
  let d = "";
  for (let i = 0; i < pts * 2; i++) {
    const r = i % 2 === 0 ? R : inner;
    const a = (Math.PI / pts) * i - Math.PI / 2;
    d += (i ? "L" : "M") + (cx + r * Math.cos(a)).toFixed(2) + "," + (cy + r * Math.sin(a)).toFixed(2);
  }
  return d + "Z";
}

function qrPath(m) {
  let d = "";
  for (let r = 0; r < m.size; r++)
    for (let c = 0; c < m.size; c++)
      if (m.data[r * m.size + c]) d += `M${c} ${r}h1v1h-1z`;
  return d;
}

export function buildLabelSVG({ qrText, productName, location, itemLabel, pairingCode }) {
  const m = window.QRCode.create(qrText, { errorCorrectionLevel: "M" }).modules;
  const cx = W / 2;
  const parts = [];
  let y = PAD;

  // Brand row: sparkle mark + "matter" wordmark, centred as a unit.
  const markR = 16, wordSize = 30, gap = 13, word = "matter";
  const wordFont = `500 ${wordSize}px ${SANS}`;
  const wordW = measure(word, wordFont);
  const groupW = markR * 2 + gap + wordW;
  const gx = cx - groupW / 2;
  const brandY = y + markR;
  parts.push(`<path d="${sparkle(gx + markR, brandY, markR)}" fill="#101418"/>`);
  parts.push(`<text x="${(gx + markR * 2 + gap).toFixed(1)}" y="${brandY}" font-family="${SANS}" font-size="${wordSize}" font-weight="500" fill="#101418" dominant-baseline="central">${word}</text>`);
  y = brandY + markR + 20;

  // QR with quiet zone, centred.
  const box = m.size + QUIET * 2;
  const s = QR_SIZE / box;
  const qx = cx - QR_SIZE / 2;
  parts.push(`<rect x="${qx.toFixed(1)}" y="${y}" width="${QR_SIZE}" height="${QR_SIZE}" fill="#fff"/>`);
  parts.push(`<g transform="translate(${(qx + QUIET * s).toFixed(2)} ${(y + QUIET * s).toFixed(2)}) scale(${s.toFixed(4)})" shape-rendering="crispEdges"><path d="${qrPath(m)}" fill="#101418"/></g>`);
  y += QR_SIZE + 30;

  // Manual pairing code.
  parts.push(`<text x="${cx}" y="${y}" text-anchor="middle" font-family="${MONO}" font-size="22" letter-spacing="1.5" fill="#101418">${esc(pairingCode)}</text>`);
  y += 10;

  // Our own fields.
  const sub = [];
  if (location && location.trim()) sub.push(esc(location.trim()));
  if (itemLabel) sub.push(esc(itemLabel));
  const product = productName && productName.trim();
  if (product || sub.length) {
    y += 18;
    parts.push(`<line x1="${PAD + 22}" y1="${y}" x2="${W - PAD - 22}" y2="${y}" stroke="#e4e7eb" stroke-width="1.5"/>`);
    y += 30;
    if (product) {
      const maxTextW = W - PAD * 2 - 8;
      let pSize = 19;
      const pw = measure(product, `600 ${pSize}px ${SANS}`);
      if (pw > maxTextW) pSize = Math.max(12, Math.floor((pSize * maxTextW) / pw));
      parts.push(`<text x="${cx}" y="${y}" text-anchor="middle" font-family="${SANS}" font-size="${pSize}" font-weight="600" fill="#101418">${esc(product)}</text>`);
      y += sub.length ? 24 : 6;
    }
    if (sub.length) {
      parts.push(`<text x="${cx}" y="${y}" text-anchor="middle" font-family="${SANS}" font-size="15" fill="#6b7680">${sub.join("   \u00b7   ")}</text>`);
      y += 6;
    }
  }

  const H = Math.round(y + PAD);
  const svg =
`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" rx="28" fill="#fff"/>
<rect x="3" y="3" width="${W - 6}" height="${H - 6}" rx="25" fill="none" stroke="#d7dbe0" stroke-width="3"/>
${parts.join("\n")}
</svg>`;
  return { svg, width: W, height: H };
}
