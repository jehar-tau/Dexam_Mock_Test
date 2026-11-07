import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { drawingInspectionLayout, drawingRenderMetadata, nativeDrawingOrientation } from "./drawing-inspection.js";

function DrawingImage({ image, label, controls = false }) {
  const viewport = useRef(null), [size, setSize] = useState({ width: 0, height: 0 });
  const [pixels, setPixels] = useState(null), [native, setNative] = useState(undefined), [failed, setFailed] = useState(false);
  const [turns, setTurns] = useState(0), [mirrored, setMirrored] = useState(false), [zoom, setZoom] = useState(1);
  const [darkPaper, setDarkPaper] = useState(false);
  useEffect(() => {
    let current = true;
    nativeDrawingOrientation(image.mimeType).then(value => { if (current) setNative(value); });
    return () => { current = false; };
  }, [image.mimeType]);
  useLayoutEffect(() => {
    const element = viewport.current;
    const update = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    update();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(update) : null;
    observer?.observe(element); window.addEventListener("resize", update);
    return () => { observer?.disconnect(); window.removeEventListener("resize", update); };
  }, []);
  const layout = pixels && native !== undefined && drawingInspectionLayout({ width: pixels.width, height: pixels.height,
    orientation: drawingRenderMetadata(image) ? image.orientation : 1, nativeOriented: native,
    turns, mirrored, zoom, viewportWidth: size.width, viewportHeight: size.height });
  const viewZoom = layout?.zoom ?? zoom;
  useLayoutEffect(() => {
    const element = viewport.current;
    if (!layout) return;
    element.scrollLeft = Math.max(0, (element.scrollWidth - element.clientWidth) / 2);
    element.scrollTop = Math.max(0, (element.scrollHeight - element.clientHeight) / 2);
  }, [layout?.frameWidth, layout?.frameHeight]);
  return <>
    {controls && <div className="drawing-inspection-toolbar" role="group" aria-label="Image view controls">
      <button type="button" onClick={() => { setTurns(value => (value + 3) % 4); setZoom(1); }}>Rotate left</button>
      <button type="button" onClick={() => { setTurns(value => (value + 1) % 4); setZoom(1); }}>Rotate right</button>
      <button type="button" aria-pressed={mirrored} onClick={() => setMirrored(value => !value)}>Mirror view</button>
      <button type="button" aria-pressed={darkPaper} onClick={() => setDarkPaper(value => !value)}>Dark background</button>
      <button type="button" disabled={!layout || viewZoom <= layout.minZoom} onClick={() => setZoom(Math.max(layout.minZoom, viewZoom - 0.5))}>Zoom out</button>
      <button type="button" disabled={!layout || viewZoom >= layout.maxZoom} onClick={() => setZoom(Math.min(layout.maxZoom, viewZoom + 0.5))}>Zoom in</button>
      <button type="button" disabled={!layout || Math.abs(layout.scale - 1) < 0.001} onClick={() => setZoom(layout.nativeZoom)}>Actual size</button>
      <button type="button" onClick={() => setZoom(1)}>Fit page</button>
      <button type="button" onClick={() => { setTurns(0); setMirrored(false); setZoom(1); setDarkPaper(false); }}>Reset view</button>
      <span role="status">{Math.round(viewZoom * 100)}% of fit · rotated {turns * 90}°{mirrored ? " · mirrored" : ""}{darkPaper ? " · dark background" : ""}</span>
    </div>}
    <div className={`drawing-image-viewport${controls ? " expanded" : ""}`} ref={viewport} tabIndex={controls ? 0 : undefined}
      role={controls ? "region" : undefined} aria-label={controls ? `${label} scrollable image` : undefined}>
      <div className="drawing-image-content"><div className="drawing-image-canvas" style={{ ...(layout ? { width: layout.frameWidth, height: layout.frameHeight } : { width: 1, height: 1 }), background: darkPaper ? "#162824" : "#fff" }}>
        <img src={image.url} alt={label} referrerPolicy="no-referrer" loading={controls ? "eager" : "lazy"} decoding="async" onLoad={event => setPixels({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
          onError={() => setFailed(true)} style={layout ? { width: layout.imageWidth, height: layout.imageHeight,
            transform: `translate(-50%, -50%) matrix(${layout.matrix.join(",")},0,0)`, visibility: failed ? "hidden" : "visible" } : { visibility: "hidden" }} />
      </div></div>
    </div>
    {failed && <p role="alert">This page could not be displayed. Refresh the saved images to open a new private link.</p>}
  </>;
}

export { DrawingImage as PrivateRasterImage };

function DrawingInspectionDialog({ image, label, onClose }) {
  const dialog = useRef(null), titleId = useId();
  useLayoutEffect(() => {
    // Removing a dialog removes it from the top layer. Closing during Strict Mode's
    // effect replay would dispatch a late close event against the reopened dialog.
    if (!dialog.current.open) dialog.current.showModal();
  }, []);
  const containTab=event=>{
    if(event.key!=="Tab")return;
    const controls=[...dialog.current.querySelectorAll("button,[tabindex]")].filter(element=>!element.matches(":disabled")&&element.tabIndex>=0&&element.getClientRects().length);
    const first=controls[0],last=controls.at(-1),active=document.activeElement;
    if(first&&(!controls.includes(active)||(event.shiftKey?active===first:active===last))){event.preventDefault();(event.shiftKey?last:first).focus();}
  };
  return <dialog className="drawing-inspection-dialog" ref={dialog} aria-labelledby={titleId} onClose={onClose} onKeyDown={containTab}>
    <div className="drawing-inspection-header"><h2 id={titleId}>{label}</h2>
      <button type="button" autoFocus onClick={() => dialog.current.close()}>Close image</button></div>
    <p>Adjust the view. The original submission stays unchanged.</p>
    <DrawingImage image={image} label={label} controls />
  </dialog>;
}
export { DrawingInspectionDialog as PrivateImageInspectionDialog };

function DrawingPagesSession({ load, anonymous = false, disabled = false }) {
  const [images, setImages] = useState(null), [selected, setSelected] = useState(null), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const current = useRef(0), pending = useRef(null), expiry = useRef(null);
  useEffect(() => () => { current.current++; pending.current?.abort(); clearTimeout(expiry.current); }, []);
  const open = async () => {
    const started = performance.now();
    const sequence = ++current.current;
    pending.current?.abort(); clearTimeout(expiry.current);
    const controller = new AbortController(); pending.current = controller;
    setImages(null); setSelected(null); setBusy(true); setMessage("");
    try {
      const result = await load(controller.signal);
      if (controller.signal.aborted || current.current !== sequence) return;
      const pages = Array.isArray(result) ? result : result.images;
      if (!Array.isArray(pages) || pages.length > 5 || new Set(pages.map(page => page.id)).size !== pages.length ||
          pages.some(page => !Number.isInteger(page.ordinal) || page.ordinal < 1 || page.ordinal > 5 || typeof page.url !== "string")) throw new Error();
      setImages(pages.slice().sort((a, b) => a.ordinal - b.ordinal));
      const expires = Date.parse(result.expiresAt);
      const serverNow = Date.parse(result.serverNow);
      const remaining = Number.isFinite(expires) && Number.isFinite(serverNow) ? expires - serverNow
        : Number.isFinite(expires) ? expires - Date.now() : 300_000;
      const delay = Math.max(0, Math.min(300_000, remaining) - Math.max(0, performance.now() - started));
      expiry.current = setTimeout(() => {
        if (current.current !== sequence) return;
        setImages(null); setSelected(null); setMessage("Private links expired. Open the images again to continue.");
      }, delay);
    } catch {
      if (!controller.signal.aborted && current.current === sequence) setMessage("Couldn’t open drawing pages. Refresh the queue or saved pages and try again.");
    } finally { if (current.current === sequence) setBusy(false); }
  };
  const label = image => `${anonymous ? "Anonymous drawing page" : "Your drawing page"} ${image.ordinal}`;
  return <div className="drawing-review-media">
    <button type="button" disabled={busy || disabled} onClick={open}>{images ? (anonymous ? "Refresh private images" : "Refresh saved images") : (anonymous ? "Open private images" : "View saved images")}</button>
    {busy && <p role="status">Opening private images…</p>}
    {message && <p role="status">{message}</p>}
    {images?.length === 0 && <p>No drawing pages found.</p>}
    {images?.length > 0 && <div className="drawing-review-grid">{images.map(image => <figure key={`${image.id}:${image.url}`}>
      <DrawingImage image={image} label={label(image)} />
      <figcaption>Page {image.ordinal}</figcaption>
      <button type="button" aria-label={`Inspect page ${image.ordinal}, ${anonymous ? "anonymous drawing" : "your drawing"}`} onClick={() => setSelected(image)}>Inspect page {image.ordinal}</button>
    </figure>)}</div>}
    {selected && <DrawingInspectionDialog image={selected} label={label(selected)} onClose={() => setSelected(null)} />}
  </div>;
}

export function DrawingPages({ scopeKey, ...props }) {
  return <DrawingPagesSession key={scopeKey} {...props} />;
}
