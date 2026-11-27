const unreadable = "This photo couldn’t be read. Export it as JPEG or PNG and try again.";

async function decodeHeic(file) {
  const bytes = await file.arrayBuffer();
  const header = new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 64));
  const brand = new TextDecoder("latin1").decode(header);
  if (brand.slice(4, 8) !== "ftyp" || !/heic|heix|hevc|hevx|mif1|msf1/.test(brand.slice(8))) {
    throw new Error(unreadable);
  }
  const worker = new Worker(new URL("./year-drawing-heic-worker.mjs", import.meta.url), { type: "module" });
  try {
    return await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(unreadable)), 30000);
      worker.onerror = () => { clearTimeout(timeout); reject(new Error(unreadable)); };
      worker.onmessage = ({ data }) => {
        clearTimeout(timeout);
        if (data instanceof ArrayBuffer && data.byteLength) resolve(new File([data], "drawing.jpg", { type: "image/jpeg" }));
        else reject(new Error(unreadable));
      };
      worker.postMessage(bytes, [bytes]);
    });
  } finally {
    worker.terminate();
  }
}

// Native image decoding respects EXIF orientation. Export only rasterized pixels.
export async function yearDrawingPhoto(file, turns = 0) {
  if (!file.size || file.size > 12 * 1024 * 1024) throw new Error("Choose a photo up to 12 MB.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    try { await image.decode(); }
    catch {
      const converted = await decodeHeic(file);
      return turns === 0 ? converted : yearDrawingPhoto(converted, turns);
    }
    const scale = Math.min(1, 2000 / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = turns % 2 ? height : width;
    canvas.height = turns % 2 ? width : height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your photo could not be prepared.");
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate(turns * Math.PI / 2);
    context.drawImage(image, -width / 2, -height / 2, width, height);
    const jpeg = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!jpeg || jpeg.type !== "image/jpeg") throw new Error("Your photo could not be prepared.");
    return new File([jpeg], "drawing.jpg", { type: "image/jpeg" });
  } finally { URL.revokeObjectURL(url); }
}
