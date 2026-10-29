-- Sample data for local testing. Loaded by `npm run db:reset` (after the
-- migrations). Dates are relative to today, so the data stays current.
--
-- Passwords (scrypt, fixed salts so this file is stable):
--   admin accounts  pop-admin-123
--   host accounts   pop-host-123
--   players         pop-player-123
-- Emails go to Mailpit (http://127.0.0.1:54324).

-- ── Staff accounts ─────────────────────────────────────────────────────────

insert into admins (id, username, password_hash, role, email, email_verified_at, group_name) values
  -- Club admin, added by hand (no email to verify).
  ('a0000000-0000-4000-8000-000000000001', 'admin',
   'scrypt$cG9wLXNlZWQtYWRtaW4wMA$oWM6_M8azdg2WItHJG-aVpey0X3UtX_X37jT44Q4IOs',
   'admin', null, null, ''),
  -- Host who schedules "today" and the past open play.
  ('a0000000-0000-4000-8000-000000000002', 'makati.host',
   'scrypt$cG9wLXNlZWQtaG9zdDAwMA$J3lSVAuS7Y94WHNguZ_e2NVWt2G_HalB--QCRhfLopU',
   'host', 'makati.host@example.com', now() - interval '30 days', 'Makati Dinkers'),
  -- Host of their own open play, and co-host of makati.host's one today.
  ('a0000000-0000-4000-8000-000000000003', 'bgc.host',
   'scrypt$cG9wLXNlZWQtaG9zdDAwMA$J3lSVAuS7Y94WHNguZ_e2NVWt2G_HalB--QCRhfLopU',
   'host', 'bgc.host@example.com', now() - interval '20 days', 'BGC Smashers'),
  -- Signed up but never verified: signing in emails a code first.
  ('a0000000-0000-4000-8000-000000000004', 'pending.host',
   'scrypt$cG9wLXNlZWQtaG9zdDAwMA$J3lSVAuS7Y94WHNguZ_e2NVWt2G_HalB--QCRhfLopU',
   'host', 'pending.host@example.com', null, 'QC Paddlers');

-- ── Players ────────────────────────────────────────────────────────────────

insert into players (id, name, first_name, last_name, level, email, email_confirmed_at, phone, home_club, bio, hand, username, password_hash) values
  ('b0000000-0000-4000-8000-000000000001', 'Maria S.', 'Maria', 'Santos', 'advanced', 'maria@example.com', now() - interval '20 days', '0917 555 0101', 'Makati Dinkers', 'Third-shot drop enthusiast.', 'right', 'maria', 'scrypt$cG9wLXNlZWQtcGxheWVyMA$kbVSI5faUdgDoqPrmIa26C9ZuofiKFr6-wDrBS4SoEc'),
  ('b0000000-0000-4000-8000-000000000002', 'Juan D.', 'Juan', 'Dela Cruz', 'advanced', 'juan@example.com', now() - interval '20 days', '0917 555 0102', 'Makati Dinkers', '', 'left', 'juan', 'scrypt$cG9wLXNlZWQtcGxheWVyMA$kbVSI5faUdgDoqPrmIa26C9ZuofiKFr6-wDrBS4SoEc'),
  ('b0000000-0000-4000-8000-000000000003', 'Ana R.', 'Ana', 'Reyes', 'intermediate', 'ana@example.com', now() - interval '10 days', '', '', '', 'right', null, null),
  ('b0000000-0000-4000-8000-000000000004', 'Paolo G.', 'Paolo', 'Garcia', 'intermediate', 'paolo@example.com', null, '', '', '', null, null, null),
  ('b0000000-0000-4000-8000-000000000005', 'Bea L.', 'Bea', 'Lim', 'intermediate', 'bea@example.com', null, '', '', '', null, null, null),
  ('b0000000-0000-4000-8000-000000000006', 'Carlo T.', 'Carlo', 'Tan', 'intermediate', 'carlo@example.com', null, '', '', '', null, null, null),
  ('b0000000-0000-4000-8000-000000000007', 'Dani C.', 'Dani', 'Cruz', 'novice', 'dani@example.com', null, '', '', '', null, null, null),
  ('b0000000-0000-4000-8000-000000000008', 'Enzo R.', 'Enzo', 'Ramos', 'novice', 'enzo@example.com', null, '', '', '', null, null, null),
  ('b0000000-0000-4000-8000-000000000009', 'Fe M.', 'Fe', 'Mendoza', 'novice', 'fe@example.com', null, '', '', '', null, null, null),
  ('b0000000-0000-4000-8000-000000000010', 'Gio T.', 'Gio', 'Torres', 'novice', 'gio@example.com', null, '', '', '', null, null, null),
  ('b0000000-0000-4000-8000-000000000011', 'Hana V.', 'Hana', 'Villanueva', 'beginner', 'hana@example.com', null, '', '', '', null, null, null),
  ('b0000000-0000-4000-8000-000000000012', 'Iggy B.', 'Iggy', 'Bautista', 'beginner', 'iggy@example.com', null, '', '', '', null, null, null),
  ('b0000000-0000-4000-8000-000000000013', 'Jia A.', 'Jia', 'Aquino', 'beginner', 'jia@example.com', null, '', '', '', null, null, null),
  ('b0000000-0000-4000-8000-000000000014', 'Kiko N.', 'Kiko', 'Navarro', 'beginner', 'kiko@example.com', null, '', '', '', null, null, null),
  ('b0000000-0000-4000-8000-000000000015', 'Lara C.', 'Lara', 'Castillo', 'novice', 'lara@example.com', null, '', '', '', null, null, null),
  ('b0000000-0000-4000-8000-000000000016', 'Migs F.', 'Migs', 'Flores', 'pro', 'migs@example.com', null, '', 'BGC Smashers', '', 'right', null, null),
  ('b0000000-0000-4000-8000-000000000017', 'Nina O.', 'Nina', 'Ocampo', 'pro', 'nina@example.com', null, '', 'BGC Smashers', '', 'right', null, null),
  ('b0000000-0000-4000-8000-000000000018', 'Oli P.', 'Oli', 'Pascual', 'advanced', 'oli@example.com', null, '', '', '', null, null, null),
  ('b0000000-0000-4000-8000-000000000019', 'Pia R.', 'Pia', 'Robles', 'advanced', 'pia@example.com', null, '', '', '', null, null, null);

-- ── Open plays ─────────────────────────────────────────────────────────────

insert into open_plays (id, venue, location, created_by, play_date, start_time, end_time, levels, max_pairs, fee_cents) values
  -- Last week: finished, with matches (history, records, protests).
  ('c0000000-0000-4000-8000-000000000001', 'Sunrise Courts', 'Makati', 'a0000000-0000-4000-8000-000000000002',
   current_date - 7, '17:00', '21:00', '{novice,intermediate,advanced}', null, 30000),
  -- Today: ready to start; bgc.host co-hosts.
  ('c0000000-0000-4000-8000-000000000002', 'Sunrise Courts', 'Makati', 'a0000000-0000-4000-8000-000000000002',
   current_date, '17:00', '21:00', '{beginner,novice,intermediate,advanced}', 12, 30000),
  -- Tomorrow: BGC Smashers' own, nearly full.
  ('c0000000-0000-4000-8000-000000000003', 'Uptown Pickle Hub', 'BGC, Taguig', 'a0000000-0000-4000-8000-000000000003',
   current_date + 1, '18:00', '22:00', '{advanced,pro}', 4, 40000),
  -- In three days: scheduled by the admin, nobody signed up yet.
  ('c0000000-0000-4000-8000-000000000004', 'Community Gym', 'Quezon City', 'a0000000-0000-4000-8000-000000000001',
   current_date + 3, '08:00', '12:00', '{beginner,novice}', 8, 20000);

insert into open_play_hosts (open_play_id, admin_id) values
  ('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000003');

-- Invited by email; becomes a co-host when that email signs up as a host.
insert into open_play_invites (open_play_id, email, invited_by) values
  ('c0000000-0000-4000-8000-000000000002', 'newcohost@example.com', 'a0000000-0000-4000-8000-000000000002');

-- ── Pairs and registrations ────────────────────────────────────────────────

insert into pairs (id, open_play_id, status, amount_cents, method, notes, paid_at) values
  -- Last week.
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'paid', 30000, 'cash', '', now() - interval '7 days'),
  ('d0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'paid', 30000, 'ewallet', 'GCash GC-10021', now() - interval '7 days'),
  ('d0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001', 'paid', 30000, 'cash', '', now() - interval '7 days'),
  ('d0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001', 'paid', 30000, 'card', '4242', now() - interval '7 days'),
  ('d0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000001', 'paid', 30000, 'cash', '', now() - interval '7 days'),
  ('d0000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000001', 'paid', 30000, 'ewallet', 'GC-10022', now() - interval '7 days'),
  -- Today.
  ('d0000000-0000-4000-8000-000000000007', 'c0000000-0000-4000-8000-000000000002', 'paid', 30000, 'cash', '', now() - interval '2 days'),
  ('d0000000-0000-4000-8000-000000000008', 'c0000000-0000-4000-8000-000000000002', 'paid', 30000, 'ewallet', 'GC-20031', now() - interval '2 days'),
  ('d0000000-0000-4000-8000-000000000009', 'c0000000-0000-4000-8000-000000000002', 'paid', 30000, 'cash', '', now() - interval '1 day'),
  ('d0000000-0000-4000-8000-000000000010', 'c0000000-0000-4000-8000-000000000002', 'paid', 30000, 'cash', '', now() - interval '1 day'),
  ('d0000000-0000-4000-8000-000000000011', 'c0000000-0000-4000-8000-000000000002', 'paid', 30000, 'card', '1881', now() - interval '1 day'),
  ('d0000000-0000-4000-8000-000000000012', 'c0000000-0000-4000-8000-000000000002', 'paid', 30000, 'cash', '', now() - interval '3 hours'),
  ('d0000000-0000-4000-8000-000000000013', 'c0000000-0000-4000-8000-000000000002', 'pending', null, null, '', null),
  ('d0000000-0000-4000-8000-000000000014', 'c0000000-0000-4000-8000-000000000002', 'paid', 30000, 'ewallet', 'GC-20032', now() - interval '3 hours'),
  -- Tomorrow.
  ('d0000000-0000-4000-8000-000000000015', 'c0000000-0000-4000-8000-000000000003', 'paid', 40000, 'ewallet', 'GC-30001', now() - interval '1 day'),
  ('d0000000-0000-4000-8000-000000000016', 'c0000000-0000-4000-8000-000000000003', 'pending', null, null, '', null);

update pairs set requested_level = 'advanced' where id = 'd0000000-0000-4000-8000-000000000016';

insert into registrations (player_id, open_play_id, pair_id, checked_in_at, created_at) values
  -- Last week: everyone checked in.
  ('b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', now() - interval '7 days', now() - interval '9 days'),
  ('b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', now() - interval '7 days', now() - interval '9 days' + interval '1 second'),
  ('b0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002', now() - interval '7 days', now() - interval '9 days'),
  ('b0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002', now() - interval '7 days', now() - interval '9 days' + interval '1 second'),
  ('b0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000003', now() - interval '7 days', now() - interval '9 days'),
  ('b0000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000003', now() - interval '7 days', now() - interval '9 days' + interval '1 second'),
  ('b0000000-0000-4000-8000-000000000007', 'c0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000004', now() - interval '7 days', now() - interval '9 days'),
  ('b0000000-0000-4000-8000-000000000008', 'c0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000004', now() - interval '7 days', now() - interval '9 days' + interval '1 second'),
  ('b0000000-0000-4000-8000-000000000009', 'c0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000005', now() - interval '7 days', now() - interval '9 days'),
  ('b0000000-0000-4000-8000-000000000010', 'c0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000005', now() - interval '7 days', now() - interval '9 days' + interval '1 second'),
  ('b0000000-0000-4000-8000-000000000018', 'c0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000006', now() - interval '7 days', now() - interval '9 days'),
  ('b0000000-0000-4000-8000-000000000019', 'c0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000006', now() - interval '7 days', now() - interval '9 days' + interval '1 second'),
  -- Today: most checked in; Gio hasn't arrived (Fe + Gio not ready).
  ('b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000007', now() - interval '1 hour', now() - interval '2 days'),
  ('b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000007', now() - interval '1 hour', now() - interval '2 days' + interval '1 second'),
  ('b0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000008', now() - interval '1 hour', now() - interval '2 days'),
  ('b0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000008', now() - interval '1 hour', now() - interval '2 days' + interval '1 second'),
  ('b0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000009', now() - interval '1 hour', now() - interval '1 day'),
  ('b0000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000009', now() - interval '1 hour', now() - interval '1 day' + interval '1 second'),
  ('b0000000-0000-4000-8000-000000000007', 'c0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000010', now() - interval '1 hour', now() - interval '1 day'),
  ('b0000000-0000-4000-8000-000000000008', 'c0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000010', now() - interval '1 hour', now() - interval '1 day' + interval '1 second'),
  ('b0000000-0000-4000-8000-000000000009', 'c0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000011', now() - interval '1 hour', now() - interval '1 day'),
  ('b0000000-0000-4000-8000-000000000010', 'c0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000011', null, now() - interval '1 day' + interval '1 second'),
  ('b0000000-0000-4000-8000-000000000011', 'c0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000012', now() - interval '1 hour', now() - interval '3 hours'),
  ('b0000000-0000-4000-8000-000000000012', 'c0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000012', now() - interval '1 hour', now() - interval '3 hours' + interval '1 second'),
  -- Signed up online, not paid yet.
  ('b0000000-0000-4000-8000-000000000013', 'c0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000013', null, now() - interval '5 hours'),
  ('b0000000-0000-4000-8000-000000000014', 'c0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000013', null, now() - interval '5 hours' + interval '1 second'),
  ('b0000000-0000-4000-8000-000000000018', 'c0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000014', now() - interval '1 hour', now() - interval '3 hours'),
  ('b0000000-0000-4000-8000-000000000019', 'c0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000014', now() - interval '1 hour', now() - interval '3 hours' + interval '1 second'),
  -- Tomorrow.
  ('b0000000-0000-4000-8000-000000000016', 'c0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000015', null, now() - interval '1 day'),
  ('b0000000-0000-4000-8000-000000000017', 'c0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000015', null, now() - interval '1 day' + interval '1 second'),
  ('b0000000-0000-4000-8000-000000000018', 'c0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000016', null, now() - interval '6 hours'),
  ('b0000000-0000-4000-8000-000000000019', 'c0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000016', null, now() - interval '6 hours' + interval '1 second');

-- Today: a solo player looking for a partner (the desk pairs them).
insert into registrations (player_id, open_play_id, pair_id, requested_level, created_at) values
  ('b0000000-0000-4000-8000-000000000015', 'c0000000-0000-4000-8000-000000000002', null, 'novice', now() - interval '4 hours');

-- ── Last week's session and matches ────────────────────────────────────────

insert into sessions (id, status, open_play_id, starts_at, ends_at, state, created_at, updated_at)
select
  'e0000000-0000-4000-8000-000000000001', 'ended', 'c0000000-0000-4000-8000-000000000001',
  w.starts_at, w.ends_at,
  jsonb_build_object(
    'version', 4,
    'config', jsonb_build_object('startTime', '17:00', 'endTime', '21:00', 'courtCount', 3, 'playersPerCourt', 2, 'overtimeMinutes', 12),
    'startsAt', (extract(epoch from w.starts_at) * 1000)::bigint,
    'endsAt', (extract(epoch from w.ends_at) * 1000)::bigint,
    'players', '{}'::jsonb, 'queue', '[]'::jsonb, 'courts', '[]'::jsonb, 'matches', '[]'::jsonb,
    'history', jsonb_build_object('teammates', '{}'::jsonb, 'opponents', '{}'::jsonb),
    'nextCourtNumber', 4
  ),
  w.starts_at, w.ends_at
from (select (current_date - 7 + time '17:00')::timestamptz as starts_at,
             (current_date - 7 + time '21:00')::timestamptz as ends_at) w;

insert into matches (id, session_id, court_label, started_at, ended_at, score_a, score_b)
select m.id::uuid, 'e0000000-0000-4000-8000-000000000001', m.court,
       (current_date - 7 + time '17:00')::timestamptz + m.start_min * interval '1 minute',
       (current_date - 7 + time '17:00')::timestamptz + (m.start_min + 15) * interval '1 minute',
       m.a, m.b
from (values
  ('f0000000-0000-4000-8000-000000000001', 'Court 1', 5, 11, 8),
  ('f0000000-0000-4000-8000-000000000002', 'Court 2', 5, 11, 9),
  ('f0000000-0000-4000-8000-000000000003', 'Court 3', 5, 7, 11),
  ('f0000000-0000-4000-8000-000000000004', 'Court 1', 25, 11, 13),
  ('f0000000-0000-4000-8000-000000000005', 'Court 2', 25, 11, 6),
  ('f0000000-0000-4000-8000-000000000006', 'Court 3', 25, 11, 5),
  ('f0000000-0000-4000-8000-000000000007', 'Court 1', 45, 11, 4),
  ('f0000000-0000-4000-8000-000000000008', 'Court 2', 45, 9, 11)
) as m(id, court, start_min, a, b);

-- Who played: each pair sits on one side. Level as it was that day.
insert into match_players (match_id, player_id, side, name, level)
select s.match_id::uuid, p.id, s.side::side, p.name, p.level
from (values
  -- Maria + Juan vs Oli + Pia
  ('f0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'A'),
  ('f0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'A'),
  ('f0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000018', 'B'),
  ('f0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000019', 'B'),
  -- Ana + Paolo vs Bea + Carlo
  ('f0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000003', 'A'),
  ('f0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000004', 'A'),
  ('f0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000005', 'B'),
  ('f0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000006', 'B'),
  -- Dani + Enzo vs Fe + Gio
  ('f0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000007', 'A'),
  ('f0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000008', 'A'),
  ('f0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000009', 'B'),
  ('f0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000010', 'B'),
  -- Oli + Pia vs Maria + Juan
  ('f0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000018', 'A'),
  ('f0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000019', 'A'),
  ('f0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001', 'B'),
  ('f0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000002', 'B'),
  -- Bea + Carlo vs Ana + Paolo
  ('f0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000005', 'A'),
  ('f0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000006', 'A'),
  ('f0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000003', 'B'),
  ('f0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000004', 'B'),
  -- Fe + Gio vs Dani + Enzo
  ('f0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000009', 'A'),
  ('f0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000010', 'A'),
  ('f0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000007', 'B'),
  ('f0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000008', 'B'),
  -- Maria + Juan vs Bea + Carlo
  ('f0000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000001', 'A'),
  ('f0000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000002', 'A'),
  ('f0000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000005', 'B'),
  ('f0000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000006', 'B'),
  -- Ana + Paolo vs Oli + Pia
  ('f0000000-0000-4000-8000-000000000008', 'b0000000-0000-4000-8000-000000000003', 'A'),
  ('f0000000-0000-4000-8000-000000000008', 'b0000000-0000-4000-8000-000000000004', 'A'),
  ('f0000000-0000-4000-8000-000000000008', 'b0000000-0000-4000-8000-000000000018', 'B'),
  ('f0000000-0000-4000-8000-000000000008', 'b0000000-0000-4000-8000-000000000019', 'B')
) as s(match_id, player_id, side)
join players p on p.id = s.player_id::uuid;

-- ── Live now: a running session for hosts to score ─────────────────────────
-- Two games on court (Game done → the host types the final score), one
-- already recorded, two pairs waiting. Clocks are relative to now(); the
-- window is now() - 1h to now() + 3h whatever the time zone.

insert into players (id, name, first_name, last_name, level, email) values
  ('b0000000-0000-4000-8000-000000000020', 'Quinn A.', 'Quinn', 'Aguilar', 'intermediate', 'quinn@example.com'),
  ('b0000000-0000-4000-8000-000000000021', 'Rio B.', 'Rio', 'Bernardo', 'intermediate', 'rio@example.com'),
  ('b0000000-0000-4000-8000-000000000022', 'Sam C.', 'Sam', 'Cortez', 'intermediate', 'sam@example.com'),
  ('b0000000-0000-4000-8000-000000000023', 'Tess D.', 'Tess', 'Domingo', 'intermediate', 'tess@example.com'),
  ('b0000000-0000-4000-8000-000000000024', 'Uma E.', 'Uma', 'Estrada', 'intermediate', 'uma@example.com'),
  ('b0000000-0000-4000-8000-000000000025', 'Vic F.', 'Vic', 'Fajardo', 'intermediate', 'vic@example.com'),
  ('b0000000-0000-4000-8000-000000000026', 'Wes G.', 'Wes', 'Gomez', 'novice', 'wes@example.com'),
  ('b0000000-0000-4000-8000-000000000027', 'Xia H.', 'Xia', 'Herrera', 'novice', 'xia@example.com'),
  ('b0000000-0000-4000-8000-000000000028', 'Yen I.', 'Yen', 'Ilagan', 'novice', 'yen@example.com'),
  ('b0000000-0000-4000-8000-000000000029', 'Zed J.', 'Zed', 'Jimenez', 'novice', 'zed@example.com'),
  ('b0000000-0000-4000-8000-000000000030', 'Abby K.', 'Abby', 'Katigbak', 'novice', 'abby@example.com'),
  ('b0000000-0000-4000-8000-000000000031', 'Ben L.', 'Ben', 'Lozano', 'novice', 'ben@example.com');

insert into open_plays (id, venue, location, created_by, play_date, start_time, end_time, levels, max_pairs, fee_cents) values
  ('c0000000-0000-4000-8000-000000000005', 'Riverside Courts', 'Pasig', 'a0000000-0000-4000-8000-000000000002',
   current_date, '06:00', '23:00', '{novice,intermediate}', 10, 25000);

insert into open_play_hosts (open_play_id, admin_id) values
  ('c0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000003');

insert into pairs (id, open_play_id, status, amount_cents, method, notes, paid_at)
select ('d0000000-0000-4000-8000-0000000000' || n)::uuid, 'c0000000-0000-4000-8000-000000000005',
       'paid', 25000, 'cash', '', now() - interval '2 hours'
from unnest(array['17', '18', '19', '20', '21', '22']) as n;

insert into registrations (player_id, open_play_id, pair_id, checked_in_at, created_at)
select ('b0000000-0000-4000-8000-0000000000' || r.player)::uuid, 'c0000000-0000-4000-8000-000000000005',
       ('d0000000-0000-4000-8000-0000000000' || r.pair)::uuid, now() - interval '70 minutes',
       now() - interval '2 hours' + r.seat * interval '1 second'
from (values
  ('20', '17', 0), ('21', '17', 1), ('22', '18', 0), ('23', '18', 1),
  ('24', '19', 0), ('25', '19', 1), ('26', '20', 0), ('27', '20', 1),
  ('28', '21', 0), ('29', '21', 1), ('30', '22', 0), ('31', '22', 1)
) as r(player, pair, seat);

-- Queue units are pair ids; skill is the pair's rank (novice 1, intermediate 2).
insert into sessions (id, status, open_play_id, starts_at, ends_at, state)
select
  'e0000000-0000-4000-8000-000000000002', 'active', 'c0000000-0000-4000-8000-000000000005',
  to_timestamp(t.ms / 1000.0 - 3600), to_timestamp(t.ms / 1000.0 + 3 * 3600),
  jsonb_build_object(
    'version', 4,
    'config', jsonb_build_object('startTime', '06:00', 'endTime', '23:00', 'courtCount', 2, 'playersPerCourt', 2, 'overtimeMinutes', 12),
    'startsAt', t.ms - 3600000,
    'endsAt', t.ms + 3 * 3600000,
    'players', jsonb_build_object(
      'd0000000-0000-4000-8000-000000000017', jsonb_build_object('id', 'd0000000-0000-4000-8000-000000000017', 'name', 'Quinn A. & Rio B.', 'gamesPlayed', 0, 'joinedAt', t.ms - 3600000, 'skill', 2),
      'd0000000-0000-4000-8000-000000000018', jsonb_build_object('id', 'd0000000-0000-4000-8000-000000000018', 'name', 'Sam C. & Tess D.', 'gamesPlayed', 1, 'joinedAt', t.ms - 3600000, 'skill', 2),
      'd0000000-0000-4000-8000-000000000019', jsonb_build_object('id', 'd0000000-0000-4000-8000-000000000019', 'name', 'Uma E. & Vic F.', 'gamesPlayed', 1, 'joinedAt', t.ms - 3600000, 'skill', 2),
      'd0000000-0000-4000-8000-000000000020', jsonb_build_object('id', 'd0000000-0000-4000-8000-000000000020', 'name', 'Wes G. & Xia H.', 'gamesPlayed', 0, 'joinedAt', t.ms - 3600000, 'skill', 1),
      'd0000000-0000-4000-8000-000000000021', jsonb_build_object('id', 'd0000000-0000-4000-8000-000000000021', 'name', 'Yen I. & Zed J.', 'gamesPlayed', 0, 'joinedAt', t.ms - 3600000, 'skill', 1),
      'd0000000-0000-4000-8000-000000000022', jsonb_build_object('id', 'd0000000-0000-4000-8000-000000000022', 'name', 'Abby K. & Ben L.', 'gamesPlayed', 0, 'joinedAt', t.ms - 3600000, 'skill', 1)
    ),
    'queue', jsonb_build_array('d0000000-0000-4000-8000-000000000019', 'd0000000-0000-4000-8000-000000000022'),
    'courts', jsonb_build_array(
      jsonb_build_object('id', 'seed-court-1', 'label', 'Court 1', 'rank', 2, 'stoppedAfterMs', null,
        'playerIds', jsonb_build_array('d0000000-0000-4000-8000-000000000017', 'd0000000-0000-4000-8000-000000000018'),
        'startedAt', t.ms - 9 * 60000),
      jsonb_build_object('id', 'seed-court-2', 'label', 'Court 2', 'rank', 1, 'stoppedAfterMs', null,
        'playerIds', jsonb_build_array('d0000000-0000-4000-8000-000000000020', 'd0000000-0000-4000-8000-000000000021'),
        'startedAt', t.ms - 4 * 60000)
    ),
    'matches', jsonb_build_array(
      jsonb_build_object('courtLabel', 'Court 1',
        'playerIds', jsonb_build_array('d0000000-0000-4000-8000-000000000018', 'd0000000-0000-4000-8000-000000000019'),
        'playerNames', jsonb_build_array('Sam C. & Tess D.', 'Uma E. & Vic F.'),
        'startedAt', t.ms - 30 * 60000, 'endedAt', t.ms - 12 * 60000)
    ),
    'history', jsonb_build_object(
      'teammates', '{}'::jsonb,
      'opponents', jsonb_build_object('d0000000-0000-4000-8000-000000000018|d0000000-0000-4000-8000-000000000019', 1)
    ),
    'nextCourtNumber', 3
  )
from (select (extract(epoch from now()) * 1000)::bigint as ms) t;

insert into matches (id, session_id, court_label, started_at, ended_at, score_a, score_b) values
  ('f0000000-0000-4000-8000-000000000009', 'e0000000-0000-4000-8000-000000000002', 'Court 1',
   now() - interval '30 minutes', now() - interval '12 minutes', 11, 7);

insert into match_players (match_id, player_id, side, name, level)
select 'f0000000-0000-4000-8000-000000000009', p.id, s.side::side, p.name, p.level
from (values ('22', 'A'), ('23', 'A'), ('24', 'B'), ('25', 'B')) as s(player, side)
join players p on p.id = ('b0000000-0000-4000-8000-0000000000' || s.player)::uuid;

-- ── Protests and level changes ─────────────────────────────────────────────

insert into protests (id, player_id, current_level, requested_level, reason, filed_by, status, admin_note, created_at, resolved_at) values
  -- Waiting for an admin.
  ('10000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000018', 'advanced', 'pro',
   'Oli dominated every rally last week; advanced games are one-sided.',
   'b0000000-0000-4000-8000-000000000002', 'pending', '', now() - interval '2 days', null),
  -- Approved: Bea moved up (see level_changes).
  ('10000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000005', 'novice', 'intermediate',
   'Bea won most of her novice games 11-2.',
   'b0000000-0000-4000-8000-000000000003', 'approved', 'Agreed after watching her play.', now() - interval '6 days', now() - interval '5 days'),
  -- Rejected.
  ('10000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000019', 'advanced', 'intermediate',
   'Pia struggles at the kitchen line.',
   'b0000000-0000-4000-8000-000000000004', 'rejected', 'One rough night; keeping her at advanced.', now() - interval '6 days', now() - interval '5 days');

insert into level_changes (player_id, from_level, to_level, note, protest_id, created_at) values
  ('b0000000-0000-4000-8000-000000000005', 'novice', 'intermediate', 'Protest approved', '10000000-0000-4000-8000-000000000002', now() - interval '5 days'),
  ('b0000000-0000-4000-8000-000000000001', 'intermediate', 'advanced', 'Promoted after the club tournament', null, now() - interval '15 days');
