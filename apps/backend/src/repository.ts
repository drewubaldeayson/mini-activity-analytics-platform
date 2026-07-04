import type {
  ActivityEventPayload,
  ActivitySource,
  DashboardSummary,
  DeviceDetail,
  DeviceStatus,
  HeartbeatPayload,
  ProductivityClassification,
  ProductivityRule,
  TimelineBucket,
  TopApplication,
} from "@mini-analytics/shared";
import { pool } from "./db.js";

type RangeFilter = {
  fromIso: string;
  toIso: string;
};

type ProductivityRuleRow = {
  id: string;
  target: ProductivityRule["target"];
  match_type: ProductivityRule["matchType"];
  pattern: string;
  classification: ProductivityClassification;
  label: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

function normalizeText(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function mapRuleRow(row: ProductivityRuleRow): ProductivityRule {
  return {
    id: row.id,
    target: row.target,
    matchType: row.match_type,
    pattern: row.pattern,
    classification: row.classification,
    label: row.label,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function matchesRule(
  candidate: string,
  matchType: ProductivityRule["matchType"],
  pattern: string,
) {
  if (!candidate || !pattern) {
    return false;
  }

  switch (matchType) {
    case "equals":
      return candidate === pattern;
    case "contains":
      return candidate.includes(pattern);
    case "suffix":
      return candidate === pattern || candidate.endsWith(`.${pattern}`);
    default:
      return false;
  }
}

async function resolveClassification(
  event: Pick<ActivityEventPayload, "appName" | "domain" | "url">,
): Promise<ProductivityClassification> {
  const rules = await getProductivityRules();
  const appName = normalizeText(event.appName);
  const domain = normalizeText(event.domain);
  const url = normalizeText(event.url);

  for (const rule of rules) {
    if (!rule.active) continue;

    const pattern = normalizeText(rule.pattern);
    const candidate =
      rule.target === "app" ? appName : rule.target === "domain" ? domain : url;

    if (matchesRule(candidate, rule.matchType, pattern)) {
      return rule.classification;
    }
  }

  return "neutral";
}

function paramsForRange(range: RangeFilter, deviceId?: string) {
  if (deviceId) {
    return [range.fromIso, range.toIso, deviceId];
  }
  return [range.fromIso, range.toIso];
}

function rangeClause(withDevice = false) {
  return `
    captured_at >= $1::timestamptz
    AND captured_at <= $2::timestamptz
    ${withDevice ? "AND device_id = $3" : ""}
  `;
}

export async function insertActivityEvent(event: ActivityEventPayload) {
  const classification = await resolveClassification(event);
  const source: ActivitySource = event.source ?? "desktop-agent";
  await pool.query(
    `
      INSERT INTO activity_events (
        device_id,
        device_name,
        platform,
        app_name,
        window_title,
        state,
        started_at,
        ended_at,
        duration_seconds,
        captured_at,
        source,
        session_id,
        url,
        domain,
        classification
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
    `,
    [
      event.deviceId,
      event.deviceName,
      event.platform,
      event.appName,
      event.windowTitle,
      event.state,
      event.startedAt,
      event.endedAt,
      event.durationSeconds,
      event.capturedAt,
      source,
      event.sessionId ?? null,
      event.url ?? null,
      event.domain ?? null,
      classification,
    ],
  );

  await updateHeartbeat(
    {
      deviceId: event.deviceId,
      deviceName: event.deviceName,
      platform: event.platform,
      status: event.state,
      capturedAt: event.capturedAt,
      lastAppName: event.appName,
      lastWindowTitle: event.windowTitle,
      source,
      lastUrl: event.url,
      lastDomain: event.domain,
      lastClassification: classification,
    },
    event.appName,
    event.windowTitle,
    event.url ?? "",
    event.domain ?? "",
    classification,
  );
}

export async function insertActivityEvents(events: ActivityEventPayload[]) {
  for (const event of events) {
    await insertActivityEvent(event);
  }
}

export async function updateHeartbeat(
  heartbeat: HeartbeatPayload,
  lastAppName = "",
  lastWindowTitle = "",
  lastUrl = "",
  lastDomain = "",
  lastClassification?: ProductivityClassification,
) {
  const source: ActivitySource = heartbeat.source ?? "desktop-agent";
  const classification =
    lastClassification ??
    (await resolveClassification({
      appName: lastAppName,
      domain: lastDomain,
      url: lastUrl,
    }));
  await pool.query(
    `
      INSERT INTO device_heartbeats (
        device_id,
        device_name,
        platform,
        status,
        captured_at,
        last_app_name,
        last_window_title,
        source,
        last_url,
        last_domain,
        last_classification
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (device_id) DO UPDATE SET
        device_name = EXCLUDED.device_name,
        platform = EXCLUDED.platform,
        status = EXCLUDED.status,
        captured_at = EXCLUDED.captured_at,
        source = EXCLUDED.source,
        last_app_name = CASE
          WHEN EXCLUDED.last_app_name = '' THEN device_heartbeats.last_app_name
          ELSE EXCLUDED.last_app_name
        END,
        last_window_title = CASE
          WHEN EXCLUDED.last_window_title = '' THEN device_heartbeats.last_window_title
          ELSE EXCLUDED.last_window_title
        END,
        last_url = CASE
          WHEN EXCLUDED.last_url = '' THEN device_heartbeats.last_url
          ELSE EXCLUDED.last_url
        END,
        last_domain = CASE
          WHEN EXCLUDED.last_domain = '' THEN device_heartbeats.last_domain
          ELSE EXCLUDED.last_domain
        END,
        last_classification = EXCLUDED.last_classification
    `,
    [
      heartbeat.deviceId,
      heartbeat.deviceName,
      heartbeat.platform,
      heartbeat.status,
      heartbeat.capturedAt,
      lastAppName,
      lastWindowTitle,
      source,
      lastUrl,
      lastDomain,
      classification,
    ],
  );
}

export async function updateHeartbeats(heartbeats: HeartbeatPayload[]) {
  for (const heartbeat of heartbeats) {
    await updateHeartbeat(
      heartbeat,
      heartbeat.lastAppName ?? "",
      heartbeat.lastWindowTitle ?? "",
      heartbeat.lastUrl ?? "",
      heartbeat.lastDomain ?? "",
      heartbeat.lastClassification,
    );
  }
}

export async function getSummary(range: RangeFilter): Promise<DashboardSummary> {
  const [summaryResult, totalsResult] = await Promise.all([
    pool.query(`
      SELECT
        COUNT(*) FILTER (
          WHERE status = 'active' AND captured_at >= NOW() - INTERVAL '2 minutes'
        )::int AS active_devices,
        COUNT(*)::int AS total_devices,
        COUNT(*) FILTER (WHERE status = 'paused')::int AS paused_devices,
        COUNT(*) FILTER (WHERE status = 'stopped')::int AS stopped_devices
      FROM device_heartbeats
    `),
    pool.query(
      `
        SELECT
          COALESCE(SUM(CASE WHEN state = 'active' THEN duration_seconds END), 0)::int AS active_seconds,
          COALESCE(SUM(CASE WHEN state = 'idle' THEN duration_seconds END), 0)::int AS idle_seconds,
          COALESCE(SUM(CASE WHEN classification = 'productive' THEN duration_seconds END), 0)::int AS productive_seconds,
          COALESCE(SUM(CASE WHEN classification = 'neutral' THEN duration_seconds END), 0)::int AS neutral_seconds,
          COALESCE(SUM(CASE WHEN classification = 'unproductive' THEN duration_seconds END), 0)::int AS unproductive_seconds
        FROM activity_events
        WHERE ${rangeClause(false)}
      `,
      paramsForRange(range),
    ),
  ]);

  const summaryRow = summaryResult.rows[0];
  const totalsRow = totalsResult.rows[0];

  return {
    activeDevices: summaryRow?.active_devices ?? 0,
    totalDevices: summaryRow?.total_devices ?? 0,
    pausedDevices: summaryRow?.paused_devices ?? 0,
    stoppedDevices: summaryRow?.stopped_devices ?? 0,
    activeSeconds: totalsRow?.active_seconds ?? 0,
    idleSeconds: totalsRow?.idle_seconds ?? 0,
    productiveSeconds: totalsRow?.productive_seconds ?? 0,
    neutralSeconds: totalsRow?.neutral_seconds ?? 0,
    unproductiveSeconds: totalsRow?.unproductive_seconds ?? 0,
  };
}

export async function getDevices(range: RangeFilter): Promise<DeviceStatus[]> {
  const result = await pool.query(
    `
      SELECT
        h.device_id AS "deviceId",
        h.device_name AS "deviceName",
        h.platform,
        h.status,
        h.captured_at AS "lastSeenAt",
        h.last_app_name AS "lastAppName",
        h.last_window_title AS "lastWindowTitle",
        h.last_classification AS "lastClassification",
        h.last_domain AS "lastDomain",
        h.source,
        COALESCE(SUM(CASE WHEN e.state = 'active' THEN e.duration_seconds END), 0)::int AS "activeSeconds",
        COALESCE(SUM(CASE WHEN e.state = 'idle' THEN e.duration_seconds END), 0)::int AS "idleSeconds"
      FROM device_heartbeats h
      LEFT JOIN activity_events e
        ON e.device_id = h.device_id
        AND e.captured_at >= $1::timestamptz
        AND e.captured_at <= $2::timestamptz
      GROUP BY h.device_id, h.device_name, h.platform, h.status, h.captured_at, h.last_app_name, h.last_window_title, h.last_classification, h.last_domain, h.source
      ORDER BY h.captured_at DESC
    `,
    paramsForRange(range),
  );
  return result.rows as DeviceStatus[];
}

export async function getRecentActivity(limit: number, range: RangeFilter, deviceId?: string) {
  const query = `
    SELECT
      device_id AS "deviceId",
      device_name AS "deviceName",
      platform,
      app_name AS "appName",
      window_title AS "windowTitle",
      state,
      started_at AS "startedAt",
      ended_at AS "endedAt",
      duration_seconds AS "durationSeconds",
      captured_at AS "capturedAt",
      source,
      session_id AS "sessionId",
      url,
      domain,
      classification
    FROM activity_events
    WHERE ${rangeClause(Boolean(deviceId))}
    ORDER BY captured_at DESC
    LIMIT ${deviceId ? "$4" : "$3"}
  `;

  const params = [...paramsForRange(range, deviceId), limit];
  const result = await pool.query(query, params);
  return result.rows as ActivityEventPayload[];
}

export async function getTopApplications(
  range: RangeFilter,
  limit: number,
  deviceId?: string,
): Promise<TopApplication[]> {
  const query = `
    SELECT
      app_name AS "appName",
      SUM(duration_seconds)::int AS "totalSeconds",
      (ARRAY_AGG(classification ORDER BY captured_at DESC))[1] AS classification
    FROM activity_events
    WHERE ${rangeClause(Boolean(deviceId))}
    GROUP BY app_name
    ORDER BY "totalSeconds" DESC
    LIMIT ${deviceId ? "$4" : "$3"}
  `;

  const result = await pool.query(query, [...paramsForRange(range, deviceId), limit]);
  return result.rows as TopApplication[];
}

export async function getTimeline(range: RangeFilter, deviceId?: string): Promise<TimelineBucket[]> {
  const result = await pool.query(
    `
      SELECT
        TO_CHAR(date_trunc('hour', captured_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD"T"HH24:00:00"Z"') AS bucket,
        COALESCE(SUM(CASE WHEN state = 'active' THEN duration_seconds END), 0)::int AS "activeSeconds",
        COALESCE(SUM(CASE WHEN state = 'idle' THEN duration_seconds END), 0)::int AS "idleSeconds"
      FROM activity_events
      WHERE ${rangeClause(Boolean(deviceId))}
      GROUP BY bucket
      ORDER BY bucket ASC
    `,
    paramsForRange(range, deviceId),
  );
  return result.rows as TimelineBucket[];
}

export async function getDeviceDetail(
  deviceId: string,
  range: RangeFilter,
): Promise<DeviceDetail> {
  const [devices, topApps, recentActivity, timeline] = await Promise.all([
    getDevices(range),
    getTopApplications(range, 5, deviceId),
    getRecentActivity(20, range, deviceId),
    getTimeline(range, deviceId),
  ]);

  const device = devices.find((item) => item.deviceId === deviceId) ?? null;
  const summary = recentActivity.reduce(
    (acc, item) => {
      acc.totalEvents += 1;
      if (item.state === "active") {
        acc.activeSeconds += item.durationSeconds;
      }
      if (item.state === "idle") {
        acc.idleSeconds += item.durationSeconds;
      }
      if (item.classification === "productive") {
        acc.productiveSeconds += item.durationSeconds;
      }
      if (item.classification === "neutral") {
        acc.neutralSeconds += item.durationSeconds;
      }
      if (item.classification === "unproductive") {
        acc.unproductiveSeconds += item.durationSeconds;
      }
      return acc;
    },
    {
      activeSeconds: 0,
      idleSeconds: 0,
      totalEvents: 0,
      productiveSeconds: 0,
      neutralSeconds: 0,
      unproductiveSeconds: 0,
    },
  );

  return {
    device,
    summary,
    topApps,
    recentActivity,
    timeline,
  };
}

export async function getProductivityRules(): Promise<ProductivityRule[]> {
  const result = await pool.query<ProductivityRuleRow>(
    `
      SELECT
        id,
        target,
        match_type,
        pattern,
        classification,
        label,
        active,
        created_at::text,
        updated_at::text
      FROM productivity_rules
      ORDER BY created_at ASC
    `,
  );

  return result.rows.map(mapRuleRow);
}

export async function replaceProductivityRules(rules: ProductivityRule[]) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM productivity_rules");

    for (const rule of rules) {
      await client.query(
        `
          INSERT INTO productivity_rules (
            id,
            target,
            match_type,
            pattern,
            classification,
            label,
            active,
            created_at,
            updated_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        `,
        [
          rule.id,
          rule.target,
          rule.matchType,
          rule.pattern,
          rule.classification,
          rule.label,
          rule.active,
          rule.createdAt,
          rule.updatedAt,
        ],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
