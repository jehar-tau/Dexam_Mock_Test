export function learningDraftInput(form, lesson) {
  const value = (field) => String(form.get(field) ?? "").trim();
  const slug = value("slug").toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("Use words separated by hyphens for the lesson URL.");
  return {
    p_id: lesson?.id ?? null,
    p_expected_version: lesson?.version ?? null,
    p_slug: slug,
    p_exam: value("exam"),
    p_topic: value("topic"),
    p_title: value("title"),
    p_summary: value("summary"),
    p_body: value("body"),
    p_ordinal: Number(value("ordinal")),
  };
}

export function learningPublicationInput(lesson, note) {
  const reason = String(note ?? "").trim();
  if (reason.length < 5 || reason.length > 1000) throw new Error("Give a reason between 5 and 1,000 characters.");
  return { p_id: lesson.id, p_expected_version: lesson.version, p_publish: !lesson.published, p_reason: reason };
}
