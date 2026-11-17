# Riftmax — Riot Profile & Season Tracker

Standalone dark-charcoal Riftmax frontend with a secure Cloudflare Worker backend for Riot data. A demo state remains visible until a live Riot ID is searched.

## Preview

Open [index.html](./index.html) in a browser, or use the [GitHub HTMLPreview](https://htmlpreview.github.io/?https://github.com/dawsonkuy/riftmax/blob/main/riftmax/index.html). The prototype is a single HTML file with inline CSS and JavaScript: no npm install or build step is required.

## Branding and official ranked emblems

The page background is **black**, and the provisional wordmark is bold blue **RM**. Dark charcoal cards remain for contrast.

Current ranked Solo/Duo and Flex tiers use official League of Legends game-client emblem artwork, with a smaller matching emblem beside the verified **tracked peak**. All ten tiers are supported (Iron through Challenger). Unranked and non-ranked modes do not show a misleading emblem.

The images are loaded from CommunityDragon's pinned 16.2 mirror of Riot's client assets:
https://raw.communitydragon.org/16.2/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-emblem/

Riot also provides official rank emblem bundles at https://developer.riotgames.com/docs/lol#ranked-info. The website retains plain-text rank/LP as a fallback if the third-party image mirror is unavailable. The CDN image requests contain no API key.

## Interactive features

- Horizontal **six-option game-mode tab selector** across the top: All, Ranked Solo/Duo, Ranked Flex, Normal Draft, ARAM, and Other. 'Other' preserves special/rotating queues. Profile, session, champion performance and match-history data change with the selected mode. Only ranked modes show the LP graph.
- Ranked profile shows current rank/LP. In live mode, the **tracked peak** is based on verified snapshots saved to Cloudflare D1, if enabled. Historical all-time peak LP prior to enabling tracking is unavailable through the Riot APIs. Unranked modes explicitly show **no ranked LP**.
- Last-20-games performance: win rate, overall KDA ratio, and current win/loss streak.
- A **ranked-only LP graph above Recent Performance**, with 24h, 7d, Month (30 days) and Season time selectors. Real time-interval filtering is performed against the sample match timestamps, with tooltip, division-promotion and demotion markers; Normal Draft and ARAM hide the graph but keep session tracking. Season currently means all available mock matches, not a full season of real ranked LP records.
- Sessions automatically group games in the currently selected mode separated by **up to 120 minutes between game end times**. Latest and previous sessions show win/loss record, elapsed duration and ranked LP movement when applicable.
- Champions use an **iOS home-screen-style grid of four rounded portraits per row** on desktop and mobile, automatically sorted by **Riftmax Champion Score** (0–100) within the selected game mode. Each tile shows champion name, games, and win rate, with rank and score badges overlaid on the champion art. The top three receive metallic **gold (#1), silver (#2), and bronze (#3)** rank badges. Tap a tile to see the detailed score breakdown, KDA, CS/min, damage, gold, vision and a dedicated **View matches** button.
- Expand matches to view kills/deaths/assists, CS/min, damage, gold, vision, item builds, summoner spells, damage comparison and both teams' scoreboards.
- Load more displayed matches, toggle remakes, and responsive desktop/mobile styling. In live mode, **current-season match IDs are paginated automatically** with Riot rate-limit cooldown, visible progress, pause/resume, browser caching, and a completed-season indicator.

## Riftmax Champion Score v1 (personal champion proficiency)

Riftmax Score rates **how well this particular player performs on each champion in the selected queue**. It is not a global champion strength tier list. Remakes do not count.

**Formula:** 60% adjusted win rate + 25% experience + 15% role-aware performance; each component is 0–100.

1. **Win quality (60%):** The adjusted win rate is (wins + 10) / (games + 20), a neutral Beta(10,10) prior equivalent to ten additional wins and ten additional losses. This prevents a 2–0 record from behaving like a statistically reliable 100% win rate. Win quality is clamp(50 + 250 * (adjusted win rate - 0.5), 0, 100).
2. **Experience (25%):** 100 * min(1, ln(1 + games) / ln(101)). Each added game matters less than the one before; the experience bonus caps at 100 games.
3. **Performance (15%):** KDA (40%), CS/minute (20%), damage/minute (25%), and vision/minute (15%), graded relative to illustrative role-specific benchmarks. Each metric grade is clamp(50 + 50 * log2(actual / baseline), 0, 100). The combined performance is shrunk toward neutral 50 by the reliability factor games / (games + 12). ARAM uses its own 55% KDA and 45% damage/min performance calculation instead of lane roles, CS and vision.

The UI sorts by rounded Riftmax Score descending, then unrounded win-quality contribution, then games, then champion name. Each tile shows ordinal rank and numeric score as icon overlays, with the component breakdown in its expanded panel.

**Calibration limitations:** In this UI prototype, match data is invented and each champion is given a representative position using a static lookup. The benchmark numbers are heuristics, not Riot or population-validated data. Production should derive actual roles from matches and use separately calibrated baselines by role, rank, queue and patch. Score is an optional explanatory personal stat, not a verified measure of skill or matchmaking value.

## Live Riot API and full-season history

Riftmax uses a secure Cloudflare Worker in `api/worker.js`. The Riot API key stays in the Cloudflare `RIOT_API_KEY` secret; never put it in GitHub or the browser.

### Deploy updated code (already-connected users)

If the Riot key is already configured in Cloudflare, **do not paste it again**. Update and deploy the Worker:

```powershell
cd $HOME\riftmax
git pull
cd .\riftmax\api
npx.cmd wrangler deploy
```

Start the local frontend separately:

```powershell
cd $HOME\riftmax\riftmax
npx.cmd --yes http-server . -a 127.0.0.1 -p 8788 -c-1
```

Open http://127.0.0.1:8788, use the previously configured Worker URL, and search a Riot ID like `dawsk#vlova`. Riftmax automatically imports the **current season**. Keep the browser tab open until the import reports **Complete**. The progress panel permits pause/resume. Imported history is cached in this browser and reused when the latest match ID is unchanged.

### Season scope and pagination

The default current season is **2026 Season 3**, beginning **July 29, 2026 at noon NA server-local time** (configured UTC timestamp `2026-07-29T19:00:00Z`). Riot patch 26.14 officially confirms the starting date/time. If deploying for another region or after a new season begins, set the Worker variables `SEASON_START` (UTC ISO date/time) and `SEASON_LABEL` before redeploying.

Match-V5 IDs are requested with `startTime`, a `start` offset and `count=15`. The frontend retrieves all available pages and their match details until Riot provides fewer than 15 IDs. **Unknown/rotating game queues are retained** under Other and All instead of disappearing. Riot may omit certain historical games, so 'complete' means all matches Riot returned within the requested window, not a promise that deleted/unavailable records exist.

Match-based season win rates, champion counts and scoring are based on games **loaded so far** until import completes. Current ranked tier and LP are obtained separately from League-V4. Riot rate limits can temporarily pause the import; the frontend respects Retry-After when provided and allows resuming.

### Persistent tracked rank peak (Cloudflare D1)

Riot does **not** provide a prior all-time peak rank or per-match LP changes through standard Match-V5/League-V4 endpoints. Downloading every match cannot reconstruct a verified historical all-time peak. To store the highest **observed** rank/LP going forward, enable the D1 rank snapshot tracker:

```powershell
cd $HOME\riftmax
git pull
cd .\riftmax\api
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\setup-rank-history.ps1
```

The setup script creates `riftmax-rank-history`, adds the `RANK_DB` binding to `wrangler.toml`, applies `schema.sql` remotely, and deploys the Worker. It **does not need or replace your Riot API key**. Wrangler might offer to add the binding automatically; the script avoids duplicating it.

Search your Riot ID after setup to save the first verified ranked snapshot. The app displays **Tracked peak (since YYYY-MM-DD)**. This is not a retroactive all-time peak. Snapshots are taken on account lookup, not continuously after every game, so a peak reached and lost between lookups cannot be recovered.

### Endpoints and other limits

- `GET /api/health`: reports Worker readiness and key presence without exposing the key.
- `GET /api/profile?gameName=dawsk&tagLine=vlova&platform=na1&start=0`: first page of season match results, current rank and optional observed peak, plus `pagination`, `season` and `rankHistory`. Continue with `start=<nextStart>` until `hasMore=false`.
- Riot development keys expire every 24 hours and have low rate limits. For public access, use an approved production key and add server-side throttling, centralized caching, and durable season-match storage.
- Exact per-match LP gains and verified lifetime historical peaks remain unavailable without an older trustworthy tracking dataset or continuous snapshots. Never infer them from match outcomes.

References: https://developer.riotgames.com/docs/lol, https://developer.riotgames.com/docs/portal, https://www.leagueoflegends.com/en-gb/news/game-updates/league-of-legends-patch-26-14-notes/, and https://developers.cloudflare.com/d1/get-started/.

## Important data limitations

**The initial demo data is illustrative. Once the backend is deployed and a Riot ID is searched successfully, live account, match, and ranked stats replace the demo. There is no GRID integration.** Ranked LP deltas are not part of standard Riot match-history responses; production LP tracking and verified tracked peak ranks require recorded ranked snapshots, queue-specific history, and careful handling of rank promotion/demotion boundaries. Session grouping currently uses demo game times and is scoped to the selected mode; production session detection should be based on chronological game timelines across queues and must handle missing match history. Detailed item builds and summoner spells also require Riot data.

The UI is a design prototype, independent of Earfolio and BestPad.
