// Only add public pages after their content and availability have been verified.
export const siteOrigin = 'https://dmocks.com';
export const publicPages = new Map([
  ['/', {title: 'Design entrance practice and free sample test | DMocks', description: 'Try five original design practice questions, explore a worked visual exercise, and check DMocks mock-test availability.'}],
  ['/sample', {title: 'Free design entrance sample test | DMocks', description: 'Try five original visual questions in six minutes without signing in. Review your answers and explanations when you finish.'}],
  ['/practice/visual-hierarchy', {title: 'Visual hierarchy practice: reading a museum sign | DMocks', description: 'Compare two museum signs, decide what a visitor reads first, and check your reasoning against a worked visual hierarchy example.'}],
  ['/tests', {title: 'Design entrance mock tests and practice availability | DMocks', description: 'Check which design entrance practice is available now, see the first planned mock, or start the free sample test.'}],
  ['/tests/uceed', {title: 'UCEED Part A practice mock and free sample | DMocks', description: 'Explore the planned DMocks UCEED Part A practice mock, check access information and try the separate free experience sample.'}],
  ['/plans', {title: 'Design mock-test annual pass and access | DMocks', description: 'Check the DMocks annual pass price, what it covers and current access. Try the free sample before deciding.'}],
  ['/contact', {title: 'Contact DMocks for practice and account support', description: 'Find help with DMocks practice, account access and purchase questions.', index: false, shell: true}],
  ['/tests/ceed', {title: 'CEED practice availability | DMocks', description: 'Check the status of CEED practice on DMocks and find the official exam information.', index: false}],
  ['/tests/nid', {title: 'NID DAT practice availability | DMocks', description: 'Check the status of NID DAT practice on DMocks and find the official exam information.', index: false}],
  ['/tests/nift', {title: 'NIFT practice availability | DMocks', description: 'Check the status of NIFT practice on DMocks and find the official exam information.', index: false}],
  ['/privacy', {title: 'Privacy and sample data | DMocks', description: 'Read how DMocks handles the free sample and learn about account privacy.', index: false, shell: true}],
  ['/terms', {title: 'Terms and access | DMocks', description: 'Read the DMocks terms and access information.', index: false, shell: true}],
  ['/refunds', {title: 'Cancellations and refunds | DMocks', description: 'Read the current DMocks cancellation and refund information.', index: false, shell: true}],
]);

const escape = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const tag = 'data-dmocks-head';
export function pageHead(pathname, publicBuild) {
  const path = pathname.replace(/\/+$/, '') || '/';
  const page = publicPages.get(path);
  const title = escape(page?.title ?? 'DMocks');
  const indexed = publicBuild && page && page.index !== false;
  const tags = [`<title ${tag}>${title}</title>`, `<meta ${tag} name="robots" content="${indexed ? 'index, follow' : 'noindex, nofollow'}">`];
  if (page) tags.push(`<meta ${tag} name="description" content="${escape(page.description)}">`);
  if (indexed) {
    const url = siteOrigin + path;
    tags.push(`<link ${tag} rel="canonical" href="${url}">`, `<meta ${tag} property="og:site_name" content="DMocks">`,
      `<meta ${tag} property="og:type" content="website">`, `<meta ${tag} property="og:title" content="${title}">`,
      `<meta ${tag} property="og:description" content="${escape(page.description)}">`, `<meta ${tag} property="og:url" content="${url}">`);
    if (path === '/') {
      const website = {'@context': 'https://schema.org', '@type': 'WebSite', name: 'DMocks', url};
      tags.push(`<script ${tag} type="application/ld+json">${JSON.stringify(website)}</script>`);
    }
  }
  return tags.join('\n');
}
