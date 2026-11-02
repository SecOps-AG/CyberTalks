-- Materials links, listing flags, and the search index copied into D1 after a sync.
-- ensureSchema adds the columns only when they are missing, so a second sync is safe.

ALTER TABLE talks ADD COLUMN has_slides INTEGER NOT NULL DEFAULT 0;
ALTER TABLE talks ADD COLUMN has_repo INTEGER NOT NULL DEFAULT 0;
ALTER TABLE talks ADD COLUMN media_url TEXT;

CREATE TABLE IF NOT EXISTS talk_materials (
  talk_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  type TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT,
  source TEXT NOT NULL,
  confidence REAL NOT NULL,
  dead INTEGER NOT NULL DEFAULT 0,
  label TEXT NOT NULL,
  PRIMARY KEY (talk_id, position)
);

CREATE INDEX IF NOT EXISTS talk_materials_talk ON talk_materials (talk_id);

CREATE TABLE IF NOT EXISTS search_index_chunk (
  seq INTEGER PRIMARY KEY,
  data TEXT NOT NULL
);
