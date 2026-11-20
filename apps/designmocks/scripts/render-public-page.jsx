import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import App from '../src/App.jsx';

// Render the same signed-out view students see. No browser storage or session is present.
export function renderPublicPage(path) {
  return renderToStaticMarkup(<StaticRouter location={path}><App /></StaticRouter>);
}
