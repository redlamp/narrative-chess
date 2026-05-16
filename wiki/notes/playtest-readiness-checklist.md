---
tags:
  - domain/auth
  - domain/security
  - scope/m1
  - status/open
---

# Playtest Readiness Checklist

Pre-flight before inviting outside players onto `narrative-chess.vercel.app`. M2 narrative layer is deferred until this list closes. Captured 2026-05-16.

Severity legend:

- **P0** must ship before any outside-player invite goes out
- **P1** should ship before scaling past first cohort (~5-10 testers)
- **P2** nice-to-have, queue for once the loop is healthy

## 0. Current branch / migration state

- [x] **P0** — Land PR #47 (admin tooling + invites), PR #48 (bulk role edit), PR #49 (per-move duration) into `dev`. Done 2026-05-16.
- [ ] **P0** — Ship `dev → main` so production carries the admin/invite/email-confirmation work. Pre-flight: run smoke test against the dev preview alias first.

## 1. Auth + onboarding

- [x] **P0** — Email confirmation. Already enabled on hosted Supabase per `app/(auth)/sign-up/actions.ts` comment. `app/auth/confirm` route exists. (`supabase/config.toml` local value is false — irrelevant, we are hosted-first.)
- [x] **P0** — Invite-only signup gate. Signup form requires `inviteCode`, validated via `consume_invite_code` RPC. Half-created auth user rolls back on failure.
- [x] **P0** — Password reset flow. `app/(auth)/reset-password` + `/reset-password/new` routes shipped.
- [ ] **P0** — Configure custom SMTP (Resend or Postmark). Supabase free tier email is rate-limited and from-address is generic. Custom SMTP also unlocks branded templates.
- [ ] **P0** — Brand the four Supabase auth email templates (signup confirm, magic link, password reset, email change). Match editorial palette + Fraunces wordmark.
- [ ] **P0** — Surface a "Forgot password" link in the sign-in form. Route exists but discoverability matters when a cold tester gets locked out.
- [ ] **P1** — CAPTCHA on signup. `supabase/config.toml` has `[auth.captcha]` commented out. Wire hCaptcha or Cloudflare Turnstile when the invite gate comes off.
- [ ] **P1** — Display-name uniqueness. `profiles.display_name` has no UNIQUE constraint; two users can claim the same name and the games list / move log shows collisions.
- [ ] **P2** — OAuth providers (Google, GitHub). Defer until post-beta unless a tester explicitly asks.

## 2. Privacy + legal

- [ ] **P0** — `/privacy` and `/terms` pages. Even a one-page each placeholder is enough for beta, but the auth dialog should link both before any new signup lands.
- [ ] **P0** — Account deletion path. User in `/account` page should be able to request deletion; admin nuke RPC works for staff but not for self-serve.
- [ ] **P1** — Cookie banner if any tester is in the EU. Vercel Analytics + Supabase auth cookies are functional-only, so a simple "we use cookies to keep you signed in" line is fine.
- [ ] **P2** — Data export. GDPR-lite "download my data" endpoint that returns the user's games + moves.

## 3. Abuse + safety

- [ ] **P0** — Profanity / slur filter on `display_name` at signup. Cheap word-list check; reject before profile insert. Otherwise the games list is one bad-actor away from broadcasting slurs.
- [ ] **P1** — Block / report flow for opponents. Initially "Report" can be a `mailto:` to support, but the games library already shows other players' open invites and that's the surface that needs the cleanup path.
- [ ] **P1** — Rate-limit `create_game` and `signup` server actions. Vercel has built-in IP rate limiting at the platform level (configurable in `vercel.json`); confirm or wire one explicitly.
- [ ] **P2** — Chat / DM is out of scope for beta. Confirm no chat surfaces shipped accidentally.

## 4. Observability

- [ ] **P0** — Error reporting. No Sentry / PostHog / Vercel error monitor wired yet. At minimum, install `@vercel/analytics` + `@vercel/speed-insights` and turn on Vercel Error Monitoring (free on Hobby). Sentry recommended for stack traces.
- [ ] **P0** — Vercel Runtime Logs retention. Hobby retains 1 day; if a tester reports a bug, the trace is gone within 24h. Either capture logs into Sentry/Better Stack or commit to investigating same-day.
- [ ] **P1** — Realtime + RLS gate procedure run before each major migration. See `wiki/notes/realtime-rls-gate-procedure.md`.
- [ ] **P1** — Health-check endpoint (`/api/health`) that pings Supabase + returns 200. Useful for an uptime monitor.
- [ ] **P2** — Status page (`status.narrative-chess.com` or similar). Premature for one-cohort beta.

## 5. Capacity + reliability

- [ ] **P0** — Supabase free-tier ceilings: 500 MB DB, 1 GB egress / month, 50K MAU, project auto-pauses after 7 days of inactivity. Beta cohort will exhaust egress fast if the games library hot-loads previews. Either upgrade to Pro ($25/mo) before the cohort hits ~10 active users or set a Realtime/egress alert.
- [ ] **P0** — Vercel Hobby ceilings: 100 GB bandwidth / month, 100K Function invocations, 2 cron jobs (1 already used for daily timeout sweep). Should comfortably cover beta but worth monitoring.
- [ ] **P1** — DB backup plan. Supabase free tier provides **no** automated backups. For beta, either upgrade to Pro (daily backups) or take manual SQL dumps weekly. Without this, a bad migration loses every game played to date.
- [ ] **P1** — Migration deployment SOP. Currently uses MCP `apply_migration` against hosted DB. Document the rollback path (manual `down` SQL) for anything destructive.
- [ ] **P2** — CDN cache settings for static board assets, fonts, pieces SVG.

## 6. Onboarding UX

- [ ] **P0** — Cold-browser smoke. Open `narrative-chess.vercel.app` in an incognito window with no Supabase session. Walk: landing → sign-up → confirm email → create game → share URL → open in second browser → join → play 5 moves → resign. Watch for any dead-end state.
- [ ] **P0** — Empty-state copy. New user with 0 games sees `/games` (Catalogue) — is the empty state inviting? Currently shelves render but might look like a broken page.
- [ ] **P0** — Mobile usability spot-check on real iOS Safari + Android Chrome. Polish C landed mobile layout but not every flow has been hand-tested on a real device.
- [ ] **P1** — "How to play" / rules clarity. Assume chess knowledge for now, but a one-liner about how to claim a timeout / what abort means would head off support questions.
- [ ] **P1** — Welcome email after signup. Linked from the invite code if invite-gated.
- [ ] **P1** — OpenGraph card for share URLs. Right now sharing `narrative-chess.vercel.app/games/<uuid>` in Slack/Discord yields a bare URL preview. A static OG image + per-game dynamic title would lift conversion.
- [ ] **P2** — Onboarding tour / first-game tutorial.

## 7. Game integrity

- [ ] **P0** — Server validates every move (chess.js engine wrapper). ✅ already done — confirm by inspecting `app/games/[gameId]/actions.ts::makeMove`. Add to manual smoke: try sending an illegal UCI via curl + service-role JWT and confirm it errors.
- [ ] **P0** — Realtime channel auth verified against RLS. Procedure exists at `wiki/notes/realtime-rls-gate-procedure.md`. Run once before doors open.
- [ ] **P1** — Clock enforcement under network lag. The chess.com 200 ms lag-credit policy is in place per the M1.5++ spec; confirm with a manual test on a throttled connection.
- [ ] **P2** — Engine-cheat detection. Out of scope for a friends-and-family beta.

## 8. Operations

- [ ] **P0** — Custom domain. `narrative-chess.vercel.app` works but a `.com` (or similar) reads more legitimate when shared. Cheap to register; redirect the vercel.app to it.
- [ ] **P0** — Support contact. Either a `mailto:taylor@redlamp.org` link in the footer or a dedicated `play@narrative-chess.com` alias. Without a support channel, bug reports vanish into Discord DMs.
- [ ] **P1** — Beta-tester comms channel. Discord or a private Slack works; pick before the first invite.
- [ ] **P1** — Incident runbook. Single page: "site is down, what now?" with Vercel status, Supabase status, log links.
- [ ] **P2** — Privatize v1 (`gh repo edit redlamp/narrative-chess-v1 --visibility private`). Already queued in the project tracker; confirm production smoke is happy first.

## 9. Pre-flight smoke (run within 24h of sending first invite)

- [ ] **P0** — Two-browser end-to-end on prod alias: signup → join → play → checkmate.
- [ ] **P0** — Timeout sweep: create a 5+0 game, let one side run out, confirm timeout fires within the next cron tick.
- [ ] **P0** — Realtime + RLS gate procedure green.
- [ ] **P0** — Mobile smoke on iOS Safari + Android Chrome.
- [ ] **P0** — Password reset cold-flow: forget password, click reset email, set new, sign in.
- [ ] **P1** — Concurrency: two clients submitting at the same time → loser sees `concurrency_conflict` toast + refreshes.
- [ ] **P1** — Observer mode: third user opens game URL, sees board read-only.
- [ ] **P1** — Resign + draw-offer paths render correct banners.
- [ ] **P1** — Move-list scrub + Play button + per-move durations land on prod (after PR #49 ships).

## 10. After-the-fact

- [ ] **P1** — Feedback loop. In-app "Send feedback" button → email or Discord. Surface 1 click away from any page.
- [ ] **P1** — Tester-facing release notes. Wiki page that summarises what changed each week so testers know whether to expect a bug to be fixed.
- [ ] **P2** — Public roadmap. Out of scope until M2.

## Related

- [[narrative-chess-v2]] — project tracker
- [[realtime-rls-gate-procedure]] — pre-migration verification
- [[decision-auth-email-password]] — auth choice context
- `.claude/memory/domain/auth.md` (project-local) — full email-confirmation re-enable checklist
