// Decode a HomeKit setup payload ("X-HM://..." QR string) into its fields.
// Reference: HomeKit Accessory Protocol, Setup Payload; bit layout cross-checked
// against the hap-nodejs setupURI() algorithm (homebridge/HAP-NodeJS).
//
// Layout: "X-HM://" + 9-char base-36 payload + 4-char setup ID (plaintext).
// The base-36 payload packs (from the least-significant bit):
//   setup code  bits 0-26  (the 8-digit code, 0-99999999)
//   flags       bits 27-30 (pairing transport: IP/BLE/etc.)
//   category    bit 31 + bits 32-38 (accessory category, see CATEGORY_NAMES)
//   reserved    bits 39-42
//   version     bits 43-45

const PREFIX = "X-HM://";

// HAP accessory categories. Names are friendly product hints, not the enum constants.
const CATEGORY_NAMES = {
  2: "Bridge", 3: "Fan", 4: "Garage Door Opener", 5: "Lightbulb", 6: "Lock",
  7: "Outlet", 8: "Switch", 9: "Thermostat", 10: "Sensor", 11: "Security System",
  12: "Door", 13: "Window", 14: "Window Covering", 15: "Programmable Switch",
  16: "Range Extender", 17: "Camera", 18: "Video Doorbell", 19: "Air Purifier",
  20: "Heater", 21: "Air Conditioner", 22: "Humidifier", 23: "Dehumidifier",
  24: "Apple TV", 25: "HomePod", 26: "Speaker", 27: "AirPort", 28: "Sprinkler",
  29: "Faucet", 30: "Shower Head", 31: "Television", 32: "Remote", 33: "Router",
  34: "Receiver", 35: "Set-top Box", 36: "Streaming Stick",
};

export function categoryName(category) {
  return CATEGORY_NAMES[category] || "";
}

function base36Decode(str) {
  let value = 0;
  for (const ch of str) {
    const d = parseInt(ch, 36);
    if (Number.isNaN(d)) throw new Error(`Invalid HomeKit code character: ${ch}`);
    value = value * 36 + d;
  }
  return value;
}

export function parseHomeKitPayload(text) {
  const t = String(text || "").trim();
  if (!t.startsWith(PREFIX)) throw new Error('Not a HomeKit QR code (missing "X-HM://" prefix).');
  const body = t.slice(PREFIX.length);
  if (body.length < 9) throw new Error("HomeKit payload too short.");

  // The first 9 characters are the base-36 payload; remaining characters are the setup ID.
  const payload = base36Decode(body.slice(0, 9));
  const setupId = body.slice(9);

  // Unsigned bit extraction (values stay well under 2^53, so Number maths is exact).
  const setupCode = String(payload % 2 ** 27).padStart(8, "0");
  const category = (Math.floor(payload / 2 ** 31) % 2) + ((Math.floor(payload / 2 ** 32) % 128) << 1);

  return { type: "homekit", setupCode, category, categoryName: categoryName(category), setupId, raw: t };
}
