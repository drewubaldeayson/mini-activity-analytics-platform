import { useEffect, useState } from "react";
import type {
  ActivityEventPayload,
  DashboardSummary,
  DeviceDetail,
  DeviceStatus,
  TimelineBucket,
  TopApplication,
} from "@mini-analytics/shared";
import { AppShell, Button, Card, PanelHeader, StatCard } from "@mini-analytics/shared-ui";
import { ActivityChartPanel } from "../components/organisms/activity-chart-panel";
import { DashboardHero } from "../components/organisms/dashboard-hero";
import { DeviceDetailPanel } from "../components/organisms/device-detail-panel";
import { DeviceTablePanel } from "../components/organisms/device-table-panel";
import { AppRow } from "../components/molecules/app-row";
import { ActivityItem } from "../components/molecules/activity-item";
import { formatDuration } from "../lib/view-formatters";

const API_URL = import.meta.env.VITE_API_URL ?? "";

type RecentActivityItem = ActivityEventPayload;
type RangePreset = "1" | "7" | "30" | "custom";

const emptySummary: DashboardSummary = {
  activeDevices: 0,
  totalDevices: 0,
  activeSeconds: 0,
  idleSeconds: 0,
  pausedDevices: 0,
  stoppedDevices: 0,
  productiveSeconds: 0,
  neutralSeconds: 0,
  unproductiveSeconds: 0,
};

const emptyDetail: DeviceDetail = {
  device: null,
  summary: {
    activeSeconds: 0,
    idleSeconds: 0,
    totalEvents: 0,
    productiveSeconds: 0,
    neutralSeconds: 0,
    unproductiveSeconds: 0,
  },
  topApps: [],
  recentActivity: [],
  timeline: [],
};

function queryForRange(days: RangePreset) {
  return `days=${days}`;
}

function parseInitialFilters() {
  const params = new URLSearchParams(window.location.search);
  const hasCustomRange = Boolean(params.get("from") || params.get("to"));
  return {
    rangePreset: hasCustomRange ? "custom" : ((params.get("days") as RangePreset | null) ?? "1"),
    fromDate: params.get("from") ?? "",
    toDate: params.get("to") ?? "",
    selectedDeviceId: params.get("deviceId"),
  };
}

function buildQuery(params: { rangePreset: RangePreset; fromDate: string; toDate: string }) {
  if (params.rangePreset === "custom" && params.fromDate && params.toDate) {
    return `from=${encodeURIComponent(new Date(`${params.fromDate}T00:00:00`).toISOString())}&to=${encodeURIComponent(new Date(`${params.toDate}T23:59:59`).toISOString())}`;
  }
  return queryForRange(params.rangePreset === "custom" ? "7" : params.rangePreset);
}

async function fetchJson<T>(path: string, apiToken: string): Promise<T> {
  const headers = apiToken.trim()
    ? ({ Authorization: `Bearer ${apiToken.trim()}` } satisfies HeadersInit)
    : undefined;
  const response = await fetch(`${API_URL}${path}`, { headers });
  if (!response.ok) {
    throw new Error(`Request failed for ${path}`);
  }
  return response.json() as Promise<T>;
}

export function DashboardPage() {
  const initial = parseInitialFilters();
  const [rangePreset, setRangePreset] = useState<RangePreset>(initial.rangePreset);
  const [fromDate, setFromDate] = useState(initial.fromDate);
  const [toDate, setToDate] = useState(initial.toDate);
  const [apiToken, setApiToken] = useState(() => window.localStorage.getItem("dashboard-api-token") ?? "");
  const [summary, setSummary] = useState(emptySummary);
  const [devices, setDevices] = useState<DeviceStatus[]>([]);
  const [topApps, setTopApps] = useState<TopApplication[]>([]);
  const [timeline, setTimeline] = useState<TimelineBucket[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(initial.selectedDeviceId);
  const [deviceDetail, setDeviceDetail] = useState<DeviceDetail>(emptyDetail);
  const [error, setError] = useState<string | null>(null);
  const [appliedFilterVersion, setAppliedFilterVersion] = useState(0);

  useEffect(() => {
    window.localStorage.setItem("dashboard-api-token", apiToken);
  }, [apiToken]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (rangePreset !== "custom") {
      params.set("days", rangePreset);
    }
    if (rangePreset === "custom" && fromDate) {
      params.set("from", fromDate);
    }
    if (rangePreset === "custom" && toDate) {
      params.set("to", toDate);
    }
    if (selectedDeviceId) {
      params.set("deviceId", selectedDeviceId);
    }
    const query = params.toString();
    window.history.replaceState({}, "", query ? `?${query}` : window.location.pathname);
  }, [rangePreset, fromDate, toDate, selectedDeviceId]);

  useEffect(() => {
    let active = true;
    async function load() {
      const query = buildQuery({ rangePreset, fromDate, toDate });
      try {
        const [summaryData, deviceData, appData, timelineData, recentData] = await Promise.all([
          fetchJson<DashboardSummary>(`/api/dashboard/summary?${query}`, apiToken),
          fetchJson<DeviceStatus[]>(`/api/dashboard/devices?${query}`, apiToken),
          fetchJson<TopApplication[]>(`/api/dashboard/top-apps?${query}&limit=6`, apiToken),
          fetchJson<TimelineBucket[]>(`/api/dashboard/timeline?${query}`, apiToken),
          fetchJson<RecentActivityItem[]>(`/api/dashboard/recent-activity?${query}&limit=12`, apiToken),
        ]);

        if (!active) return;
        setSummary(summaryData);
        setDevices(deviceData);
        setTopApps(appData);
        setTimeline(timelineData);
        setRecentActivity(recentData);
        setError(null);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load dashboard data");
        }
      }
    }
    load();
    const timer = window.setInterval(load, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [rangePreset, fromDate, toDate, apiToken, appliedFilterVersion]);

  useEffect(() => {
    if (!selectedDeviceId) {
      setDeviceDetail(emptyDetail);
      return;
    }

    let active = true;
    fetchJson<DeviceDetail>(
      `/api/dashboard/device/${selectedDeviceId}?${buildQuery({ rangePreset, fromDate, toDate })}`,
      apiToken,
    )
      .then((detail) => {
        if (active) setDeviceDetail(detail);
      })
      .catch((detailError) => {
        if (active) {
          setError(detailError instanceof Error ? detailError.message : "Failed to load device detail");
        }
      });
    return () => {
      active = false;
    };
  }, [selectedDeviceId, rangePreset, fromDate, toDate, apiToken, appliedFilterVersion]);

  const chartData = timeline.map((item) => ({
    time: new Date(item.bucket).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    activeMinutes: Math.round(item.activeSeconds / 60),
    idleMinutes: Math.round(item.idleSeconds / 60),
  }));
  const activeNow = devices.filter((device) => {
    const recentMs = Date.now() - new Date(device.lastSeenAt).getTime();
    return device.status === "active" && recentMs <= 2 * 60 * 1000;
  });

  const isDevicePage = Boolean(selectedDeviceId);

  function applyCustomRange() {
    if (fromDate && toDate) {
      setRangePreset("custom");
    }
    setAppliedFilterVersion((value) => value + 1);
  }

  function resetFilters() {
    setRangePreset("7");
    setFromDate("");
    setToDate("");
    setAppliedFilterVersion((value) => value + 1);
  }

  function openDeviceDetail(deviceId: string) {
    setSelectedDeviceId(deviceId);
  }

  function closeDeviceDetail() {
    setSelectedDeviceId(null);
  }

  return (
    <AppShell className="px-6 py-8" contentClassName="max-w-7xl">
      <DashboardHero
        rangePreset={rangePreset}
        fromDate={fromDate}
        toDate={toDate}
        apiToken={apiToken}
        onRangeChange={(value) => setRangePreset(value as RangePreset)}
        onFromDateChange={setFromDate}
        onToDateChange={setToDate}
        onApiTokenChange={setApiToken}
        onApplyCustomRange={applyCustomRange}
        onResetFilters={resetFilters}
      />

      {error ? (
        <div className="mb-6 rounded-2xl border border-border bg-card px-5 py-4 text-sm text-red-700 shadow-panel">
          {error}
        </div>
      ) : null}

      <section className="mb-6 grid gap-5 md:grid-cols-3 xl:grid-cols-8">
        <StatCard label="Active devices" value={summary.activeDevices} />
        <StatCard label="Total devices" value={summary.totalDevices} />
        <StatCard label="Active time" value={formatDuration(summary.activeSeconds)} />
        <StatCard label="Idle time" value={formatDuration(summary.idleSeconds)} />
        <StatCard label="Paused / stopped" value={summary.pausedDevices + summary.stoppedDevices} />
        <StatCard label="Productive" value={formatDuration(summary.productiveSeconds)} />
        <StatCard label="Neutral" value={formatDuration(summary.neutralSeconds)} />
        <StatCard label="Unproductive" value={formatDuration(summary.unproductiveSeconds)} />
      </section>

      {isDevicePage ? (
        <section className="mb-6 grid gap-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">
                {deviceDetail.device?.deviceName ?? "Device detail"}
              </h2>
              <p className="text-sm text-muted-foreground">
                Full device activity view for the selected date range.
              </p>
            </div>
            <Button variant="outline" onClick={closeDeviceDetail}>
              Back to overview
            </Button>
          </div>
          <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <DeviceDetailPanel detail={deviceDetail} />
            <Card>
              <PanelHeader title="Device recent slices" caption="Latest 20 events" />
              <div className="grid gap-3">
                {deviceDetail.recentActivity.map((item, index) => (
                  <ActivityItem
                    key={`${item.deviceId}-${index}-${item.capturedAt}`}
                    appName={item.appName}
                    windowTitle={item.windowTitle}
                    rightTop={item.domain || item.state}
                    middle={item.classification}
                    rightBottom={`${Math.round(item.durationSeconds)}s`}
                  />
                ))}
              </div>
            </Card>
          </section>
        </section>
      ) : (
        <>
      <section className="mb-6 grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <ActivityChartPanel data={chartData} />
        <Card>
          <PanelHeader title="Top applications" caption="By active and idle time" />
          <div className="grid gap-3">
            {topApps.map((app) => (
              <AppRow key={app.appName} appName={app.appName} value={formatDuration(app.totalSeconds)} />
            ))}
          </div>
        </Card>
      </section>

      <section className="mb-6 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <DeviceTablePanel
          devices={devices}
          selectedDeviceId={selectedDeviceId}
          onSelect={setSelectedDeviceId}
          onOpenDetail={openDeviceDetail}
        />
        <Card>
          <PanelHeader title="Active now" caption={`${activeNow.length} devices currently active`} />
          <div className="grid gap-3">
            {(activeNow.length > 0 ? activeNow : devices.slice(0, 6)).map((item, index) => (
              <ActivityItem
                key={`${item.deviceId}-${index}`}
                appName={item.lastAppName}
                windowTitle={item.lastWindowTitle}
                rightTop={item.deviceName}
                middle={item.lastClassification ?? item.status}
                rightBottom={item.lastDomain || item.platform}
              />
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr]">
        <Card>
          <PanelHeader title="Recent activity" caption="Newest slices first" />
          <div className="grid gap-3">
            {recentActivity.map((item, index) => (
              <ActivityItem
                key={`${item.deviceId}-${index}-${item.capturedAt}`}
                appName={item.appName}
                windowTitle={item.windowTitle}
                rightTop={item.deviceName}
                middle={item.classification ?? item.state}
                rightBottom={`${Math.round(item.durationSeconds)}s`}
              />
            ))}
          </div>
        </Card>
      </section>
        </>
      )}
    </AppShell>
  );
}
