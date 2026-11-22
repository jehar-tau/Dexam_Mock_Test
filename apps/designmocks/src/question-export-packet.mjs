import { ownerAdjudicationEvidenceReady } from "../scripts/question-runtime.mjs";

const digestPattern = /^[a-f0-9]{64}$/;
const uuidPattern = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const externalKeyPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const maxPayloadBytes = 512 * 1024;

const record = value => value !== null && typeof value === "object" && !Array.isArray(value);
const invalid = () => new Error("Couldn’t verify this export packet. Refresh the review queue and try again.");

export async function verifyQuestionExportPacket(input, expected = {}) {
  if (!record(input) || input.format !== "dmocks-question-export-v1" || input.publicationState !== "git-review-required" ||
      typeof input.artifactId !== "string" || !uuidPattern.test(input.artifactId) ||
      typeof input.externalKey !== "string" || !externalKeyPattern.test(input.externalKey) ||
      typeof input.contentSha256 !== "string" || !digestPattern.test(input.contentSha256) ||
      !["manual", "pdf", "photo", "ai"].includes(input.sourceType) ||
      typeof input.rightsNote !== "string" || input.rightsNote.length > 2000 ||
      Array.from(input.rightsNote.trim()).length < 10 || Array.from(input.rightsNote).length > 1000 ||
      typeof input.createdAt !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(input.createdAt) ||
      !Number.isFinite(Date.parse(input.createdAt)) || typeof input.payloadText !== "string" ||
      input.payloadText.length > maxPayloadBytes ||
      ["artifactId", "externalKey", "contentSha256"].some(key => expected[key] !== undefined && input[key] !== expected[key])) {
    throw invalid();
  }

  const bytes = new TextEncoder().encode(input.payloadText);
  if (bytes.length > maxPayloadBytes) throw invalid();
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  if (Array.from(hash, byte => byte.toString(16).padStart(2, "0")).join("") !== input.contentSha256) throw invalid();

  let payload;
  try { payload = JSON.parse(input.payloadText); } catch { throw invalid(); }
  if (!record(payload) || payload.externalKey !== input.externalKey ||
      !Array.isArray(payload.holds) || payload.holds.length !== 0 ||
      typeof payload.prompt !== "string" || payload.prompt.trim().length < 3 ||
      !["MCQ", "MSQ", "NAT", "DESCRIPTIVE"].includes(payload.type) ||
      !["uceed", "ceed", "nid", "nift"].includes(payload.provenance?.exam)) throw invalid();
  if (payload.answer?.status === "owner-adjudicated" &&
      (payload.type === "DESCRIPTIVE" || !["pdf", "photo"].includes(input.sourceType) ||
       !ownerAdjudicationEvidenceReady(payload))) throw invalid();

  const { format, artifactId, externalKey, contentSha256, payloadText, rightsNote, createdAt, sourceType, publicationState } = input;
  return { packet: { format, artifactId, externalKey, contentSha256, payloadText, rightsNote, createdAt, sourceType, publicationState }, payload };
}
