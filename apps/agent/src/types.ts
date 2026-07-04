export type ActivityState = "active" | "idle" | "paused" | "stopped";

export interface AgentStatus {
  device_id: string;
  device_name: string;
  api_url: string;
  api_token: string;
  excluded_apps: string[];
  last_sync_at: string | null;
  last_window_title: string;
  last_app_name: string;
  state: ActivityState;
  tracked_seconds_total: number;
  current_run_started_at: string | null;
  pending_queue_count: number;
  sync_state: string;
  message: string;
}

export interface SaveSettingsInput {
  apiUrl: string;
  apiToken: string;
  excludedApps: string[];
}
