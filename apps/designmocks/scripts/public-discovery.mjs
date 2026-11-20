import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createServer } from 'vite';
import { pageHead, publicPages, siteOrigin } from '../src/search-pages.mjs';

// These client routes must keep their direct-entry points, including OAuth callbacks.
// Their documents contain the application shell only. Personal state is never rendered.
const shellRoutes = [
  '/sample/result', '/account', '/account/callback', '/account/purchases', '/dashboard',
  '/dashboard/mocks', '/dashboard/all-india', '/dashboard/practice', '/dashboard/learn',
  '/dashboard/community', '/onboarding', '/report', '/admin', '/review/drawings',
];

async function writeRoute(directory, route, html) {
  const file = join(directory, route === '/' ? 'index.html' : route.slice(1) + '.html');
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, html);
}

export function publicDiscovery(publicBuild) {
  let config;
  return {
    name: 'dmocks-public-discovery',
    apply: 'build',
    configResolved(resolved) { config = resolved; },
    async writeBundle({ dir }) {
      if (!publicBuild) {
        await writeFile(join(dir, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
        return;
      }
      const template = await readFile(join(dir, 'index.html'), 'utf8');
      const document = (path, body = '') => template
        .replace(/<!--dmocks-head-->[\s\S]*?<!--\/dmocks-head-->/, () => pageHead(path, true))
        .replace('<div id="root"></div>', () => `<div id="root">${body}</div>`);
      const renderer = await createServer({
        configFile: false, root: config.root, mode: config.mode,
        define: { ...config.define, 'import.meta.env.DEV': 'false' },
        server: { middlewareMode: true, hmr: false, watch: null },
        optimizeDeps: { noDiscovery: true },
      });
      try {
        const { renderPublicPage } = await renderer.ssrLoadModule('/scripts/render-public-page.jsx');
        for (const [path, page] of publicPages) {
          await writeRoute(dir, path, document(path, page.shell ? '' : renderPublicPage(path)));
        }
        await writeRoute(dir, '/404', document('/404', renderPublicPage('/404')));
      } finally {
        await renderer.close();
      }
      for (const path of shellRoutes) await writeRoute(dir, path, document(path));
      const locations = [...publicPages].filter(([,page]) => page.index !== false)
        .map(([path]) => `  <url><loc>${siteOrigin}${path}</loc></url>`);
      await writeFile(join(dir, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${locations.join('\n')}\n</urlset>\n`);
      await writeFile(join(dir, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${siteOrigin}/sitemap.xml\n`);
    },
  };
}
