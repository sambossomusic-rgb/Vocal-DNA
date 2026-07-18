# VocalDNA

A local-first vocal repertoire manager. Runs entirely as a web app (PWA) —
no backend server, no cloud services, no user accounts. Your data lives only
in your browser's IndexedDB, on your device.

Imports a StageTraxx4 (`.st4b`) library, builds VocalDNA's own database from
it, and lets you browse, search, filter, rate, and analyze your repertoire.

---

## What this is NOT

- Not a cloud app. Nothing is ever uploaded anywhere.
- Not connected to GitHub, Vercel, Supabase, or Firebase.
- Has no backend server of any kind — it's a static site you run locally.
- Never modifies your original `.st4b` file. It only reads it once, in your
  browser, to copy data into its own local database.

---

## Use it on iPad with no computer (GitHub Pages)

If you only have an iPad — no computer to run `npm run dev` — the repo
builds and deploys itself automatically via GitHub Actions to GitHub Pages
on every push to `main`. This is still just a static file host: no backend,
no accounts, your data still lives only in Safari's local storage on your
iPad.

One-time setup (does through the GitHub website, not the iPad app):
1. In the repo, go to **Settings → Pages**.
2. Under "Build and deployment", set **Source** to **GitHub Actions**.
3. Push (or merge) to `main` — the "Deploy to GitHub Pages" workflow builds
   the app and publishes it. Check the **Actions** tab for the run and the
   published URL (looks like
   `https://<owner>.github.io/Vocal-DNA/`).

Then on the iPad:
1. Open that URL in **Safari**.
2. Tap **Share → Add to Home Screen**.
3. Use the installed icon like any other app. After the first load it also
   works offline (the service worker caches everything).
4. Import your `.st4b` file from the **Import** tab as usual.

Every future push to `main` redeploys automatically — reload the installed
app (or re-add to home screen) to pick up updates.

---

## Requirements

- [Node.js](https://nodejs.org) 18 or newer (only needed to *build/run* the
  app locally — end users never need Node once it's built and installed to
  the home screen).
- A modern browser. For iPad: Safari 16.4+.

---

## Run it on your computer (development mode)

```bash
cd vocaldna
npm install
npm run dev
```

This starts a local server (Vite prints a URL, typically `http://localhost:5173`).
Open that URL in your browser. Everything runs locally — this server does not
call out to the internet for anything except serving the app's own files from
your machine.

---

## Use it on your iPad TODAY

iPads can't run `npm` directly, so the simplest path is: run the dev server
on your computer, then open it from Safari on the iPad over your **local
Wi-Fi network** (no internet/cloud involved — just your computer talking to
your iPad on the same network).

1. On your computer, inside the `vocaldna` folder:
   ```bash
   npm install
   npm run dev -- --host
   ```
   The `--host` flag makes Vite listen on your local network, not just
   `localhost`. It will print a URL like `http://192.168.1.23:5173`.

2. On your iPad, open **Safari** and go to that `http://192.168.x.x:5173`
   address (both devices must be on the same Wi-Fi network).

3. Tap the **Share** button → **Add to Home Screen**. This installs VocalDNA
   as a standalone app icon on your iPad — no browser chrome, works offline
   after first load, feels like a native app.

4. Tap the **Import** tab and choose your `StageTraxx4_Database.st4b` file
   from the Files app (or wherever it's stored on the iPad/iCloud Drive).

That's it — your repertoire is now in VocalDNA, stored locally in the
iPad's browser storage.

### For long-term daily use (recommended)

Running `npm run dev` every time you want to use it is fine for today, but
for a permanent setup, build the static production version once and serve
that instead — it's faster and more stable:

```bash
npm install
npm run build
npm run preview -- --host
```

`npm run preview` serves the optimized `dist/` build. Use the printed
network URL on your iPad the same way as above, then **Add to Home Screen**
again from that URL so the installed icon points at the production build.

You can also point any simple static file server (e.g. `npx serve dist`) at
the `dist/` folder after `npm run build` — same idea, no cloud required,
just something on your local network serving static files.

---

## Using the app

1. **Import** tab → choose your `.st4b` file. VocalDNA reads it once, copies
   everything into its own local database (including StageTraxx playlists),
   and never touches the original file again. Afterward you'll see new vs.
   updated songs, playlists, any "potential conflicts" (matched by name
   instead of StageTraxx ID — worth a glance), songs removed from this
   export (never auto-deleted), duplicate titles, and a missing-metadata
   count.
2. **Assess** tab (the default screen) → the fast path through a whole
   library, in three phases that each complete across every song before the
   next begins: **Status** (🎤 Regular / 🎵 Occasional / 📚 Learning /
   🌱 Unexplored, one tap), then **Pass One** (Demand & Reliability only,
   prefilled from what you've already rated), then **Pass Two** (Enjoyment &
   Fatigue only). Every rating is a five-point tap: Very Low, Low, Average,
   Good, Excellent. A progress header tracks each phase's remaining count.
3. **Library** tab → browse every imported song, search instantly by title
   or artist, and filter by folder, playlist, artist, key, status, or tags
   (all combinable). Tap **Select** to multi-select songs — tap individual
   cards, or filter to a folder/playlist and "Select all shown", then
   deselect any you don't want — and batch-apply a status, Demand,
   Reliability, Transpose, tags, or clear ratings entirely across the whole
   selection at once.
4. Tap any song card to open its **detail page**: BPM, duration, your own
   tags, and the detailed rating form. **Key is editable** with up/down
   arrows — this only ever updates VocalDNA, never your StageTraxx library.
   (No lyrics, no track list — StageTraxx already does that.)
5. The detailed rating form rates a song on **Demand, Reliability,
   Enjoyment, Fatigue** (five-point buttons), a **Status**, a **Transpose**
   amount, and free-text **Notes** — useful for a deeper pass beyond the
   fast Assess flow.
6. **Statistics** tab → repertoire-wide numbers: song/artist/folder counts,
   average BPM, key distribution, rating coverage, average Demand/
   Reliability/Enjoyment/Fatigue, status breakdown, top artists, and songs
   missing Key or BPM. Every bar and row is tappable — it jumps straight to
   that filtered slice of the Library.
7. **Voice Profile** tab → a profile built entirely from your own ratings:
   strongest and weakest keys (by reliability), transpose patterns, a
   "repertoire map" (strongest / comfort zone / growing / needs work), and a
   recent fatigue trend — every key row, quadrant, and trend entry is
   tappable, opening the matching songs in the Library.

Re-importing the same (or an updated) `.st4b` file later will **update**
existing songs rather than duplicate them — matched by StageTraxx ID first,
then by artist + title if that ID has never been seen (so an ID changing
between exports can't create a duplicate or orphan your ratings).

---

## Project structure

See `PROJECT_STRUCTURE.md` for a full file-by-file breakdown.

## Guiding principles

See `CONSTITUTION.md` for the mission and design principles every feature is
held to.

## Version history

See `CHANGELOG.md`.
