// Pure rules for the pass prompts and the Duo invite. No network access here.
// What the browser shows about a student's pass. The server enforces every
// paid limit; this read only decides which prompts and locks to display.
export function passIsActive(value) {
  return Boolean(value && typeof value === "object" && value.active === true && value.revoked !== true);
}

// Duo invite links carry a 64-character token: /duo/<token>.
export const duoTokenPattern = /^[0-9a-f]{64}$/;
export const duoInviteLink = (origin, token) => `${origin}/duo/${token}`;

const duoMessages = Object.freeze({
  dmocks_duo_google: "Sign in with Google to claim this pass.",
  dmocks_duo_invalid: "This invite link is not valid. Ask your friend to copy it again from their DMocks account.",
  dmocks_duo_payer: "This invite is for your friend. Your own pass is already active.",
  dmocks_duo_used: "This invite has already been used.",
  dmocks_duo_unavailable: "This invite is no longer available.",
  dmocks_duo_expired: "This invite has expired. Invites last 30 days from the payment.",
  dmocks_duo_has_pass: "You already have an active pass, so this invite stays free for someone else.",
});
export function duoClaimMessage(error) {
  return duoMessages[error?.hint] ?? "Couldn’t claim this invite. Check your connection and try again.";
}
