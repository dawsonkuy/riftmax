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
- Champions use an **iOS home-screen-style grid of four rounded portraits per row** on desktop and mobile. Each tile shows champion name, games played, and win rate. Click or tap a tile to expand its detailed statistics (record, KDA, K/D/A, CS/min, average damage, gold, and vision); the expanded panel has a dedicated **View matches** button to filter match history.
- Expand matches to view kills/deaths/assists, CS/min, damage, gold, vision, item builds, summoner spells, damage comparison and both teams' scoreboards.
- Load more sample matches, toggle remakes, and responsive desktop/mobile styling.

## Important data limitations

**All player statistics, games, rank history, game times, item builds, LP changes, and sessions in this prototype are invented sample data.** There is no live Riot or GRID API connection. Ranked LP deltas are not part of standard Riot match-history responses; production LP tracking and verified all-time peak ranks will require recorded ranked snapshots, queue-specific history, and careful handling of rank promotion/demotion boundaries. Session grouping currently uses demo game times and is scoped to the selected mode; production session detection should be based on chronological game timelines across queues and must handle missing match history. Detailed item builds and summoner spells also require Riot data.

The UI is a design prototype, independent of Earfolio and BestPad.
