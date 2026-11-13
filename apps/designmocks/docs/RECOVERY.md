# Private database and file recovery

This operator workflow captures the standalone DMocks project only. Public registration, checkout and launch attestations remain closed. It neither restores a hosted database nor provisions a scheduler, backup subscription or offsite store.

Supabase database backups contain Storage metadata, not the object bytes. Both must be recovered. See the official [backup guide](https://supabase.com/docs/guides/platform/backups) and [restore prerequisites](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore). Provider roles, extension versions and separately configured services require a compatible restore environment.

## Capture

Use Node 24 and PostgreSQL 17 clients (`psql`, `pg_dump`). Use a direct database connection or the session pooler on 5432, never the transaction pooler. Hosted connections require `verify-full` for the snapshot, dump and final inventory check. The source is fixed to the standalone DMocks project.

For the existing DMocks project, download the official CA certificate from **Database Settings** and set `DMOCKS_RECOVERY_DATABASE_CA_FILE` to its absolute path. The direct endpoint and session pooler use this CA. When the variable is unset, the clients use the system trust store with hostname verification. [Supabase SSL enforcement](https://supabase.com/docs/guides/platform/ssl-enforcement)

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

Use the approved full release SHA. The default capture requires the complete migration history from the checkout and the companion MVP permissions. A read-only repeatable-read transaction supplies the row and schema fingerprints and the snapshot to `pg_dump --format=custom`. The snapshot includes Auth, application tables, the Storage catalogue and the migration ledger. Capture downloads each private object and verifies canonical paper-file hashes. A fresh transaction checks the migration history, permissions stage and Storage catalogue before the bundle becomes ready. If those checks fail, review the source state and retry into a new directory. [PostgreSQL snapshot options](https://www.postgresql.org/docs/17/app-pgdump.html)

Each payload and the private manifest use AES-256-GCM with a bundle-derived key, random nonces and bundle/slot authentication. The encrypted manifest contains exact release/profile, row/schema/privilege fingerprints, sequence state, object paths/owners/metadata and byte hashes. Only aggregate metadata and random identifiers are exposed in the readiness header. Files are 0600, directories 0700. The readiness marker is synced last. A failed or missing marker, altered/missing/extra payload, wrong key or authentication/hash failure invalidates the bundle.

Capture is read-only on the source. A successful capture/verify is **not** a successful database restoration. The verification summary explicitly reports `databaseRestoreAccepted:false`. Copy the whole encrypted bundle to the approved offsite location and independently verify that copy before accepting a migration backup. Protect and remove obsolete encrypted copies under the approved retention policy.

## Capture before the first upgrade

Read the complete installed ledger from the approved DMocks database before applying migrations. Review that list with the rollout release. The ledger contains the installed versions, including any gaps in the sequence. Use the following query to obtain the sorted JSON array. [Supabase migration history](https://supabase.com/docs/reference/cli/supabase-migration-list)

```sql
select coalesce(jsonb_agg(version order by version), '[]'::jsonb)
from supabase_migrations.schema_migrations;
```

Save the reviewed list in a private JSON file with these fields. Replace the placeholders with the full approved release SHA and the complete installed array.

```json
{
  "version": "dmocks-pre-upgrade-ledger-v1",
  "projectRef": "tiodqzvvujxvxssvjdis",
  "releaseSha": "APPROVED_FULL_RELEASE_SHA",
  "migrationVersions": ["INSTALLED_MIGRATION_VERSION"]
}
```

```sh
npm run recovery:capture -- --output /private/backups/pre-upgrade --release APPROVED_FULL_RELEASE_SHA --pre-upgrade-ledger /private/recovery/reviewed-ledger.json
npm run recovery:verify -- --bundle /private/backups/pre-upgrade
```

Pre-upgrade capture requires the companion MVP profile to be absent. It validates the project and release in the file, checks the installed versions against the reviewed list and records the ledger digest in the authenticated manifest. The capture and verification summaries report `sourceStage: "pre-upgrade"`. Keep the reviewed ledger with the rollout evidence.

## Capture closed staging before permissions repair

Use this mode when the companion profile is installed in staging and its permissions verifier reports false. The source must have Test mode, sales off, registration closed or restricted to testers, and Test checkout disabled. The ledger uses the same keys as the example above, with version `dmocks-staging-recovery-ledger-v1` and every migration version from the approved source and hosted ledger. Review the exact project, release and migration list before capture.

```sh
npm run recovery:capture -- --output /private/backups/staging-before-repair --release APPROVED_FULL_RELEASE_SHA --staging-ledger /private/recovery/reviewed-staging-ledger.json
npm run recovery:verify -- --bundle /private/backups/staging-before-repair
```

If the proposed upgrade adds migrations, capture the pre-upgrade staging snapshot using the reviewed checkout that matches the installed ledger. The new release checkout belongs to the upgrade rehearsal.

Verification reports `staging-before-permissions-repair`. Capture records the installed schema and grants, rechecks them and the Storage inventory before committing the encrypted bundle, and records no canonical profile digest. Restore into an isolated database and compare snapshots at that same stage first. The restored snapshot will carry the original permission drift. Rehearse the reviewed repair on that isolated copy, then verify the canonical profile and the closed checkout controls before recording acceptance.

## Rehearse restoration

1. Create a new disposable, compatible PostgreSQL 17/Supabase target with the required provider roles/extensions. Isolate its services from external OAuth, email, merchant endpoints, public DNS and scheduled jobs **before loading data**. Use original fictional data for development checks; customer recovery needs an approved protected recovery environment.
2. Verify the encrypted offsite copy, then extract only into a new private directory with `npm run recovery:verify -- --bundle /private/backups/copied-bundle --extract-to /private/recovery/new-extraction`. Plaintext files must never enter public/source/build/Git paths or an ordinary shared development directory.
3. Restore the custom PostgreSQL archive (`payload-000000.bin`) with `pg_restore --exit-on-error --single-transaction` using the compatible target procedure. Treat every provider ownership/role/extension error as a failed rehearsal. Do not ignore errors, disable authorization, overwrite a nonempty unknown target or apply missing migrations to disguise a mismatched backup.
4. Before starting background services, call `captureRecoverySnapshot(connection, {sourceStage, expectedVersions})` on the restored database. Use the verified snapshot's `sourceStage` and `migrationVersions`, with `mvp` as the stage for older bundles that omit it. Use `compareRecoverySnapshots` to check the ledger, recorded schema, functions, triggers, RLS, grants, table rows and sequences against the verified archive. This check establishes the baseline before any migration is applied to the restored database.
5. Wait for the isolated Storage API to be ready, then restore private object bytes. Use `restoreLocalRecoveryObjects` with the verified extraction, a matching database check and a check of the restored object metadata. It preserves bucket, path, owner, content type, cache control and custom metadata, then downloads each object to verify its hash and size. Sign requests for owned objects with a key from the isolated target. Compare ownership, metadata and bytes after upload, allowing the Storage API to assign its own version and timestamps. [Supabase Storage schema](https://supabase.com/docs/guides/storage/schema/design)
6. Start only the isolated services. Verify restored identity, own/foreign/anonymous permissions, paid order/pass/event binding, frozen questions/answers/revisions, the original deadline and submitted score, support replies, private-file downloads and new sequence allocation. Login legitimately changes Auth sessions; the complete pre-service snapshot comparison remains the authoritative exact-row check. Never reset an exam clock during recovery.
7. Retain credential-free proof and timing. Remove isolated services, volumes, network routes, temporary keys, credentials and decrypted files. Review the result before marking any hosted `backup_restore` attestation approved.

For a pre-upgrade bundle, complete the database and private-file checks at the captured migration versions. Then apply the reviewed pending migrations on that isolated copy and install the companion profile last. Recheck the preserved account, assessment, payment, support and media records, plus the closed registration and sales gates.

Logical archives do not include API/JWT secrets, external OAuth configuration, Edge deployments/secrets, merchant configuration, DNS/TLS, alert routing, schedules or global role passwords. Inventory and restore those separately through their approved provider procedures. The helper exposes no hosted restore command, and local proof does not approve a production target or switch.

## Verification boundaries

The permanent database suite uses a disposable PostgreSQL 17 service to dump and restore original fictional 57-question UCEED data, 114 frozen items, saved answer revisions, original clocks, a paid order/pass/event, a replied support report and identity sequences. It compares schema/RLS/grants/rows and verifies own-account reads plus foreign/anonymous denial. Its Storage catalogue is a stub; it makes no real Storage acceptance claim.

The pre-upgrade database suite captures the historical model with 25 installed migrations, restores it after dropping the source database, and applies all missing source migrations and the companion profile. An earlier isolated Supabase rehearsal exercises the capture command with actual Auth and Storage, restores the 25-version archive, and runs the Supabase CLI dry run and upgrade on the restored copy. Both check the original account, saved attempt, payment, support reply, canonical question record and private figure. The Supabase rehearsal also verifies desktop and mobile portal access and the restored private bytes after the upgrade. Rehearse the approved release against the fresh target ledger and backup before applying migrations.

The private local Supabase rehearsal passes actual encrypted capture, changed-inventory rejection, full database restoration across 110 recorded relations, private Storage bytes/ownership/cache/custom metadata and real Auth/PostgREST/SDK checks. Desktop/mobile portal checks pass submitted results, saved answers/revisions, original clocks, paid access, support replies, foreign-account denial and private-byte hashes while the source instance is stopped and removed. The isolated target is removed after evidence is retained. All actors/questions/payments are fictional; Google and Razorpay acceptance, approved hosted recovery, offsite/key custody, delivery alerts and an agreed recovery target remain separate launch gates. The existing 424 desktop/mobile regression journeys still apply because this slice changes no product UI or public API.
