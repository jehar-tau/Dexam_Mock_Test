const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
const instant = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT/.test(value) && Number.isFinite(Date.parse(value));
const finite = value => typeof value === 'number' && Number.isFinite(value);

export function ownedYearPaperAttempts(input) {
  if (!Array.isArray(input) || input.length > 1000) throw new Error('Could not verify your paper attempts.');
  const attempts = new Map();
  const seen = new Set();
  for (const item of input) {
    if (!item || typeof item !== 'object' || Array.isArray(item) || !uuid(item.paperId) ||
        !uuid(item.attemptId) || !['active', 'submitted'].includes(item.status) || !instant(item.startedAt) ||
        typeof item.resultsPending !== 'boolean' ||
        (item.score !== null && !finite(item.score)) ||
        (item.total !== null && (!finite(item.total) || item.total < 0)) ||
        ((item.status === 'active' || item.resultsPending) && (item.score !== null || item.total !== null)) ||
        (item.status === 'submitted' && !item.resultsPending && (item.score === null || item.total === null))) {
      throw new Error('Could not verify your paper attempts.');
    }
    const key = `${item.paperId}:${item.status}`;
    if (seen.has(key)) throw new Error('Could not verify your paper attempts.');
    seen.add(key);
    const row = attempts.get(item.paperId) ?? { active: null, submitted: null };
    row[item.status] = { id: item.attemptId, startedAt: item.startedAt,
      resultsPending: item.resultsPending, score: item.score, total: item.total };
    attempts.set(item.paperId, row);
  }
  return attempts;
}
