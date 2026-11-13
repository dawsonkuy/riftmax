# Riftmax — summoner profile UI mockup

A standalone, dark-charcoal **visual prototype** based on the original Riftmax layout sketch.

## Preview

Open [index.html](./index.html) in a browser. To preview locally, download the HTML file and double-click it. No npm install, framework, or build step required.

## What works in the prototype

- Centered navigation with Riot ID search styling
- Player profile card with rank, LP, wins, losses, and win rate
- Green/red LP graph that switches between 10, 20, and 50 sample games
- Compact victory/defeat cards that expand into a two-team scoreboard
- Separate Champions tab
- Remakes hidden by default, with an option to reveal them
- Responsive desktop and mobile layout

All statistics, match results, and displayed LP changes are **placeholder data**. Search, refreshing, filtering, and loading more matches are intentionally marked as nonfunctional until the API integration.

**Implementation note:** Match-specific LP gains/losses are not available through standard Riot match history endpoints. Production LP history should use tracked ranked snapshots, and only show per-match LP changes when verified.

This is deliberately a UI design prototype rather than a finished Riftmax app; it is independent of Earfolio and BestPad.
