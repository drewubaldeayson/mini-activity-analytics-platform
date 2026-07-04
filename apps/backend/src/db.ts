import { Pool } from "pg";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/activity_analytics";

export const pool = new Pool({
  connectionString: databaseUrl,
});

export async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS activity_events (
      id BIGSERIAL PRIMARY KEY,
      device_id TEXT NOT NULL,
      device_name TEXT NOT NULL,
      platform TEXT NOT NULL,
      app_name TEXT NOT NULL,
      window_title TEXT NOT NULL,
      state TEXT NOT NULL,
      started_at TIMESTAMPTZ NOT NULL,
      ended_at TIMESTAMPTZ NOT NULL,
      duration_seconds INTEGER NOT NULL,
      captured_at TIMESTAMPTZ NOT NULL,
      source TEXT NOT NULL DEFAULT 'desktop-agent',
      session_id TEXT,
      url TEXT,
      domain TEXT,
      classification TEXT NOT NULL DEFAULT 'neutral'
    );

    CREATE TABLE IF NOT EXISTS device_heartbeats (
      device_id TEXT PRIMARY KEY,
      device_name TEXT NOT NULL,
      platform TEXT NOT NULL,
      status TEXT NOT NULL,
      captured_at TIMESTAMPTZ NOT NULL,
      last_app_name TEXT NOT NULL DEFAULT '',
      last_window_title TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'desktop-agent',
      last_url TEXT NOT NULL DEFAULT '',
      last_domain TEXT NOT NULL DEFAULT '',
      last_classification TEXT NOT NULL DEFAULT 'neutral'
    );

    CREATE TABLE IF NOT EXISTS productivity_rules (
      id TEXT PRIMARY KEY,
      target TEXT NOT NULL,
      match_type TEXT NOT NULL,
      pattern TEXT NOT NULL,
      classification TEXT NOT NULL,
      label TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE activity_events
      ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'desktop-agent',
      ADD COLUMN IF NOT EXISTS session_id TEXT,
      ADD COLUMN IF NOT EXISTS url TEXT,
      ADD COLUMN IF NOT EXISTS domain TEXT,
      ADD COLUMN IF NOT EXISTS classification TEXT NOT NULL DEFAULT 'neutral';

    ALTER TABLE device_heartbeats
      ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'desktop-agent',
      ADD COLUMN IF NOT EXISTS last_url TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS last_domain TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS last_classification TEXT NOT NULL DEFAULT 'neutral';
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_activity_events_captured_at
      ON activity_events (captured_at DESC);
    CREATE INDEX IF NOT EXISTS idx_activity_events_device_id
      ON activity_events (device_id);
    CREATE INDEX IF NOT EXISTS idx_activity_events_app_name
      ON activity_events (app_name);
    CREATE INDEX IF NOT EXISTS idx_activity_events_domain
      ON activity_events (domain);
    CREATE INDEX IF NOT EXISTS idx_activity_events_classification
      ON activity_events (classification);
    CREATE INDEX IF NOT EXISTS idx_productivity_rules_target
      ON productivity_rules (target, active);
  `);

  await seedDefaultProductivityRules();
}

async function seedDefaultProductivityRules() {
  const { rows } = await pool.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM productivity_rules",
  );

  if ((rows[0]?.count ?? "0") !== "0") {
    return;
  }

  await pool.query(
    `
      INSERT INTO productivity_rules (id, target, match_type, pattern, classification, label)
      VALUES
        ('rule-domain-github', 'domain', 'suffix', 'github.com', 'productive', 'GitHub'),
        ('rule-domain-docs', 'domain', 'suffix', 'docs.openai.com', 'productive', 'OpenAI Docs'),
        ('rule-domain-stackoverflow', 'domain', 'suffix', 'stackoverflow.com', 'productive', 'Stack Overflow'),
        ('rule-domain-youtube', 'domain', 'suffix', 'youtube.com', 'neutral', 'YouTube'),
        ('rule-domain-facebook', 'domain', 'suffix', 'facebook.com', 'unproductive', 'Facebook'),
        ('rule-app-vscode', 'app', 'contains', 'code', 'productive', 'VS Code'),
        ('rule-app-excel', 'app', 'contains', 'excel', 'productive', 'Excel'),
        ('rule-app-slack', 'app', 'contains', 'slack', 'neutral', 'Slack')
    `,
  );
}
