import assert from "node:assert/strict";
import test from "node:test";
import { parseMatterPayload, hex4, manualPairingCode, formatPairingCode } from "./matter.js";

// Canonical CHIP test onboarding payload.
test("decodes the canonical Matter test QR payload", () => {
  const p = parseMatterPayload("MT:Y.K9042C00KA0648G00");
  assert.equal(p.vendorId, 0xfff1);
  assert.equal(p.productId, 0x8000);
  assert.equal(p.discriminator, 3840);
  assert.equal(p.passcode, 20202021);
});

test("preserves the full raw payload for lossless regeneration", () => {
  assert.equal(parseMatterPayload("  MT:Y.K9042C00KA0648G00  ").raw, "MT:Y.K9042C00KA0648G00");
});

test("rejects strings without the MT: prefix", () => {
  assert.throws(() => parseMatterPayload("https://example.com"), /MT:/);
});

test("hex4 formats IDs to four uppercase digits", () => {
  assert.equal(hex4(0xfff1), "0xFFF1");
  assert.equal(hex4(0), "0x0000");
});

test("computes and formats the manual pairing code", () => {
  const v = parseMatterPayload("MT:Y.K9042C00KA0648G00");
  assert.equal(manualPairingCode(v), "34970112332");
  assert.equal(formatPairingCode("34970112332"), "3497-011-2332");
});
