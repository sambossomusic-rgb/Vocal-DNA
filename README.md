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
   everything into its own local database, and never touches the original
   file again.
2. **Library** tab → browse every imported song, search instantly by title
   or artist, and filter by folder, artist, key, or rating status.
3. Tap any song card to open its **detail page**: key, BPM, duration, track
   list, lyrics/chart, and your rating form.
4. Rate a song on **Difficulty, Confidence, Enjoyment, Fatigue**, set a
   **Transpose** amount, a **Status**, and free-text **Notes**. Tap
   **Save rating**.
5. **Statistics** tab → repertoire-wide numbers: song/artist/folder counts,
   average BPM, key distribution, rating coverage, average ratings, rating
   status breakdown, top artists.
6. **Voice Profile** tab → a profile built entirely from your own ratings:
   strongest keys (by confidence), most challenging keys (by difficulty),
   transpose patterns, a "repertoire map" (strongest / comfort zone /
   growing / needs work), and a recent fatigue trend.

Re-importing the same (or an updated) `.st4b` file later will **update**
existing songs rather than duplicate them — VocalDNA tracks each song's
original StageTraxx ID internally to match them up.

---

## Project structure

See `PROJECT_STRUCTURE.md` for a full file-by-file breakdown.

## Version history

See `CHANGELOG.md`.
