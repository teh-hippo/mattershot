import { test, expect } from "bun:test";
import { parseMatterPayload, hex4 } from "./matter.js";

// Canonical CHIP test onboarding payload.
test("decodes the canonical Matter test QR payload", () => {
  const p = parseMatterPayload("MT:Y.K9042C00KA0648G00");
  expect(p.vendorId).toBe(0xfff1);
  expect(p.productId).toBe(0x8000);
  expect(p.discriminator).toBe(3840);
  expect(p.passcode).toBe(20202021);
});

test("preserves the full raw payload for lossless regeneration", () => {
  expect(parseMatterPayload("  MT:Y.K9042C00KA0648G00  ").raw).toBe("MT:Y.K9042C00KA0648G00");
});

test("rejects strings without the MT: prefix", () => {
  expect(() => parseMatterPayload("https://example.com")).toThrow(/MT:/);
});

test("hex4 formats IDs to four uppercase digits", () => {
  expect(hex4(0xfff1)).toBe("0xFFF1");
  expect(hex4(0)).toBe("0x0000");
});
