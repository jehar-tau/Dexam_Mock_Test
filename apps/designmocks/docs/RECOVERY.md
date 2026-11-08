# Private database and file recovery

This operator workflow captures the standalone DMocks project only. Public registration, checkout and launch attestations remain closed. It neither restores a hosted database nor provisions a scheduler, backup subscription or offsite store.

Supabase database backups contain Storage metadata, not the object bytes. Both must be recovered. See the official [backup guide](https://supabase.com/docs/guides/platform/backups) and [restore prerequisites](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore). Provider roles, extension versions and separately configured services require a compatible restore environment.

## Capture

Use Node 24 and PostgreSQL 17 clients (`psql`, `pg_dump`). Use a direct database connection or the session pooler on 5432, never the transaction pooler. Hosted connections require certificate verification against the system trust store. The source is fixed to the standalone DMocks project; unrelated Dexam data is refused.

Load these values privately from the operator secret store:

- `DMOCKS_SUPABASE_URL`: standalone HTTPS origin.
- `DMOCKS_SUPABASE_SERVICE_ROLE_KEY`: standalone server Storage credential.
- `DMOCKS_RECOVERY_DATABASE_URL`: privileged direct/session PostgreSQL connection.
- `DMOCKS_RECOVERY_KEY`: random 32-byte key represented by 64 lowercase hexadecimal characters.

Keep the recovery key in a separately secured store, outside the bundle, Git, build output and command history. Losing it makes the archive unrecoverable. Before automating capture, agree key custody, rotation, access, retention/deletion and an independent offsite destination. No schedule or recovery-point promise is established by these commands.

From `apps/designmocks`, choose a **new** private directory under an existing private parent, then run:

```sh
npm run recovery:capture -- --output /private/backups/new-bundle --release APPROVED_FULL_RELEASE_SHA
npm run recovery:verify -- --bundle /private/backups/new-bundle
```

The release must be the exact approved database source. Capture checks all installed migration versions and the companion MVP permissions before exporting. A read-only repeatable-read transaction supplies the row/schema fingerprint and exported snapshot to `pg_dump --format=custom`. The snapshot includes Auth, application, Storage catalogue and migration data. Every private object is downloaded separately; canonical paper-file SHA names are checked. A fresh independent catalogue read must match before the bundle becomes ready. Storage changes cause the incomplete bundle to be removed; quiesce file writers and retry in a new directory.

Each payload and the private manifest use AES-256-GCM with a bundle-derived key, random nonces and bundle/slot authentication. The encrypted manifest contains exact release/profile, row/schema/privilege fingerprints, sequence state, object paths/owners/metadata and byte hashes. Only aggregate metadata and random identifiers are exposed in the readiness header. Files are 0600, directories 0700. The readiness marker is synced last. A failed or missing marker, altered/missing/extra payload, wrong key or authentication/hash failure invalidates the bundle.

Capture is read-only on the source. A successful capture/verify is **not** a successful database restoration. The verification summary explicitly reports `databaseRestoreAccepted:false`. Copy the whole encrypted bundle to the approved offsite location and independently verify that copy before accepting a migration backup. Protect and remove obsolete encrypted copies under the approved retention policy.

## Rehearse restoration

1. Create a new disposable, compatible PostgreSQL 17/Supabase target with the required provider roles/extensions. Isolate its services from external OAuth, email, merchant endpoints, public DNS and scheduled jobs **before loading data**. Use original fictional data for development checks; customer recovery needs an approved protected recovery environment.
2. Verify the encrypted offsite copy, then extract only into a new private directory with `npm run recovery:verify -- --bundle /private/backups/copied-bundle --extract-to /private/recovery/new-extraction`. Plaintext files must never enter public/source/build/Git paths or an ordinary shared development directory.
3. Restore the custom PostgreSQL archive (`payload-000000.bin`) with `pg_restore --exit-on-error --single-transaction` using the compatible target procedure. Treat every provider ownership/role/extension error as a failed rehearsal. Do not ignore errors, disable authorization, overwrite a nonempty unknown target or apply missing migrations to disguise a mismatched backup.
4. Before starting background services, compare `captureRecoverySnapshot` with the verified manifest via `compareRecoverySnapshots`: exact schema/functions/triggers/RLS/effective grants and all recorded table rows; sequence values must not move backwards. Verify migration ledger and exact MVP profile. This is a real database check, independent of payload verification.
5. Restore private object bytes through the Storage API. Storage tables are [read-only infrastructure metadata](https://supabase.com/docs/guides/storage/schema/design); inserting catalogue rows does not restore files. The local-only `restoreLocalRecoveryObjects` helper requires a verified extraction, a matching-database check and post-upload metadata check. It preserves bucket/path, owner, content type, raw cache-control and custom metadata, then downloads each object to verify SHA and size. An isolated local signing adapter is required for owned objects; it must never borrow production signing keys. New provider object versions/timestamps may change; original owner/path/metadata/bytes must match.
6. Start only the isolated services. Verify restored identity, own/foreign/anonymous permissions, paid order/pass/event binding, frozen questions/answers/revisions, the original deadline and submitted score, support replies, private-file downloads and new sequence allocation. Login legitimately changes Auth sessions; the complete pre-service snapshot comparison remains the authoritative exact-row check. Never reset an exam clock during recovery.
7. Retain credential-free proof and timing. Remove isolated services, volumes, network routes, temporary keys, credentials and decrypted files. Review the result before marking any hosted `backup_restore` attestation approved.

Logical archives do not include API/JWT secrets, external OAuth configuration, Edge deployments/secrets, merchant configuration, DNS/TLS, alert routing, schedules or global role passwords. Inventory and restore those separately through their approved provider procedures. The helper exposes no hosted restore command, and local proof does not approve a production target or switch.

## Verification boundaries

The permanent database suite uses a disposable PostgreSQL 17 service to dump and restore original fictional 57-question UCEED data, 114 frozen items, saved answer revisions, original clocks, a paid order/pass/event, a replied support report and identity sequences. It compares schema/RLS/grants/rows and verifies own-account reads plus foreign/anonymous denial. Its Storage catalogue is a stub; it makes no real Storage acceptance claim.

The private local Supabase rehearsal passes actual encrypted capture, changed-inventory rejection, full database restoration across 110 recorded relations, private Storage bytes/ownership/cache/custom metadata and real Auth/PostgREST/SDK checks. Desktop/mobile portal checks pass submitted results, saved answers/revisions, original clocks, paid access, support replies, foreign-account denial and private-byte hashes while the source instance is stopped and removed. The isolated target is removed after evidence is retained. All actors/questions/payments are fictional; Google and Razorpay acceptance, approved hosted recovery, offsite/key custody, delivery alerts and an agreed recovery target remain separate launch gates. The existing 424 desktop/mobile regression journeys still apply because this slice changes no product UI or public API.
