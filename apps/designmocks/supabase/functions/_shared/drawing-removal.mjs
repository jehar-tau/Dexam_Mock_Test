export function isDrawingRemovalPath(path) {
  return typeof path === "string" && /^drawings\/[a-zA-Z0-9_-]{1,120}\.(?:png|jpe?g|webp)$/.test(path);
}

export async function finishDrawingRemoval({ id, storagePath, remove, confirm }) {
  if (!isDrawingRemovalPath(storagePath)) return false;
  try { await remove(storagePath); }
  catch { /* The private file may already be gone despite the missing reply. */ }
  try { return await confirm(id, storagePath) === true; }
  catch { return false; }
}
