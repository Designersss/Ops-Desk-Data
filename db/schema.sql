BEGIN;
CREATE TABLE IF NOT EXISTS production_records (
  id BIGSERIAL PRIMARY KEY,
  section TEXT NOT NULL CHECK(section IN('preparation','welding','documents')),
  record_key TEXT NOT NULL,
  work_date DATE NOT NULL,
  batch_id TEXT,
  employee TEXT,
  plan_qty BIGINT,
  fact_qty BIGINT,
  need_qty BIGINT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT max_record_key CHECK(length(record_key) BETWEEN 1 AND 100)
);
CREATE INDEX IF NOT EXISTS idx_records_section_date ON production_records(section,work_date);
CREATE INDEX IF NOT EXISTS idx_records_section_batch ON production_records(section,batch_id);
CREATE TABLE IF NOT EXISTS import_sources (
  section TEXT PRIMARY KEY CHECK(section IN('preparation','welding','documents')),
  file_name TEXT NOT NULL,
  row_count INTEGER NOT NULL CHECK(row_count>=0),
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS audit_events (
  id BIGSERIAL PRIMARY KEY,
  record_id BIGINT,
  event_type TEXT NOT NULL CHECK(event_type IN('created','updated','deleted')),
  role_name TEXT NOT NULL,
  before_state JSONB,
  after_state JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMIT;
