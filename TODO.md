# TODO

Last updated: April 18, 2026

## In Progress

1. Multiplayer groundwork
   a. `Games` tabs split into `Active`, `Yours`, `Historic`
   b. multiplayer plan doc added
   c. profiles + username claim UI scaffolded
   d. multiplayer schema tables scaffolded
   e. invite-by-username RPCs added
   f. `Active` tab now creates invites and accepts / declines them
   g. next: move append / turn sync

## Next

1. Add move append / turn update flow

2. Add rated game completion + Elo update

3. Add `Resume game` flow from `Active`

4. Add Supabase Realtime subscriptions for multiplayer

5. Let invite creator choose or randomize color instead of fixed white

## Durable data already moved to Supabase

1. city editions and published/draft versions
2. cloud layout bundles
3. saved matches

## Notes

1. Keep public Play on published city data by default
2. Keep invite-based multiplayer before public matchmaking
3. Keep `Historic` separate from multiplayer state
4. Current invite flow assigns creator = white and opponent = black as a first pass
