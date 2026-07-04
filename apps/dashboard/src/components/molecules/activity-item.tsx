import { friendlyAppName, friendlyWindowTitle } from "../../lib/view-formatters";

interface ActivityItemProps {
  appName: string;
  windowTitle: string;
  rightTop: string;
  rightBottom: string;
  middle?: string;
}

export function ActivityItem({
  appName,
  windowTitle,
  rightTop,
  rightBottom,
  middle,
}: ActivityItemProps) {
  return (
    <div className="flex justify-between gap-4 rounded-2xl bg-secondary px-4 py-4">
      <div>
        <strong>{friendlyAppName(appName)}</strong>
        <p className="mt-1 text-sm text-muted-foreground">{friendlyWindowTitle(windowTitle)}</p>
      </div>
      <div className="grid justify-items-end text-sm text-muted-foreground">
        <span>{rightTop}</span>
        {middle ? <span>{middle}</span> : null}
        <span>{rightBottom}</span>
      </div>
    </div>
  );
}
