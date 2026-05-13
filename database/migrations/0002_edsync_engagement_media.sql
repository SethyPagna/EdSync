CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  actor_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  action_url TEXT,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  channels TEXT DEFAULT '["in_app"]',
  metadata TEXT DEFAULT '{}',
  read_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS email_messages (
  id TEXT PRIMARY KEY,
  recipient_user_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  body_html TEXT,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed', 'skipped')),
  provider TEXT DEFAULT 'outbox',
  provider_message_id TEXT,
  error_message TEXT,
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  sent_at TEXT
);

CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  owner_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  storage_object_id TEXT REFERENCES storage_objects(id) ON DELETE SET NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('image', 'video', 'audio', 'document', 'other')),
  title TEXT,
  description TEXT,
  public_url TEXT,
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  width INTEGER,
  height INTEGER,
  source TEXT DEFAULT 'upload',
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS content_extractions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  content_type TEXT,
  size_bytes INTEGER,
  extraction_kind TEXT NOT NULL,
  extracted_text TEXT,
  warning TEXT,
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read_at, created_at);
CREATE INDEX IF NOT EXISTS idx_email_messages_recipient ON email_messages(recipient_user_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_media_assets_owner ON media_assets(owner_id, asset_type, created_at);
CREATE INDEX IF NOT EXISTS idx_content_extractions_user ON content_extractions(user_id, created_at);
