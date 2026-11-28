import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import App from '../src/App.jsx';
import { GuideReader, GuidesIndex } from '../src/PublicGuides.jsx';
import { editorialArticles } from '../src/community-editorial.js';
import { guidePage, guidePath } from '../src/guide-pages.mjs';

const prerendered = { GuidesIndex, GuideReader };

// Every guide page with the search details pageHead() needs.
export function guideRoutes() {
  return editorialArticles.map(article => [guidePath(article.slug), guidePage(article)]);
}

// Render the same signed-out view students see. No browser storage or session is present.
export function renderPublicPage(path) {
  return renderToStaticMarkup(<StaticRouter location={path}><App prerendered={prerendered} /></StaticRouter>);
}
