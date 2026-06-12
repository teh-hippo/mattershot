# Mattershot

Back up the QR codes on your Matter devices as crisp, re-scannable images.

Scan a device's Matter QR code with your phone. Mattershot decodes the `MT:` onboarding
payload and regenerates a pristine QR code from it, so the backup is lossless and stays
sharp at any size, unlike a photo of the label. You name it by product, location and a
running number, then save it.

Everything runs in your browser. Nothing is uploaded anywhere, except an optional product
name lookup (see Privacy below).

## Using it

1. Open the app on your phone: <https://teh-hippo.github.io/mattershot/>
2. Set the **Location** once (it is remembered). The **Next number** advances automatically.
3. Tap **Scan QR code** and point the camera at a device's Matter QR code. You can also use
   **Photo / image** or **Paste MT: code**.
4. The product name is filled in from the public device registry where available. Edit it if
   you like.
5. Tap **Save backup**. On iOS the share sheet opens; choose your OneDrive folder
   (for example `pi/Matter`). Both an SVG and a high-resolution PNG are produced.
6. The number increments after each successful save. Tap **Scan next** for the next device.

Files are named `<Product>-<Location>-<Number>.svg` and `.png`, with the number zero-padded
to two digits starting at `01`.

## Why regenerate instead of photographing?

A photo of a printed QR code can be blurry, skewed or glare-affected, which makes it harder
to scan later. Mattershot reads the exact payload and re-encodes it, giving a clean QR that
scans reliably. SVG is vector, so it never pixelates.

## Privacy

All decoding and QR generation happen on your device. The only network call is an optional
lookup of the product name from the public Connectivity Standards Alliance
[Distributed Compliance Ledger](https://webui.dcl.csa-iot.org/), which receives only the
device's numeric Vendor and Product IDs. If the lookup fails or the device is not listed,
just type the product name yourself.

## How it works

- `matter.js` decodes the base-38 `MT:` payload into its fields (Vendor ID, Product ID, and
  so on).
- [`jsQR`](https://github.com/cozmo/jsQR) reads QR codes from the camera or an image.
- [`qrcode`](https://github.com/soldair/node-qrcode) regenerates the QR as SVG and PNG.
- State (location and the running number) is kept in `localStorage`.

It is a static site with no build step. The two libraries are vendored in `vendor/`.

## Local development

Serve the folder over HTTP (a secure context is needed for the camera; `localhost` counts):

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```
