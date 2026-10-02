# Tech debt and architecture notes

- **AI build rules are global.** `data/ai.json` has one rule set per category. A leader menu that adds a category the profile has no rules for is never built by the computer. Leader-specific AI rules (or a per-leader profile) will be needed once kits really differ.
- **Kit drift.** The default kit mirrors the category menus by hand. A test guards it, but every new unit must also be added to `data/loadouts.json`.
- **Leader identity is split.** Names/portraits live in `campaign.json`, loadouts in `loadouts.json`. Skirmish depends on the campaign data only for names and portraits (fallback: title-cased id). Consider one source.
- **Cramped maps.** On `classic` the formation pushes some units to odd spots (artillery ends up ahead); on `tri_point` properties on the row ahead displace five units. Naval maps lose their starting fleets when a leader is used (`None` keeps them). Maps may need hand-authored formation hints.
- **Quick Start / default mission** do not use leaders.
- **`Session.leaderName`** is an ad hoc hook for the intro matchup line; there is no Session/UI test for it.
- **Skirmish screen** re-renders every portrait canvas on each change.
- **Leaders are independent of team colour**; they could be tied together later.
- **Not visually verified.** The picker's layout at phone width was not checked in a browser (the sandbox browser could not reach localhost); only unit tests cover it.
