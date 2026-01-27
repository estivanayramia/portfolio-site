-- Error Monitoring Database Schema
-- Creates tables for storing error reports with indexing for efficient queries

CREATE TABLE IF NOT EXISTS errors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  url TEXT NOT NULL,
  filename TEXT,
  line INTEGER,
  column INTEGER,
  stack TEXT,
  user_agent TEXT,
  ip TEXT,
  is_bot INTEGER DEFAULT 0,
  category TEXT DEFAULT 'uncategorized',
  status TEXT DEFAULT 'new',
  timestamp INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_timestamp ON errors(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_status ON errors(status);
CREATE INDEX IF NOT EXISTS idx_category ON errors(category);
CREATE INDEX IF NOT EXISTS idx_is_bot ON errors(is_bot);
CREATE INDEX IF NOT EXISTS idx_created_at ON errors(created_at DESC);
