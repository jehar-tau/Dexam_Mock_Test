// Only add public pages after their content and availability have been verified.
export const siteOrigin = 'https://dmocks.com';
export const publicPages = new Map([
  ['/', {title: 'Design entrance practice and free sample test | DMocks', description: 'Take free UCEED, CEED, NID and NIFT past papers with the original timer and a worked solution for every question, or try a five-question sample without signing in.'}],
  ['/sample', {title: 'Free design entrance sample test | DMocks', description: 'Try five original visual questions in six minutes without signing in. Review your answers and explanations when you finish.'}],
  ['/practice/visual-hierarchy', {title: 'Visual hierarchy practice: reading a museum sign | DMocks', description: 'Compare two museum signs, decide what a visitor reads first, and check your reasoning against a worked visual hierarchy example.'}],
  ['/tests', {title: 'Design entrance mock tests and practice availability | DMocks', description: 'Check which design entrance practice is available now, see the first planned mock, or start the free sample test.'}],
  ['/tests/uceed', {title: 'UCEED Part A practice mock and free sample | DMocks', description: 'Read the UCEED Part A format, take free UCEED past papers with worked solutions, or try the five-question sample.'}],
  ['/plans', {title: 'Design mock-test annual pass and access | DMocks', description: 'Check the DMocks annual and Duo pass prices, what a free account includes and what the pass adds. Try the free sample before deciding.'}],
  ['/papers', {title: 'Free design entrance past papers with solutions | DMocks', description: 'Free UCEED, CEED, NID and NIFT past-year papers, timed like the real exam, with a worked solution for every question.', index: false, shell: true}],
  ['/papers/uceed', {title: 'Free UCEED past papers with solutions | DMocks', description: 'Take UCEED past-year papers for free with the original timer and marking, then review a worked solution for every question.', index: false, shell: true}],
  ['/papers/ceed', {title: 'Free CEED past papers with solutions | DMocks', description: 'Take CEED Part A past-year papers for free with the original timer and marking, then review a worked solution for every question.', index: false, shell: true}],
  ['/papers/nid', {title: 'Free NID DAT past papers with solutions | DMocks', description: 'Take NID B.Des. and M.Des. past papers for free, timed, with a worked solution for every question.', index: false, shell: true}],
  ['/papers/nift', {title: 'Free NIFT past papers with solutions | DMocks', description: 'Take NIFT GAT past papers for free with the original timer and marking, then review a worked solution for every question.', index: false, shell: true}],
  ['/contact', {title: 'Contact DMocks for practice and account support', description: 'Find help with DMocks practice, account access and purchase questions.', index: false, shell: true}],
  ['/tests/ceed', {title: 'CEED practice availability | DMocks', description: 'Check the status of CEED practice on DMocks and find the official exam information.', index: false}],
  ['/tests/nid', {title: 'NID DAT practice availability | DMocks', description: 'Check the status of NID DAT practice on DMocks and find the official exam information.', index: false}],
  ['/tests/nift', {title: 'NIFT practice availability | DMocks', description: 'Check the status of NIFT practice on DMocks and find the official exam information.', index: false}],
  ['/privacy', {title: 'Privacy and sample data | DMocks', description: 'Read how DMocks handles the free sample and learn about account privacy.', index: false, shell: true}],
  ['/terms', {title: 'Terms and access | DMocks', description: 'Read the DMocks terms and access information.', index: false, shell: true}],
  ['/guides', {title: 'Guides for NID, UCEED, NIFT and CEED preparation | DMocks', description: 'Free guides on exam strategy, time management and calm under pressure for design entrance exams, by an NID Bengaluru alumnus.'}],
  ['/refunds', {title: 'Cancellations and refunds | DMocks', description: 'Read the current DMocks cancellation and refund information.', index: false, shell: true}],
]);

const escape = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const tag = 'data-dmocks-head';
// `override` supplies the entry for pages outside this map (the guides, see guide-pages.mjs).
export function pageHead(pathname, publicBuild, override = null) {
  const path = pathname.replace(/\/+$/, '') || '/';
  const page = override ?? publicPages.get(path);
  const title = escape(page?.title ?? 'DMocks');
  const indexed = publicBuild && page && page.index !== false;
  const tags = [`<title ${tag}>${title}</title>`, `<meta ${tag} name="robots" content="${indexed ? 'index, follow' : 'noindex, nofollow'}">`];
  if (page) tags.push(`<meta ${tag} name="description" content="${escape(page.description)}">`);
  if (indexed) {
    const url = siteOrigin + path;
    tags.push(`<link ${tag} rel="canonical" href="${url}">`, `<meta ${tag} property="og:site_name" content="DMocks">`,
      `<meta ${tag} property="og:type" content="${page.article ? 'article' : 'website'}">`, `<meta ${tag} property="og:title" content="${title}">`,
      `<meta ${tag} property="og:description" content="${escape(page.description)}">`, `<meta ${tag} property="og:url" content="${url}">`);
    if (page.article) {
      const article = {'@context': 'https://schema.org', '@type': 'Article', headline: page.article.headline, description: page.description,
        author: {'@type': 'Person', name: page.article.author}, datePublished: page.article.datePublished,
        publisher: {'@type': 'Organization', name: 'DMocks', url: siteOrigin}, mainEntityOfPage: url};
      tags.push(`<script ${tag} type="application/ld+json">${JSON.stringify(article).replaceAll('<', '\\u003c')}</script>`);
    }
    if (path === '/') {
      const website = {'@context': 'https://schema.org', '@type': 'WebSite', name: 'DMocks', url};
      tags.push(`<script ${tag} type="application/ld+json">${JSON.stringify(website)}</script>`);
    }
  }
  return tags.join('\n');
}
