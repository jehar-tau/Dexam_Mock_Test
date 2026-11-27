import { ImageMagick, initializeImageMagick, MagickFormat, ResourceLimits } from "@imagemagick/magick-wasm";
import codecUrl from "@imagemagick/magick-wasm/magick.wasm?url";

// A fresh worker bounds each decode and keeps unsupported phone photos on-device.
self.onmessage = async ({ data }) => {
  try {
    const response = await fetch(codecUrl);
    if (!response.ok) throw new Error();
    await initializeImageMagick(new Uint8Array(await response.arrayBuffer()));
    ResourceLimits.width = 12000n;
    ResourceLimits.height = 12000n;
    ResourceLimits.area = 50000000n;
    ResourceLimits.memory = 256n * 1024n * 1024n;
    ResourceLimits.disk = 0n;
    ResourceLimits.listLength = 8n;
    const jpeg = ImageMagick.read(new Uint8Array(data), MagickFormat.Heic, image => {
      image.autoOrient();
      if (Math.max(image.width, image.height) > 2000) image.resize(2000, 2000);
      image.strip();
      image.quality = 90;
      return image.write(MagickFormat.Jpeg, bytes => new Uint8Array(bytes));
    });
    self.postMessage(jpeg.buffer, [jpeg.buffer]);
  } catch {
    self.postMessage(null);
  }
};
