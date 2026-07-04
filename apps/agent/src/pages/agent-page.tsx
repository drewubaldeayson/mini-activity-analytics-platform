import { useEffect, useState } from "react";
import { AppShell, PageHero } from "@mini-analytics/shared-ui";
import { AgentControlPanel } from "../components/organisms/agent-control-panel";
import { AgentSettingsForm } from "../components/organisms/agent-settings-form";
import { AgentStatusPanel } from "../components/organisms/agent-status-panel";
import {
  getStatus,
  pauseTracking,
  saveSettings,
  startTracking,
  stopTracking,
} from "../lib/tauri";
import type { AgentStatus } from "../types";

const emptyStatus: AgentStatus = {
  device_id: "",
  device_name: "Windows Device",
  api_url: "http://localhost:4000",
  api_token: "",
  excluded_apps: [],
  last_sync_at: null,
  last_window_title: "",
  last_app_name: "",
  state: "stopped",
  tracked_seconds_total: 0,
  current_run_started_at: null,
  pending_queue_count: 0,
  sync_state: "idle",
  message: "Ready to start tracking.",
};

function formatDuration(totalSeconds: number) {
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function liveTrackedSeconds(status: AgentStatus) {
  const running = status.state === "active" || status.state === "idle";
  if (!running || !status.current_run_started_at) {
    return status.tracked_seconds_total;
  }
  const elapsed = Math.max(
    0,
    Math.floor((Date.now() - new Date(status.current_run_started_at).getTime()) / 1000),
  );
  return status.tracked_seconds_total + elapsed;
}

export function AgentPage() {
  const [status, setStatus] = useState<AgentStatus>(emptyStatus);
  const [apiUrl, setApiUrl] = useState(emptyStatus.api_url);
  const [apiToken, setApiToken] = useState(emptyStatus.api_token);
  const [excludedApps, setExcludedApps] = useState("");

  async function refreshStatus() {
    const next = await getStatus();
    setStatus(next);
    setApiUrl(next.api_url);
    setApiToken(next.api_token);
    setExcludedApps(next.excluded_apps.join("\n"));
  }

  useEffect(() => {
    void refreshStatus();
    const timer = window.setInterval(() => {
      void refreshStatus();
    }, 1500);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <AppShell contentClassName="max-w-3xl">
      <PageHero
        eyebrow="Rust + Tauri Desktop Agent"
        title="Mini Activity Analytics"
        description="Native Windows activity collection with a React command center, local SQLite durability, and automatic backend replay after connectivity returns."
      />
      <AgentControlPanel
        status={status}
        timer={formatDuration(liveTrackedSeconds(status))}
        onStart={() => void startTracking().then(setStatus)}
        onPause={() => void pauseTracking().then(setStatus)}
        onStop={() => void stopTracking().then(setStatus)}
      />
      <div className="grid gap-5 md:grid-cols-[1.15fr_0.85fr]">
        <AgentStatusPanel status={status} />
        <AgentSettingsForm
          apiUrl={apiUrl}
          apiToken={apiToken}
          excludedApps={excludedApps}
          onApiUrlChange={setApiUrl}
          onApiTokenChange={setApiToken}
          onExcludedAppsChange={setExcludedApps}
          onSave={() =>
            void saveSettings({
              apiUrl,
              apiToken,
              excludedApps: excludedApps.split(/\r?\n/),
            }).then(setStatus)
          }
        />
      </div>
    </AppShell>
  );
}
