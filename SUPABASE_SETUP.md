# Leaderboard backend (Supabase): setup notes

**Status:** not set up yet. `js/leaderboard.js` is a stub that shows only the local player and the note "Classifica online in arrivo". The game is fully playable without it.

## What is stored
One row per phone. Nothing else: no name, no email, no login.

| Column | Type | Meaning |
|---|---|---|
| `player_id` | `uuid` (primary key) | random ID made on the phone (`crypto.randomUUID()`), kept in `localStorage` |
| `emoji` | `smallint` | index into `EMOJIS` in `js/names.js` (0–19) |
| `noun` | `smallint` | index into `NOUNS` (0–35) |
| `adj` | `smallint` | index into `ADJECTIVES` (0–35) |
| `number` | `smallint` | the 2-digit number (10–99) |
| `total_coins` | `integer` | all coins ever earned ("Più ricchi") |
| `farmers` | `integer` | farmers served (added so the server can compute the average and hide players with fewer than 5 farmers from "Più precisi") |
| `avg_coins` | `real` | `total_coins / farmers`, computed by the server ("Più precisi") |
| `updated_at` | `timestamptz` | last update |

If the lists in `js/names.js` grow, update the upper bounds in the check constraints. Never reorder or delete list entries once the board is live (existing indices would change meaning).

## 1. Create the project
1. Create a free project at supabase.com (region: EU, e.g. Frankfurt).
2. Settings → API: copy the **Project URL** and the **anon public key** into `js/config.js` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`). The anon key is meant to be public; security comes from the rules below.

## 2. Table and rules (SQL editor)
Design: the browser **cannot read `player_id`** and **cannot write the table directly**. It can only (a) read the board through a view without IDs and (b) call one function that upserts the row for the ID it knows. Since each ID is a secret random UUID that only its phone knows, a player can only change their own row.

```sql
create table public.scores (
  player_id   uuid primary key,
  emoji       smallint not null check (emoji  between 0 and 19),
  noun        smallint not null check (noun   between 0 and 35),
  adj         smallint not null check (adj    between 0 and 35),
  number      smallint not null check (number between 10 and 99),
  total_coins integer  not null default 0 check (total_coins between 0 and 100000),
  farmers     integer  not null default 0 check (farmers between 0 and 20000),
  avg_coins   real     not null default 0 check (avg_coins between 0 and 10),
  updated_at  timestamptz not null default now(),
  check (total_coins <= 10 * farmers)
);

-- Row-level security on, and no direct access for the browser roles.
alter table public.scores enable row level security;
revoke all on public.scores from anon, authenticated;

-- Public board: no player_id in it.
create view public.board as
  select emoji, noun, adj, number, total_coins, farmers, avg_coins, updated_at
  from public.scores;
grant select on public.board to anon;

-- The only way to write: upsert your own row.
create or replace function public.submit_score(
  p_id uuid, p_emoji int, p_noun int, p_adj int, p_number int,
  p_total int, p_farmers int
) returns void
language sql security definer set search_path = public as $$
  insert into scores (player_id, emoji, noun, adj, number, total_coins, farmers, avg_coins, updated_at)
  values (p_id, p_emoji, p_noun, p_adj, p_number, p_total, p_farmers,
          case when p_farmers > 0 then p_total::real / p_farmers else 0 end, now())
  on conflict (player_id) do update set
    emoji = excluded.emoji, noun = excluded.noun, adj = excluded.adj, number = excluded.number,
    total_coins = excluded.total_coins, farmers = excluded.farmers,
    avg_coins = excluded.avg_coins, updated_at = now();
$$;
revoke all on function public.submit_score from public;
grant execute on function public.submit_score to anon;
```

Notes:
- The view runs with the owner's rights, so it can read the table even though `anon` cannot. That is intended: the view is the public face and exposes no IDs.
- The check constraints are the "plausible values" cap from the spec. A student can still post a fake but plausible score from the console; delete it in Table Editor → `scores`.
- "Ricomincia" in the game keeps the same `player_id`, so the row is overwritten with the new (lower) score. That is fine.
- The "who is who" mapping stays in class: students tell Dominik their game name.

## 3. Game side (to implement in `js/leaderboard.js`)
- `submitScore(entry)`: `POST {SUPABASE_URL}/rest/v1/rpc/submit_score` with headers `apikey` and `Authorization: Bearer <anon key>`, body `{ p_id, p_emoji, p_noun, p_adj, p_number, p_total, p_farmers }`. Swallow every error.
- `fetchBoard('rich')`: `GET /rest/v1/board?select=*&order=total_coins.desc&limit=50`.
- `fetchBoard('precise')`: `GET /rest/v1/board?select=*&farmers=gte.5&order=avg_coins.desc&limit=50`.
- "Is this row me?": the board has no IDs, so compare the name indices with the local name (names include a 2-digit number, so collisions are rare and harmless).
- Timeout of a few seconds; if unreachable, show the local-only view (as now).
- The service worker ignores cross-origin requests, so board data is never cached and always fresh.

## Privacy
- No personal data is stored. Supabase (like any web host) sees request IP addresses in its own logs; we do not store them.
- TODO(Dominik): tell the school anyway, since the students are minors.
