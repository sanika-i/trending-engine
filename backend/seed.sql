DELETE FROM history;
DELETE FROM posts;
DELETE FROM sqlite_sequence WHERE name IN ('posts','history');

INSERT INTO posts (description, likes, shares, saves, created_at) VALUES
  ('First look at our hackathon submission', 142, 38, 55, datetime('now', '-0 days')),
  ('Why time decay matters in engagement ranking', 89, 24, 41, datetime('now', '-1 days')),
  ('Behind the scenes: building a REST API in 24 hours', 67, 15, 28, datetime('now', '-2 days')),
  ('The math behind our scoring formula, explained', 203, 12, 18, datetime('now', '-3 days')),
  ('Weighted engagement: why shares matter most', 54, 22, 31, datetime('now', '-4 days')),
  ('Quick demo of the filters dropdown UX', 31, 8, 12, datetime('now', '-5 days')),
  ('Testing the /info endpoint with percentiles', 12, 4, 7, datetime('now', '-7 days')),
  ('Docker containerization for reproducible deployment', 45, 18, 22, datetime('now', '-10 days')),
  ('An older post that should be heavily decayed by now', 180, 35, 48, datetime('now', '-14 days')),
  ('This post has decayed to zero already', 2, 1, 0, datetime('now', '-20 days')),
  ('Ancient post from the early draft days', 25, 5, 8, datetime('now', '-30 days')),
  ('Fresh hot take posted today', 5, 2, 3, datetime('now', '-0 days'));

INSERT INTO history (post_id, event_type, likes, shares, saves, timestamp)
  SELECT id, 'add', likes, shares, saves, created_at FROM posts;

SELECT COUNT(*) AS posts_inserted FROM posts;
SELECT COUNT(*) AS history_entries FROM history;