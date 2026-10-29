# PRD: POP · Pickleball Open Play

Open-play court queue for pickleball, like Paddle Stack Queuing, but
everything is saved in a database: sessions, every match with its score,
and each player's history. That history is the reference when a player
protests their skill level.

## Users

- **Staff accounts** sign in with a **username and password**, each
  level at its own door: **hosts** at `/host/login` (the "Host" nav
  link); **admins** at `/admin/login` (the "Admin" nav link, also linked
  from the host sign-in; search engines don't index it). Each door turns away the other level with the
  same "wrong username or password". Admin-only pages (protests, QR
  codes) answer 404 to anyone else instead of pointing at the sign-in. On phones the nav links fold behind a **Menu**
  button. The first account comes from
  `ADMIN_USERNAME`/`ADMIN_PASSWORD` and is an admin. Each account has a
  **level**:
  - **Admin:** everything. Every open play (home "Mine / All" toggle),
    levels, protests, QR codes, and accounts. Settings: add accounts
    (pick Admin or Host), switch an account's level, remove accounts
    (never yourself or the last admin).
  - **Host:** schedules open plays and runs only the ones they created
    or were invited to: register pairs, confirm payments, run the
    courts, check-in QR codes and profile edits for players signed up
    to their open plays. No protests, level changes, QR-codes page, or
    account management. Settings: change their own password.
  - Any account: Settings → change your password (signs out your other
    devices).
- **Host self sign-up** (`/host/signup`, linked from the Host sign-in
  and the public home): group name, email, username, password → a
  6-digit code is emailed → `/host/verify` → the account opens and signs
  in. Until verified the account can't sign in (signing in sends a new
  code). Signing up again with an unverified email replaces that account.
  The password and confirm fields each have a **Show / Hide** button
  (`components/ui/password-input.tsx`).
- **Group (optional):** an account can have a group name and logo
  (JPEG/PNG/WebP up to 300 KB). Set them in the New open play form's
  "Hosted by" section (prefilled; a blank name keeps the current one) or
  in Settings → Your group. Scheduling never requires them. Cards and the
  public open play page show the court venue, location, "Hosted by
  {group}" (linking to the group's public page), and the logo.
- **Venue is required** (name and location) on new open plays. Open plays
  without one (made before venues existed) show "📍 Venue to be
  announced" to players, and staff get an amber 📍 Add venue button on the
  card that opens its Manage page (`saveVenue`, its hosts only).
  Cards show the venue in bold with the location under it.
- **Banner:** each open play can have a banner photo (JPEG/PNG/WebP; the
  browser shrinks it to 1600 px wide and up to 600 KB). Add it in the New
  open play form or later on its Manage page (its hosts only; removing
  takes two taps).
  Without one, a colorful court placeholder shows (its colors stay the
  same per open play, with the venue name on it).
- **Card and open play page header:** banner on top with the ranks and
  Live/Full badges on it, then the group's logo over its edge (no logo:
  the group's initials, or a paddle when unnamed) and "Hosted by {group}"
  (unnamed: "POP open play").
- **Group public page** (`/groups/[id]`, the account id): anyone can open
  it, like a public profile. It shows the logo, the group name ("Open play
  host" when unnamed), how many open plays it hosted, its courts, Live
  now, Coming up, and the 6 most recent past open plays, plus a Share
  button (share sheet or copy link). It lists only open plays the account
  scheduled, never its username or email. Staff reach theirs from "Your
  public page" on My open plays.
- **Host workflow (admin-added):** an admin adds the host's account in Settings
  (level: Host) and shares the username and password → the host signs in
  and schedules open plays, which only they (and admins) see on **My
  open plays** → on an open play card, **⚙️ Manage** → Hosts → invite by
  **username or email**. Only the **main host** (the account that
  scheduled it) or an admin invites and removes hosts; co-hosts see the
  list but not the invite form. An existing (verified) account joins right away; an email
  without one gets an invitation email linking to host sign-up with the
  email filled in, and is listed under "Waiting to sign up" (cancellable)
  until they verify, then the open play is on their list. Invited hosts can be removed; the creator
  always stays. Removing an account keeps its open plays.
- **Manage page** (`/open-plays/[id]/manage`, its hosts and admins
  only; anyone else is sent to the public page, signed-out visitors to
  sign-in): banner header with paid / waiting / solo / spots-left counts,
  your role (main host, co-host, admin), and buttons to the courts and the
  Player desk. Sections: **Date, ranks & entry** (edit; `editOpenPlay` →
  `updateOpenPlay`), Court venue, Banner, Hosts (and invites, main host
  only), and Remove while nobody has signed up. Edits are refused when
  they'd strand players: while it's running the date, time, and ranks are
  locked (cap and entry can change); a rank with sign-ups stays; the cap
  can't go under the paid pairs; and a new time can't clash with another
  open play its players joined. Paid amounts don't change. The old
  `/details` and `/hosts` links redirect here.
- **Players / public:** no sign-in. See the live board, the players list,
  any profile, and can file a level protest.
- **Player sign-in** (`/login`): **username and password**, or a 6-digit
  email code (no password yet / forgot it). Players set their username and
  password on their profile edit page once their payment is confirmed;
  admins can set them too.
- **Player (verified):** scans their profile QR code, verifies their email
  with a 6-digit code, then edits their own basic info and photo.

## Confirming changes

Nothing that removes, deletes, or changes saved data happens on one tap.
Remove, delete, reject, end, and cancel buttons take two taps ("Sure?").
Save buttons on edit forms take two taps too: the first checks the form
and turns the button red with "Tap again to …" and "This can't be
undone."; it resets after 5 seconds or when you tap away. This covers the
open play edit, venue, banner, level change, protest approve/reject,
payment confirmation, pairing solos, profile and login settings, password
and group settings, the session time, and recording a score. Changing an
account's level asks inline ("Make … an Admin? Yes, change it / Cancel"),
and a picked profile photo waits for **Save photo**. Live court moves
(queue order, swaps, court rank, renames) stay one tap so games keep
moving; they can be changed back.

## Two kinds of open play: Regular and Ranked

Picked when scheduling (Regular is the default); it doesn't change
afterwards. The Manage page, desk, and results show which it is.

|                | **Regular**                                                                             | **Ranked**                                                                           |
| -------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Sign-up        | The host types each pair in one line: `gel/son` (also `gel & son`, `gel, son`)          | Queue name, first and last name, email for each player                               |
| Email          | None                                                                                    | Required: receipts and profile link                                                  |
| Online sign-up | No: the public page says to join at the booth                                           | Yes                                                                                  |
| Paid / unpaid  | A **Paid** box when adding; **✓ Mark paid** (entry fee, cash) and **Mark unpaid** later | **✓ Mark paid** with amount, method, notes                                           |
| Queue          | Paid pairs only                                                                         | Paid pairs only                                                                      |
| Check-in       | Same as Ranked                                                                          | Before the start only                                                                |
| Stats          | Kept for that open play (History, Standings, results); nothing on player profiles       | Saved to each player's record, shared across open plays (levels, protests, rankings) |

- Regular desk form has two tabs: **👥 Pair** (`gel/son`, **Paid
  already** box, notes) and **🙋 Solo** (one name, for someone who came
  alone). When the open play runs more than one rank, **Rank they join**
  chips (e.g. Beginner | Novice) pick the queue line; the choice stays for
  the next entry. (Ranked open plays take each player's own level.) Solos wait under the list's **Solo** filter. Each solo row has
  **🎲 Random partner** (draws one of the other solos) and **Pick
  partner**; both open a popup to choose (or **🎲 Shuffle**) the partner,
  then **🤝 Pair up**: Regular ticks **Paid already** or not, Ranked
  records the full entry. A solo's **Edit** fixes the name or removes
  them before pairing.
- **🎲 Pair all solos (n)** (in the table header, shown with more than two
  solos while the list shows All or Solo) previews every solo
  paired at random, numbered; **🎲 Shuffle** redraws everyone (who
  waits, with an odd count, changes too). **⏸ Hold** on a name leaves that
  player out of this round (listed under **On hold**, **▶ Include** brings
  them back); holding or including reshuffles the rest. One **All paid already** box (Regular) or one
  entry (Ranked) applies to every pair, then **🤝 Pair them all**.
- Typing **one name** in a Regular pair's **Names** splits it: that
  player goes back to solo, the other is removed with the pair and its
  payment (not while the pair is in a running queue).
- Hosts **fix a Regular pair's names** in the row's **Edit** popup
  (**Names**, typed like `gel/son`; saving asks first). A running queue
  shows the new names.
- Regular names are **guests**: they belong to that open play only, never
  show in the player directory, rankings, or profiles. **Names are
  unique within an open play** (any case): adding, renaming, or splitting
  into a name already there tells the host ("Gel is already in this open
  play"). Another open play, or a real player, can use the same name.

## End of an open play

- **End session** asks in a popup. Confirming closes the open play for
  good: its page shows the **results** instead of setting it up again,
  for hosts (from My open plays) and the public alike:
  - **Top pairs** (🥇🥈🥉),
  - **Rankings**: every pair that joined, highest to lowest by the
    Standings point system; pairs that never played are last,
  - **Every game**, in order, as a table: game number, court, duration,
    both pairs, the score.
- An ended open play **leaves the lists** and takes no more sign-ups:
  it's not on the Player desk's open play picker (an old desk link opens
  its results), and it's no longer in Open plays
  (home), Coming up, or a group's upcoming ones (it moves to the group's
  Past). **My open plays** has two tabs, **🎾 Active** (Live now, Coming
  up, Past ones that never ran) and **🏁 Ended (n)**, which opens each
  one's results. Its card shows "🏁 Ended · results".

## Open plays by rank

- **Pages:** the home page (`/`) is public: Live now and Coming up, with
  no forms or host buttons (signed-in staff get a **My open plays**
  button). **My open plays** (`/host`, staff only, also in the nav;
  signing in and verifying land here) lists the open plays they created
  or co-host: Live now, Coming up, and the 12 most recent Past ones, each
  card with Register pairs, ⚙️ Manage, and Remove (while empty). Admins
  switch between Mine and All. **New open play** is its own page
  (`/open-plays/new`); saving opens the new open play's Manage page, and
  removing one from its Manage page goes back to My open plays.
- Staff **schedule open plays** at `/open-plays/new`: **venue name and
  location**, date, start and end time, the **ranks** it runs (tick one or more levels, e.g.
  Beginner and Novice), an optional **max pairs**, and the **entry per
  pair (required, above 0)**, so players see the price on the open play
  cards and page before they join. Editing keeps it required.
- **Venue autocomplete:** venues saved with past open plays are
  suggested (one per name, newest first; a host sees their own open
  plays' venues, an admin all). Picking a saved venue fills in its
  location; the form starts with the last venue used. Cards, the public
  open play page, the board heading, and receipt emails show the venue.
- **Staff see only their open plays** on `/host` and at the Player desk: the
  ones they created or were invited to host. Every desk action (register,
  pair solos, confirm or remove payments, check in, profile status)
  checks the account hosts that open play, so a host can't act on
  another host's open play by its id. Admins can switch to
  **All**. Opening an open play you don't run shows its public page.
- **One open play, several ranks, shared courts.** Each ticked rank has
  its own line in the queue; pairs only play pairs of their rank. When
  starting, the admin picks the pairs, then the courts: each court gets a
  rank, suggested from how many pairs each rank has (e.g. 4 courts →
  2 Beginner, 2 Novice). A court's rank can be switched from its card
  anytime; a game in progress finishes first, an idle court hands its
  group back to the line.
- Several open plays can also run at once (separate courts and queues).
- **Public:** the home lists open plays by date; each card is a link to
  the open play. There, each rank is a card linking to that rank: who's in
  (pairs, and players at that level looking for a partner), then how to
  join (booth, fee, pair level rule, solo option). A live open play links
  to its court board. Admin cards also link through, with Register pairs
  and Remove on top.
- A pair joins the rank of its level (the stronger player's) when that
  rank is ticked. **Once either player is, e.g., Novice, the pair can
  never join a lower rank** (Beginner): the desk refuses it and names who
  ("Nia is Novice, so this pair can't join Beginner"). A solo player can
  sign up unless they're above every rank; pairing two solos checks the
  pair's level.
- If a player is promoted after paying, the pair is re-checked: setup and
  late arrivals show it as blocked with the reason, and it can't be added
  to the queue. Full open plays refuse
  new pairs. A player can't be in two open plays that overlap in time.
- An open play nobody signed up for can be removed (two taps).

## Joining open play: pairs, paid at the booth

### Online sign-up, admin-confirmed payment

1. On a rank's public page, players choose **Pair** or **Solo**. A pair
   signs up (queue name, first and last name, email for both). A solo
   player signs up alone and joins that rank's "looking for a partner"
   list (refused if above the rank); the desk pairs them and the pair pays
   at the booth. A taken name only matches that player when the
   email is the one on file. The sign-up shows as **Pending payment**
   (also on the public roster as "Awaiting payment"). No email yet.
2. They pay at the management booth. On the Player desk they show as
   **Unpaid** rows (filter **Unpaid**); the host taps **Confirm
   payment** (amount, method, notes) or **Reject**.
3. Confirming checks rank and capacity again, marks the pair paid (it
   counts toward the cap and can join the queue), and emails both players
   the receipt with their profile link.
4. **Profile editing opens only after a confirmed payment** (QR code,
   "This is me", receipt link, saving info or photo). Admins can always
   edit, and can remove a pair (refund) while its open play isn't running.
   **Hosts** change only the names a player registered with (queue name,
   first and last name), for players of their own open plays; email,
   phone, photo, and the rest stay the player's (or an admin's).

- Players join **as a pair** for one open play. One **entry for the pair,
  paid in full** (no split payments): amount (default `OPEN_PLAY_FEE`),
  method (cash, e-wallet, card at the booth), optional **notes**.
- **Notes** are the host's own (e.g. "paid half", "own paddles"): on any
  pair, paid or unpaid, editable from the list, never emailed.
- The **Player desk** (`/admin/players`) has two steps:
  1. Pick the date and the open play (rank, time, spots left). Each one
     opens its own desk (`?openPlay=…`, with **← Change** back).
  2. The desk fits one screen, no page scrolling; each column scrolls on
     its own. On phones a **Sign up | List** switch shows one at a time,
     the list shows cards instead of a table, and the filters scroll
     sideways. A bar on top shows paid and unpaid
     counts, money collected, and spots left.
     - **Left, tabs:** **Pay later** (unpaid, first), **Paid now**, **Solo**,
       and **Players** (find anyone to edit or show their QR). Each player
       is picked from registered players or added as new (queue name,
       first name, last name, email — all required). A new queue name
       fills first and last name ("Ana Maria Cruz" → Ana Maria / Cruz).
       The amount is always the open play's entry fee (with no fee set, the
       desk says so and links to Manage); the desk remembers the last
       payment method on that device and opens on **Pay later**.
     - **Right, the list:** one row per pair, paid or unpaid, and solo
       players, as a table: players (level, check-in), payment (Paid with
       amount and method, or Unpaid) with the **date and time**, and
       notes. Filter **All / Paid / Unpaid / Notes / Solo** (with counts)
       and search names or notes. Each row has one small **Edit** button;
       unpaid rows also **✓ Mark paid** (a popup with the amount from the
       fee, method, and notes; confirming there marks the pair paid and
       emails receipts), and solo rows **Pick**, two at a time, to pair up.
     - **Edit** opens a popup with tabs: **Pair** (payment status, notes,
       reject or remove) and one tab per player with their
       registration names only (queue name, first, last). Admins also get
       a link to the full profile. The **Players** tab's Edit opens the
       same names form.
- A player who comes alone signs up **solo** (no payment yet). The desk
  picks two solos, pairs them, and records the pair's full entry.
- After each sign-up, every player gets an email: receipt (date, partner,
  entry) or "looking for a partner", with a one-tap link (7 days) that
  confirms their email and opens their profile editor (`/confirm/[token]`).
- **Pair level** = the stronger player's level. Matchmaking keeps pairs
  close in level (after games-played fairness).
- Only that open play's paid pairs can join its queue. Only players who have signed
  up at least once can edit their own info (admins always can).
- Online card payment is planned; it needs a payment provider (Stripe via
  the Vercel Marketplace) connected to the project first.

## Open play (admin, `/`)

- Each open play starts from its page: its **paid pairs** (tap to add, or
  add all) → courts (doubles by pairs: two pairs per court), each with a
  rank. Date and time come from the open play.
- Fixed partners: the queue is a list of pairs; courts are pair vs pair.
  Each recorded game is stored per player, so individual stats and
  ranking keep working.
- Same live dashboard: courts, up next, queue, drag to reorder, swap,
  pause, overtime alerts, history tab. **Late arrivals**: pairs signed up
  for this open play who aren't in the queue show under it in **Not in
  the queue yet** (refreshes every 20 s). It's running, so **no
  check-in**: once a pair is paid, it **joins the queue on its own, at the
  front** (it hasn't played yet, so games stay balanced). Unpaid pairs fold into one line ("⚠️ 2 unpaid pairs ·
  Review & confirm") that opens a popup to **✓ Mark paid** each one. **＋ New pair** registers a pair right there (the desk's
  form: Pay later, Paid now, Solo); they wait in that list until added.
- **Courts** show side A over side B with a **VS** line between; each pair
  is a full-width row with both players' avatars and names in full.
- **Rankings so far** appears under the courts once every pair has
  played a game: every pair best first (🥇🥈🥉 highlighted), both
  players' names, rating, W–L, and point difference. It refreshes as
  scores come in.
- **Game done** asks the host for the **final score** (no ties), typed
  in for each pair. Scores are entered by hand, only by the open play's
  hosts (creator, co-hosts) or an admin; players and the public board
  can't. Saving records the match with each player's current level.
- **Standings** tab (hosts only): pairs ranked by a **point system**,
  not only wins. Each scored game is worth 3 for a win, up to ±1 for the
  margin (11–0 is +1), and ±0.5 per rank for beating a stronger pair or
  losing to a weaker one. Pairs are ranked by points per game, counted as
  if each had one extra average game, so one lucky win can't top the
  list; ties go to wins, point difference, then points scored. Until
  every pair in the session has a scored game it shows "Leaders so far"
  and who's still waiting; then it becomes the **predicted top N**, with
  the leader as the predicted winner. The host picks Top 3, 5 or 10 and
  one rank or all ranks. It refreshes when a game is scored and every
  20 s.
- Pair names come from the players ("Ana & Ben"); rename players at the
  desk, not in the queue.
- Changes save in the background; a red banner shows if a save fails.
- Only one session runs at a time. Ending it keeps all recorded matches.

## Public board (`/` when not signed in)

Read-only courts, up next, and queue, refreshed every 15 seconds. Names
link to profiles.

## Players (`/players`, `/players/[id]`)

- Directory: search, filter by level, W–L per player.
- Profile: level, games, W–L, win rate, point diff, court time, W–L by the
  toughest opponent's level, and full match history (date, court,
  duration, score, partners and opponents with their level at the time).
- Level history: every change with its note.
- **Profile card** (public): photo, first and last name (queue name under
  it), level,
  ranking (#n of m), matches, wins, losses, win rate, point diff, court
  time, home club, playing hand, bio, member since. Email and phone are
  never shown publicly.
- **Ranking:** players with at least one game, by most wins, then win
  rate, then fewer games. Same wins and games share a rank. The directory
  can sort by ranking and shows photos and first and last names.

## Player info and QR codes

- Every player has a QR code. Admins see it on the profile and print all
  of them from `/admin/qr-codes`. "New code" voids a printed one.
- Scanning opens `/claim/<token>`: enter email → a 6-digit code is emailed
  (10 min, 5 tries, one per minute) → verified devices stay signed in for
  30 days and land on `/players/[id]/edit`.
- The first verified email is linked to the player and is **required**
  for future features. Later codes only go to that email; an admin can
  change it from the edit page.
- Basic info: first name and last name (required), email (required,
  private), phone
  (optional, private), home club or city, playing hand, bio (280 chars).
- Photo: JPEG, PNG, or WebP, resized in the browser to 512 px, max 300 KB.
  Remove with a two-tap button.
- Admins can edit any player's info and photo without verifying.

### Onboarding workflow (where cards and QR codes show)

Status: **Needs setup** (no verified email) → **Info missing** (no full
name or photo) → **Complete**.

1. **Check-in (main path).** The host dashboard has a **Profiles** tab
   (badge = players not complete) listing today's session. **Show QR**
   puts the player's code full screen on the host's phone; the player
   scans it while waiting in the queue. Status refreshes every 20 s.
2. **Printed cards.** `/admin/qr-codes` defaults to **Needs setup** (only
   players without a verified email), with **Everyone** as a filter, for
   a sign-in table, lanyards, or a binder at the desk.
3. **Returning players.** A profile with a linked email shows **Is this
   you? → This is me** (`/players/[id]/verify`): a code goes to the
   linked email, no QR needed. Profiles without one say to ask the host.
4. **Edit page checklist:** Add email · Add first & last name · Add a
   photo.

QR codes are never shown on the public board or public pages: the first
person to verify an email through a code claims that profile.

## Levels and protests

- Levels: Beginner, Novice, Intermediate, Advanced, Pro. New players start
  at Beginner. Admins set levels on the profile, with an optional note.
- Protests need a **signed-in player** (Sign in: email + 6-digit code)
  who had a **confirmed (paid) spot in an open play with that player**.
  Anonymous visitors and outside players can't file. Pick the level it
  should be and say why. One pending protest per player.
- The admin sees who filed it (name, email) and the open play they
  shared. The public profile never shows who filed a protest.
- `/admin/protests` lists pending protests with the player's record beside
  each. Approve (moves the level) or reject, with a note the player sees.

## Confirmations

- Every edit, update, and delete asks in a **popup** ("Remove host
  jo?", "Save the venue?") with **Go back** and the action, so it's clear
  what's being confirmed. Removals are red. Creating or recording
  something new (a sign-up, pairing solos, a game's final score) saves
  in one tap.

## Payments, check-in, and shared players

- **Every payment is confirmed by a host by hand.** At the desk a pair is
  registered "Pair · paid now" (entry recorded, receipts emailed) or
  "Pair · pay later" (saved **UNPAID**, no receipt yet). Online sign-ups
  are unpaid too. Unpaid pairs are marked with a rose **UNPAID** badge at
  the desk ("Unpaid · confirm payment"), solos waiting for a partner are
  marked unpaid, and the check-in list highlights unpaid pairs in rose.
- **Check-in before queuing:** the first setup step is **Check-in**: every
  pair (paid and unpaid) with **one button for the pair** ("○ Son & Gel ·
  Check in"): one tap checks both players in, tapping again undoes both.
  Before the start a pair can be added to the queue only when it's
  **paid and checked in** ("✓ Ready"); the server refuses anything else.
  Check-in applies only before the start: once the open play is running,
  a paid pair can be added without it. Before the start the desk's list
  shows "✓ Checked in" or "○ Not checked in" per pair; once it's running,
  that status is hidden.
- **Players are shared across open plays and groups.** A player is one
  record identified by email: registering someone (desk or online) with
  an email already on a player links that player, keeping their name,
  level, matches, and ranking, instead of making a new one. Hosts' desk
  lists show only players from their own open plays (emails are
  private); returning players from elsewhere are linked by typing their
  email. Hosts can't change a player's confirmed email (admins can).
