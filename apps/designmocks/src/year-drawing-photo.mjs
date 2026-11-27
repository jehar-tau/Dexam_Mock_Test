// The canvas exports only decoded pixels, removing EXIF (including GPS).
export async function yearDrawingPhoto(file) {
  if (!file.size || file.size > 12 * 1024 * 1024) throw new Error("Choose a photo up to 12 MB.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode().catch(() => { throw new Error("This browser couldn’t read that photo. Export a JPEG or PNG and try again."); });
    const scale = Math.min(1, 2000 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your photo could not be prepared.");
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const jpeg = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!jpeg || jpeg.type !== "image/jpeg") throw new Error("Your photo could not be prepared.");
    return new File([jpeg], "drawing.jpg", { type: "image/jpeg" });
  } finally { URL.revokeObjectURL(url); }
}
