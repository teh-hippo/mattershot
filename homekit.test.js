import assert from "node:assert/strict";
import test from "node:test";
import { parseHomeKitPayload, categoryName } from "./homekit.js";

// Fixtures encoded with the canonical hap-nodejs setupURI() algorithm:
// "X-HM://" + base36(payload, 9 chars) + 4-char setup ID.
test("decodes the 8-digit setup code as the low 27 bits", () => {
  assert.equal(parseHomeKitPayload("X-HM://0053EOVG1AB12").setupCode, "84131633");
  assert.equal(parseHomeKitPayload("X-HM://00713L3UQWXYZ").setupCode, "03145154");
  assert.equal(parseHomeKitPayload("X-HM://0080RMC0EABCD").setupCode, "12345678");
});

test("zero-pads short setup codes to eight digits", () => {
  assert.equal(parseHomeKitPayload("X-HM://0023GXK3K1QJ8").setupCode, "00000000");
});

test("decodes the accessory category and its friendly name", () => {
  assert.equal(parseHomeKitPayload("X-HM://0053EOVG1AB12").category, 5);
  assert.equal(parseHomeKitPayload("X-HM://0053EOVG1AB12").categoryName, "Lightbulb");
  // Outlet (7) is an odd category: confirms the unsigned bit maths is correct.
  assert.equal(parseHomeKitPayload("X-HM://00713L3UQWXYZ").category, 7);
  assert.equal(parseHomeKitPayload("X-HM://00713L3UQWXYZ").categoryName, "Outlet");
});

test("extracts the 4-character setup ID", () => {
  assert.equal(parseHomeKitPayload("X-HM://0053EOVG1AB12").setupId, "AB12");
});

test("preserves the full raw payload for lossless regeneration", () => {
  assert.equal(parseHomeKitPayload("  X-HM://0053EOVG1AB12  ").raw, "X-HM://0053EOVG1AB12");
});

test("tags the result as a HomeKit payload", () => {
  assert.equal(parseHomeKitPayload("X-HM://0053EOVG1AB12").type, "homekit");
});

test("rejects strings without the X-HM:// prefix", () => {
  assert.throws(() => parseHomeKitPayload("MT:Y.K9042C00KA0648G00"), /X-HM/);
});

test("rejects truncated payloads", () => {
  assert.throws(() => parseHomeKitPayload("X-HM://0053"), /too short/);
});

test("categoryName returns empty string for unknown categories", () => {
  assert.equal(categoryName(1), "");
  assert.equal(categoryName(999), "");
});
