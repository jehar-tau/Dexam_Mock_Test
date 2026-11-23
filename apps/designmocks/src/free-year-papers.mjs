import { withAccountDeadline } from './account-request.js';

const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);

export async function loadReleasedYearPapers(client, signal, deadlineMs = 10000) {
  return withAccountDeadline(async active => {
    const { data, error } = await client.rpc('free_year_paper_catalog').abortSignal(active);
    if (error) throw error;
    releasedYearPaperMap(data);
    return data;
  }, signal, deadlineMs);
}

export function releasedYearPaperMap(releases) {
  if (!Array.isArray(releases)) throw new Error('Invalid year-paper catalogue');
  const mapped = new Map();
  const seenIds = new Set();
  for (const release of releases) {
    const sourceId = `${release?.exam}:${release?.sourcePaperId}`;
    if (!['uceed','ceed','nift','nid'].includes(release?.exam) ||
        !Number.isSafeInteger(release.year) || release.year < 2000 || release.year > 2100 ||
        typeof release.sourcePaperId !== 'string' || !/^[a-z0-9-]{4,100}$/.test(release.sourcePaperId) ||
        !uuid(release.paperId) || seenIds.has(release.paperId) ||
        !Number.isSafeInteger(release.questionCount) ||
        release.questionCount < 1 || release.questionCount > 200 ||
        !Number.isSafeInteger(release.durationSeconds) || release.durationSeconds < 60 ||
        release.durationSeconds > 21600 || typeof release.partLabel !== 'string' ||
        release.partLabel.trim().length < 2 || release.partLabel.length > 40) {
      throw new Error('Invalid year-paper catalogue');
    }
    seenIds.add(release.paperId);
    const rows = mapped.get(sourceId) ?? [];
    if (rows.length && rows[0].year !== release.year) throw new Error('Conflicting year-paper release');
    if (rows.some(row => row.partLabel === release.partLabel)) throw new Error('Duplicate year-paper part');
    rows.push({paperId: release.paperId, partLabel: release.partLabel, questionCount: release.questionCount,
      durationSeconds: release.durationSeconds, year: release.year});
    mapped.set(sourceId, rows);
  }
  return mapped;
}

export function releasedYearPaperGroups(releases) {
  const mapped = releasedYearPaperMap(releases);
  const exams = ['uceed','ceed','nift','nid'];
  return [...mapped].map(([id,parts]) => {
    const [exam, ...source] = id.split(':');
    return {id, exam, paperId: source.join(':'), year: parts[0].year,
      questionCount: parts.reduce((total, part) => total + part.questionCount, 0)};
  }).sort((a,b) => exams.indexOf(a.exam) - exams.indexOf(b.exam) ||
    b.year - a.year || a.paperId.localeCompare(b.paperId));
}
