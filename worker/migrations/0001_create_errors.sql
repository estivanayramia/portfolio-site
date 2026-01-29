-- D1 migration: create errors table and indexes

CREATE TABLE IF NOT EXISTS errors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  filename TEXT,
  line INTEGER,
  col INTEGER,
  stack TEXT,
  url TEXT,
  user_agent TEXT,
  viewport TEXT,
  version TEXT,
  breadcrumbs TEXT,
  timestamp INTEGER NOT NULL,
  category TEXT NOT NULL DEFAULT 'uncategorized',
  status TEXT NOT NULL DEFAULT 'new',
  is_bot INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_errors_timestamp ON errors(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_errors_status ON errors(status);
CREATE INDEX IF NOT EXISTS idx_errors_category ON errors(category);
