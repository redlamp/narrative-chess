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

## See also

- [[mocs/decisions]]
- [[mocs/architecture]]
- `docs/superpowers/specs/2026-05-02-v2-foundation-design.md` §4
