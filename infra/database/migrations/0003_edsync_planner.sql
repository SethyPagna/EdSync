CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  teacher_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  class_id TEXT REFERENCES classes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  audience TEXT DEFAULT 'class' CHECK (audience IN ('class', 'all')),
  publish_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT,
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS schedule_events (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  class_id TEXT REFERENCES classes(id) ON DELETE CASCADE,
  lesson_id TEXT REFERENCES lessons(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT DEFAULT 'class' CHECK (event_type IN ('deadline', 'class', 'office_hours', 'study', 'announcement', 'other')),
  starts_at TEXT,
  ends_at TEXT,
  due_at TEXT,
  location TEXT,
  visibility TEXT DEFAULT 'class' CHECK (visibility IN ('teacher', 'student', 'class')),
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_announcements_class_publish ON announcements(class_id, publish_at, expires_at);
CREATE INDEX IF NOT EXISTS idx_announcements_teacher ON announcements(teacher_id, created_at);
CREATE INDEX IF NOT EXISTS idx_schedule_events_class_start ON schedule_events(class_id, starts_at, due_at);
CREATE INDEX IF NOT EXISTS idx_schedule_events_owner ON schedule_events(owner_id, starts_at, due_at);
