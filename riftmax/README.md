# Riftmax — Summoner Profile UI Prototype

Standalone dark-charcoal **interactive UI mockup** for Riftmax, based on the original layout sketch.

## Preview

Open [index.html](./index.html) in a browser, or use the [GitHub HTMLPreview](https://htmlpreview.github.io/?https://github.com/dawsonkuy/riftmax/blob/main/riftmax/index.html). The prototype is a single HTML file with inline CSS and JavaScript: no npm install or build step is required.

## Interactive features

- Horizontal, four-option **game-mode tab selector** across the top: Ranked Solo/Duo, Ranked Flex, Normal Draft, and ARAM. Profile, session, champion performance and match-history data change with the selected mode. Only ranked modes show the LP graph.
- Ranked profile shows current rank/LP, an **all-time peak** for the selected ranked queue (illustrative until historic snapshots are available), and sample season win rate. Unranked modes explicitly show **no ranked LP**.
- Last-20-games performance: win rate, overall KDA ratio, and current win/loss streak.
- 10/20/50-game **ranked-only LP graph**: ranked LP movement. Normal Draft and ARAM hide the entire LP graph but still display session statistics. Focus, tap or hover a match dot to see champion, result, rating and LP change (ranked only). Ranked division promotions and demotions get a highlighted marker where the illustrative sample crosses a division threshold. A selected range can have fewer games when the sample does not contain enough.
- Sessions automatically group games in the currently selected mode separated by **up to 120 minutes between game end times**. Latest and previous sessions show win/loss record, elapsed duration and ranked LP movement when applicable.
- Champions use an **iOS home-screen-style grid of four rounded portraits per row** on desktop and mobile, automatically sorted by **Riftmax Champion Score** (0–100) within the selected game mode. Each tile shows champion name, games, and win rate, with rank and score badges overlaid on the champion art. Tap a tile to see the detailed score breakdown, KDA, CS/min, damage, gold, vision and a dedicated **View matches** button.
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

## Important data limitations

**All player statistics, games, rank history, game times, item builds, LP changes, and sessions in this prototype are invented sample data.** There is no live Riot or GRID API connection. Ranked LP deltas are not part of standard Riot match-history responses; production LP tracking and verified all-time peak ranks will require recorded ranked snapshots, queue-specific history, and careful handling of rank promotion/demotion boundaries. Session grouping currently uses demo game times and is scoped to the selected mode; production session detection should be based on chronological game timelines across queues and must handle missing match history. Detailed item builds and summoner spells also require Riot data.

The UI is a design prototype, independent of Earfolio and BestPad.
