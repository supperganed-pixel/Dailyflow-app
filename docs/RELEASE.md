# Android and web distribution

Expo owner `newflow1`; project `dailyflow`; Android package `com.newflow1.dailyflow`.
Public downloads repository: https://github.com/supperganed-pixel/dailyflow-releases

## Android

From `artifacts/dailyflow`, create a signed APK with:

```sh
pnpm exec eas build --platform android --profile preview
```

`preview` produces an APK for direct installation, `development` a development client, and `production` an AAB for a future Play submission. EAS manages signing credentials; preserve the same signing key for all app upgrades. Never commit signing files or tokens. Do not enable a paid plan without the owner's decision.

Configure the public Supabase and repository variables in EAS before building (local `.env` files are excluded from uploads). Bump `version` in `app.config.ts` for a release and increment Android version codes. Use stable `vMAJOR.MINOR.PATCH` GitHub tags. The update comparison ignores preview tags; downloads display previews with a label and prioritize stable releases.

Before publishing an APK, install it on an Android device and authorize release checks for login/signup/recovery links, offline persistence/sync, file upload/view/download/deletion, notifications, share-sheet capture, dark/light mode, accessibility and account deletion. The local web build cannot establish native correctness.

After device acceptance, create a GitHub release, upload the signed APK, include release notes and a SHA-256 checksum, then publish it. Do not attach an AAB as a direct-install APK. The app selects APK assets only and opens GitHub's direct download URL. It never silently installs updates. Android may ask the owner to allow installation from the chosen download source.

No APK is published merely by creating the repository. Record the actual build URL, checksum and release URL after completing those actions.

## Web

`pnpm build:app` exports `artifacts/dailyflow/dist`. Deploy this directory to an HTTPS static host supporting an SPA fallback to `index.html`. Configure the host's security headers and Supabase redirect allowlist for that exact origin. Do not expose environment files, repository folders or source credentials. A static export is not a hosted website until deployed.

## Future Google Play

Play Console registration is separate from Expo/direct distribution. Before submission provide a developer name, support email, privacy policy, public account-deletion request page, accurate Data safety declarations, screenshots and any required testing/production access. Recheck Google Play's current requirements at submission time. No Play Store publication has been performed.
