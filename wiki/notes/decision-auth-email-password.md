---
tags:
  - domain/auth
  - domain/supabase
  - status/adopted
  - scope/m1
---

# Decision — Auth: Email + Password for M1, OAuth Deferred

**Date:** 2026-05-02
**Status:** Adopted

## Context

`docs/V2_PLAN.md` did not specify which auth method M1 would use. Supabase Auth supports email + password, magic link, OAuth (Google/GitHub/etc.), and SAML. Each has different setup cost, test-flow cost, and Vercel preview URL handling.

## Options considered

1. **A. Email + password** (chosen)
2. B. Magic link (passwordless email)
3. C. OAuth (Google + GitHub)
4. D. Anonymous sign-in (Supabase 2024+ feature)

## Choice

Email + password for M1. OAuth deferred to M2+ (low priority, easy to add later).

## Why

- Cheapest test path: e2e Playwright test fills two `<input>` fields and clicks submit. No external provider mocking, no email-link interception, no OAuth callback gymnastics.
- No external provider config to maintain (Google Cloud project, OAuth client IDs, secrets, redirect URIs per environment).
- Supabase ships email + password out of the box; only Auth setting to touch is the redirect URL allow list.
- Magic link is similar effort but adds an email round-trip per test (slow + flaky in CI).
- OAuth is "free" with Supabase but locks the user into linking a real Google/GitHub account just to test the chess game — friction for early development.
- Anonymous sign-in defers identity but breaks any feature that needs persistent identity (e.g., game history). M1 has 0 such features but this would change in M1.5+.

Cost is not the gate — Supabase free tier supports OAuth at no charge. Setup complexity is the gate.

## When OAuth gets added (M2+)

- Likely Google + GitHub providers
- Supabase dashboard → Authentication → Providers → enable per provider, paste client ID + secret
- Add provider's redirect URI on the provider side (Google Cloud / GitHub developer settings)
- Add `https://narrative-chess.vercel.app/auth/callback` etc. to Supabase redirect URLs
- Login UI grows a "Continue with Google" button
- Test flow: existing email/password e2e remains; add separate OAuth e2e if needed (typically mocked at the OAuth boundary)

## Risks / follow-ups

- Email verification flow: Supabase free tier sends from a default Supabase-branded address with rate limits. For M1 with 2 test users, fine. M2+: configure custom SMTP if user-facing email volume rises.
- Password reset flow: same email constraint applies.
- Forgot-password UX: deferred to M1.5 or M2.

## Current settings (live)

- **Provider:** Email + password (no OAuth, no magic link, no passkey for MVP)
- **Email confirmation:** **DISABLED** in Supabase Auth → Email provider → Confirm email = OFF
- **Site URL:** `https://narrative-chess.vercel.app`
- **Redirect URLs allow list:**
  - `http://localhost:3000/**`
  - `https://narrative-chess.vercel.app/**`
  - `https://narrative-chess-git-dev-taylor-8571s-projects.vercel.app/**` (kept; redundant with wildcard but harmless)
  - `https://narrative-chess-git-*-taylor-8571s-projects.vercel.app/**` (added 2026-05-04 for feat-branch previews; pairs with Vercel env scope widened to "Preview (all)" for `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Service role key still scoped to Preview-dev only.)

## TODO — Re-enable email confirmation before broader release

Why OFF today: MVP simplicity. Sign-up flow finishes in one round-trip without forcing the user to check email + click a link. Acceptable risk for M1 (closed beta, trusted testers) but **must be re-enabled before broader release**.

Checklist when transitioning from M1/M2 testing to public-ish access:

1. Supabase dashboard → Auth → Email provider → **Confirm email = ON**
2. Verify SMTP is configured (Supabase free tier ships limited built-in SMTP — check rate caps; consider Resend or SendGrid for production volume)
3. Customize email templates: confirmation, password reset, magic link (Supabase dashboard → Auth → Email Templates)
4. Update sign-up flow to show "Check your email" message after submit instead of redirecting straight to `/`
5. Add `/auth/confirm` callback route to handle the confirmation link
6. Add `/auth/reset-password` flow (currently absent — will need it once confirmations are real)
7. End-to-end test: real email account → sign up → click confirmation link → verify session activates

Routine check-in `trig_015ySpmnFNMvnesR4WRoir9k` fires 2026-05-09 09:00 UTC as a reminder.

## See also

- [[mocs/decisions]]
- [[mocs/architecture]]
- `docs/superpowers/specs/2026-05-02-v2-foundation-design.md` §4
- Server actions: `app/(auth)/sign-up/actions.ts`, `app/(auth)/login/actions.ts`
- Logout route: `app/auth/logout/route.ts`
- Auth-aware landing: `app/page.tsx`
