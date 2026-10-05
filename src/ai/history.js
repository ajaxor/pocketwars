// What the computer has learned about the person playing it, across battles, kept in this browser (localStorage). The strategist uses
// it when it picks a game plan (strategist/selector.js): plans that have beaten this player are favoured, plans the player has seen
// little of get a novelty bonus, and last battle's plan is avoided, so the computer does not fall into a pattern a player can learn
// to exploit.
//
//   history = { strategies: { [strategyId]: { games, wins } }, last: strategyId | null }   (wins: battles the computer won)
//   loadHistory(store?)             the saved history (an empty one when there is none or storage is refused)
//   recordGame(game, store?)        add a finished battle: every plan each computer player used, and whether it won
//
// Never throws: a browser that refuses storage (a private window) just gets a computer that learns nothing between battles.

const KEY = 'pocketwars.ai.history';
const defaultStore = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };
const empty = () => ({ strategies: {}, last: null });

export function loadHistory(store = defaultStore()) {
  try {
    const h = JSON.parse(store?.getItem(KEY) ?? 'null');
    return h && typeof h === 'object' && h.strategies ? h : empty();
  } catch { return empty(); }
}

export function recordGame(game, store = defaultStore()) {
  if (!store || !game.isOver) return null;
  const h = loadHistory(store);
  game.map.players.forEach((p, player) => {
    if (p.controller !== 'ai') return;
    const log = game.state.ai?.[player]?.log;
    if (!log?.length) return;
    const won = game.state.winner === player;
    for (const id of new Set(log.map((l) => l.id))) {
      const s = (h.strategies[id] ??= { games: 0, wins: 0 });
      s.games++;
      if (won) s.wins++;
    }
    h.last = log[0].id;
  });
  try { store.setItem(KEY, JSON.stringify(h)); } catch { /* storage full or refused: forget it */ }
  return h;
}
