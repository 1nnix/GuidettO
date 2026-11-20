# Where does it feel from?

Survey for *Guidelines for the Orient*, an academic design research project on East Asian-coded branding in India.

- `index.html` — the public survey. Share this link.
- `admin.html` — researcher page (photos, settings, live data). Unlisted; data needs the PIN.
- `app.js`, `app.css` — shared code.
- `photos/` — photos plus `manifest.json`, made by **Export for website** on the admin page.
- `apps-script/Code.gs` — the Google Sheet script that stores answers.

## One-time setup

### 1. Google Sheet
1. Make a new Google Sheet (any name).
2. Extensions → Apps Script. Delete what's there, paste in `apps-script/Code.gs`, save.
3. Project Settings (gear) → Script properties → Add: `ADMIN_PIN` = a passphrase of at least 8 characters.
4. Deploy → New deployment → type **Web app**. Execute as: **Me**. Who has access: **Anyone**. Deploy, allow the permissions.
5. Copy the web app URL (ends in `/exec`).

### 2. GitHub Pages
1. Upload `index.html`, `admin.html`, `app.js`, `app.css`, `README.md` and the `apps-script` folder to the repo.
2. Settings → Pages → Source: Deploy from a branch → `main` / root → Save.
3. After a minute the site is at `https://1nnix.github.io/GuidettO/`. Admin: `…/GuidettO/admin.html`.

### 3. Photos and settings
1. Open `admin.html`. Settings: paste the sheet URL, add contact email and institution line, check the other settings.
2. Images: add photos, set group, round, pairs (C07r / C07t) and element tags.
3. Home → **Export for website** → unzip → upload the `photos` folder to the repo (GitHub's upload page takes up to 100 files at a time).
4. Reload `index.html` to check. Any change later: edit in admin, export, upload again (same names overwrite).

## Notes
- Answers go to the sheet one photo at a time; if a phone is offline they wait on the device and send later.
- Opt-in emails go to their own tab with no participant ID.
- The PIN check happens in the sheet's script, so the data stays locked even though the site's code is public.
- GitHub Pages caches files for about 10 minutes, so changes can take that long to show.
- After changing `Code.gs`, Deploy → Manage deployments → edit → new version, so the URL stays the same.
