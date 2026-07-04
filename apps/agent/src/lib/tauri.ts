import { invoke } from "@tauri-apps/api/core";
import type { AgentStatus, SaveSettingsInput } from "../types";

export async function getStatus() {
  return invoke<AgentStatus>("get_status");
}

export async function startTracking() {
  return invoke<AgentStatus>("start_tracking");
}

export async function pauseTracking() {
  return invoke<AgentStatus>("pause_tracking");
}

export async function stopTracking() {
  return invoke<AgentStatus>("stop_tracking");
}

export async function saveSettings(input: SaveSettingsInput) {
  return invoke<AgentStatus>("save_settings", {
    apiUrl: input.apiUrl,
    apiToken: input.apiToken,
    excludedApps: input.excludedApps,
  });
}
