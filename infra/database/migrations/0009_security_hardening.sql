-- EdSync security hardening (bugs H2, H3, M10).
-- The remote D1 migration runner re-applies every file, so every statement here is idempotent.
-- Existing constraints already back the rest of the hardening: UNIQUE(provider, provider_event_id) on
-- billing_webhook_events, UNIQUE(scope, subject_hash) on rate_limits, UNIQUE(bucket, object_key) on storage_objects.

-- Supports idempotent entitlement grants from webhooks and manual payments.
CREATE INDEX IF NOT EXISTS idx_entitlements_grant_source
  ON entitlements(tenant_id, user_id, product_id, source_type, source_id);

-- Supports the billing admin transaction list.
CREATE INDEX IF NOT EXISTS idx_billing_transactions_tenant_status
  ON billing_transactions(tenant_id, status, created_at);

-- Owner-scoped reads in the shared default tenant.
CREATE INDEX IF NOT EXISTS idx_learning_events_tenant_actor
  ON learning_events(tenant_id, actor_id, created_at);

CREATE INDEX IF NOT EXISTS idx_standards_packages_tenant_owner
  ON standards_packages(tenant_id, owner_id);

CREATE INDEX IF NOT EXISTS idx_automation_rules_tenant_owner
  ON automation_rules(tenant_id, created_by);
