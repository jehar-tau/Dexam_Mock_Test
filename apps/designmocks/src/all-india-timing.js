const boundaryByState = Object.freeze({
  scheduled: 'startsAt',
  open: 'lastStartAt',
  closing: 'endsAt',
  review: 'reviewEndsAt',
});

export function eventTiming(event, now) {
  const boundary = Date.parse(event[boundaryByState[event.state]]);
  return {
    needsRefresh: Number.isFinite(boundary) && now >= boundary,
    nextBoundary: Number.isFinite(boundary) && now < boundary ? boundary : null,
  };
}

export function nextEventBoundary(events, now) {
  return events.reduce((nearest, event) => {
    const next = eventTiming(event, now).nextBoundary;
    return next != null && (nearest == null || next < nearest) ? next : nearest;
  }, null);
}
