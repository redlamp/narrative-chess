## What changed

(One-paragraph summary)

## How tested

(Specific verification steps run locally — not "ran the tests")

## Checklist

- [ ] CI green locally (`bun run lint && bunx tsc --noEmit && bunx playwright test`)
- [ ] Migration touched? If yes, ran `supabase db reset` locally OR accepted hosted-only risk
- [ ] RLS or Realtime touched? If yes, ran the gate procedure (`wiki/notes/realtime-rls-gate-procedure.md`)
- [ ] Server Action takes user input? If yes, validated with Zod
- [ ] chess.js imported? If yes, only inside `lib/chess/engine.ts`
