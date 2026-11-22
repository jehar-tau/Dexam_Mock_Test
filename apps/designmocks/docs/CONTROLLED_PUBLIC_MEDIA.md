# Controlled public tester media

The owner may inspect the student portal on `https://dmocks.com` with approved
Google tester accounts before opening registration or sales. The public
frontend flag is `VITE_CONTROLLED_PUBLIC_PORTAL_ENABLED=true`; see
`DIRECT_PUBLIC_RELEASE.md` after that PR lands. Keep the flag off until an
exact-domain Google callback and account journey has passed.

The `attempt-media` and `drawing-media` Edge functions accept this additional
origin only when both server variables are set exactly:

- `DMOCKS_CONTROLLED_PUBLIC_ORIGIN=https://dmocks.com`
- `DMOCKS_EDGE_REQUIRE_STAGING_TESTER=true`

The approved-tester RPC is checked after authentication and again before
returning signed attempt media. Drawing uploads check the same admission
before processing requests. The existing staging origin remains available;
the checkout origin on `attempt-media` remains a separate setting.
`create-order` does not gain the public origin here, so this change cannot
open checkout.

Before deploying these functions, verify the target is the designated DMocks
Test project with sales and checkout closed, and capture the current function
versions for rollback. After deployment, preflight `OPTIONS` on both media
functions with `Origin: https://dmocks.com`: each must return 204 and that
exact allow-origin. `www.dmocks.com` and a copied domain must return 403.
Then test signed-out denial, an admitted tester's own media, another user's
media denial, and revocation during an active session. Do not switch on the
public tester frontend until those hosted checks pass.
