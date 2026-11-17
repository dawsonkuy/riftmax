# Riftmax — Summoner Profile UI Prototype

Standalone dark-charcoal **interactive UI mockup** for Riftmax, based on the original layout sketch.

## Preview

Open [index.html](./index.html) in a browser, or use the [GitHub HTMLPreview](https://htmlpreview.github.io/?https://github.com/dawsonkuy/riftmax/blob/main/riftmax/index.html). The prototype is a single HTML file with inline CSS and JavaScript: no npm install or build step is required.

## Interactive features

- Horizontal, four-option **game-mode tab selector** across the top: Ranked Solo/Duo, Ranked Flex, Normal Draft, and ARAM. Profile, session, champion performance and match-history data change with the selected mode. Only ranked modes show the LP graph.
- Ranked profile shows current rank/LP, an **all-time peak** for the selected ranked queue (illustrative until historic snapshots are available), and sample season win rate. Unranked modes explicitly show **no ranked LP**.
- Last-20-games performance: win rate, overall KDA ratio, and current win/loss streak.
- A **ranked-only LP graph above Recent Performance**, with 24h, 7d, Month (30 days) and Season time selectors. Real time-interval filtering is performed against the sample match timestamps, with tooltip, division-promotion and demotion markers; Normal Draft and ARAM hide the graph but keep session tracking. Season currently means all available mock matches, not a full season of real ranked LP records.
- Sessions automatically group games in the currently selected mode separated by **up to 120 minutes between game end times**. Latest and previous sessions show win/loss record, elapsed duration and ranked LP movement when applicable.
- Champions use an **iOS home-screen-style grid of four rounded portraits per row** on desktop and mobile, automatically sorted by **Riftmax Champion Score** (0–100) within the selected game mode. Each tile shows champion name, games, and win rate, with rank and score badges overlaid on the champion art. The top three receive metallic **gold (#1), silver (#2), and bronze (#3)** rank badges. Tap a tile to see the detailed score breakdown, KDA, CS/min, damage, gold, vision and a dedicated **View matches** button.
- Expand matches to view kills/deaths/assists, CS/min, damage, gold, vision, item builds, summoner spells, damage comparison and both teams' scoreboards.
- Load more sample matches, toggle remakes, and responsive desktop/mobile styling.

## Riftmax Champion Score v1 (personal champion proficiency)

Riftmax Score rates **how well this particular player performs on each champion in the selected queue**. It is not a global champion strength tier list. Remakes do not count.

**Formula:** 60% adjusted win rate + 25% experience + 15% role-aware performance; each component is 0–100.

1. **Win quality (60%):** The adjusted win rate is (wins + 10) / (games + 20), a neutral Beta(10,10) prior equivalent to ten additional wins and ten additional losses. This prevents a 2–0 record from behaving like a statistically reliable 100% win rate. Win quality is clamp(50 + 250 * (adjusted win rate - 0.5), 0, 100).
2. **Experience (25%):** 100 * min(1, ln(1 + games) / ln(101)). Each added game matters less than the one before; the experience bonus caps at 100 games.
3. **Performance (15%):** KDA (40%), CS/minute (20%), damage/minute (25%), and vision/minute (15%), graded relative to illustrative role-specific benchmarks. Each metric grade is clamp(50 + 50 * log2(actual / baseline), 0, 100). The combined performance is shrunk toward neutral 50 by the reliability factor games / (games + 12). ARAM uses its own 55% KDA and 45% damage/min performance calculation instead of lane roles, CS and vision.

The UI sorts by rounded Riftmax Score descending, then unrounded win-quality contribution, then games, then champion name. Each tile shows ordinal rank and numeric score as icon overlays, with the component breakdown in its expanded panel.

**Calibration limitations:** In this UI prototype, match data is invented and each champion is given a representative position using a static lookup. The benchmark numbers are heuristics, not Riot or population-validated data. Production should derive actual roles from matches and use separately calibrated baselines by role, rank, queue and patch. Score is an optional explanatory personal stat, not a verified measure of skill or matchmaking value.

## Riot API integration plan

See https://developer.riotgames.com/ and the official LoL documentation at https://developer.riotgames.com/docs/lol. **Do not put the Riot API key in this HTML prototype, a browser request, or GitHub.**

1. Sign in to the Riot Developer Portal and generate a development key (temporary, expires every 24 hours). Before public release, register Riftmax and apply for an approved production key.
2. Run a private backend or Cloudflare Worker using the key as a secret (for Cloudflare, `wrangler secret put RIOT_API_KEY`). Expose only validated, rate-limited Riftmax endpoints to the browser.
3. Search Riot ID (game name + tag) using Account-v1 `GET /riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine}` on `americas` / `europe` / `asia` as appropriate, then use the returned PUUID as the stable player identifier.
4. Retrieve ranked entries from League-v4 on the player's platform host (for NA: `na1.api.riotgames.com`) and recent match IDs/details from Match-v5 on a regional host (for NA: `americas.api.riotgames.com`). Match-V5 ID list: `GET /lol/match/v5/matches/by-puuid/{puuid}/ids?start=0&count=20`, details: `GET /lol/match/v5/matches/{matchId}`.
5. Normalize Riot queue IDs into Solo/Duo, Flex, Draft, ARAM. Aggregate champion game counts, win rates and per-minute metrics from real matches. Build sessions from game timestamps.
6. **Store ranked snapshots in a database** (PUUID, platform, queue, tier, division, leaguePoints, timestamp, optional match ID). Riot Match-V5 does not provide verified per-match LP gains/losses, and an API key cannot retrieve a complete historical LP graph retroactively. Only graph verified changes and label gaps as missing history. Store all-time peak from tracked snapshots, not from a fabricated rank.
7. Cache game data and respect HTTP 429 `Retry-After`, per-route rate limits and current Riot API policies. For images use Riot Data Dragon assets, ideally current version rather than an old hard-coded patch.

The UI is a static demonstration, not yet connected to Riot. An API key alone is not sufficient to make the prototype live.

## Important data limitations

**All player statistics, games, rank history, game times, item builds, LP changes, and sessions in this prototype are invented sample data.** There is no live Riot or GRID API connection. Ranked LP deltas are not part of standard Riot match-history responses; production LP tracking and verified all-time peak ranks will require recorded ranked snapshots, queue-specific history, and careful handling of rank promotion/demotion boundaries. Session grouping currently uses demo game times and is scoped to the selected mode; production session detection should be based on chronological game timelines across queues and must handle missing match history. Detailed item builds and summoner spells also require Riot data.

The UI is a design prototype, independent of Earfolio and BestPad.
