export type ActivityState = "active" | "idle" | "paused" | "stopped";
export type ActivitySource = "desktop-agent" | "browser-extension";
export type ProductivityClassification = "productive" | "neutral" | "unproductive";
export type ProductivityRuleTarget = "app" | "domain" | "url";
export type ProductivityRuleMatchType = "equals" | "contains" | "suffix";

export interface ProductivityRule {
  id: string;
  target: ProductivityRuleTarget;
  matchType: ProductivityRuleMatchType;
  pattern: string;
  classification: ProductivityClassification;
  label: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityEventPayload {
  deviceId: string;
  deviceName: string;
  platform: string;
  appName: string;
  windowTitle: string;
  state: ActivityState;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  capturedAt: string;
  source?: ActivitySource;
  sessionId?: string;
  url?: string;
  domain?: string;
  classification?: ProductivityClassification;
}

export interface HeartbeatPayload {
  deviceId: string;
  deviceName: string;
  platform: string;
  status: ActivityState;
  capturedAt: string;
  lastAppName?: string;
  lastWindowTitle?: string;
  source?: ActivitySource;
  lastUrl?: string;
  lastDomain?: string;
  lastClassification?: ProductivityClassification;
}

export interface DashboardSummary {
  activeDevices: number;
  totalDevices: number;
  activeSeconds: number;
  idleSeconds: number;
  pausedDevices: number;
  stoppedDevices: number;
  productiveSeconds: number;
  neutralSeconds: number;
  unproductiveSeconds: number;
}

export interface DeviceStatus {
  deviceId: string;
  deviceName: string;
  platform: string;
  status: ActivityState;
  lastSeenAt: string;
  lastAppName: string;
  lastWindowTitle: string;
  activeSeconds: number;
  idleSeconds: number;
  lastClassification?: ProductivityClassification | null;
  lastDomain?: string | null;
  source?: ActivitySource;
}

export interface TimelineBucket {
  bucket: string;
  activeSeconds: number;
  idleSeconds: number;
}

export interface TopApplication {
  appName: string;
  totalSeconds: number;
  classification?: ProductivityClassification | null;
}

export interface DashboardRange {
  from?: string;
  to?: string;
  days?: number;
}

export interface DeviceDetail {
  device: DeviceStatus | null;
  summary: {
    activeSeconds: number;
    idleSeconds: number;
    totalEvents: number;
    productiveSeconds: number;
    neutralSeconds: number;
    unproductiveSeconds: number;
  };
  topApps: TopApplication[];
  recentActivity: ActivityEventPayload[];
  timeline: TimelineBucket[];
}

export interface AgentSettings {
  apiUrl: string;
  excludedApps: string[];
}
