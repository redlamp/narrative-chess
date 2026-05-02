# Auth — Current State

**Last updated:** 2026-05-02

## Current settings

- **Provider:** Email + password (no OAuth, no magic link, no passkey for MVP)
- **Email confirmation:** **DISABLED** (Supabase Auth → Email provider → Confirm email = OFF)
- **Site URL:** `https://narrative-chess.vercel.app`
- **Redirect URLs allow list:**
  - `http://localhost:3000/**`
  - `https://narrative-chess.vercel.app/**`
  - `https://narrative-chess-git-dev-taylor-8571s-projects.vercel.app/**`

## Why email confirmation is OFF

MVP simplicity. Lets sign-up flow finish in one round-trip without forcing the user to check email + click a link. Acceptable risk for M1 (closed beta, trusted testers) but **must be re-enabled before broader release**.

## TODO — Re-enable email confirmation before release

When the project transitions from M1/M2 testing to public-ish access:

1. Supabase dashboard → Auth → Email provider → **Confirm email = ON**
2. Verify SMTP is configured (Supabase free tier ships limited built-in SMTP — check rate caps; consider Resend or SendGrid for production volume)
3. Customize email templates: confirmation, password reset, magic link (Supabase dashboard → Auth → Email Templates)
4. Update sign-up flow to show "Check your email" message after submit instead of redirecting straight to `/`
5. Add `/auth/confirm` callback route to handle the confirmation link
6. Add `/auth/reset-password` flow (currently absent — will need it once confirmations are real)
7. End-to-end test: real email account → sign up → click confirmation link → verify session activates

## Related

- Spec: `docs/superpowers/specs/2026-05-02-v2-foundation-design.md` §6 (auth design)
- Decision note: `wiki/notes/decision-auth-email-password.md`
- Server actions: `app/(auth)/sign-up/actions.ts`, `app/(auth)/login/actions.ts`
- Logout route: `app/auth/logout/route.ts`
- Auth-aware landing: `app/page.tsx`
