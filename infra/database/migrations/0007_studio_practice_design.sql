CREATE TABLE IF NOT EXISTS studio_documents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  owner_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  item_kind TEXT NOT NULL CHECK (item_kind IN ('note', 'doc', 'sheet', 'slide', 'practice', 'import', 'design')),
  title TEXT NOT NULL,
  content TEXT DEFAULT '{}',
  plain_text TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  source_type TEXT,
  source_id TEXT,
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS studio_assets (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  owner_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  document_id TEXT REFERENCES studio_documents(id) ON DELETE CASCADE,
  media_asset_id TEXT REFERENCES media_assets(id) ON DELETE SET NULL,
  asset_kind TEXT NOT NULL,
  title TEXT,
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS practice_attempts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_id TEXT,
  mode TEXT NOT NULL,
  target_seconds INTEGER,
  elapsed_seconds INTEGER DEFAULT 0,
  score_percent REAL DEFAULT 0,
  points_earned REAL DEFAULT 0,
  points_possible REAL DEFAULT 0,
  summary TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS practice_attempt_items (
  id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL REFERENCES practice_attempts(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  expected_answer TEXT,
  response TEXT,
  is_correct INTEGER DEFAULT 0,
  points REAL DEFAULT 1,
  explanation TEXT,
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS practice_review_cards (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  attempt_item_id TEXT REFERENCES practice_attempt_items(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL,
  source_id TEXT,
  prompt TEXT NOT NULL,
  correct_answer TEXT,
  explanation TEXT,
  mastery TEXT DEFAULT 'again' CHECK (mastery IN ('again', 'almost', 'mastered')),
  next_review_at TEXT,
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_studio_documents_tenant_kind ON studio_documents(tenant_id, item_kind, updated_at);
CREATE INDEX IF NOT EXISTS idx_studio_documents_owner ON studio_documents(owner_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_practice_attempts_user ON practice_attempts(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_practice_review_cards_user ON practice_review_cards(user_id, mastery, created_at);
