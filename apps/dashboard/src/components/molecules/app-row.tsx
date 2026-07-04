import { friendlyAppName } from "../../lib/view-formatters";

interface AppRowProps {
  appName: string;
  value: string;
}

export function AppRow({ appName, value }: AppRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-secondary px-4 py-4">
      <strong>{friendlyAppName(appName)}</strong>
      <span className="text-sm text-muted-foreground">{value}</span>
    </div>
  );
}
