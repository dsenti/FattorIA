// Class leaderboard ("classifica").
// For now this is a STUB: it only knows the local player. The interface is what the
// Supabase version will implement (see SUPABASE_SETUP.md), so the UI will not change.
//
//   submitScore(entry)   -> Promise<boolean>   entry = { playerId, name:{e,n,a,num}, totalCoins, avgCoins, farmers }
//   fetchBoard(kind)     -> Promise<{ online:boolean, note:string|null, rows:[{ playerId, name, value, isMe }] }>
//                           kind = 'rich' (total coins earned) | 'precise' (average coins per farmer)

import { CONFIG } from './config.js';

let lastLocal = null;

export function isOnline() {
  return !!(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY);
}

export async function submitScore(entry) {
  lastLocal = { ...entry };
  if (!isOnline()) return false;
  // TODO(Dominik): once the Supabase project exists, upsert into `scores` here, e.g.
  // fetch(`${CONFIG.SUPABASE_URL}/rest/v1/scores?on_conflict=player_id`, { method: 'POST',
  //   headers: { apikey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json',
  //              Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify(row) })
  // Failures must be swallowed: the game has to work without network.
  return false;
}

export async function fetchBoard(kind) {
  const rows = [];
  if (lastLocal && lastLocal.name) {
    const value = kind === 'precise' ? lastLocal.avgCoins : lastLocal.totalCoins;
    const eligible = kind !== 'precise' || lastLocal.farmers >= CONFIG.MIN_FARMERS_FOR_PRECISION;
    if (eligible) rows.push({ playerId: lastLocal.playerId, name: lastLocal.name, value, isMe: true });
  }
  return { online: false, note: 'Classifica online in arrivo', rows };
}
