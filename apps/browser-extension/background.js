const DEFAULT_API_URL = "http://localhost:4000";
const DEFAULT_DEVICE_NAME = "Chrome Browser";
const PLATFORM = "chrome-extension";
const HEARTBEAT_ALARM = "mini-analytics-heartbeat";
const FLUSH_ALARM = "mini-analytics-flush";
const SYNC_ALARM = "mini-analytics-sync";
const IDLE_THRESHOLD_SECONDS = 60;
const MAX_SLICE_SECONDS = 300;
const HEARTBEAT_PERIOD_MINUTES = 0.5;
const FLUSH_PERIOD_MINUTES = 0.5;

let idleState = "active";
let currentSession = null;

function updateActionBadge(isEnabled) {
  chrome.action.setBadgeBackgroundColor({ color: isEnabled ? "#1f6f4c" : "#8a9a90" });
  chrome.action.setBadgeText({ text: isEnabled ? "ON" : "OFF" });
}

async function getPlatformDeviceName() {
  const info = await chrome.runtime.getPlatformInfo();
  return `Chrome ${info.os}`;
}

async function ensureSettings() {
  const stored = await chrome.storage.local.get([
    "apiUrl",
    "apiToken",
    "deviceId",
    "deviceName",
    "trackingEnabled",
    "excludedDomains",
    "scheduleEnabled",
    "trackingWindowStart",
    "trackingWindowEnd",
    "weekdaysOnly",
    "pendingQueue",
  ]);

  const defaults = {
    apiUrl: stored.apiUrl || DEFAULT_API_URL,
    apiToken: stored.apiToken || "",
    deviceId: stored.deviceId || crypto.randomUUID(),
    deviceName: stored.deviceName || (await getPlatformDeviceName()),
    trackingEnabled: stored.trackingEnabled ?? true,
    excludedDomains: Array.isArray(stored.excludedDomains) ? stored.excludedDomains : [],
    scheduleEnabled: stored.scheduleEnabled ?? false,
    trackingWindowStart: stored.trackingWindowStart || "09:00",
    trackingWindowEnd: stored.trackingWindowEnd || "18:00",
    weekdaysOnly: stored.weekdaysOnly ?? false,
    pendingQueue: Array.isArray(stored.pendingQueue) ? stored.pendingQueue : [],
  };

  await chrome.storage.local.set(defaults);
  return defaults;
}

function normalizeDomain(hostname) {
  return hostname.replace(/^www\./, "").toLowerCase();
}

function deriveDomain(url) {
  try {
    return normalizeDomain(new URL(url).hostname);
  } catch {
    return "";
  }
}

function isTrackableUrl(url) {
  return typeof url === "string" && (url.startsWith("http://") || url.startsWith("https://"));
}

async function getFocusedActiveTab() {
  const window = await chrome.windows.getLastFocused({ populate: true });
  if (!window || !window.focused || !Array.isArray(window.tabs)) {
    return null;
  }
  return window.tabs.find((tab) => tab.active) ?? null;
}

async function getActivitySnapshot() {
  const tab = await getFocusedActiveTab();
  if (!tab || !isTrackableUrl(tab.url)) {
    return null;
  }

  const url = tab.url;
  const domain = deriveDomain(url);
  return {
    appName: domain || "browser",
    windowTitle: tab.title || domain || "Browser tab",
    url,
    domain,
  };
}

function nextStateForSnapshot(snapshot) {
  if (!snapshot) {
    return "stopped";
  }
  if (idleState === "idle" || idleState === "locked") {
    return "idle";
  }
  return "active";
}

function sessionChanged(snapshot, state) {
  if (!currentSession) {
    return true;
  }
  return (
    currentSession.appName !== snapshot.appName ||
    currentSession.windowTitle !== snapshot.windowTitle ||
    currentSession.url !== snapshot.url ||
    currentSession.domain !== snapshot.domain ||
    currentSession.state !== state
  );
}

async function getSettings() {
  return ensureSettings();
}

async function getQueue() {
  const { pendingQueue = [] } = await chrome.storage.local.get("pendingQueue");
  return Array.isArray(pendingQueue) ? pendingQueue : [];
}

async function setQueue(pendingQueue) {
  await chrome.storage.local.set({ pendingQueue });
}

async function enqueue(kind, payload) {
  const queue = await getQueue();
  queue.push({
    id: crypto.randomUUID(),
    kind,
    payload,
  });
  await setQueue(queue);
}

async function postJson(apiUrl, path, payload) {
  const { apiToken } = await getSettings();
  const headers = {
    "content-type": "application/json",
  };
  if (apiToken && apiToken.trim()) {
    headers.Authorization = `Bearer ${apiToken.trim()}`;
  }

  const response = await fetch(`${apiUrl}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
}

async function flushQueue() {
  const settings = await getSettings();
  const queue = await getQueue();
  if (queue.length === 0) {
    return;
  }

  const events = [];
  const heartbeats = [];

  for (const item of queue.slice(0, 500)) {
    if (item.kind === "activity") {
      events.push(item.payload);
    } else if (item.kind === "heartbeat") {
      heartbeats.push(item.payload);
    }
  }

  try {
    await postJson(settings.apiUrl, "/api/agent/sync", { events, heartbeats });
    await setQueue(queue.slice(events.length + heartbeats.length));
  } catch {
    // Leave the queue intact for the next retry.
  }
}

async function sendOrQueue(kind, path, payload) {
  const settings = await getSettings();

  try {
    await postJson(settings.apiUrl, path, payload);
    await flushQueue();
  } catch {
    await enqueue(kind, payload);
  }
}

function toMinutes(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function isWithinSchedule(settings) {
  if (!settings.scheduleEnabled) {
    return true;
  }

  const now = new Date();
  if (settings.weekdaysOnly) {
    const day = now.getDay();
    if (day === 0 || day === 6) {
      return false;
    }
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const start = toMinutes(settings.trackingWindowStart || "09:00");
  const end = toMinutes(settings.trackingWindowEnd || "18:00");

  if (start === end) {
    return true;
  }

  if (start < end) {
    return currentMinutes >= start && currentMinutes <= end;
  }

  return currentMinutes >= start || currentMinutes <= end;
}

function isExcludedDomain(settings, snapshot) {
  if (!snapshot?.domain) {
    return false;
  }

  const normalized = snapshot.domain.toLowerCase();
  return (settings.excludedDomains || []).some((domain) => {
    const pattern = String(domain).trim().toLowerCase();
    return pattern && (normalized === pattern || normalized.endsWith(`.${pattern}`));
  });
}

async function emitHeartbeat(snapshot, state) {
  const settings = await getSettings();
  const payload = {
    deviceId: settings.deviceId,
    deviceName: settings.deviceName || DEFAULT_DEVICE_NAME,
    platform: PLATFORM,
    status: state,
    capturedAt: new Date().toISOString(),
    source: "browser-extension",
    lastAppName: snapshot?.appName || "browser",
    lastWindowTitle: snapshot?.windowTitle || "No active tab",
    lastUrl: snapshot?.url,
    lastDomain: snapshot?.domain,
  };

  await sendOrQueue("heartbeat", "/api/heartbeat", payload);
}

async function flushCurrentSession(endedAt, nextSnapshot, nextState, forceStop = false) {
  if (!currentSession) {
    return;
  }

  const durationSeconds = Math.max(
    1,
    Math.floor((endedAt.getTime() - new Date(currentSession.startedAt).getTime()) / 1000),
  );

  const payload = {
    deviceId: currentSession.deviceId,
    deviceName: currentSession.deviceName,
    platform: PLATFORM,
    appName: currentSession.appName,
    windowTitle: currentSession.windowTitle,
    state: currentSession.state,
    startedAt: currentSession.startedAt,
    endedAt: endedAt.toISOString(),
    durationSeconds,
    capturedAt: endedAt.toISOString(),
    source: "browser-extension",
    sessionId: currentSession.sessionId,
    url: currentSession.url,
    domain: currentSession.domain,
  };

  await sendOrQueue("activity", "/api/activity", payload);

  if (forceStop || !nextSnapshot || nextState === "stopped") {
    currentSession = null;
    return;
  }

  const renewSession =
    currentSession.appName !== nextSnapshot.appName ||
    currentSession.windowTitle !== nextSnapshot.windowTitle ||
    currentSession.url !== nextSnapshot.url ||
    currentSession.domain !== nextSnapshot.domain ||
    currentSession.state !== nextState;

  currentSession = {
    ...currentSession,
    ...(renewSession ? { sessionId: crypto.randomUUID() } : {}),
    startedAt: endedAt.toISOString(),
    appName: nextSnapshot.appName,
    windowTitle: nextSnapshot.windowTitle,
    url: nextSnapshot.url,
    domain: nextSnapshot.domain,
    state: nextState,
  };
}

async function syncActiveContext(reason = "poll") {
  const settings = await getSettings();
  updateActionBadge(Boolean(settings.trackingEnabled));
  if (!settings.trackingEnabled || !isWithinSchedule(settings)) {
    await flushCurrentSession(new Date(), null, "stopped", true);
    return;
  }

  const snapshot = await getActivitySnapshot();
  if (isExcludedDomain(settings, snapshot)) {
    await flushCurrentSession(new Date(), null, "stopped", true);
    await emitHeartbeat(null, "stopped");
    return;
  }
  const state = nextStateForSnapshot(snapshot);
  const now = new Date();

  if (!snapshot || state === "stopped") {
    await flushCurrentSession(now, null, "stopped", true);
    await emitHeartbeat(null, "stopped");
    return;
  }

  if (!currentSession) {
    currentSession = {
      sessionId: crypto.randomUUID(),
      deviceId: settings.deviceId,
      deviceName: settings.deviceName || DEFAULT_DEVICE_NAME,
      startedAt: now.toISOString(),
      appName: snapshot.appName,
      windowTitle: snapshot.windowTitle,
      url: snapshot.url,
      domain: snapshot.domain,
      state,
    };
    await emitHeartbeat(snapshot, state);
    return;
  }

  const elapsedSeconds = Math.floor(
    (now.getTime() - new Date(currentSession.startedAt).getTime()) / 1000,
  );

  if (sessionChanged(snapshot, state) || elapsedSeconds >= MAX_SLICE_SECONDS) {
    await flushCurrentSession(now, snapshot, state, false);
  }

  if (reason === "heartbeat" || reason === "idle-change") {
    await emitHeartbeat(snapshot, state);
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  await ensureSettings();
  chrome.idle.setDetectionInterval(IDLE_THRESHOLD_SECONDS);
  chrome.alarms.create(HEARTBEAT_ALARM, { periodInMinutes: HEARTBEAT_PERIOD_MINUTES });
  chrome.alarms.create(FLUSH_ALARM, { periodInMinutes: FLUSH_PERIOD_MINUTES });
  chrome.alarms.create(SYNC_ALARM, { periodInMinutes: 1 });
  await syncActiveContext("installed");
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureSettings();
  chrome.idle.setDetectionInterval(IDLE_THRESHOLD_SECONDS);
  await syncActiveContext("startup");
});

chrome.tabs.onActivated.addListener(() => {
  void syncActiveContext("tab-activated");
});

chrome.tabs.onUpdated.addListener((_, changeInfo, tab) => {
  if (tab.active && (changeInfo.status === "complete" || changeInfo.url || changeInfo.title)) {
    void syncActiveContext("tab-updated");
  }
});

chrome.windows.onFocusChanged.addListener(() => {
  void syncActiveContext("window-focus");
});

chrome.idle.onStateChanged.addListener((nextIdleState) => {
  idleState = nextIdleState;
  void syncActiveContext("idle-change");
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === HEARTBEAT_ALARM) {
    void syncActiveContext("heartbeat");
  }
  if (alarm.name === FLUSH_ALARM) {
    void syncActiveContext("segment-check");
  }
  if (alarm.name === SYNC_ALARM) {
    void flushQueue();
  }
});
