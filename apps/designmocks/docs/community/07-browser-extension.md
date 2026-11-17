# 7. The Save to DMocks browser extension

Phase 4. Source in `apps/designmocks/extension/`, built by
`scripts/build-extension.mjs`. Not published; publishing needs the owner
(decision 8).

## What it does

One click on the toolbar button shows the page you are on, a list of your
DMocks folders and a private note (filled with the page title). Save puts
the page's address into the chosen folders. Instagram, Facebook and other
social pages are saved the same way, with your note; DMocks never fetches
them. Other pages get a preview (title, site, description) when you choose
Get preview on the Saved page.

Sharing a saved page with other students still happens on DMocks: Suggest
for the Links feed, then a moderator's review (phase 3).

## What it can and cannot do

- Permissions: `activeTab` (the address and title of the tab you click
  on, only when you click) and `storage` (its own connection key). Host
  access only to the DMocks project's own address. No content scripts, no
  background worker, no history, cookies, bookmarks or other tabs.
- It sends only the page address, the folders you chose and your note. It
  never sends page content.
- It holds no DMocks session. It holds a connection key that can do two
  things: list your folder names and save an address into them. It cannot
  read your saved items, post, comment, like or see anything else.
- The key is shown once on the Saved page. DMocks stores only its SHA-256
  fingerprint. Keys expire after 180 days, at most five are active per
  member, and Disconnect on the Saved page stops a key at once.

## Building and trying it

From `apps/designmocks/`:

```bash
VITE_SUPABASE_URL=https://<project-ref>.supabase.co \
VITE_SUPABASE_ANON_KEY=<the public key the web app already uses> \
DMOCKS_APP_ORIGIN=https://<the DMocks site> \
npm run extension:build
```

The build refuses anything that is not an `https://*.supabase.co` project
address, an `https://` site origin, or a key that looks like a service or
secret key. The output is `dist-extension/` (not committed).

To try it: open `chrome://extensions`, turn on Developer mode, choose Load
unpacked and pick `dist-extension/`. The project must have migration
`202611170173_community_extension.sql` (and the earlier Community
migrations) and the post-launch preview must be on for the Saved page.

## Release gating

- The two functions the extension calls, `extension_community_folders` and
  `extension_save_community_link`, are callable with the public key only
  on preview and staging projects. The paid release profile
  (`supabase/launch/paid-mvp.sql`) revokes them, so a released backend
  refuses the extension until Community is released and those two
  signatures are added to the profile deliberately.
- The extension is useless without the Saved page, which stays behind the
  preview flag.

## Publishing (needs the owner)

1. A Chrome Web Store developer account owned by Design Exam Academy
   (one-time registration fee, paid by the owner).
2. Store assets the code does not include yet: 128 px icon, at least one
   1280×800 screenshot, a short and a long description.
3. A privacy policy entry on the DMocks site covering the extension. A
   draft for the owner to review:

   > The Save to DMocks extension sends DMocks only the address of the page
   > you choose to save, the folders you pick and the note you write. It
   > reads the page's address and title only when you click the extension,
   > never in the background, and never reads page content, browsing
   > history or cookies. It stores a connection key on your device, which
   > you can remove at any time from Saved on DMocks.

4. The store's data-use declarations: "Website content: no", "Web
   history: no", "Personally identifiable information: no"; the address
   you save is user-provided content.
5. Store review, which can take days.

Firefox and Edge can load the same Manifest V3 build with small changes;
not attempted.
