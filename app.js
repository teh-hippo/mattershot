import { parseMatterPayload, hex4 } from "./matter.js";

const QR_OPTS = { errorCorrectionLevel: "M", margin: 4 };
const PNG_WIDTH = 1024;
const LS = { location: "mattershot.location", next: "mattershot.nextNumber" };
const DCL = "https://on.dcl.csa-iot.org/dcl/model/models";

const $ = (id) => document.getElementById(id);
const el = {
  location: $("location"), nextNumber: $("nextNumber"),
  scanBtn: $("scanBtn"), fileInput: $("fileInput"), pasteBtn: $("pasteBtn"),
  scanArea: $("scanArea"), video: $("video"), cancelScan: $("cancelScan"), scanMsg: $("scanMsg"),
  result: $("result"), qrCanvas: $("qrCanvas"), decodeInfo: $("decodeInfo"),
  product: $("product"), fnPng: $("fnPng"), fnSvg: $("fnSvg"),
  saveBtn: $("saveBtn"), dlPng: $("dlPng"), dlSvg: $("dlSvg"),
  saveMsg: $("saveMsg"), nextBtn: $("nextBtn"),
};

let current = null;        // { raw, vid, pid, number, committed, pngUrl, svgUrl }
let scanStream = null;

// ---- persisted state -------------------------------------------------------
function loadNext() { return Math.max(0, parseInt(localStorage.getItem(LS.next) || "1", 10) || 1); }
function saveNext(n) { localStorage.setItem(LS.next, String(n)); }
function pad(n) { return String(n).padStart(2, "0"); }

el.location.value = localStorage.getItem(LS.location) || "";
el.nextNumber.value = loadNext();
el.location.addEventListener("input", () => {
  localStorage.setItem(LS.location, el.location.value);
  refreshNames();
});
el.nextNumber.addEventListener("input", () => {
  const n = Math.max(0, parseInt(el.nextNumber.value || "1", 10) || 1);
  saveNext(n);
  if (current && !current.committed) current.number = n;
  refreshNames();
});

// ---- filename --------------------------------------------------------------
function clean(s) {
  return String(s || "").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "").replace(/\s+/g, " ").trim();
}
function fileBase() {
  const product = clean(el.product.value) || "Unknown";
  const location = clean(el.location.value) || "Unknown";
  const num = pad(current ? current.number : loadNext());
  return `${product}-${location}-${num}`;
}
function refreshNames() {
  if (!current) return;
  const base = fileBase();
  el.fnPng.textContent = base + ".png";
  el.fnSvg.textContent = base + ".svg";
  el.dlPng.download = base + ".png";
  el.dlSvg.download = base + ".svg";
}

// ---- messaging -------------------------------------------------------------
function scanMsg(text, isError) {
  el.scanMsg.hidden = !text;
  el.scanMsg.textContent = text || "";
  el.scanMsg.className = "msg" + (isError ? " err" : "");
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
    scanMsg("Camera not available. Use Photo / image or Paste instead.", true);
    return;
  }
  try {
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
  } catch (err) {
    scanMsg("Camera permission denied. Use Photo / image or Paste instead.", true);
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
    if (code && code.data) {
      stopCamera();
      handlePayload(code.data);
      return;
    }
  }
  requestAnimationFrame(scanTick);
}

async function decodeImageFile(file) {
  scanMsg("Reading image...");
  try {
    const bitmap = await createImageBitmap(file);
    const c = document.createElement("canvas");
    c.width = bitmap.width; c.height = bitmap.height;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0);
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const code = jsQR(img.data, img.width, img.height);
    if (code && code.data) { scanMsg(""); handlePayload(code.data); }
    else scanMsg("No QR code found in that image. Try again or paste the MT: code.", true);
  } catch (err) {
    scanMsg("Could not read that image. " + err.message, true);
  }
}

// ---- decode + regenerate ---------------------------------------------------
async function handlePayload(text) {
  let parsed;
  try {
    parsed = parseMatterPayload(text);
  } catch (err) {
    scanMsg(err.message, true);
    return;
  }
  scanMsg("");
  if (current) revokeUrls(current);
  current = { raw: parsed.raw, vid: parsed.vendorId, pid: parsed.productId, number: loadNext(), committed: false };

  el.decodeInfo.textContent = `Vendor ${hex4(parsed.vendorId)} \u00b7 Product ${hex4(parsed.productId)}`;
  el.saveMsg.hidden = true;

  await renderQr(parsed.raw);
  el.result.hidden = false;
  el.result.scrollIntoView({ behavior: "smooth", block: "start" });

  el.product.value = "";
  el.product.placeholder = "Looking up product\u2026";
  refreshNames();

  const name = await lookupProduct(parsed.vendorId, parsed.productId);
  el.product.placeholder = "e.g. Eve Energy";
  if (name && !el.product.value) el.product.value = name;
  refreshNames();
}

async function renderQr(payload) {
  await QRCode.toCanvas(el.qrCanvas, payload, { ...QR_OPTS, width: PNG_WIDTH });
  const pngBlob = await new Promise((res) => el.qrCanvas.toBlob(res, "image/png"));
  const svgStr = await QRCode.toString(payload, { ...QR_OPTS, type: "svg" });
  const svgBlob = new Blob([svgStr], { type: "image/svg+xml" });
  current.pngBlob = pngBlob;
  current.svgBlob = svgBlob;
  current.pngUrl = URL.createObjectURL(pngBlob);
  current.svgUrl = URL.createObjectURL(svgBlob);
  el.dlPng.href = current.pngUrl;
  el.dlSvg.href = current.svgUrl;
}

function revokeUrls(item) {
  if (item.pngUrl) URL.revokeObjectURL(item.pngUrl);
  if (item.svgUrl) URL.revokeObjectURL(item.svgUrl);
}

async function lookupProduct(vid, pid) {
  try {
    const r = await fetch(`${DCL}/${vid}/${pid}`, { mode: "cors" });
    if (!r.ok) return null;
    const j = await r.json();
    const m = j && j.model;
    return (m && (m.productName || m.productLabel)) || null;
  } catch {
    return null;
  }
}

// ---- save ------------------------------------------------------------------
el.product.addEventListener("input", refreshNames);

el.saveBtn.addEventListener("click", async () => {
  if (!current) return;
  if (!clean(el.product.value)) { showSave("Enter a product name first.", true); return; }
  const base = fileBase();
  const pngFile = new File([current.pngBlob], base + ".png", { type: "image/png" });
  const svgFile = new File([current.svgBlob], base + ".svg", { type: "image/svg+xml" });

  let shared = false;
  if (navigator.canShare) {
    let files = null;
    if (navigator.canShare({ files: [pngFile, svgFile] })) files = [pngFile, svgFile];
    else if (navigator.canShare({ files: [pngFile] })) files = [pngFile];
    if (files) {
      try { await navigator.share({ files, title: "Matter QR backup", text: base }); shared = true; }
      catch (err) { if (err.name === "AbortError") return; }
    }
  }
  if (!shared) { triggerDownload(el.dlPng); triggerDownload(el.dlSvg); }
  commit(base);
});

[el.dlPng, el.dlSvg].forEach((a) =>
  a.addEventListener("click", () => { if (current) commit(fileBase()); })
);

function triggerDownload(anchor) {
  const a = document.createElement("a");
  a.href = anchor.href; a.download = anchor.download;
  document.body.appendChild(a); a.click(); a.remove();
}

function commit(base) {
  if (!current) return;
  if (!current.committed) {
    current.committed = true;
    saveNext(current.number + 1);
    el.nextNumber.value = loadNext();
  }
  showSave(`Saved ${base}. Next number: ${pad(loadNext())}.`, false);
}

function showSave(text, isError) {
  el.saveMsg.hidden = false;
  el.saveMsg.textContent = text;
  el.saveMsg.className = "msg " + (isError ? "err" : "ok");
}

el.nextBtn.addEventListener("click", () => {
  if (current) revokeUrls(current);
  current = null;
  el.result.hidden = true;
  el.saveMsg.hidden = true;
  scanMsg("");
  window.scrollTo({ top: 0, behavior: "smooth" });
});
