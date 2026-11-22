import { withAccountDeadline } from './account-request.js';

const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);

export async function loadReleasedYearPapers(client, catalogue, signal, deadlineMs = 10000) {
  return withAccountDeadline(async active => {
    const { data, error } = await client.rpc('free_year_paper_catalog').abortSignal(active);
    if (error) throw error;
    releasedYearPaperMap(data, catalogue);
    return data;
  }, signal, deadlineMs);
}

export function releasedYearPaperMap(releases, catalogue) {
  if (!Array.isArray(releases)) throw new Error('Invalid year-paper catalogue');
  const known = new Map(catalogue.map(paper => [paper.id, paper]));
  const mapped = new Map();
  const seenIds = new Set();
  for (const release of releases) {
    const source = known.get(`${release?.exam}:${release?.sourcePaperId}`);
    if (!source || !uuid(release.paperId) || seenIds.has(release.paperId) ||
        release.year !== source.year || !Number.isSafeInteger(release.questionCount) ||
        release.questionCount < 1 || release.questionCount > source.objectiveCount ||
        !Number.isSafeInteger(release.durationSeconds) || release.durationSeconds < 60 ||
        release.durationSeconds > 21600 || typeof release.partLabel !== 'string' ||
        release.partLabel.trim().length < 2 || release.partLabel.length > 40) {
      throw new Error('Invalid year-paper catalogue');
    }
    seenIds.add(release.paperId);
    const rows = mapped.get(source.id) ?? [];
    if (rows.some(row => row.partLabel === release.partLabel)) throw new Error('Duplicate year-paper part');
    rows.push({paperId: release.paperId, partLabel: release.partLabel, questionCount: release.questionCount,
      durationSeconds: release.durationSeconds});
    mapped.set(source.id, rows);
  }
  return mapped;
}
