import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { z } from "zod";
import type {
  ActivityEventPayload,
  ActivityState,
  ActivitySource,
  HeartbeatPayload,
  ProductivityClassification,
  ProductivityRuleMatchType,
  ProductivityRuleTarget,
} from "@mini-analytics/shared";
import { AnalyticsService, type RangeFilter } from "./analytics.service.js";

const activityStateSchema = z.enum([
  "active",
  "idle",
  "paused",
  "stopped",
] satisfies [ActivityState, ...ActivityState[]]);

const activitySourceSchema = z.enum([
  "desktop-agent",
  "browser-extension",
] satisfies [ActivitySource, ...ActivitySource[]]);

const productivityClassificationSchema = z.enum([
  "productive",
  "neutral",
  "unproductive",
] satisfies [ProductivityClassification, ...ProductivityClassification[]]);

const productivityRuleTargetSchema = z.enum([
  "app",
  "domain",
  "url",
] satisfies [ProductivityRuleTarget, ...ProductivityRuleTarget[]]);

const productivityRuleMatchTypeSchema = z.enum([
  "equals",
  "contains",
  "suffix",
] satisfies [ProductivityRuleMatchType, ...ProductivityRuleMatchType[]]);

const activityEventSchema = z.object({
  deviceId: z.string().min(1),
  deviceName: z.string().min(1),
  platform: z.string().min(1),
  appName: z.string().min(1),
  windowTitle: z.string(),
  state: activityStateSchema,
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationSeconds: z.number().int().nonnegative(),
  capturedAt: z.string().datetime(),
  source: activitySourceSchema.optional(),
  sessionId: z.string().min(1).optional(),
  url: z.string().url().nullish(),
  domain: z.string().min(1).nullish(),
  classification: productivityClassificationSchema.optional(),
});

const heartbeatSchema = z.object({
  deviceId: z.string().min(1),
  deviceName: z.string().min(1),
  platform: z.string().min(1),
  status: activityStateSchema,
  capturedAt: z.string().datetime(),
  lastAppName: z.string().optional(),
  lastWindowTitle: z.string().optional(),
  source: activitySourceSchema.optional(),
  lastUrl: z.string().url().nullish(),
  lastDomain: z.string().min(1).nullish(),
  lastClassification: productivityClassificationSchema.optional(),
});

const activityBulkSchema = z.object({
  events: z.array(activityEventSchema).min(1).max(500),
});

const heartbeatBulkSchema = z.object({
  heartbeats: z.array(heartbeatSchema).min(1).max(500),
});

const agentSyncSchema = z.object({
  events: z.array(activityEventSchema).max(500),
  heartbeats: z.array(heartbeatSchema).max(500),
}).refine((payload) => payload.events.length > 0 || payload.heartbeats.length > 0, {
  message: "At least one event or heartbeat is required",
});

const productivityRuleSchema = z.object({
  id: z.string().min(1),
  target: productivityRuleTargetSchema,
  matchType: productivityRuleMatchTypeSchema,
  pattern: z.string().min(1),
  classification: productivityClassificationSchema,
  label: z.string().min(1),
  active: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const productivityRulesSchema = z.array(productivityRuleSchema).max(500);

function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new BadRequestException(parsed.error.flatten());
  }
  return parsed.data;
}

function normalizeNullableActivityEvent(
  event: z.infer<typeof activityEventSchema>,
): ActivityEventPayload {
  return {
    ...event,
    url: event.url ?? undefined,
    domain: event.domain ?? undefined,
  };
}

function normalizeNullableHeartbeat(
  heartbeat: z.infer<typeof heartbeatSchema>,
): HeartbeatPayload {
  return {
    ...heartbeat,
    lastUrl: heartbeat.lastUrl ?? undefined,
    lastDomain: heartbeat.lastDomain ?? undefined,
  };
}

function rangeFromQuery(query: { days?: string; from?: string; to?: string }): RangeFilter {
  const days = Math.min(Math.max(Number(query.days ?? 1), 1), 30);
  const from = query.from;
  const to = query.to;

  const toIso = to ? new Date(to).toISOString() : new Date().toISOString();
  const fromIso = from
    ? new Date(from).toISOString()
    : new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  return { fromIso, toIso };
}

@Controller()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get("health")
  getHealth() {
    return { ok: true };
  }

  @Post("api/activity")
  async createActivity(@Body() body: unknown) {
    const event = normalizeNullableActivityEvent(parseOrThrow(activityEventSchema, body));
    await this.analyticsService.recordActivity(event);
    return { ok: true };
  }

  @Post("api/activity/bulk")
  async createActivityBulk(@Body() body: unknown) {
    const payload = parseOrThrow(activityBulkSchema, body);
    await this.analyticsService.recordActivityBulk(
      payload.events.map(normalizeNullableActivityEvent),
    );
    return { ok: true, inserted: payload.events.length };
  }

  @Post("api/heartbeat")
  async createHeartbeat(@Body() body: unknown) {
    const heartbeat = normalizeNullableHeartbeat(parseOrThrow(heartbeatSchema, body));
    await this.analyticsService.recordHeartbeat(heartbeat);
    return { ok: true };
  }

  @Post("api/heartbeat/bulk")
  async createHeartbeatBulk(@Body() body: unknown) {
    const payload = parseOrThrow(heartbeatBulkSchema, body);
    await this.analyticsService.recordHeartbeatBulk(
      payload.heartbeats.map(normalizeNullableHeartbeat),
    );
    return { ok: true, inserted: payload.heartbeats.length };
  }

  @Post("api/agent/sync")
  async syncAgentData(@Body() body: unknown) {
    const payload = parseOrThrow(agentSyncSchema, body);
    return this.analyticsService.syncAgentData({
      events: payload.events.map(normalizeNullableActivityEvent),
      heartbeats: payload.heartbeats.map(normalizeNullableHeartbeat),
    });
  }

  @Get("api/dashboard/summary")
  async getSummary(@Query() query: { days?: string; from?: string; to?: string }) {
    return this.analyticsService.getSummary(rangeFromQuery(query));
  }

  @Get("api/dashboard/devices")
  async getDevices(@Query() query: { days?: string; from?: string; to?: string }) {
    return this.analyticsService.getDevices(rangeFromQuery(query));
  }

  @Get("api/dashboard/recent-activity")
  async getRecentActivity(
    @Query() query: { days?: string; from?: string; to?: string; limit?: string },
  ) {
    const limit = Math.min(Number(query.limit ?? 20), 100);
    return this.analyticsService.getRecentActivity(limit, rangeFromQuery(query));
  }

  @Get("api/dashboard/top-apps")
  async getTopApps(
    @Query() query: { days?: string; from?: string; to?: string; limit?: string },
  ) {
    const limit = Math.min(Number(query.limit ?? 5), 20);
    return this.analyticsService.getTopApps(rangeFromQuery(query), limit);
  }

  @Get("api/dashboard/timeline")
  async getTimeline(@Query() query: { days?: string; from?: string; to?: string }) {
    return this.analyticsService.getTimeline(rangeFromQuery(query));
  }

  @Get("api/dashboard/device/:deviceId")
  async getDeviceDetail(
    @Param("deviceId") deviceId: string,
    @Query() query: { days?: string; from?: string; to?: string },
  ) {
    return this.analyticsService.getDeviceDetail(deviceId, rangeFromQuery(query));
  }

  @Get("api/classification-rules")
  async getClassificationRules() {
    return this.analyticsService.getProductivityRules();
  }

  @Put("api/classification-rules")
  async updateClassificationRules(@Body() body: unknown) {
    const rules = parseOrThrow(productivityRulesSchema, body);
    return this.analyticsService.saveProductivityRules(rules);
  }
}
