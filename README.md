# UPSC MCQ — React + Vite Migration

A faithful React port of the original vanilla-JS UPSC/BPSC MCQ practice portal.
Every function, calculation, Firestore query/transaction, localStorage/IndexedDB
key and timing rule from the original was preserved — only the runtime was moved
from imperative DOM manipulation to React components, and the UI was refined.

## Run it

```bash
npm install
npm run dev        # start the dev server (Vite)
```

Then open the printed URL. The user portal is at `/` and the admin panel at
`/admin.html`.

```bash
npm run build      # production build -> dist/
npm run preview    # preview the production build
```

## What was kept identical

- **Firebase** uses the compat SDK (`firebase@10.7.1`) so all
  `runTransaction`, `FieldValue.serverTimestamp()`, `persistentLocalCache`
  and multi-tab code is byte-for-byte the same as the original.
- **Data layer** (`src/lib/dataManager.js`, `idb.js`) — the IndexedDB cache
  (`QuizAppDB` / `app_cache`), TTLs (manifests 24h, global stats 1h),
  incremental history sync and all collection names are unchanged.
- **Scoring** (+2 correct / −0.66 incorrect), **timer** (1.2 min/question,
  <180s low-time warning), **surety/confidence matrix**, **difficulty bands**
  (≥70% Easy, ≤40% Hard), **leaderboard masking** (3 chars + `***`),
  **percentile / global comparison**, and the **chapter_stats transaction**
  (with array densification and `revision_` skip) are all verbatim.
- **Persistence keys**: `quiz_progress_${chapterId}` (24h expiry),
  `theme`, and every Firestore collection (`quizzes`, `practice_mcqs`,
  `chapter_stats`, `results`, `practiceResult`, `chapter_stats`,
  `quiz_metadata`, `app_config/keys`, `admins`) are identical.
- **AI mentor** uses the exact original Gemini prompt and `app_config/keys`
  lookup.
- **Admin panel** (`/admin.html`) ports the full discussion dashboard:
  heat-map palette, per-option user+confidence buckets, leaderboard,
  user search, attempt review modal with status/subject filters, and the
  stats-reverting delete transaction.

## UI improvements

- React modals replace Bootstrap JS modals (smoother, no jQuery/bootstrap-bundle).
- Dark-mode correctness: Bootstrap's hard-coded `bg-white`/`bg-light`/`text-dark`
  are mapped onto the theme's CSS variables so cards read correctly in dark mode.
- Toasts use `react-toastify` behind the original `toastr` API.
- Subtle card-hover, focus-ring and transition polish (additive CSS only).
- Bootstrap Icons + Font Awesome are loaded for the `bi`/`fas` icon classes the
  original markup referenced.

## Project structure

```
src/
  lib/            firebase, idb, dataManager, helpers, timer, chartHelper, toastr
  store.jsx       AppProvider — global state, auth, theme, navigation
  components/     Layout (loader, navbar, breadcrumbs)
  views/          AuthView, DashboardView, TestSelection, QuizFlow,
                  ReviewMode, PracticeConfigView, PracticeRunner
  admin/          AdminApp + admin styles (admin.html entry)
  App.jsx         view switch (replaces hideAllSections/showX)
  main.jsx        user-portal entry
```

## Firebase config

The Firebase project config lives in `src/lib/firebase.js` (ported from the
original `config.js`). Point it at your own project if needed.
