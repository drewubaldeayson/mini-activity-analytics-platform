const trackingStateNode = document.getElementById("trackingState");
const apiUrlNode = document.getElementById("apiUrl");
const deviceNameNode = document.getElementById("deviceName");
const openSettingsButton = document.getElementById("openSettings");

async function loadState() {
  const settings = await chrome.storage.local.get([
    "apiUrl",
    "deviceName",
    "trackingEnabled",
    "scheduleEnabled",
  ]);

  const enabled = settings.trackingEnabled ?? true;
  trackingStateNode.textContent = enabled
    ? settings.scheduleEnabled
      ? "Enabled (scheduled)"
      : "Enabled"
    : "Disabled";
  apiUrlNode.textContent = settings.apiUrl || "http://localhost:4000";
  deviceNameNode.textContent = settings.deviceName || "Chrome Browser";
}

openSettingsButton.addEventListener("click", async () => {
  await chrome.runtime.openOptionsPage();
});

void loadState();
