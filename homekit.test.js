import { test, expect } from "bun:test";
import { parseHomeKitPayload, categoryName } from "./homekit.js";

// Fixtures encoded with the canonical hap-nodejs setupURI() algorithm:
// "X-HM://" + base36(payload, 9 chars) + 4-char setup ID.
test("decodes the 8-digit setup code as the low 27 bits", () => {
  expect(parseHomeKitPayload("X-HM://0053EOVG1AB12").setupCode).toBe("84131633");
  expect(parseHomeKitPayload("X-HM://00713L3UQWXYZ").setupCode).toBe("03145154");
  expect(parseHomeKitPayload("X-HM://0080RMC0EABCD").setupCode).toBe("12345678");
});

test("zero-pads short setup codes to eight digits", () => {
  expect(parseHomeKitPayload("X-HM://0023GXK3K1QJ8").setupCode).toBe("00000000");
});

test("decodes the accessory category and its friendly name", () => {
  expect(parseHomeKitPayload("X-HM://0053EOVG1AB12").category).toBe(5);
  expect(parseHomeKitPayload("X-HM://0053EOVG1AB12").categoryName).toBe("Lightbulb");
  // Outlet (7) is an odd category: confirms the unsigned bit maths is correct.
  expect(parseHomeKitPayload("X-HM://00713L3UQWXYZ").category).toBe(7);
  expect(parseHomeKitPayload("X-HM://00713L3UQWXYZ").categoryName).toBe("Outlet");
});

test("extracts the 4-character setup ID", () => {
  expect(parseHomeKitPayload("X-HM://0053EOVG1AB12").setupId).toBe("AB12");
});

test("preserves the full raw payload for lossless regeneration", () => {
  expect(parseHomeKitPayload("  X-HM://0053EOVG1AB12  ").raw).toBe("X-HM://0053EOVG1AB12");
});

test("tags the result as a HomeKit payload", () => {
  expect(parseHomeKitPayload("X-HM://0053EOVG1AB12").type).toBe("homekit");
});

test("rejects strings without the X-HM:// prefix", () => {
  expect(() => parseHomeKitPayload("MT:Y.K9042C00KA0648G00")).toThrow(/X-HM/);
});

test("rejects truncated payloads", () => {
  expect(() => parseHomeKitPayload("X-HM://0053")).toThrow(/too short/);
});

test("categoryName returns empty string for unknown categories", () => {
  expect(categoryName(1)).toBe("");
  expect(categoryName(999)).toBe("");
});
