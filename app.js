import jsQR from "jsqr";
import { parseMatterPayload, manualPairingCode, formatPairingCode } from "./matter.js";
import { parseHomeKitPayload } from "./homekit.js";
import { buildLabelSVG } from "./label.js";

const LS = { location: "mattershot.location", next: "mattershot.nextNumber" };
const DCL = "https://on.dcl.csa-iot.org/dcl/model/models";

const $ = (id) => document.getElementById(id);
const el = {
  scanBtn: $("scanBtn"), fileInput: $("fileInput"), pasteBtn: $("pasteBtn"),
  scanArea: $("scanArea"), video: $("video"), cancelScan: $("cancelScan"), scanMsg: $("scanMsg"),
  result: $("result"), labelImg: $("labelImg"),
  manufacturer: $("manufacturer"), manufacturerField: $("manufacturerField"),
  product: $("product"), location: $("location"),
  itemNumber: $("itemNumber"), numMinus: $("numMinus"), numPlus: $("numPlus"),
  dlPng: $("dlPng"), dlSvg: $("dlSvg"),
};

let current = null;
let scanStream = null;

// ---- numbering state -------------------------------------------------------
// localStorage `next`: "" means numbering is off; otherwise the next number.
const pad = (n) => String(n).padStart(2, "0");
const rawNext = () => { const v = localStorage.getItem(LS.next); return v === null ? "1" : v; };
const numberingOn = () => rawNext() !== "";
const nextNum = () => (numberingOn() ? Math.max(0, parseInt(rawNext(), 10) || 0) : null);
const setNext = (n) => localStorage.setItem(LS.next, n == null ? "" : String(n));

el.location.value = localStorage.getItem(LS.location) || "";
el.itemNumber.value = numberingOn() ? nextNum() : "";

// ---- helpers ---------------------------------------------------------------
function clean(s) {
  return String(s || "").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "").replace(/\s+/g, " ").trim();
}
function fileBase() {
  const parts = [];
  if (current && current.type === "homekit") {
    const mfr = clean(el.manufacturer.value);
    if (mfr) parts.push(mfr);
  }
  parts.push(clean(el.product.value) || "Unknown");
  const loc = clean(el.location.value);
  if (loc) parts.push(loc);
  if (current && current.number != null) parts.push(pad(current.number));
  return parts.join("-");
}
function scanMsg(text, isError) {
  el.scanMsg.hidden = !text;
  el.scanMsg.textContent = text || "";
  el.scanMsg.className = "msg" + (isError ? " err" : "");
}

// ---- scanning --------------------------------------------------------------
el.scanBtn.addEventListener("click", startCamera);
el.cancelScan.addEventListener("click", stopCamera);
el.pasteBtn.addEventListener("click", () => {
  const v = prompt("Paste a Matter (MT:) or HomeKit (X-HM://) code");
  if (v) handlePayload(v);
});
el.fileInput.addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  if (file) await decodeImageFile(file);
  e.target.value = "";
});

async function startCamera() {
  scanMsg("");
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    scanMsg("Camera not available. Use photo / image or enter the code instead.", true);
    return;
  }
  try {
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
  } catch {
    scanMsg("Camera permission denied. Use photo / image or enter the code instead.", true);
    return;
  }
  el.video.srcObject = scanStream;
  el.scanArea.hidden = false;
  await el.video.play().catch(() => {});
  requestAnimationFrame(scanTick);
}

function stopCamera() {
  if (scanStream) { scanStream.getTracks().forEach((t) => t.stop()); scanStream = null; }
  el.video.srcObject = null;
  el.scanArea.hidden = true;
}

function scanTick() {
  if (!scanStream) return;
  const v = el.video;
  if (v.readyState >= v.HAVE_ENOUGH_DATA && v.videoWidth) {
    const c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(v, 0, 0, c.width, c.height);
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
    if (code && code.data) { stopCamera(); handlePayload(code.data); return; }
  }
  requestAnimationFrame(scanTick);
}

async function decodeImageFile(file) {
  scanMsg("Reading image\u2026");
  try {
    const bitmap = await createImageBitmap(file);
    const c = document.createElement("canvas");
    c.width = bitmap.width; c.height = bitmap.height;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0);
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const code = jsQR(img.data, img.width, img.height);
    if (code && code.data) { scanMsg(""); handlePayload(code.data); }
    else scanMsg("No QR code found in that image. Try again or enter the code.", true);
  } catch (err) {
    scanMsg("Could not read that image. " + err.message, true);
  }
}

// ---- decode + label --------------------------------------------------------
function parsePayload(text) {
  return String(text || "").trim().startsWith("X-HM://")
    ? parseHomeKitPayload(text)
    : parseMatterPayload(text);
}

async function handlePayload(text) {
  let parsed;
  try { parsed = parsePayload(text); }
  catch (err) { scanMsg(err.message, true); return; }
  scanMsg("");
  if (current) cleanup(current);

  current = {
    type: parsed.type, raw: parsed.raw, setupCode: parsed.setupCode,
    pairingFmt: parsed.type === "matter" ? formatPairingCode(manualPairingCode(parsed)) : "",
    number: nextNum(), committed: false, previewUrl: null,
  };
  el.itemNumber.value = current.number == null ? "" : current.number;
  el.manufacturerField.hidden = parsed.type !== "homekit";
  el.result.hidden = false;
  el.result.scrollIntoView({ behavior: "smooth", block: "start" });

  if (parsed.type === "homekit") {
    // No public registry for HomeKit: pre-fill the category as a hint instead.
    el.manufacturer.value = "";
    el.product.placeholder = "e.g. Eve Energy";
    el.product.value = parsed.categoryName;
    regen();
    return;
  }

  el.product.value = "";
  el.product.placeholder = "Looking up product\u2026";
  regen();

  const name = await lookupProduct(parsed.vendorId, parsed.productId);
  el.product.placeholder = "e.g. Eve Energy";
  if (name && !el.product.value) { el.product.value = name; regen(); }
}

function regen() {
  if (!current) return;
  const itemLabel = current.number != null ? "#" + pad(current.number) : "";
  const built = buildLabelSVG({
    type: current.type, qrText: current.raw,
    productName: el.product.value, location: el.location.value, itemLabel,
    pairingCode: current.pairingFmt,
    setupCode: current.setupCode, manufacturer: el.manufacturer.value,
  });
  current.svg = built.svg; current.w = built.width; current.h = built.height;
  current.base = fileBase();

  if (current.previewUrl) URL.revokeObjectURL(current.previewUrl);
  current.previewUrl = URL.createObjectURL(new Blob([built.svg], { type: "image/svg+xml" }));
  el.labelImg.src = current.previewUrl;

  current.pngBlob = null;
  schedulePng();

  const ready = !!clean(el.product.value);
  el.dlPng.disabled = !ready;
  el.dlSvg.disabled = !ready;
}

// Pre-rasterise the PNG so the save tap can share it synchronously on iOS.
let pngToken = 0;
let pngTimer;
function schedulePng() {
  clearTimeout(pngTimer);
  const token = ++pngToken;
  const svg = current && current.svg, w = current && current.w, h = current && current.h;
  if (!svg) return;
  pngTimer = setTimeout(async () => {
    try {
      const blob = await svgToPng(svg, w, h, 3);
      if (token === pngToken && current) current.pngBlob = blob;
    } catch { /* will rasterise on demand */ }
  }, 120);
}

function cleanup(item) {
  if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
}

async function lookupProduct(vid, pid) {
  try {
    const r = await fetch(`${DCL}/${vid}/${pid}`, { mode: "cors" });
    if (!r.ok) return null;
    const m = (await r.json()).model;
    return (m && (m.productName || m.productLabel)) || null;
  } catch {
    return null;
  }
}

// ---- field reactivity ------------------------------------------------------
el.manufacturer.addEventListener("input", regen);
el.product.addEventListener("input", regen);
el.location.addEventListener("input", () => {
  localStorage.setItem(LS.location, el.location.value);
  regen();
});

function onItemInput() {
  const raw = el.itemNumber.value.trim();
  if (raw === "") {
    setNext(null);
    if (current) current.number = null;
  } else {
    const n = Math.max(0, parseInt(raw, 10) || 0);
    setNext(n);
    if (current && !current.committed) current.number = n;
  }
  regen();
}
el.itemNumber.addEventListener("input", onItemInput);

function step(delta) {
  const raw = el.itemNumber.value.trim();
  let n;
  if (raw === "") {
    if (delta < 0) return;            // nothing to decrement from
    n = nextNum() != null ? nextNum() : 1;
  } else {
    n = Math.max(0, (parseInt(raw, 10) || 0) + delta);
  }
  el.itemNumber.value = n;
  onItemInput();
}
el.numMinus.addEventListener("click", () => step(-1));
el.numPlus.addEventListener("click", () => step(1));

// ---- saving (iOS share sheet where available, download otherwise) ----------
el.dlSvg.addEventListener("click", () => save("svg"));
el.dlPng.addEventListener("click", () => save("png"));

async function save(kind) {
  if (!current || !clean(el.product.value)) return;
  let file;
  if (kind === "svg") {
    file = new File([current.svg], current.base + ".svg", { type: "image/svg+xml" });
  } else {
    const blob = current.pngBlob || (await svgToPng(current.svg, current.w, current.h, 3));
    file = new File([blob], current.base + ".png", { type: "image/png" });
  }
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: current.base });
    } catch (err) {
      if (err.name === "AbortError") return;   // cancelled: don't save or advance
      downloadFile(file);                       // share failed: fall back to a download
    }
  } else {
    downloadFile(file);
  }
  commit();
}

// Increment once per scanned item, after a successful save.
function commit() {
  if (current && current.number != null && !current.committed) {
    current.committed = true;
    setNext(current.number + 1);
  }
}

function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url; a.download = file.name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function svgToPng(svg, w, h, scale) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = Math.round(w * scale); c.height = Math.round(h * scale);
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png");
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("could not rasterise SVG")); };
    img.src = url;
  });
}
