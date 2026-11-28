import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { pageHead } from './search-pages.mjs';
import { guidePage, guideSlug } from './guide-pages.mjs';

function applyHead(pathname, override = null) {
  const template = document.createElement('template');
  template.innerHTML = pageHead(pathname, __DMOCKS_PUBLIC_DISCOVERY__, override);
  document.head.querySelectorAll('[data-dmocks-head]').forEach(element => element.remove());
  document.head.append(template.content);
}

export function SearchHead() {
  const { pathname } = useLocation();
  useEffect(() => {
    const slug = guideSlug(pathname);
    if (!slug) { applyHead(pathname); return; }
    // Guide text loads only on guide pages; the prerendered head stays until it arrives.
    let current = true;
    import('./community-editorial.js').then(({ findEditorial }) => {
      const article = findEditorial(slug);
      if (current) applyHead(pathname, article ? guidePage(article) : null);
    });
    return () => { current = false; };
  }, [pathname]);
  return null;
}
