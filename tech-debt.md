# Tech debt and architecture notes

- **AI build rules are global.** `data/ai.json` has one rule set per category. A leader menu that adds a category the profile has no rules for is never built by the computer. Leader-specific AI rules (or a per-leader profile) will be needed once kits really differ.
- **Kit drift.** The default kit mirrors the category menus by hand. A test guards it, but every new unit must also be added to `data/loadouts.json`.
- **Leader identity is split.** Names/portraits live in `campaign.json`, loadouts in `loadouts.json`. Skirmish depends on the campaign data only for names and portraits (fallback: title-cased id). Consider one source.
- **Cramped maps.** On `classic` the formation pushes some units to odd spots (artillery ends up ahead); on `tri_point` properties on the row ahead displace five units. Naval fleets now come from the shipyard set, so they no longer vanish, but they are one default destroyer per shipyard rather than the map author's fleet. A map with no factories (`river_run`) gives only the HQ and airfield sets. Maps may need hand-authored formation hints.
- **Quick Start / default mission** do not use leaders.
- **`Session.leaderName`** is an ad hoc hook for the intro matchup line; there is no Session/UI test for it.
- **Skirmish screen** re-renders every portrait canvas on each change.
- **Leaders are independent of team colour**; they could be tied together later.
- **Not visually verified.** The picker's layout at phone width was not checked in a browser (the sandbox browser could not reach localhost); only unit tests cover it.
- **Session has no automated test.** The commentary logic, banner, pacer and hold gesture are unit-tested, but the Session wiring (opening cards, the banner during the computer's turn, fast-forward) was only checked with a throwaway headless-browser script. A small browser smoke test in `tools/` would pay for itself.
- **Milestones share situations.** The commentary milestones reuse the speech files' existing situations (a first kill is a `taunt`, a lost building a `danger`). Dedicated situations (`first_kill`, `hq_threat`, ...) with their own lines would let each milestone sound specific; `greeting`, `praise` and `tech` are still unused in battle.
- **The banner covers the bottom of the map** during opening cards and the computer's turn; it could move to the side of the screen away from the action, like the dock.
- **Portrait colours follow the leader's own faction**, while the banner accent and the units follow the team colour, so a leader can look mismatched with their army.
- **Eye drawing is parametric but 2D-flat:** expressions (angry, shock) only change brow and lid openness, not each style's eye shape.
