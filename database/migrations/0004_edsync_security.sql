CREATE TABLE IF NOT EXISTS rate_limits (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  subject_hash TEXT NOT NULL,
  window_start TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(scope, subject_hash)
);

CREATE TABLE IF NOT EXISTS security_events (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  severity TEXT DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  subject_hash TEXT,
  ip_hash TEXT,
  user_agent TEXT,
  path TEXT,
  message TEXT NOT NULL,
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_scope_subject ON rate_limits(scope, subject_hash);
CREATE INDEX IF NOT EXISTS idx_security_events_type_time ON security_events(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_security_events_user_time ON security_events(user_id, created_at);
