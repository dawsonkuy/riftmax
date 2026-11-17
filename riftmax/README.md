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

## Riot API backend — ready for deployment

Riftmax now includes a separate Cloudflare Worker at `api/worker.js`, configuration at `api/wrangler.toml`, and a frontend that can query it by Riot ID. No Riot key is stored in the repository.

### Deploy the Worker (Windows PowerShell)

1. On https://developer.riotgames.com/ regenerate your **development API key**. Keys shared in chat should be considered exposed; Riot development keys also expire every 24 hours.
2. From an existing cloned Riftmax repository, update files and enter the Worker directory:

```powershell
cd $HOME\riftmax
git pull
cd .\riftmax\api
npx.cmd wrangler login
npx.cmd wrangler deploy
npx.cmd wrangler secret put RIOT_API_KEY
```

3. **Only when prompted by Wrangler**, paste the newly generated key into the terminal. Do not type the key into a GitHub file or into the website. Wrangler will deploy an updated version with the encrypted secret.
4. Open the deployment URL printed by Wrangler, adding `/api/health`. It should return JSON with `ok: true` and `configured: true`.
5. Open the [online Riftmax preview](https://htmlpreview.github.io/?https://github.com/dawsonkuy/riftmax/blob/main/riftmax/index.html). Click **Connect Riot backend**, enter the Worker base URL (just `https://...workers.dev`, not `/api/health`), and click **Save URL**. Search for a Riot ID in the format `Name#TAG`. The region selector is in the backend settings.

**Important:** The existing PowerShell `start .\riftmax\index.html` command opens a `file://` page, which is not an approved cross-origin source for the Worker. Use the online preview or host the HTML locally on `http://localhost:8788` instead. The Worker allows `https://htmlpreview.github.io`, `http://localhost:8788`, and `http://127.0.0.1:8788`; add your real website origin to the `ALLOWED_ORIGINS` value in `api/wrangler.toml` before production deployment.

### What the integration really does

- GET `/api/health`: check Worker and secret configuration (without revealing the key).
- GET `/api/profile?gameName=Example&tagLine=NA1&platform=na1`: uses Account-V1, League-V4, Summoner-V4 and Match-V5; returns sanitized account, rank, and up to 20 normalized matches. Riot requests use the server-side `RIOT_API_KEY` Worker secret.
- The frontend now loads that data when you search `Name#TAG`, updates the current rank and record, filters matches by queue, computes champion scores, and supports match-detail expansion. If a lookup fails, existing data stays visible and an error is shown.
- It explicitly **does not invent LP gains, all-time peaks or graph history** when connected to real Riot data. Those require a separate, durable rank snapshot database and reliable backfill policy. A `0 LP` or fake session change is never used as a placeholder.
- Matches and account data are cached for limited periods; Riot 429 rate-limit replies are surfaced. This is a **personal development prototype**, not a production-scale rate-limited service. Add per-client throttling, a permanent datastore and Riot product registration before opening the Worker to many users.

### Keeping it running

A Riot development key expires every 24 hours. After regenerating the key, run `npx.cmd wrangler secret put RIOT_API_KEY` again in the `riftmax/api` directory. For a publicly launched Riftmax, apply for Riot's appropriate approved production key and comply with its published policies.

Official docs: https://developer.riotgames.com/docs/lol and https://developers.cloudflare.com/workers/configuration/secrets/.

## Remaining feature work

Build queue-aware ranked snapshots with durable storage, verify rank promotion boundaries, add rate-limiting/WAF rules, improve queue coverage, and calibrate champion-scoring benchmarks against actual matches and roles.

## Important data limitations

**The initial demo data is illustrative. Once the backend is deployed and a Riot ID is searched successfully, live account, match, and ranked stats replace the demo. There is no GRID integration.** Ranked LP deltas are not part of standard Riot match-history responses; production LP tracking and verified all-time peak ranks will require recorded ranked snapshots, queue-specific history, and careful handling of rank promotion/demotion boundaries. Session grouping currently uses demo game times and is scoped to the selected mode; production session detection should be based on chronological game timelines across queues and must handle missing match history. Detailed item builds and summoner spells also require Riot data.

The UI is a design prototype, independent of Earfolio and BestPad.
