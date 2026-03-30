# ELL Coast Monsters — Lineup Manager

## What this is
A single-page PWA for managing softball lineups for the **ELL Coast Monsters** (District 9, Coast Division, Sammamish WA, 2026 season). Built as a single HTML file with Supabase cloud sync. The primary workflow is building pre-game lineups on a laptop, then referencing them on a phone during games.

**Live app:** https://scotttewel.github.io/monsters-lineup
**GitHub repo:** https://github.com/ScottTewel/monsters-lineup
**Supabase project:** https://egigneadnkiqkiohraoi.supabase.co
**Supabase anon key:** eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnaWduZWFkbmtpcWtpb2hyYW9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4Mzg0NzMsImV4cCI6MjA5MDQxNDQ3M30.RI7NozPdZH5FoovoRxW1bTcBtIDE-yqI0StagOlyaVY

## Tech stack decisions (don't change these without good reason)
- **Single HTML file** (`index.html`) — no build step, no frameworks, vanilla JS only
- **No CDN dependencies** — everything is self-contained. The xlsx export uses a pure-JS ZIP/STORE writer (no SheetJS). Supabase uses direct REST API calls (no supabase-js SDK).
- **Persistence:** localStorage as fast local cache + Supabase as cloud source of truth
- **localStorage keys:** `m_players`, `m_games`, `m_cur`, `m_fblog`, `m_sb_session`
- **Hosting:** GitHub Pages (HTTPS required for PWA + Supabase)
- **PWA files:** `index.html`, `manifest.json`, `service-worker.js`, `icon.svg`

## Deploying changes
The file lives at `/Users/scott/Desktop/monsters-lineup/`. After editing:
```bash
cd ~/Desktop/monsters-lineup
git add index.html  # (or manifest.json, service-worker.js as needed)
git commit -m "description of change"
git push
```
GitHub Pages redeploys automatically in ~60 seconds. The git remote URL includes a GitHub PAT (Personal Access Token) for auth — if push fails with auth error, generate a new token at https://github.com/settings/tokens (repo scope) and run:
```bash
git remote set-url origin https://ScottTewel:NEW_TOKEN@github.com/ScottTewel/monsters-lineup.git
```

## Team colors
Pink/black theme. CSS variables:
- `--navy: #1a1a1a` (black, used for header/dark elements)
- `--gold: #ec4899` (pink, used for accents/active states)
- The xlsx game card also uses these colors in ARGB format in `_xlsxStyles()`

## Roster (12 players — do not change ids, they are used as keys in saved game data)
| id | Name | # | Hitting Rank | Notes |
|---|---|---|---|---|
| georgia | Georgia Tewel | 21 | 2 | Starting pitcher. Versatile — good everywhere |
| emily | Emily Kim | 7 | 4 | Backup pitcher. Best in CF/LF. Strong SS/2B |
| olivia | Olivia Lervick | 24 | 1 | Best catcher. Elite SS. Best hitter (lead-off) |
| emerson | Emerson Barbeau | 14 | 6 | Tall corner infielder (1B/3B). 4th pitcher |
| gaura | Gaura Sharma | 1 | 3 | Tall corner infielder (1B/3B). Power hitter. Avoid CF/middle |
| aahana | Aahana Desai | 31 | 5 | OK at most positions. Fast bat |
| alysha | Alysha Pandole | 22 | 9 | 3rd pitcher option. Below-avg defense |
| harper | Harper Fitzpatrick | 6 | 8 | Only lefty — best at 1B. Shot-put throw; avoid 3B/RF |
| ela | Ela Ozkeskin | 3 | 10 | Smart but inexperienced. Slow bat |
| soha | Soha Pancholi | 30 | 12 | Most inexperienced. Hard worker — encourage her! |
| yufei | Yufei Liang | 9 | 7 | Fast bat, bad mechanics. FASTEST runner — exploit on bases |
| dylan | Dylan Riley | 12 | 11 | Super slow. Scared at plate. Short-arm throw |

**Pitching rotation:** Georgia → Emily → Emerson → Alysha (in `PITCHING_ROT` array, order matters)

## District 9 Coast rules (enforced in validate() and doAutoFill())
- Max **3 innings pitching** per pitcher per game (hard rule)
- **Bench equity:** no player sits twice before everyone has sat once (hard rule)
- **≥1 consecutive infield inning** in first 5 innings per player (hard rule — "3 consecutive outs in infield")
- **≥2 infield innings average** per player — this is a guideline/soft rule, NOT a hard requirement. Show as warning not error. The warning text should say "Guideline (not a hard rule)"

## Key data structures

### Player object
```javascript
{id:'georgia', name:'Georgia Tewel', num:'21', hittingRank:2,
 skills:{P:'ideal',C:'good','1B':'good','2B':'good','3B':'good',SS:'good',LF:'good',CF:'good',RF:'good'},
 notes:'...'}
```

### Game object
```javascript
{id:'uuid', opponent:'Firebolts', date:'2026-03-31', home:false, innings:6,
 battingOrder:['olivia','emily','emerson',...],  // player ids in order
 fieldingPlan:{1:{P:'georgia',C:'olivia',...}, 2:{...}},  // inning → position → playerId
 playerInnings:{'olivia':[1]},  // null/missing = all innings; [] = fully absent; [1] = only inning 1
 notes:''}
```

### Per-inning availability
`game.playerInnings[pid]`:
- `undefined` or `null` → player available all innings
- `[1,2,3]` → player available only those innings
- `[]` → player fully absent

## Positions and skill levels
```javascript
const POS     = ['P','C','1B','2B','3B','SS','LF','CF','RF'];
const INFIELD = new Set(['P','C','1B','2B','3B','SS']);
const SK_SCORE = {ideal:4, good:3, ok:2, poor:1, avoid:0};
```

## Skill levels for feedback
10 softball skills: Throwing, Catching, Fielding Grounders, Fielding Pop-Flies, Pitching, Catcher, Hitting, Baserunning, Bunting, Game IQ
Ratings: Great / Good / Fair / Poor
Stored in `feedbackLog` array: `[{id, ts, playerId, skill, rating, note}]`

## Supabase schema
```sql
create table lineup_state (
  id uuid references auth.users primary key,
  players jsonb,
  games jsonb,
  cur_game_id text,
  feedback_log jsonb,
  updated_at timestamptz default now()
);
alter table lineup_state enable row level security;
create policy "Users can only access their own data"
  on lineup_state for all using (auth.uid() = id);
```
Single row per user — entire app state stored as JSON blobs. Last-write-wins (single user, no conflict resolution needed).

## Sync flow
1. `init()` → `load()` from localStorage (instant) → `renderAll()` (app visible immediately)
2. `sbToken()` → if no valid token → show login overlay
3. `sbPull()` → if data in Supabase, overwrite localStorage + re-render
4. If no Supabase data but localStorage has games → `sbPushNow()` (bootstrap push)
5. Every `save()` and `saveFbLog()` call → `sbPush()` (debounced 800ms)

## Game card export (.xlsx)
- Downloads via pure-JS xlsx writer (ZIP STORE method, no CDN)
- Shows: `#21 Georgia Tewel` format for player names
- Does NOT show skill ratings (assistant coaches are parents; opposing coach gets a copy)
- Style constants: `_XS = {T,SUB,SEC,CH,BW,BA,BBW,BBA,MW,MA,NW,NA,AH,AN}`
- Colors in `_xlsxStyles()` use ARGB hex format matching pink/black theme

## Important gotchas / lessons learned
1. **Never cause a JS parse error** — any syntax error resets the apparent app state (data is safe in localStorage but `load()` doesn't run). Always test changes carefully.
2. **CDN scripts blocked on file://** — the app was originally local-file. CDN imports fail from `file://` URLs in Chrome. The app uses no CDN dependencies for this reason.
3. **Player ids are permanent keys** — changing `id` in DEFAULT_PLAYERS breaks all saved game data. Only change `name`/`num`/`skills`/`notes`.
4. **runMigration()** — called after load to sync name/num changes from DEFAULT_PLAYERS into saved player records without touching lineup data. Safe to call anytime.
5. **Mobile login UX** — the "local only • sign in" header badge is small and hidden in portrait mode. The login overlay auto-shows on first visit. If a user accidentally dismisses it, the app shows in empty/offline state with no obvious recovery. Known issue, acceptable for single-user app.
6. **Service worker caching** — after pushing code changes, users may need a hard refresh (Cmd+Shift+R) to bypass the service worker cache. Bump the `CACHE_NAME` version in `service-worker.js` to force cache invalidation on next visit.

## Files
```
monsters-lineup/
  index.html        ← entire app (~1941 lines, single file)
  manifest.json     ← PWA manifest (start_url: /monsters-lineup/)
  service-worker.js ← cache-first offline strategy
  icon.svg          ← softball emoji on black background
  CLAUDE.md         ← this file
```
