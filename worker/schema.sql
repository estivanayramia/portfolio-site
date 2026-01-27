-- Error Monitoring Database Schema
-- Run with: wrangler d1 execute portfolio-errors --file=schema.sql

CREATE TABLE IF NOT EXISTS errors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  message TEXT,
  filename TEXT,
  line INTEGER,
  col INTEGER,
  stack TEXT,
  url TEXT,
  user_agent TEXT,
  viewport TEXT,
  version TEXT,
  timestamp INTEGER NOT NULL,
  category TEXT DEFAULT 'uncategorized',
  status TEXT DEFAULT 'new',
  is_bot INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_timestamp ON errors(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_status ON errors(status);
CREATE INDEX IF NOT EXISTS idx_category ON errors(category);
CREATE INDEX IF NOT EXISTS idx_created_at ON errors(created_at DESC);

-- Auto-categorization helper
-- Errors marked as 'resolved' can be auto-deleted via dashboard
