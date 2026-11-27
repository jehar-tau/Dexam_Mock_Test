// Converts test-only raster bytes into the same two responses as the authenticated Edge functions.
export function fictionalDrawingResponse(route, input, { images, serverNow, expiresAt }, headers) {
  if (input.action === "page") {
    const selected = images.find(image => image.id === input.id);
    if (!selected) return route.fulfill({status: 403, headers, json: {error: "Page unavailable."}});
    return route.fulfill({headers, contentType: "application/octet-stream", body: Buffer.from(selected.url.split(",")[1], "base64")});
  }
  const pages = images.map(({url, ...page}) => ({
    ...page, mimeType: page.mimeType ?? /^data:([^;]+);base64,/.exec(url)[1],
  }));
  const now = Date.now();
  return route.fulfill({headers, json: {
    delivery: "session", images: pages,
    serverNow: serverNow ?? new Date(now).toISOString(), expiresAt: expiresAt ?? new Date(now + 300000).toISOString(),
  }});
}
