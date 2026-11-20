import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { pageHead } from './search-pages.mjs';

export function SearchHead() {
  const { pathname } = useLocation();
  useEffect(() => {
    const template = document.createElement('template');
    template.innerHTML = pageHead(pathname, __DMOCKS_PUBLIC_DISCOVERY__);
    document.head.querySelectorAll('[data-dmocks-head]').forEach(element => element.remove());
    document.head.append(template.content);
  }, [pathname]);
  return null;
}
