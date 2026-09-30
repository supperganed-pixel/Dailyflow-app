# Firebase authentication and Supabase storage

## Services

- Firebase project: `dailyflow-6bd65` (Spark). Email/password is the app's sign-in method. Firebase sends verification and reset emails using its default hosted action handler; return to DailyFlow after completing the email action. No custom SMTP is required for this flow.
- Supabase project: `ixfcyvjrkecwtdknzwul`. Profiles, tasks and the private `dailyflow-files` bucket stay here.
- Expo project: `newflow1/dailyflow`.

## Database setup

For a new database, apply `202609260001_dailyflow.sql` then `202609290001_firebase_auth.sql`. The existing live database already contains the Firebase migration. Both scripts are transactional and intended to run once. Dashboard execution does not populate CLI migration history; reconcile history before using `db push`.

Connect the exact Firebase project in Supabase Authentication > Third-Party Auth. The client supplies fresh Firebase ID tokens using Supabase's `accessToken` callback. Signed tokens from other projects, unverified email accounts and unsigned requests cannot resolve an owner.

Firebase UIDs map to internal UUIDs through `ensure_firebase_profile`. Profiles are created after verification. The map is not editable by clients. Do not automatically link legacy profiles by matching email: that would grant access without proof of ownership. Legacy Supabase users and their data are preserved and old builds remain supported. New Firebase registrations start separate workspaces unless an administrator performs an independently verified migration. Supabase passwords are not copied into Firebase.

Firebase's default tokens have no Postgres role claim. Narrow grants therefore include the database `anon` role, while every applicable RLS policy and write RPC requires a valid project-specific identity. The word `anon` here is a database role, not permission to browse other users' data. Public API keys alone cannot pass the owner checks. No paid Firebase function or Admin SDK key is needed for custom role assignment.

Files remain private, immutable, limited to 20 MB and to the configured MIME list. Their folder uses the mapped internal UUID, not the Firebase UID. Signed links expire after 60 seconds.

## Account deletion

Deploy `supabase/functions/delete-firebase-account/index.ts` with gateway `verify_jwt=false`. The function itself verifies Google JWT signatures, exact Firebase issuer/audience, email verification, five-minute recent authentication, and current Firebase account status. Configure `FIREBASE_WEB_API_KEY` in its server environment with the public Firebase web API key. The Supabase service key stays in the server's managed environment.

Deletion requires password reauthentication. The server blocks writes, removes files and tasks, clears the display name, and retains a UID/owner tombstone to reject older tokens. The client then deletes its Firebase account. Partial cleanup can be retried. In-flight uploads, backups, and offline copies on other devices require operational retention/cleanup policies. The legacy `delete-account` endpoint remains for old Supabase-authenticated builds.

## Build configuration

Copy `artifacts/dailyflow/.env.example` to `.env` and supply the Supabase URL/public key, four `EXPO_PUBLIC_FIREBASE_*` values, and public GitHub releases repository. These public client values are embedded in builds; never use service-account or service-role secrets. Local environment files are excluded from Git and EAS. The Expo preview environment has the Firebase and Supabase public values. Configure production separately before a production build.

Use an enforced Firebase password policy of 12–128 characters. Verification and reset links use Firebase's hosted HTTPS handler; no application callback allowlist is required for these default email actions. Add actual hosted domains only when implementing a custom continuation URL or web OAuth. Google was enabled separately in the Console, but a Google sign-in button is not implemented in this app.

## Release and acceptance

A new APK is required to replace the existing Supabase-authentication build. A successful compile or API response does not prove inbox delivery. Verify signup, verification, reset email receipt and completion, sign-in persistence, cross-account isolation, private files and deletion retries before public distribution. The app is not independently security-certified.
