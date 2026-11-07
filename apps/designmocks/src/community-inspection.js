export function communityImageKey(image) {
  return typeof image?.id==="string"&&image.id&&typeof image.url==="string"&&image.url
    ? JSON.stringify([image.id,image.url]):null;
}
export function communityImageSelection(images,key) {
  if(!Array.isArray(images)||typeof key!=="string")return null;
  const matches=images.map((image,index)=>({image,index,key:communityImageKey(image)})).filter(item=>item.key===key);
  return matches.length===1?matches[0]:null;
}
