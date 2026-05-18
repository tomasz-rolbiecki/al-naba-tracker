# al-Nabaʾ tracker

Two pieces that work together:

1. **al-naba-analyser** — a Claude skill. You drop a screenshot in your Claude conversation; the skill reads it, applies a consistent analytical framework, and emits a narrative summary plus a structured JSON block.
2. **al-naba-tracker** — a small static React app deployed to GitHub Pages. You paste the JSON into the tracker, review the fields, save. The library view shows similar editorials by tag overlap.

No API keys. No server. No subscription beyond your existing Claude account. Data lives in your browser.

---

## Architecture

```
┌─────────────────────┐                  ┌────────────────────┐
│   Claude.ai chat    │                  │   GitHub Pages     │
│                     │                  │                    │
│   you upload an     │                  │   al-naba-tracker  │
│   al-Naba screenshot│                  │   (static React)   │
│           │         │                  │           ▲        │
│           ▼         │                  │           │        │
│  al-naba-analyser   │   copy JSON      │   paste, review,   │
│  skill triggers     │ ───────────────► │   save             │
│           │         │                  │           │        │
│           ▼         │                  │           ▼        │
│  narrative + JSON   │                  │   browser local    │
│                     │                  │   storage          │
└─────────────────────┘                  └────────────────────┘
```

Why this works: the screenshot stays in your Claude.ai session (which is already authenticated and trusted). The tracker only ever sees structured analytical text, never the original image. The tracker itself contains nothing sensitive, so the deployment surface is uninteresting to an attacker even if the URL leaks.

---

## Part 1: Install the al-naba-analyser skill in Claude

The skill is in `al-naba-analyser/`. It is a single `SKILL.md` file. You can also use the packaged `al-naba-analyser.skill` file if provided.

**To install:**

1. Open Claude.ai.
2. Go to **Settings** → **Capabilities** → **Skills** (or **Settings** → **Skills** depending on your Claude version).
3. Click **Add skill** or **Upload skill**.
4. Upload either the `al-naba-analyser.skill` file, or zip the `al-naba-analyser/` folder and upload that.
5. The skill is now installed.

**To use the skill:**

1. Open a new Claude conversation.
2. Drop a screenshot of an al-Naba editorial page.
3. The skill triggers automatically. If it doesn't, prompt with: *"Use al-naba-analyser to process this."*
4. Claude returns a narrative summary plus a fenced JSON code block.
5. Copy the response (the JSON block alone is enough, the whole response also works).

---

## Part 2: Deploy the tracker to GitHub Pages

The tracker is in `al-naba-tracker/`. It builds to a static site and deploys via a GitHub Actions workflow.

### Prerequisites

- A **GitHub account**. That is all. Everything below happens in your browser.

### Step-by-step deployment, web only

#### 1. Extract the tracker zip on your computer

Double-click `al-naba-tracker.zip` to extract it. You should end up with a folder called `al-naba-tracker` containing files and subfolders.

**Important.** The folder contains a hidden subfolder called `.github`. GitHub Pages needs this folder. By default your file manager hides folders starting with a dot. Enable showing hidden items first:

- **macOS Finder:** open the `al-naba-tracker` folder, then press `Cmd + Shift + .` (period). A faint `.github` folder appears alongside the other items.
- **Windows File Explorer:** in the folder, click **View** → **Show** → **Hidden items**.

You should now see: `.github`, `.gitignore`, `index.html`, `package.json`, `README.md`, `src/`, `vite.config.js`. If you cannot see `.github`, the upload will skip the auto-deploy and the site will not build.

#### 2. Create a private GitHub repository

1. Go to https://github.com/new.
2. **Repository name:** `al-naba-tracker`. The name matters because the workflow uses it for the deploy path.
3. **Visibility:** **Private** if you have GitHub Pro (~$4/month), otherwise **Public**. The repo contains no sensitive data, only the tracker UI code, so public is safe.
4. Leave all the "Initialize this repository with..." boxes unticked.
5. Click **Create repository**.

#### 3. Upload the files

On the empty repo page, GitHub shows a "Quick setup" panel. Look for the line that says **uploading an existing file** and click it. You land on the upload page.

1. In your file manager, select **everything inside** the `al-naba-tracker` folder. On macOS, `Cmd + A` after opening the folder; on Windows, `Ctrl + A`. Make sure `.github` is in the selection.
2. Drag the selection into the GitHub upload area.
3. Scroll down. At the bottom, in **Commit changes**, leave the default message or write your own. Make sure **Commit directly to the main branch** is selected.
4. Click **Commit changes**.

GitHub uploads and processes the files. When done, you see the repo file listing. Confirm you can see `.github` in the list. If it is missing, repeat the upload (you may have to enable hidden files first).

#### 4. Enable GitHub Pages

1. On the repo, click **Settings** (top right of the repo page).
2. In the left sidebar, click **Pages**.
3. Under **Build and deployment** → **Source**, select **GitHub Actions** (not "Deploy from a branch").
4. There is no save button. The setting takes effect immediately.

#### 5. Wait for the first deploy

1. Click the **Actions** tab at the top of the repo.
2. You should see a workflow run named "Deploy to GitHub Pages", queued or in progress.
3. Wait for it to finish (1 to 2 minutes). Refresh if needed. A green tick means success; a red cross means a problem (see Troubleshooting below).
4. Go back to **Settings** → **Pages**. Near the top, there is a URL like `https://YOUR-USERNAME.github.io/al-naba-tracker/`. Click it.

Bookmark the URL. You are deployed.

#### 6. Use the tracker

1. Open the tracker URL.
2. Click **Add editorial**.
3. Paste the skill output from your Claude conversation.
4. Click **Parse and review**.
5. Adjust any field. Save.

---

## Updating the tracker later

To change anything on the deployed tracker, you edit files in GitHub's web editor and commit. GitHub Actions handles the rebuild and redeploy automatically.

1. Navigate to the file you want to change in the GitHub web UI.
2. Click the pencil icon (top right of the file view) to edit.
3. Make your change.
4. Scroll down. Write a commit message. Click **Commit changes**.
5. The Actions tab will show a new workflow run. When it succeeds (1 to 2 minutes), the change is live.

To upload a new file or replace a file: navigate to the folder, click **Add file** → **Upload files**, drag in the new file, commit.

---

## Data, backup, and privacy

- **Where is my data?** In your browser's `localStorage`, scoped to the deployed origin. Nobody else can see it. Nothing is sent to any server.
- **What if I clear browser data?** Your library is gone. Use **Backup** regularly to download a JSON file you can re-import.
- **Cross-device?** Not supported. localStorage is per-browser-per-device. If you use the tracker on your laptop and your phone, they will have separate libraries. Workaround: export Backup from one, import on the other.
- **Sharing with a colleague?** Same workaround: backup, send the JSON file, they import.
- **What is in the GitHub repo?** Only the tracker UI code. No editorial data, no analytical output. The repo can be inspected by anyone (if public) or only by you (if private). Neither reveals anything sensitive.

---

## Why no auth gate?

Earlier versions of this setup had a password gate. With the new architecture, it adds no real security:

- The deployed URL contains no editorial data.
- Anyone visiting the URL sees their own empty tracker, not yours.
- The data only exists in your browser's localStorage, which is already protected by your operating system.

If you still want a password gate as a friction layer (e.g., to prevent shoulder-surfers seeing the tracker UI on a shared screen), it can be added with about 30 lines of client-side code. Ask Claude to add it; I have left the architecture clean for now.

---

## Customising

**To change the deploy path** (if you renamed the repo): the GitHub Actions workflow reads the repo name automatically, so usually no change is needed. If you want to deploy to a different path, edit `vite.config.js`.

**To change the visual style:** the styles are in a `<style>` block at the top of `src/Tracker.jsx`. The CSS variables at the top of that block control the colour palette.

**To change the analytical framework or output format:** edit `al-naba-analyser/SKILL.md`. Reinstall the skill in Claude. Note that if you change the JSON schema, you may need to update the `extractJSONFromPaste` function in `src/Tracker.jsx` to handle the new fields.

---

## Troubleshooting

**No workflow run appears in the Actions tab after upload.** The `.github` folder was probably skipped during upload because it was hidden in your file manager. Enable showing hidden items (see step 1), then upload `.github/workflows/deploy.yml` separately: in the repo, click **Add file** → **Upload files**, drag the folder in, commit.

**Workflow fails with "Pages site not yet created."** Go to Settings → Pages and make sure the source is set to **GitHub Actions**. Re-run the workflow from the Actions tab (click the failed run → **Re-run all jobs**).

**Tracker shows blank page after deploy.** Check the browser console. Most common cause: `base` path mismatch. The workflow sets `VITE_BASE_PATH` to `/<repo-name>/`. If you renamed the repo, the next deploy will pick up the new name automatically.

**Paste fails with "No JSON object found."** Make sure you copied the JSON block from the skill output. The parser looks for a fenced ```json ... ``` block first, then falls back to any `{ ... }` structure. If the skill output is malformed, ask Claude to regenerate.

**Skill doesn't trigger when I drop a screenshot.** Type *"use the al-naba-analyser skill to process this"* to force-trigger it. If it still doesn't, reinstall the skill in Claude settings.

**I'm on the free GitHub plan and the repo is set to private.** GitHub Pages on private repos requires GitHub Pro. Either upgrade, or change the repo to Public. The repo contains no sensitive data so Public is safe.

---

## What is not done, and why

- **No auth gate.** Not needed; data is browser-local. Adding one is straightforward if you want it.
- **No cross-device sync.** Adding it would require a backend (Vercel KV, Supabase, etc.) and complicates the threat model. CSV/JSON export is the workaround.
- **No image-based similarity.** Tag overlap is transparent and cheap. Embedding-based similarity would need a backend or a heavy client-side model. Worth considering only if the corpus grows past a few hundred entries and tag overlap stops surfacing useful links.
- **Skill outputs structured JSON, not a fully native form.** Paste-and-parse is the simplest interop layer. A future version could expose a "share to tracker" URL scheme but it adds friction with no real gain.
