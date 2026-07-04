import { Injectable, OnModuleInit } from "@nestjs/common";
import type {
  ActivityEventPayload,
  DashboardSummary,
  DeviceDetail,
  DeviceStatus,
  HeartbeatPayload,
  ProductivityRule,
  TimelineBucket,
  TopApplication,
} from "@mini-analytics/shared";
import { initializeDatabase } from "./db.js";
import {
  getDeviceDetail,
  getDevices,
  getRecentActivity,
  getSummary,
  getTimeline,
  getTopApplications,
  getProductivityRules,
  insertActivityEvent,
  insertActivityEvents,
  replaceProductivityRules,
  updateHeartbeat,
  updateHeartbeats,
} from "./repository.js";

export interface RangeFilter {
  fromIso: string;
  toIso: string;
}

@Injectable()
export class AnalyticsService implements OnModuleInit {
  async onModuleInit() {
    await initializeDatabase();
  }

  async recordActivity(event: ActivityEventPayload) {
    await insertActivityEvent(event);
  }

  async recordActivityBulk(events: ActivityEventPayload[]) {
    await insertActivityEvents(events);
  }

  async recordHeartbeat(heartbeat: HeartbeatPayload) {
    await updateHeartbeat(
      heartbeat,
      heartbeat.lastAppName ?? "",
      heartbeat.lastWindowTitle ?? "",
    );
  }

  async recordHeartbeatBulk(heartbeats: HeartbeatPayload[]) {
    await updateHeartbeats(heartbeats);
  }

  async syncAgentData(payload: {
    events: ActivityEventPayload[];
    heartbeats: HeartbeatPayload[];
  }) {
    if (payload.events.length > 0) {
      await insertActivityEvents(payload.events);
    }
    if (payload.heartbeats.length > 0) {
      await updateHeartbeats(payload.heartbeats);
    }
    return {
      ok: true,
      insertedEvents: payload.events.length,
      insertedHeartbeats: payload.heartbeats.length,
    };
  }

  async getSummary(range: RangeFilter): Promise<DashboardSummary> {
    return getSummary(range);
  }

  async getDevices(range: RangeFilter): Promise<DeviceStatus[]> {
    return getDevices(range);
  }

  async getRecentActivity(limit: number, range: RangeFilter) {
    return getRecentActivity(limit, range);
  }

  async getTopApps(range: RangeFilter, limit: number): Promise<TopApplication[]> {
    return getTopApplications(range, limit);
  }

  async getTimeline(range: RangeFilter): Promise<TimelineBucket[]> {
    return getTimeline(range);
  }

  async getDeviceDetail(deviceId: string, range: RangeFilter): Promise<DeviceDetail> {
    return getDeviceDetail(deviceId, range);
  }

  async getProductivityRules(): Promise<ProductivityRule[]> {
    return getProductivityRules();
  }

  async saveProductivityRules(rules: ProductivityRule[]) {
    await replaceProductivityRules(rules);
    return this.getProductivityRules();
  }
}
