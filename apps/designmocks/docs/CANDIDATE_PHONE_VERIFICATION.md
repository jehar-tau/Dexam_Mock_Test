# Candidate phone verification

The DMocks profile can verify the number a student has saved after signing in with Google. The number remains in the student profile. Keep Supabase's primary phone sign-in disabled.

The server reserves one challenge before requesting an SMS. The code expires in five minutes. Students may request a new code after 60 seconds. Each account and each destination can request up to five codes in a rolling 24-hour period, and each code allows five wrong guesses. A new code or an edit to the saved number invalidates the previous challenge. A confirmed code updates the saved profile. If the SMS request loses its reply, the student can still enter the code if it arrives.

The private challenge table stores keyed digests of the destination and code, the account ID, and timestamps. It stores no plaintext phone number or code. New reservations clean up a limited batch of rows that expired more than 24 hours earlier. Agree on a retention period and schedule deletion to cover quiet periods before enabling the feature.

## Controlled staging

1. Approve the staging target, supported destination countries, SMS template and budget, delivery consent copy, and retention and recovery procedures. The current adapter is MSG91 Flow. For Indian recipients, register and map the approved DLT template to the Flow with a single `OTP` variable. [MSG91 Flow API](https://docs.msg91.com/sms/send-sms) · [MSG91 DLT mapping](https://msg91.com/help/dlt-registration-in-india/map-approved-dlt-template-id-with-respective-flow-id-on-msg91-panel)
2. Apply the candidate-phone migration and deploy the matching `candidate-phone` Edge Function to the approved private backend. Keep registration tester-only and sales closed. The function authenticates the bearer session with Supabase Auth and calls the challenge RPCs with its server credential.
3. Set `PUBLIC_APP_ORIGIN` to the exact approved frontend origin. Set `DMOCKS_PHONE_SMS_PROVIDER=msg91-flow` and add `DMOCKS_PHONE_CHALLENGE_KEY` as a separately generated 32-byte key encoded in lowercase hex. Set `DMOCKS_MSG91_AUTHKEY` and `DMOCKS_MSG91_FLOW_TEMPLATE` in the Edge Function secret store. Keep these settings out of the browser build. Rotating the challenge key invalidates outstanding codes and starts a new destination rate history.
4. Build the private staging frontend with `VITE_CANDIDATE_PHONE_VERIFICATION_ENABLED=true`. Confirm real delivery to an approved tester, verify the code, refresh the profile, and check that editing the number clears the proof. Exercise wrong codes, resend limits, and a signed-out request. Check that SMS still cannot sign in to DMocks. Local tests simulate SMS delivery.

To close the feature, remove the server provider setting and publish a private build without the frontend flag. Reopen only after verifying provider delivery, account recovery and monitoring on the approved target.
