import { isHumanTask, nidPracticeSchema, validateNidPracticeBlueprint } from './nid-practice-blueprint.js';
import { answerAlternativesLabel, numericAnswerLabel } from "./answer-key.js";
export const initialBankFilters = { exam: "", type: "", status: "pending", topic: "", search: "", limit: 25 };

export function nidQuestionPractice(question) {
  const binding = question?.nidPractice?.binding, blueprint = binding?.blueprint;
  if (String(question?.exam ?? '').toLowerCase() !== 'nid' || binding?.current !== true || binding.externalKey !== question.externalKey || binding.contentSha256 !== question.contentSha256 ||
      blueprint?.status !== 'reviewed' || blueprint.revision !== blueprint.currentRevision || !Number.isInteger(blueprint.revision) || blueprint.revision < 1 || !/^[a-f0-9]{64}$/.test(blueprint.sha256 ?? '')) return null;
  try { validateNidPracticeBlueprint(blueprint.payload); } catch { return null; }
  const section = blueprint.payload.sections[binding.sectionOrdinal - 1];
  if (!section || (isHumanTask(section.kind) ? question.type !== 'DESCRIPTIVE' : question.type?.toLowerCase() !== section.kind)) return null;
  return { binding, blueprint, section };
}
export function practiceApprovalReady(question) {
  if (String(question?.exam ?? '').toLowerCase() !== 'nid') return true;
  const practice = nidQuestionPractice(question), context = question.context;
  return Boolean(practice && question.nidPractice.materialized === true && question.runtimeReady === true && context?.version === nidPracticeSchema &&
    context.bindingId === practice.binding.id && context.blueprintId === practice.blueprint.id && context.blueprintRevision === practice.blueprint.revision && context.blueprintSha256 === practice.blueprint.sha256);
}

export function bankSearchInput(filters, offset = 0) {
  return {
    p_exam: filters.exam || null, p_type: filters.type || null, p_status: filters.status,
    p_topic: filters.topic.trim() || null, p_search: filters.search.trim() || null,
    p_limit: Number(filters.limit), p_offset: offset,
  };
}

export function sourceAnswerLabel(answer) {
  if (answer == null) return "Awaiting verification";
  const raw = typeof answer === "object" && !Array.isArray(answer) ? answer.raw : answer;
  const text = Array.isArray(raw) ? raw.join(", ") : String(raw ?? "");
  if (!text.trim()) return "Awaiting verification";
  return answer.status === "pending" ? `${text} · pending verification` : text;
}

export function deliveryAnswerLabel(key) {
  if (!key) return "Awaiting conversion";
  const alternatives = answerAlternativesLabel(key);
  if (alternatives) return alternatives;
  if (["mcq", "msq"].includes(key.kind) && Array.isArray(key.correct)) return key.correct.join(", ");
  if (key.kind === "nat" && Array.isArray(key.accepted)) {
    return key.accepted.map(value => numericAnswerLabel(value) ?? "Awaiting verification").join(" or ");
  }
  return key.kind === "drawing" ? "Human review against the task rubric" : "Awaiting verification";
}

export function questionUsage(question) {
  const exam = String(question?.exam ?? "").toLowerCase();
  const type = String(question?.type ?? "").toUpperCase();
  const practice = nidQuestionPractice(question);
  if (practice) {
    const { section, blueprint } = practice, human = isHumanTask(section.kind);
    return { section: `Authored practice · ${section.label}`, mode: human ? 'Uploaded response with human rubric evaluation' : 'Authored objective practice',
      scoring: human ? `${section.points} maximum marks · reviewed practice rubric` : `+${section.points} correct · −${section.penalty} wrong${section.kind === 'msq' ? ' · complete correct set only' : ''}`,
      duration: `${blueprint.payload.durationMinutes} practice minutes${blueprint.payload.uploadGraceMinutes ? ` · ${blueprint.payload.uploadGraceMinutes} minutes to upload completed pages` : ''}` };
  }
  if (exam === "nift") {
    if (type === "MCQ") return { section: "B.Des. GAT", mode: "Timed objective question", scoring: "+1 correct · −0.25 wrong", duration: "Within the 120-minute GAT paper" };
    return { section: "CAT / creative practice", mode: "Uploaded response with human evaluation", scoring: "Rubric and maximum marks must be assigned", duration: "Practice-only until the CAT blueprint is verified" };
  }
  if (exam === "nid") return type === "DESCRIPTIVE"
    ? { section: "DAT Prelims creative practice", mode: "Uploaded drawing or written response", scoring: "Human evaluation against an approved rubric", duration: "Practice-only until the NID blueprint is verified" }
    : { section: "DAT Prelims aptitude practice", mode: "Objective practice question", scoring: "Marks require a verified NID blueprint", duration: "Practice-only until the NID blueprint is verified" };
  if (["uceed", "ceed"].includes(exam) && type === "DESCRIPTIVE") return {
    section: "Part B", mode: "Uploaded drawing or design response", scoring: "Human evaluation", duration: question?.context?.durationSeconds ? `${question.context.durationSeconds / 60} minutes for Part B` : "Uses the verified Part B clock after conversion",
  };
  return {
    section: ["uceed", "ceed"].includes(exam) ? "Part A" : "Practice bank",
    mode: type === "NAT" ? "Numeric-answer question" : type === "MSQ" ? "Multiple-select question" : "Single-choice question",
    scoring: question?.marking ? `+${question.marking.correct} correct · ${question.marking.wrong} wrong${question.marking.partial ? " · partial credit" : ""}` : "Uses the verified exam marking rule after conversion",
    duration: question?.context?.durationSeconds ? `${question.context.durationSeconds / 60} minutes for the section` : "Within the verified timed section",
  };
}

export function conversionChecklist(question) {
  const availability = [];
  if (question?.active === false || question?.holdReason)
    availability.push({state:'blocked',label:'Resolve the current inactive status or question hold before approval.'});
  if (question?.media?.some(figure => !figure.available))
    availability.push({state:'fix',label:'Import and verify every required private question figure.'});
  if (question?.exam === 'nid' && nidQuestionPractice(question)) return [
    { state: practiceApprovalReady(question) ? 'ready' : 'queue', label: practiceApprovalReady(question) ? 'Converted with a reviewed DMocks-authored practice context; separate exact-question approval is required.' : 'Practice binding reviewed; run the guarded conversion, then review this exact question.' }, ...availability,
  ];
  if (question?.runtimeReady && question?.exam !== 'nid') return [
    { state: "ready", label: question.type==='DESCRIPTIVE' ? 'Converted with a verified exam context and human-review marking.' : "Converted with a verified exam context and answer key." },
    ...availability,
  ];
  const exam = String(question?.exam ?? "").toLowerCase();
  const type = String(question?.type ?? "").toUpperCase();
  const issues = [...availability];
  if (exam === "nid") issues.push({ state: "blocked", label: "Verify the NID delivery blueprint, timing and marking/rubric before conversion." });
  if (exam === "nift" && type !== "MCQ") issues.push({ state: "blocked", label: "Model the applicable NIFT creative/CAT section and its human-review rubric." });
  const raw = typeof question?.answer === "object" && !Array.isArray(question.answer) ? question.answer?.raw : question?.answer;
  if (type !== "DESCRIPTIVE" && (raw == null || !String(raw).trim() || question?.answer?.status === "pending"))
    issues.push({ state: "fix", label: "Verify and save a complete answer key." });
  if (["MCQ", "MSQ"].includes(type)) {
    const keys=Array.isArray(question?.options)?question.options.map(option=>option?.key??option?.id):[];
    const fourChoices=['uceed','ceed'].includes(exam)||(exam==='nift'&&type==='MCQ');
    if ((fourChoices ? keys.length!==4 : keys.length<2) || keys.some(key=>typeof key!=='string'||!key.trim()) || new Set(keys).size!==keys.length)
      issues.push({ state: "fix", label: fourChoices ? "Provide exactly four uniquely labelled options." : "Provide at least two uniquely labelled options before verifying the exam blueprint." });
    else if (question.options.some(option => !String(option?.text ?? "").trim()) && !(question?.media?.length > 0))
      issues.push({ state: "fix", label: "Restore missing option text or attach the complete labelled question figure." });
  }
  if (!issues.length) issues.push({ state: "queue", label: "Run the verified runtime materializer, then review the exact converted version." });
  return issues;
}

export function bankReviewImages(images, expected) {
  if (!Array.isArray(images) || images.length !== expected.length ||
    new Set(images.map(image => image?.ordinal)).size !== expected.length ||
    images.some(image => !expected.some(figure => figure.ordinal === image?.ordinal) || typeof image?.url !== "string" || !image.url)) {
    throw new Error("The question figures are incomplete. Refresh the figures before approving.");
  }
  return [...images].sort((left, right) => left.ordinal - right.ordinal);
}
