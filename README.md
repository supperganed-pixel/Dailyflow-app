# DailyFlow

An Expo Android and responsive web application for tasks, notes, follow-ups and private files. The active entry is `artifacts/dailyflow/index.ts` → `src/App.tsx`. The earlier Expo Router prototype under `app/` is preserved but is not the active application.

## Features

- Firebase email signup, verification, sign-in, hosted password recovery, persistent sessions and protected screens. Supabase retains private data and storage.
- Profiles and incremental task sync protected by user ownership rules. Offline edits queue after sign-in; overlapping edits preserve a local copy.
- Private files with owner-only access, a 20 MB server limit, allowed MIME types, client signature checks, upload progress, cancellation, optional JPEG compression and short-lived download links.
- Public GitHub release history, direct APK downloads, release dates/counts and a cached startup update notice.
- Responsive navigation, light/dark/system themes, accessible form labels, loading placeholders, reduced-motion-aware transitions, toast feedback and paginated lists.
- A four-step getting-started guide opens for new empty accounts and remains available from More and Settings.
- Local date suggestions, task completion/undo, snoozing, reminders, share-sheet text capture, JSON backup/import.

## Start

Use Node 24 and pnpm 11.19.0. From the repository root:

```sh
pnpm install
pnpm dev:web
```

Copy `artifacts/dailyflow/.env.example` to `.env` and supply your Supabase **public** URL and publishable key. Supply the four Firebase public values too. Apply both SQL migrations and connect Firebase third-party authentication before using accounts. See [authentication and storage setup](docs/API.md).

```sh
pnpm check:app
pnpm build:app
pnpm preview:app
```

The preview binds only to `127.0.0.1:4173`. Native work uses `pnpm dev` and a development build; the native share extension requires a built Android client.

## Layout

| Path | Purpose |
| --- | --- |
| `artifacts/dailyflow/src/auth` | Session and recovery lifecycle |
| `artifacts/dailyflow/src/services` | Supabase, profile, files and GitHub clients |
| `artifacts/dailyflow/src/screens` | Lazy-loaded files, releases and profile |
| `artifacts/dailyflow/src/ui.tsx` | Shared accessible controls and palette |
| `lib/flow-core` | Validated types, capture suggestions and sync merge logic |
| `supabase/migrations` | Profiles, task RPC, RLS and private storage policies |
| `supabase/functions/delete-account` | Authenticated account and storage cleanup |

The optional Express scaffold is not used for application authentication or sync. The earlier custom account backend was removed.

## Distribution and limitations

Downloads repository: https://github.com/supperganed-pixel/dailyflow-releases

See [Android release instructions](docs/RELEASE.md) and [security notes](docs/SECURITY.md). Compilation does not establish production readiness. Real-device authentication, deep links, uploads, notifications, accessibility and isolation checks are required before a public release. A repository without an attached APK correctly displays “No releases” in the app.
