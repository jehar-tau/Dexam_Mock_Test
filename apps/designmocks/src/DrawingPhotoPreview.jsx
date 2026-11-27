import React, { useEffect, useState } from "react";

export function DrawingPhotoPreview({ page, rotate }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const objectUrl = URL.createObjectURL(page.file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [page.file]);
  return <figure className="drawing-photo-preview">
    <div>{url && <img src={url} alt={`Page ${page.ordinal} before upload`} style={{ transform: `rotate(${page.turns * 90}deg)` }} />}</div>
    <figcaption>Page {page.ordinal}
      <button type="button" className="text-button" onClick={rotate} aria-label={`Rotate page ${page.ordinal} clockwise`}>Rotate 90°</button>
    </figcaption>
  </figure>;
}
