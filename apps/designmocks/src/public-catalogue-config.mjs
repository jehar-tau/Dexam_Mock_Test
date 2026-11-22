const providerUrl = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i;

function publicKey(value) {
  if (typeof value !== 'string' || value.startsWith('sb_secret_')) return false;
  if (value.startsWith('sb_publishable_')) return true;
  try {
    const parts = value.split('.');
    return parts.length === 3 && JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))).role === 'anon';
  } catch { return false; }
}

export function publicCatalogueConfiguration({ enabled, deployment, origin, productionOrigin,
  productionProvider, url, key }) {
  if (!enabled) return false;
  if (!providerUrl.test(url ?? '') || !publicKey(key))
    throw new Error('The public paper catalogue needs a Supabase URL and public browser key.');
  if (deployment === 'production') {
    if (url !== productionProvider)
      throw new Error('The public paper catalogue requires the designated DMocks project.');
    if (origin !== productionOrigin) return false;
  }
  return true;
}
