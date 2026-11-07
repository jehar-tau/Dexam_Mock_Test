const exams = new Set(["uceed", "nid", "nift", "ceed"]);
const text = value => typeof value === "string" ? value.trim() : "";

export function learningPracticeLink(lesson) {
  const exam = text(lesson?.exam).toLowerCase(), topic = text(lesson?.topic);
  const params = new URLSearchParams();
  if (exams.has(exam)) {
    params.set("exam", exam);
    if (topic) params.set("topic", topic);
  }
  return {
    to: `/dashboard/practice${params.size ? `?${params}` : ""}`,
    label: params.has("topic") ? "Practise this topic" : "Browse practice",
  };
}

export function practicePools(catalog, count = 10) {
  return catalog.filter(item => exams.has(item?.exam) && typeof item.topic === "string" && item.topic.trim()
    && Number.isInteger(item.questions) && item.questions >= count);
}

export function practiceSelection(catalog, { exam: requestedExam = "", topic: requestedTopic = "" } = {}) {
  const exam = text(requestedExam).toLowerCase(), topic = text(requestedTopic), pools = practicePools(catalog);
  const empty = notice => ({ exam: "", topic: "", notice });
  const selected = pool => ({ exam: pool.exam, topic: pool.topic, notice: "" });
  if (requestedExam && !exams.has(exam)) {
    return empty("That practice exam is unavailable. Choose an exam and topic.");
  }
  if (requestedTopic && typeof requestedTopic !== "string") {
    return empty("That practice topic is unavailable. Choose an exam and topic.");
  }
  if (exam) {
    const examPools = pools.filter(item => item.exam === exam);
    if (!examPools.length) return empty(`Practice for ${exam.toUpperCase()} is not ready yet. Choose another exam and topic.`);
    if (!topic) return selected(examPools[0]);
    const match = examPools.find(item => item.topic === topic);
    return match ? selected(match) : { exam, topic: "", notice: `Practice for this topic is not ready for ${exam.toUpperCase()} yet. Choose another topic or exam.` };
  }
  if (topic) {
    const matches = pools.filter(item => item.topic === topic);
    if (matches.length === 1) return selected(matches[0]);
    return empty(matches.length ? "This topic is available in several exams. Choose the exam you want to practise."
      : "Practice for this topic is not ready yet. Choose an exam and topic.");
  }
  return pools.length ? selected(pools[0]) : empty("");
}
