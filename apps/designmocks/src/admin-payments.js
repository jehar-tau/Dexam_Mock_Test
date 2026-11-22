import { validatePurchasePage } from './purchase-history.js';

export function readPaymentReviews(value) {
  const page = validatePurchasePage(value, value?.mode);
  for (const item of value.items) {
    if (item.reviewRequired !== true || !['active', 'revoked', 'expired', 'none'].includes(item.passState)) {
      throw new Error('Invalid payment review page');
    }
  }
  return { ...page, items: page.items.map((item, index) => ({ ...item, passState: value.items[index].passState })) };
}
