# Security and operational boundaries

- Server authorization uses verified Firebase issuer/audience/email claims, a server-owned UID-to-UUID mapping, and owner-only RLS. Legacy Supabase tokens resolve only existing legacy owners. Public Supabase keys identify the project; they are not secrets or authorization substitutes.
- Native auth sessions use SecureStore; web sessions use browser storage. Task caches use AsyncStorage and are not separately encrypted. Protect devices and use HTTPS for hosted web. This is not end-to-end encryption.
- Text is rendered as text. Capture links allow HTTP/HTTPS only. There is no HTML/Markdown execution. File names are sanitized and generated UUIDs prevent accidental overwrite.
- Private file URLs expire after 60 seconds. A recipient of a signed link can access it until expiry. Saved downloads are outside the app's access controls.
- Client file signature checks improve error handling. They are not a malware scanner and can be bypassed by a custom client. Storage enforces size, MIME and ownership, but stronger content inspection, per-account storage quotas and malware scanning require a trusted upload service before untrusted/public-scale use.
- Native compression is opt-in and produces JPEG; it may remove transparency/metadata. No automatic access to user libraries, clipboard or contacts is requested.
- The deletion endpoint requires verified identity and recent password authentication. It never logs credentials. It must be deployed separately.
- Firebase email quotas, abuse prevention, backup retention, monitoring, incident response and a public privacy/support contact must be configured for the operator's deployment. These are not provided by a frontend redesign.

## Before public distribution

Have the owner authorize and perform functional/security verification: separate-user RLS isolation, anonymous denial, storage path spoofing, recovery links/expiry, session revocation, deletion retry, offline conflicts, invalid files and accessibility with TalkBack/keyboard/large text. No compliance certification or enterprise security audit is claimed.
