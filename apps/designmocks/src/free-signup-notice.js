// The version binds a student's decision to the exact notices displayed by this build.
export function freeSignupNoticeState(receipt, publishedVersion) {
  if (!receipt || typeof receipt.required !== 'boolean' || typeof receipt.accepted !== 'boolean' ||
      (receipt.version !== null && typeof receipt.version !== 'string')) {
    throw new Error('Invalid signup notice response');
  }
  if (!receipt.required) return 'ready';
  if (!publishedVersion || receipt.version !== publishedVersion) return 'mismatch';
  return receipt.accepted ? 'ready' : 'pending';
}
