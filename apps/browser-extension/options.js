const form = document.getElementById("settings-form");
const apiUrlInput = document.getElementById("apiUrl");
const apiTokenInput = document.getElementById("apiToken");
const deviceNameInput = document.getElementById("deviceName");
const deviceIdInput = document.getElementById("deviceId");
const trackingEnabledInput = document.getElementById("trackingEnabled");
const excludedDomainsInput = document.getElementById("excludedDomains");
const scheduleEnabledInput = document.getElementById("scheduleEnabled");
const trackingWindowStartInput = document.getElementById("trackingWindowStart");
const trackingWindowEndInput = document.getElementById("trackingWindowEnd");
const weekdaysOnlyInput = document.getElementById("weekdaysOnly");
const statusNode = document.getElementById("status");

async function loadSettings() {
  const settings = await chrome.storage.local.get([
    "apiUrl",
    "apiToken",
    "deviceName",
    "deviceId",
    "trackingEnabled",
    "excludedDomains",
    "scheduleEnabled",
    "trackingWindowStart",
    "trackingWindowEnd",
    "weekdaysOnly",
  ]);

  apiUrlInput.value = settings.apiUrl || "http://localhost:4000";
  apiTokenInput.value = settings.apiToken || "";
  deviceNameInput.value = settings.deviceName || "Chrome Browser";
  deviceIdInput.value = settings.deviceId || crypto.randomUUID();
  trackingEnabledInput.checked = settings.trackingEnabled ?? true;
  excludedDomainsInput.value = Array.isArray(settings.excludedDomains)
    ? settings.excludedDomains.join(", ")
    : "";
  scheduleEnabledInput.checked = settings.scheduleEnabled ?? false;
  trackingWindowStartInput.value = settings.trackingWindowStart || "09:00";
  trackingWindowEndInput.value = settings.trackingWindowEnd || "18:00";
  weekdaysOnlyInput.checked = settings.weekdaysOnly ?? false;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  await chrome.storage.local.set({
    apiUrl: apiUrlInput.value.trim(),
    apiToken: apiTokenInput.value.trim(),
    deviceName: deviceNameInput.value.trim(),
    deviceId: deviceIdInput.value.trim(),
    trackingEnabled: trackingEnabledInput.checked,
    excludedDomains: excludedDomainsInput.value
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
    scheduleEnabled: scheduleEnabledInput.checked,
    trackingWindowStart: trackingWindowStartInput.value.trim() || "09:00",
    trackingWindowEnd: trackingWindowEndInput.value.trim() || "18:00",
    weekdaysOnly: weekdaysOnlyInput.checked,
  });

  statusNode.textContent = "Settings saved.";
  window.setTimeout(() => {
    statusNode.textContent = "";
  }, 2000);
});

void loadSettings();
