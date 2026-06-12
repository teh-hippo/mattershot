# Mattershot

Back up and digitise physical Matter and HomeKit codes.

Scan the QR code on a Matter or HomeKit device with your phone. Mattershot detects the code type,
decodes the `MT:` (Matter) or `X-HM://` (HomeKit) onboarding payload, and regenerates it as a clean,
ecosystem-style label, so the backup is lossless and stays sharp at any size, unlike a photo of the
printed sticker. A Matter label carries the Matter mark, the regenerated QR and the manual pairing
code; a HomeKit label carries the house mark and the eight-digit setup code as the familiar grid of
two rows of four. Both add your own product, location and item-number fields. You download it as SVG
(vector) and a high-resolution PNG.

Everything runs in your browser. Nothing is uploaded anywhere, except an optional product-name
lookup (see Privacy below).

## Using it

1. Open the app on your phone: <https://teh-hippo.github.io/mattershot/>
2. Tap **Scan QR code** and point the camera at a device's Matter or HomeKit QR code. You can also
   use the subtle **photo / image** or **enter code manually** options.
3. The label appears straight away. For Matter, the product name is filled in from the public device
   registry where available; for HomeKit, it is pre-filled with the accessory category (for example
   Lightbulb). Edit it if you like. HomeKit also shows a **Manufacturer** field, which is included in
   the file name.
4. **Location** and **Item Number** are both optional and are remembered between scans. Use the
   **&minus;** / **+** buttons to adjust the number; it advances by one after each download. Clear
   the field to leave numbering out entirely.
5. Tap **Save PNG** or **Save SVG**. On iOS the share sheet opens, so you can choose
   **Save to Files** and pick your OneDrive folder (for example `pi/Matter`) or send it to another
   app. On desktop it downloads.

Files are named `<Product>-<Location>-<Number>`, dropping any field you leave out; HomeKit files are
prefixed with `<Manufacturer>` when you set it. The number is zero-padded to two digits starting at
`01`.

## Why regenerate instead of photographing?

A photo of a printed QR code can be blurry, skewed or glare-affected, which makes it harder to
scan later. Mattershot reads the exact payload and re-encodes it, giving a clean QR that scans
reliably. SVG is vector, so it never pixelates.

## Privacy

All decoding and label generation happen on your device. The only network call is an optional
lookup of the product name from the public Connectivity Standards Alliance
[Distributed Compliance Ledger](https://webui.dcl.csa-iot.org/), which receives only the device's
numeric Vendor and Product IDs (Matter only). If the lookup fails or the device is not listed, just
type the product name yourself. HomeKit codes are decoded entirely on device with no network call.

## How it works

- `matter.js` decodes the base-38 `MT:` payload and computes the manual pairing code
  (Verhoeff check digit).
- `homekit.js` decodes the base-36 `X-HM://` payload: the eight-digit setup code is the low 27 bits,
  and the accessory category is read from the high bits. The code type is detected from the payload
  prefix (`MT:` or `X-HM://`).
- [`jsQR`](https://github.com/cozmo/jsQR) reads QR codes from the camera or an image.
- [`qrcode`](https://github.com/soldair/node-qrcode) regenerates the QR module matrix.
- `label.js` composes the Matter- or HomeKit-style label as a self-contained SVG; the PNG is
  rasterised from that SVG in a canvas. The saved file is shared via the Web Share API on iOS, or
  downloaded.
- State (location, the running number, and whether numbering is on) is kept in `localStorage`.

The Matter logo is the official mark from
[Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Logo_of_Matter_connectivity_standard.svg)
(public domain). The HomeKit house mark is an original glyph drawn in `label.js`, not Apple's
trademarked artwork.

It is a static site with no build step. The two libraries are vendored in `vendor/`.

## Local development

Serve the folder over HTTP (a secure context is needed for the camera; `localhost` counts):

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

Run the decoder and pairing-code tests with [Bun](https://bun.sh):

```sh
bun test
```
