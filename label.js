// Compose a Matter-style label as a self-contained SVG: brand mark + wordmark,
// the regenerated QR, the manual pairing code, and our own fields.

const W = 380;        // label width (user units)
const PAD = 30;       // inner padding
const QR_SIZE = 248;  // drawn QR size including quiet zone
const QUIET = 4;      // quiet-zone modules

const SANS = "'Avenir Next','Segoe UI Variable','Segoe UI',system-ui,-apple-system,Roboto,sans-serif";
const MONO = "ui-monospace,'SF Mono','Cascadia Code','Roboto Mono','Courier New',monospace";

// Official Matter logo (inward-pointing mark + "matter" wordmark) as a single path.
// Source: Wikimedia Commons, File:Logo of Matter connectivity standard.svg (public domain).
const LOGO_VB = { w: 338.667, h: 72.644 };
const MATTER_LOGO = "M294.697 60.122c6.777 0 12.314-3.055 15.781-7.762l-3.725-2.121c-2.691 3.415-6.831 5.641-12.056 5.641-8.464 0-14.985-5.832-15.666-13.294h33.565c.024-.441.05-.881.05-1.293 0-10.397-8.482-18.831-18.854-18.831s-18.802 8.435-18.802 18.832 8.43 18.829 19.706 18.829zm-.877-33.419c7.068 0 13.213 5.068 14.568 11.796h-29.139c1.346-6.727 7.455-11.796 14.571-11.796zm-99.896-4.243c-10.398 0-18.83 8.435-18.83 18.833s8.432 18.83 18.83 18.83c6.281 0 11.468-3.078 14.59-7.806v7.082h4.24V23.184h-4.24v7.082c-3.122-4.728-8.309-7.806-14.59-7.806zm0 4.243c8.07 0 14.59 6.518 14.59 14.59s-6.52 14.587-14.59 14.587a14.57 14.57 0 0 1-14.587-14.587c0-8.072 6.517-14.59 14.587-14.59zM65.715 32.905c-7.996 2.19-15.164 7.406-19.636 15.152s-5.407 16.568-3.306 24.587l7.835-4.526a23.9 23.9 0 0 1 1.105-11.836l18.309 10.569 4.303-2.487v-4.967L56.016 48.829a23.92 23.92 0 0 1 9.699-6.879zm-57.108 0v9.045a23.91 23.91 0 0 1 9.699 6.879L0 59.398v4.967l4.303 2.487 18.306-10.569c1.39 3.868 1.726 7.938 1.108 11.836l7.832 4.526c2.101-8.02 1.167-16.841-3.306-24.587A32.52 32.52 0 0 0 8.607 32.905zM337.063 22.46c-8.542 0-15.466 6.448-15.466 15.47v21.469h4.243V37.93c0-6.68 5.025-11.227 11.223-11.227h1.604V22.46zm-213.131 0c-8.542 0-15.466 6.448-15.466 15.47v21.469h4.243V37.93c0-6.68 5.023-11.227 11.223-11.227s11.227 4.547 11.227 11.227v21.469h4.243V37.93c0-6.68 5.023-11.227 11.223-11.227s11.227 4.547 11.227 11.227v21.469h4.243V37.93c0-9.021-6.927-15.47-15.47-15.47-5.535 0-10.576 2.848-13.37 8.642-2.845-5.741-7.84-8.642-13.323-8.642zm108.531-11.636l-4.24 2.43v9.931h-5.691v4.087h5.691v23.847c0 4.605 3.621 8.279 8.225 8.279h6.307v-4.243h-6.307c-2.175 0-3.986-1.811-3.986-4.087V27.271h21.574v23.847c0 4.605 3.619 8.279 8.171 8.279h6.364v-4.243h-6.364c-2.12 0-3.929-1.811-3.929-4.087V27.271h10.293v-4.087H258.28v-12.36l-4.243 2.43v9.931h-21.574zM37.161 0l-4.303 2.484v21.138c-4.046-.731-7.736-2.476-10.804-4.961l-7.838 4.522c5.895 5.83 14 9.429 22.946 9.429s17.051-3.599 22.946-9.429l-7.835-4.522a23.92 23.92 0 0 1-10.807 4.961V2.484z";

let _mctx;
function measure(text, font) {
  if (!_mctx) _mctx = document.createElement("canvas").getContext("2d");
  _mctx.font = font;
  return _mctx.measureText(text).width;
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
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

  // Official Matter logo (mark + wordmark), centred at the top.
  const logoW = 190;
  const ls = logoW / LOGO_VB.w;
  const lx = (W - logoW) / 2;
  parts.push(`<g transform="translate(${lx.toFixed(2)} ${y}) scale(${ls.toFixed(5)})"><path d="${MATTER_LOGO}" fill="#101418"/></g>`);
  y += LOGO_VB.h * ls + 24;

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
