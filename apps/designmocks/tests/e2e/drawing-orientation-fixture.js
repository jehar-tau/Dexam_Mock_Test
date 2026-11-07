import { readFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";
import { prepareDrawingImage } from "../../supabase/functions/_shared/drawing-image.mjs";

const crc = bytes => {
  let value = 0xffffffff;
  for (const byte of bytes) { value ^= byte; for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ value >>> 1 : value >>> 1; }
  return (value ^ 0xffffffff) >>> 0;
};
function exif(value) {
  return Buffer.from([77,77,0,42,0,0,0,8,0,1,1,18,0,3,0,0,0,1,0,value,0,0,0,0,0,0]);
}
function withOrientation(bytes, mime, orientation) {
  const payload = exif(orientation);
  if (mime === "image/jpeg") {
    const start = bytes.indexOf(Buffer.from("Exif\0\0")) - 4, end = start + 2 + bytes.readUInt16BE(start + 2);
    const segment = Buffer.concat([Buffer.from([255,225,0,34]),Buffer.from("Exif\0\0"),payload]);
    return Buffer.concat([bytes.subarray(0,start),segment,bytes.subarray(end)]);
  }
  const parts = [bytes.subarray(0,mime === "image/png" ? 8 : 12)];
  for (let at = parts[0].length; at < bytes.length;) {
    const png = mime === "image/png", size = png ? bytes.readUInt32BE(at) : bytes.readUInt32LE(at + 4);
    const type = bytes.toString("ascii",at+(png?4:0),at+(png?8:4)), end = at+size+(png?12:8+size%2);
    if (type === "eXIf" || type === "EXIF") {
      const chunk = Buffer.alloc(payload.length+(png?12:8));
      if (png) { chunk.writeUInt32BE(payload.length);chunk.write("eXIf",4);chunk.set(payload,8);chunk.writeUInt32BE(crc(chunk.subarray(4,-4)),chunk.length-4); }
      else { chunk.write("EXIF");chunk.writeUInt32LE(payload.length,4);chunk.set(payload,8); }
      parts.push(chunk);
    } else parts.push(bytes.subarray(at,end));
    at=end;
  }
  const result = Buffer.concat(parts);if(mime === "image/webp")result.writeUInt32LE(result.length-8,4);return result;
}

export async function orientationPages(orientation) {
  const pages=[];
  for (const [ordinal,ext,mimeType] of [[1,"png","image/png"],[2,"jpg","image/jpeg"],[3,"webp","image/webp"]]) {
    const input=await readFile(new URL(`../fixtures/drawing-images/fictional-drawing.${ext}`,import.meta.url));
    const checked=await prepareDrawingImage(input,mimeType);
    const updated=await prepareDrawingImage(withOrientation(Buffer.from(checked.bytes),mimeType,orientation),mimeType);
    pages.push({id:"fictional-page-"+ordinal,ordinal,mimeType,width:updated.width,height:updated.height,orientation:updated.orientation,
      url:`data:${mimeType};base64,${Buffer.from(updated.bytes).toString("base64")}`});
  }
  return pages;
}

export function largeDrawingPage() {
  const chunk = (type,payload) => {
    const out=Buffer.alloc(payload.length+12);out.writeUInt32BE(payload.length);out.write(type,4);out.set(payload,8);
    out.writeUInt32BE(crc(out.subarray(4,-4)),out.length-4);return out;
  };
  const header=Buffer.alloc(13);header.writeUInt32BE(2400);header.writeUInt32BE(1600,4);header[8]=8;header[9]=2;
  const bytes=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk("IHDR",header),chunk("IDAT",deflateSync(Buffer.alloc(1600*(2400*3+1)))),chunk("IEND",Buffer.alloc(0))]);
  return {id:"fictional-large-page",ordinal:1,mimeType:"image/png",width:2400,height:1600,orientation:1,url:"data:image/png;base64,"+bytes.toString("base64")};
}
