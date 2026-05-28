CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  owner_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  plan_tier TEXT DEFAULT 'solo' CHECK (plan_tier IN ('solo', 'team', 'enterprise')),
  isolation_mode TEXT DEFAULT 'shared_d1' CHECK (isolation_mode IN ('shared_d1', 'dedicated_d1')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  settings TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tenant_portals (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  audience TEXT DEFAULT 'internal' CHECK (audience IN ('internal', 'customer', 'partner', 'public')),
  domain TEXT,
  theme TEXT DEFAULT '{}',
  catalog_settings TEXT DEFAULT '{}',
  is_default INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(tenant_id, slug)
);

CREATE TABLE IF NOT EXISTS tenant_memberships (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_profile_id TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended')),
  permissions TEXT DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS tenant_domains (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  portal_id TEXT REFERENCES tenant_portals(id) ON DELETE CASCADE,
  hostname TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'failed')),
  verification_token TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tenant_runtime_bindings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  binding_type TEXT NOT NULL CHECK (binding_type IN ('d1', 'r2', 'queue', 'vectorize', 'analytics')),
  binding_name TEXT NOT NULL,
  resource_id TEXT,
  resource_name TEXT,
  environment TEXT DEFAULT 'prod',
  settings TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(tenant_id, binding_type, environment)
);

CREATE TABLE IF NOT EXISTS tenant_object_links (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  portal_id TEXT REFERENCES tenant_portals(id) ON DELETE SET NULL,
  object_table TEXT NOT NULL,
  object_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(object_table, object_id)
);

CREATE TABLE IF NOT EXISTS permission_catalog (
  id TEXT PRIMARY KEY,
  permission_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'core',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS role_profiles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE,
  profile_key TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  permissions TEXT DEFAULT '[]',
  is_system INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(tenant_id, profile_key)
);

CREATE TABLE IF NOT EXISTS learning_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  student_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  class_id TEXT REFERENCES classes(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL,
  source_id TEXT,
  event_type TEXT NOT NULL,
  event_version INTEGER DEFAULT 1,
  payload TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS gradebook_replay_runs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  requested_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  source_type TEXT,
  source_id TEXT,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  result TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS content_blocks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  owner_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  block_type TEXT NOT NULL,
  title TEXT NOT NULL,
  data TEXT DEFAULT '{}',
  version INTEGER DEFAULT 1,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  tags TEXT DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS course_versions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lesson_id TEXT REFERENCES lessons(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  snapshot TEXT DEFAULT '{}',
  created_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(lesson_id, version)
);

CREATE TABLE IF NOT EXISTS standards_packages (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  owner_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  package_type TEXT NOT NULL CHECK (package_type IN ('scorm_1_2', 'scorm_2004', 'xapi', 'cmi5')),
  title TEXT NOT NULL,
  storage_object_id TEXT REFERENCES storage_objects(id) ON DELETE SET NULL,
  manifest TEXT DEFAULT '{}',
  launch_path TEXT,
  status TEXT DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'parsed', 'error', 'archived')),
  error_message TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS standards_launches (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  package_id TEXT NOT NULL REFERENCES standards_packages(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id TEXT REFERENCES lessons(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'launched' CHECK (status IN ('launched', 'completed', 'failed')),
  score REAL,
  progress REAL,
  runtime_data TEXT DEFAULT '{}',
  launched_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS xapi_statements (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  package_id TEXT REFERENCES standards_packages(id) ON DELETE SET NULL,
  verb TEXT NOT NULL,
  object_id TEXT NOT NULL,
  statement TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS certification_rules (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  course_id TEXT REFERENCES lessons(id) ON DELETE SET NULL,
  expires_after_days INTEGER,
  notify_before_days INTEGER DEFAULT 30,
  settings TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS learner_certifications (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rule_id TEXT NOT NULL REFERENCES certification_rules(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  issued_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT,
  evidence TEXT DEFAULT '{}',
  UNIQUE(rule_id, user_id)
);

CREATE TABLE IF NOT EXISTS automation_rules (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  trigger_key TEXT NOT NULL,
  conditions TEXT DEFAULT '{}',
  actions TEXT DEFAULT '[]',
  enabled INTEGER DEFAULT 1,
  created_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS achievements_catalog (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'star',
  criteria TEXT DEFAULT '{}',
  points INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_achievements (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL REFERENCES achievements_catalog(id) ON DELETE CASCADE,
  awarded_by_event_id TEXT REFERENCES learning_events(id) ON DELETE SET NULL,
  earned_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, achievement_id)
);

CREATE TABLE IF NOT EXISTS billing_customers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  provider TEXT DEFAULT 'manual',
  provider_customer_id TEXT,
  email TEXT,
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS billing_products (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  product_type TEXT DEFAULT 'course' CHECK (product_type IN ('course', 'bundle', 'membership', 'subscription')),
  course_id TEXT REFERENCES lessons(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS billing_prices (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES billing_products(id) ON DELETE CASCADE,
  provider TEXT DEFAULT 'manual',
  provider_price_id TEXT,
  currency TEXT DEFAULT 'usd',
  amount_cents INTEGER NOT NULL,
  billing_interval TEXT CHECK (billing_interval IN ('one_time', 'month', 'year', 'invoice')),
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS billing_bundles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  bundle_product_id TEXT NOT NULL REFERENCES billing_products(id) ON DELETE CASCADE,
  child_product_id TEXT NOT NULL REFERENCES billing_products(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(bundle_product_id, child_product_id)
);

CREATE TABLE IF NOT EXISTS billing_subscriptions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id TEXT REFERENCES billing_customers(id) ON DELETE SET NULL,
  price_id TEXT REFERENCES billing_prices(id) ON DELETE SET NULL,
  provider TEXT DEFAULT 'manual',
  provider_subscription_id TEXT,
  status TEXT DEFAULT 'active',
  current_period_end TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS billing_invoices (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id TEXT REFERENCES billing_customers(id) ON DELETE SET NULL,
  provider TEXT DEFAULT 'manual',
  provider_invoice_id TEXT,
  amount_due_cents INTEGER DEFAULT 0,
  amount_paid_cents INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft',
  due_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS billing_transactions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id TEXT REFERENCES billing_customers(id) ON DELETE SET NULL,
  product_id TEXT REFERENCES billing_products(id) ON DELETE SET NULL,
  price_id TEXT REFERENCES billing_prices(id) ON DELETE SET NULL,
  provider TEXT DEFAULT 'manual',
  provider_transaction_id TEXT,
  amount_cents INTEGER DEFAULT 0,
  currency TEXT DEFAULT 'usd',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'refunded', 'void')),
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS entitlements (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES billing_products(id) ON DELETE CASCADE,
  source_type TEXT DEFAULT 'manual',
  source_id TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  starts_at TEXT DEFAULT (datetime('now')),
  ends_at TEXT,
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS billing_coupons (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  discount_type TEXT DEFAULT 'percent' CHECK (discount_type IN ('percent', 'amount')),
  discount_value INTEGER NOT NULL,
  active INTEGER DEFAULT 1,
  expires_at TEXT,
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(tenant_id, code)
);

CREATE TABLE IF NOT EXISTS billing_webhook_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES tenants(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload TEXT DEFAULT '{}',
  processed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(provider, provider_event_id)
);

CREATE TABLE IF NOT EXISTS offline_sync_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  item_type TEXT NOT NULL,
  item_id TEXT,
  payload TEXT DEFAULT '{}',
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'applied', 'conflict', 'failed')),
  server_event_id TEXT REFERENCES learning_events(id) ON DELETE SET NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, client_id)
);

CREATE TABLE IF NOT EXISTS analytics_rollups (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rollup_key TEXT NOT NULL,
  scope_type TEXT NOT NULL,
  scope_id TEXT,
  period_start TEXT,
  period_end TEXT,
  metrics TEXT DEFAULT '{}',
  computed_at TEXT DEFAULT (datetime('now')),
  UNIQUE(tenant_id, rollup_key, scope_type, scope_id, period_start)
);

INSERT OR IGNORE INTO tenants (id, slug, name, plan_tier, isolation_mode, settings)
VALUES ('tenant_edsync_default', 'edsync', 'EdSync Academy', 'enterprise', 'shared_d1', '{"adaptiveComplexity":true,"aiReviewRequired":true}');

INSERT OR IGNORE INTO tenant_portals (id, tenant_id, slug, name, audience, is_default, theme)
VALUES ('portal_edsync_default', 'tenant_edsync_default', 'main', 'EdSync Main Portal', 'internal', 1, '{"theme":"light"}');

INSERT OR IGNORE INTO permission_catalog (id, permission_key, label, description, category) VALUES
  ('perm_portals_manage', 'portals.manage', 'Manage portals', 'Create and manage tenant portals and domains.', 'tenant'),
  ('perm_users_manage', 'users.manage', 'Manage users', 'Invite, suspend, and assign role profiles.', 'tenant'),
  ('perm_courses_author', 'courses.author', 'Author courses', 'Create and update lessons and content blocks.', 'content'),
  ('perm_courses_publish', 'courses.publish', 'Publish courses', 'Publish lessons, packages, and course versions.', 'content'),
  ('perm_grades_manage', 'grades.manage', 'Manage grades', 'Grade, override, replay, and audit grade events.', 'assessment'),
  ('perm_reports_view', 'reports.view', 'View reports', 'View tenant reports and analytics rollups.', 'analytics'),
  ('perm_billing_manage', 'billing.manage', 'Manage billing', 'Manage products, prices, invoices, and entitlements.', 'billing'),
  ('perm_ai_manage', 'ai.manage', 'Manage AI', 'Configure AI providers, audits, and generation policies.', 'ai'),
  ('perm_security_audit', 'security.audit', 'Audit security', 'Review security, admin, and learning event logs.', 'security'),
  ('perm_learn', 'learn', 'Learn', 'Access assigned learning content and submit work.', 'learner');

INSERT OR IGNORE INTO role_profiles (id, tenant_id, profile_key, label, description, permissions, is_system) VALUES
  ('role_solo_teacher', 'tenant_edsync_default', 'solo_teacher', 'Solo Teacher', 'Guided teacher profile for independent creators.', '["courses.author","courses.publish","grades.manage","reports.view","learn"]', 1),
  ('role_instructor', 'tenant_edsync_default', 'instructor', 'Instructor', 'Course author and grader.', '["courses.author","courses.publish","grades.manage","reports.view"]', 1),
  ('role_branch_manager', 'tenant_edsync_default', 'branch_manager', 'Branch Manager', 'Manages users, reports, and local courses.', '["users.manage","courses.author","courses.publish","grades.manage","reports.view"]', 1),
  ('role_portal_admin', 'tenant_edsync_default', 'portal_admin', 'Portal Admin', 'Manages portals, users, courses, and reports.', '["portals.manage","users.manage","courses.author","courses.publish","grades.manage","reports.view"]', 1),
  ('role_billing_admin', 'tenant_edsync_default', 'billing_admin', 'Billing Admin', 'Manages monetization and entitlements.', '["billing.manage","reports.view"]', 1),
  ('role_auditor', 'tenant_edsync_default', 'auditor', 'Auditor', 'Read-only audit and reporting access.', '["reports.view","security.audit"]', 1),
  ('role_learner', 'tenant_edsync_default', 'learner', 'Learner', 'Learner access to assigned content.', '["learn"]', 1),
  ('role_master_admin', 'tenant_edsync_default', 'master_admin', 'Master Admin', 'Full enterprise command center access.', '["portals.manage","users.manage","courses.author","courses.publish","grades.manage","reports.view","billing.manage","ai.manage","security.audit","learn"]', 1);

CREATE INDEX IF NOT EXISTS idx_tenant_memberships_user ON tenant_memberships(user_id, status);
CREATE INDEX IF NOT EXISTS idx_tenant_object_links_object ON tenant_object_links(object_table, object_id);
CREATE INDEX IF NOT EXISTS idx_learning_events_tenant_source ON learning_events(tenant_id, source_type, source_id, created_at);
CREATE INDEX IF NOT EXISTS idx_learning_events_student ON learning_events(student_id, created_at);
CREATE INDEX IF NOT EXISTS idx_content_blocks_tenant ON content_blocks(tenant_id, block_type, status);
CREATE INDEX IF NOT EXISTS idx_standards_packages_tenant ON standards_packages(tenant_id, package_type, status);
CREATE INDEX IF NOT EXISTS idx_xapi_statements_tenant ON xapi_statements(tenant_id, verb, created_at);
CREATE INDEX IF NOT EXISTS idx_certifications_user ON learner_certifications(user_id, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_automation_rules_tenant ON automation_rules(tenant_id, enabled, trigger_key);
CREATE INDEX IF NOT EXISTS idx_billing_products_tenant ON billing_products(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_entitlements_user ON entitlements(user_id, status, ends_at);
CREATE INDEX IF NOT EXISTS idx_offline_sync_user ON offline_sync_items(user_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_rollups_tenant ON analytics_rollups(tenant_id, rollup_key, computed_at);
