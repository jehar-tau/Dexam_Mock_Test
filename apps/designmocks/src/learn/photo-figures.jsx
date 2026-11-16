// Photographs with credits. `alt` is written by the question: when the
// question asks what the picture shows, the alt text describes it without
// naming it.
import { IMAGES } from './decks/images.js';

const shortLicence = l => l.replace(/^Public domain$/i, 'public domain');
export function Credit({ image }) {
  const im = IMAGES[image];
  if (!im) return null;
  return <span className="photo-credit">Photo: {im.author} · {im.licenseUrl ? <a href={im.licenseUrl} target="_blank" rel="noreferrer">{shortLicence(im.license)}</a> : shortLicence(im.license)} · Wikimedia Commons</span>;
}
export function Photo({ image, alt, compact = false }) {
  const im = IMAGES[image];
  if (!im) return null;
  return <figure className={`photo-figure${compact ? ' compact' : ''}`}>
    <img src={im.src} alt={alt} width={im.width} height={im.height} loading="lazy" decoding="async" />
    <figcaption><Credit image={image} /></figcaption>
  </figure>;
}
export function PhotoRow({ items = [] }) {
  return <div className="photo-row" role="list">{items.filter(it => IMAGES[it.image]).map(it => <figure key={it.image} className="photo-figure compact" role="listitem">
    <img src={IMAGES[it.image].src} alt={it.label} loading="lazy" decoding="async" />
    <figcaption><strong>{it.label}</strong><Credit image={it.image} /></figcaption>
  </figure>)}</div>;
}
export function ImageCredits({ credits = [] }) {
  if (!credits.length) return null;
  return <details className="image-credits"><summary>Image credits ({credits.length})</summary><ul>
    {credits.map(c => <li key={c.id}><a href={c.source} target="_blank" rel="noreferrer">{c.id.replace(/-/g, ' ')}</a>: {c.author}, {c.licenseUrl ? <a href={c.licenseUrl} target="_blank" rel="noreferrer">{c.license}</a> : c.license}, via Wikimedia Commons.</li>)}
  </ul></details>;
}
