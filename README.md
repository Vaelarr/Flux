# Flux

React, Vite and Tailwind. Accounts, sessions and recovery challenges live in Turso. Brevo sends password recovery emails from the server. Google and Apple use Firebase Auth for identity verification, with account storage and sessions in Turso.

## Vercel configuration

Add these variables to the Vercel project for each deployment environment you use. Credentials must stay server-side: never use a `VITE_` prefix.

| Variable | Value |
| --- | --- |
| `TURSO_DATABASE_URL` | Your Turso `libsql://` database URL |
| `TURSO_AUTH_TOKEN` | A read/write Turso token |
| `AUTH_SECRET` | A random secret of at least 32 characters, shared by all instances |
| `APP_URL` | `https://flux-ph.vercel.app` for production |
| `BREVO_SMTP_USER` | Login from Brevo's SMTP settings |
| `BREVO_SMTP_PASSWORD` | Brevo **SMTP key**, not an API key |
| `BREVO_FROM_EMAIL` | A sender verified in Brevo |
| `BREVO_FROM_NAME` | Optional; defaults to `Flux` |
| `BREVO_SMTP_PORT` | Optional; defaults to `587`. Also supports `465` and `2525` |

Generate `AUTH_SECRET` locally with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Store it in ignored `.env.local` for development and in Vercel's environment settings. Keep production and preview databases and senders separate where possible, with the correct `APP_URL` for each.

**Redeploy after setting environment variables and deploying this code.** Adding variables alone does not install the API. An unauthenticated `GET /api/auth/session` should return JSON with HTTP `401`. If it returns HTML, the old deployment or SPA rewrite is still serving the request.

The server creates the `flux_accounts`, `flux_sessions`, `flux_password_resets` and `flux_rate_limits` tables automatically. You can also initialize them with `npm run db:init` using `.env.local`. Table creation preserves existing rows. Expired sessions and recovery challenges, plus rate counters older than a day, are cleaned up when a server instance initializes.

## Local development and checks

Copy `.env.example` to `.env.local` if you do not already have local settings. `.env.local` is ignored by Git. The Vite server handles `/api/auth/*` through the same backend used on Vercel. For isolated local work, `TURSO_DATABASE_URL=file:flux-local.sqlite` works without a Turso token; do not use a file database on Vercel.

```sh
npm ci
npm run lint
npm test
npm run build
npm run services:check
```

`services:check` uses `.env.local` to check Turso and authenticate to Brevo over TLS. It does not send an email and never prints credential values. Brevo sender approval must be checked in Brevo; SMTP login verification cannot confirm it. Tests use SQLite and mocked email delivery, without touching production accounts or sending email.

## Existing accounts

The earlier demo used Firestore and browser storage. Those records do not move to Turso automatically. Do not trust or upload browser caches as accounts. If you need previous accounts, export them through a trusted administrator and import an array of objects containing `name`, `email`, `password` (legacy plaintext), and optional `createdAt`. Social records require `provider` (`google` or `apple`) and `firebaseUid` instead of a password.

```sh
npm run db:import -- path/to/trusted-export.json
npm run db:import -- path/to/trusted-export.json --apply
```

The first command validates the export. The second hashes passwords and inserts accounts, skipping existing emails or provider identities. Treat a legacy export containing passwords as a secret. The app removes the previous plaintext browser cache when it loads; export trusted records before relying on the new deployment.

## Authentication behavior

- Passwords are stored as salted scrypt hashes; session, recovery and verification secrets are stored as keyed hashes.
- New passwords require at least 15 characters and cannot match the common passwords checked by the app. Spaces and password manager autofill are supported. Older imported passwords can still sign in.
- Sessions use HttpOnly, SameSite cookies, with Secure and `__Host-` names on Vercel. “Remember me” persists for 30 days; other sessions expire after 24 hours.
- Password recovery returns the same response for matching and unknown accounts during normal delivery. Codes and links expire after 15 minutes; five wrong codes lock a challenge. Resending invalidates the previous challenge.
- Only a verified recovery cookie can change a password. Completion consumes the challenge, and “Sign out other devices” deletes the account's active Flux sessions.
- Write requests require JSON and reject a different browser origin. Rate limits persist in Turso across server instances.
- Google/Apple tokens are verified server-side against the configured Firebase project's signing keys, audience, issuer and verified email. A matching email alone cannot link a password account to a social identity. Enable each provider and authorize your deployment domain in Firebase Auth. Use `FIREBASE_PROJECT_ID` plus matching public `VITE_FIREBASE_*` values to change projects.

References: [Turso TypeScript client](https://docs.turso.tech/sdk/ts/reference), [Brevo SMTP settings](https://developers.brevo.com/docs/smtp-integration), [Nodemailer TLS options](https://nodemailer.com/smtp), [Vercel Node.js functions](https://vercel.com/docs/functions/runtimes/node-js).
