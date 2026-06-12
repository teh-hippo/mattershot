import { parseMatterPayload, manualPairingCode, formatPairingCode } from "./matter.js";
import { buildLabelSVG } from "./label.js";

const LS = { location: "mattershot.location", next: "mattershot.nextNumber", numbering: "mattershot.numbering" };
const DCL = "https://on.dcl.csa-iot.org/dcl/model/models";

const $ = (id) => document.getElementById(id);
const el = {
  scanBtn: $("scanBtn"), fileInput: $("fileInput"), pasteBtn: $("pasteBtn"),
  scanArea: $("scanArea"), video: $("video"), cancelScan: $("cancelScan"), scanMsg: $("scanMsg"),
  result: $("result"), labelImg: $("labelImg"),
  product: $("product"), location: $("location"),
  numbering: document.querySelector(".numbering"), numberOn: $("numberOn"), itemNumber: $("itemNumber"),
  dlPng: $("dlPng"), dlSvg: $("dlSvg"), saveMsg: $("saveMsg"),
};

let current = null;
let scanStream = null;

// ---- persisted state -------------------------------------------------------
const loadNext = () => Math.max(0, parseInt(localStorage.getItem(LS.next) || "1", 10) || 1);
const saveNext = (n) => localStorage.setItem(LS.next, String(n));
const pad = (n) => String(n).padStart(2, "0");

el.location.value = localStorage.getItem(LS.location) || "";
el.numberOn.checked = localStorage.getItem(LS.numbering) !== "off";
el.itemNumber.value = loadNext();
applyNumberingUI();

function applyNumberingUI() {
  el.numbering.classList.toggle("off", !el.numberOn.checked);
}

// ---- helpers ---------------------------------------------------------------
function clean(s) {
  return String(s || "").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "").replace(/\s+/g, " ").trim();
}
function fileBase() {
  const parts = [clean(el.product.value) || "Unknown"];
  const loc = clean(el.location.value);
  if (loc) parts.push(loc);
  if (el.numberOn.checked && current && current.number != null) parts.push(pad(current.number));
  return parts.join("-");
}
function scanMsg(text, isError) {
  el.scanMsg.hidden = !text;
  el.scanMsg.textContent = text || "";
  el.scanMsg.className = "msg" + (isError ? " err" : "");
}
function showSave(text) {
  el.saveMsg.hidden = false;
  el.saveMsg.textContent = text;
}

// ---- scanning --------------------------------------------------------------
el.scanBtn.addEventListener("click", startCamera);
el.cancelScan.addEventListener("click", stopCamera);
el.pasteBtn.addEventListener("click", () => {
  const v = prompt("Paste the Matter code (starts with MT:)");
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
async function handlePayload(text) {
  let parsed;
  try { parsed = parseMatterPayload(text); }
  catch (err) { scanMsg(err.message, true); return; }
  scanMsg("");
  if (current) cleanup(current);

  const code = manualPairingCode(parsed);
  current = {
    raw: parsed.raw, pairingFmt: formatPairingCode(code),
    number: el.numberOn.checked ? loadNext() : null, committed: false, previewUrl: null,
  };
  if (el.numberOn.checked) el.itemNumber.value = current.number;
  el.saveMsg.hidden = true;
  el.result.hidden = false;
  el.result.scrollIntoView({ behavior: "smooth", block: "start" });

  el.product.value = "";
  el.product.placeholder = "Looking up product\u2026";
  regen();

  const name = await lookupProduct(parsed.vendorId, parsed.productId);
  el.product.placeholder = "e.g. Eve Energy";
  if (name && !el.product.value) { el.product.value = name; regen(); }
}

function regen() {
  if (!current) return;
  const itemLabel = el.numberOn.checked && current.number != null ? "#" + pad(current.number) : "";
  const built = buildLabelSVG({
    qrText: current.raw, productName: el.product.value, location: el.location.value,
    itemLabel, pairingCode: current.pairingFmt,
  });
  current.svg = built.svg; current.w = built.width; current.h = built.height;
  current.base = fileBase();

  if (current.previewUrl) URL.revokeObjectURL(current.previewUrl);
  current.previewUrl = URL.createObjectURL(new Blob([built.svg], { type: "image/svg+xml" }));
  el.labelImg.src = current.previewUrl;

  const ready = !!clean(el.product.value);
  el.dlPng.disabled = !ready;
  el.dlSvg.disabled = !ready;
  el.saveMsg.hidden = true;
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
el.product.addEventListener("input", regen);
el.location.addEventListener("input", () => {
  localStorage.setItem(LS.location, el.location.value);
  regen();
});
el.itemNumber.addEventListener("input", () => {
  const n = Math.max(0, parseInt(el.itemNumber.value || "1", 10) || 1);
  if (current) { current.number = n; if (!current.committed) saveNext(n); }
  regen();
});
el.numberOn.addEventListener("change", () => {
  localStorage.setItem(LS.numbering, el.numberOn.checked ? "on" : "off");
  applyNumberingUI();
  if (current && el.numberOn.checked && current.number == null) {
    current.number = loadNext();
    el.itemNumber.value = current.number;
  }
  regen();
});

// ---- downloads -------------------------------------------------------------
el.dlSvg.addEventListener("click", () => {
  if (!current || el.dlSvg.disabled) return;
  downloadBlob(new Blob([current.svg], { type: "image/svg+xml" }), current.base + ".svg");
  commit();
});
el.dlPng.addEventListener("click", async () => {
  if (!current || el.dlPng.disabled) return;
  el.dlPng.disabled = true;
  try {
    const blob = await svgToPng(current.svg, current.w, current.h, 3);
    downloadBlob(blob, current.base + ".png");
    commit();
  } catch (err) {
    showSave("PNG export failed: " + err.message);
  } finally {
    el.dlPng.disabled = !clean(el.product.value);
  }
});

function commit() {
  if (el.numberOn.checked && current.number != null) {
    if (!current.committed) { current.committed = true; saveNext(current.number + 1); }
    showSave(`Saved ${current.base}. Next item: ${pad(loadNext())}.`);
  } else {
    showSave(`Saved ${current.base}.`);
  }
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
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
