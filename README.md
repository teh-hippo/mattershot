# Mattershot

Turns physical Matter codes into high-res digital variants.

Scan the QR code on a Matter device with your phone. Mattershot decodes the `MT:` onboarding
payload and regenerates it as a clean, Matter-style label, so the backup is lossless and stays
sharp at any size, unlike a photo of the printed sticker. Each label carries the Matter mark,
the regenerated QR, the manual pairing code, and your own product, location and item-number
fields. You download it as SVG (vector) and a high-resolution PNG.

Everything runs in your browser. Nothing is uploaded anywhere, except an optional product-name
lookup (see Privacy below).

## Using it

1. Open the app on your phone: <https://teh-hippo.github.io/mattershot/>
2. Tap **Scan QR code** and point the camera at a device's Matter QR code. You can also use the
   subtle **photo / image** or **enter code manually** options.
3. The label appears straight away. The product name is filled in from the public device
   registry where available; edit it if you like.
4. **Location** is optional and is remembered between scans. **Number items** is an optional
   toggle; when on, the **Item Number** advances by one after each download.
5. Tap **Download PNG** or **Download SVG**. On iOS, choose your OneDrive folder
   (for example `pi/Matter`) when saving.

Files are named `<Product>-<Location>-<Number>`, dropping any field you leave out. The number is
zero-padded to two digits starting at `01`.

## Why regenerate instead of photographing?

A photo of a printed QR code can be blurry, skewed or glare-affected, which makes it harder to
scan later. Mattershot reads the exact payload and re-encodes it, giving a clean QR that scans
reliably. SVG is vector, so it never pixelates.

## Privacy

All decoding and label generation happen on your device. The only network call is an optional
lookup of the product name from the public Connectivity Standards Alliance
[Distributed Compliance Ledger](https://webui.dcl.csa-iot.org/), which receives only the device's
numeric Vendor and Product IDs. If the lookup fails or the device is not listed, just type the
product name yourself.

## How it works

- `matter.js` decodes the base-38 `MT:` payload and computes the manual pairing code
  (Verhoeff check digit).
- [`jsQR`](https://github.com/cozmo/jsQR) reads QR codes from the camera or an image.
- [`qrcode`](https://github.com/soldair/node-qrcode) regenerates the QR module matrix.
- `label.js` composes the Matter-style label as a self-contained SVG; the PNG is rasterised from
  that SVG in a canvas.
- State (location, the running number, and the numbering toggle) is kept in `localStorage`.

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
