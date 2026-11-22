const publicOrigin = "https://dmocks.com";

export function controlledMediaOrigin({ requestedOrigin, portalOrigin, checkoutOrigin,
  configuredPublicOrigin, stagingTesterRequired }) {
  if (!requestedOrigin) return null;
  if (requestedOrigin === portalOrigin || (checkoutOrigin && requestedOrigin === checkoutOrigin))
    return requestedOrigin;
  if (requestedOrigin === publicOrigin && configuredPublicOrigin === publicOrigin && stagingTesterRequired === "true")
    return publicOrigin;
  return null;
}
