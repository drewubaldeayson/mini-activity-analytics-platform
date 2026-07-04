export function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

export function friendlyAppName(value: string) {
  if (!value || value === "Unknown") {
    return "Foreground app unavailable";
  }
  return value;
}

export function friendlyWindowTitle(value: string) {
  if (!value || value === "No window title") {
    return "No visible window detected";
  }
  return value;
}
