const extensions = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const statuses = new Set(["uploaded", "extracting", "extracted", "failed", "reviewed"]);
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;

export async function intakeSourceDigest(bytes) {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(hash, byte => byte.toString(16).padStart(2, "0")).join("");
}

const reply = (status, error) => ({ status, body: { error } });
const unconfirmed = () => reply(503, "Could not confirm the private source. Refresh intake or retry the same file.");
const conflict = () => reply(409, "The retained private source does not match the selected file.");

export async function saveIntakeSource({ admin, actorId, name, mimeType, bytes }) {
  const [nameDigest, sourceSha256] = await Promise.all([
    intakeSourceDigest(new TextEncoder().encode(name)), intakeSourceDigest(bytes),
  ]);
  const path = `intake/${actorId}/sources/${nameDigest}-${sourceSha256}.${extensions[mimeType]}`;
  const bucket = admin.storage.from("question-intake");
  let uploaded;
  try {
    uploaded = await bucket.upload(path, bytes, { contentType: mimeType, upsert: false });
  } catch {
    // Storage may have committed before the connection was interrupted.
  }
  if (!uploaded?.data || uploaded.error) {
    try {
      const { data: existing, error } = await bucket.download(path);
      if (error || !existing) return unconfirmed();
      if (existing.size !== bytes.byteLength || await intakeSourceDigest(await existing.arrayBuffer()) !== sourceSha256) {
        return conflict();
      }
    } catch {
      return unconfirmed();
    }
  }

  // A missing acknowledgement is ambiguous. Retain the private object so a
  // later exact retry can verify and reuse it, including after a database commit.
  let saved;
  try {
    saved = await admin.rpc("register_question_intake_source", {
      p_uploaded_by: actorId, p_original_name: name, p_mime_type: mimeType,
      p_byte_size: bytes.byteLength, p_source_sha256: sourceSha256,
    });
  } catch {
    return unconfirmed();
  }
  if (saved?.error?.code === "42501") return reply(403, "Admin access required");
  if (saved?.error?.code === "22023") return conflict();
  const receipt = saved?.data;
  if (saved?.error || !uuid.test(receipt?.id ?? "") || receipt.name !== name ||
    !statuses.has(receipt.status) || receipt.sourceSha256 !== sourceSha256 || typeof receipt.reused !== "boolean") {
    return unconfirmed();
  }
  return { status: 200, body: { id: receipt.id, name: receipt.name, status: receipt.status, reused: receipt.reused } };
}
