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
   g. product direction changed from `sync/async` to time controls
   h. time-control schema + invite presets implemented
   i. move append / turn sync implemented
   j. `Active` games can now be opened into the match surface
   k. rated completion + Elo update implemented
   l. Play header now shows multiplayer status and Elo delta for completed rated games

## Next

1. Add remote refresh / polling or Realtime so opponent moves appear without manual reopen

2. Pull completed multiplayer games into a dedicated list or archive surface

3. Add Supabase Realtime subscriptions for multiplayer

4. Let invite creator choose or randomize color instead of fixed white

## Durable data already moved to Supabase

1. city editions and published/draft versions
2. cloud layout bundles
3. saved matches

## Notes

1. Keep public Play on published city data by default
2. Keep invite-based multiplayer before public matchmaking
3. Keep `Historic` separate from multiplayer state
4. Current invite flow assigns creator = white and opponent = black as a first pass
5. Replace user-facing `sync/async` with time-control presets like `10 min` and `1 move / day`
