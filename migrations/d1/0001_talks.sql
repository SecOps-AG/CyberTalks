-- Talk rows rebuilt from data/villages. Safe to run more than once.
CREATE TABLE IF NOT EXISTS talks (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  seq INTEGER NOT NULL,
  youtube_id TEXT NOT NULL,
  source_file TEXT NOT NULL,
  edition_id TEXT NOT NULL,
  event_slug TEXT NOT NULL,
  village_slug TEXT NOT NULL,
  conference TEXT NOT NULL,
  year INTEGER NOT NULL,
  track TEXT NOT NULL,
  kind TEXT NOT NULL,
  has_summary INTEGER NOT NULL DEFAULT 0,
  view_count INTEGER,
  summary_text TEXT,
  body TEXT NOT NULL,
  index_json TEXT NOT NULL,
  related_ids TEXT NOT NULL,
  content_hash TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS talks_slug ON talks (slug, seq);
CREATE INDEX IF NOT EXISTS talks_source ON talks (source_file);
CREATE INDEX IF NOT EXISTS talks_year_seq ON talks (year, seq);
CREATE INDEX IF NOT EXISTS talks_track_seq ON talks (track, seq);
CREATE INDEX IF NOT EXISTS talks_edition_seq ON talks (edition_id, seq);
CREATE INDEX IF NOT EXISTS talks_event_seq ON talks (event_slug, seq);

CREATE TABLE IF NOT EXISTS talk_topics (
  talk_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  PRIMARY KEY (talk_id, topic)
);

CREATE INDEX IF NOT EXISTS talk_topics_topic ON talk_topics (topic);

CREATE TABLE IF NOT EXISTS talk_speakers (
  talk_id TEXT NOT NULL,
  speaker_slug TEXT NOT NULL,
  speaker_name TEXT NOT NULL,
  PRIMARY KEY (talk_id, speaker_slug)
);

CREATE INDEX IF NOT EXISTS talk_speakers_slug ON talk_speakers (speaker_slug);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
