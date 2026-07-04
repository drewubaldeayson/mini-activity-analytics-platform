import type { DeviceDetail } from "@mini-analytics/shared";
import { Card, PanelHeader } from "@mini-analytics/shared-ui";
import { AppRow } from "../molecules/app-row";
import { formatDuration } from "../../lib/view-formatters";

export function DeviceDetailPanel({ detail }: { detail: DeviceDetail }) {
  return (
    <Card className="grid gap-5">
      <PanelHeader
        title="Device detail"
        caption={detail.device?.deviceName ?? "No device selected"}
      />
      {detail.device ? (
        <>
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <div className="rounded-2xl bg-secondary p-4">
              <span className="text-sm text-muted-foreground">Active time</span>
              <div className="mt-2 text-2xl font-semibold">{formatDuration(detail.summary.activeSeconds)}</div>
            </div>
            <div className="rounded-2xl bg-secondary p-4">
              <span className="text-sm text-muted-foreground">Idle time</span>
              <div className="mt-2 text-2xl font-semibold">{formatDuration(detail.summary.idleSeconds)}</div>
            </div>
            <div className="rounded-2xl bg-secondary p-4">
              <span className="text-sm text-muted-foreground">Events</span>
              <div className="mt-2 text-2xl font-semibold">{detail.summary.totalEvents}</div>
            </div>
            <div className="rounded-2xl bg-secondary p-4">
              <span className="text-sm text-muted-foreground">Productive</span>
              <div className="mt-2 text-2xl font-semibold">{formatDuration(detail.summary.productiveSeconds)}</div>
            </div>
            <div className="rounded-2xl bg-secondary p-4">
              <span className="text-sm text-muted-foreground">Neutral</span>
              <div className="mt-2 text-2xl font-semibold">{formatDuration(detail.summary.neutralSeconds)}</div>
            </div>
            <div className="rounded-2xl bg-secondary p-4">
              <span className="text-sm text-muted-foreground">Unproductive</span>
              <div className="mt-2 text-2xl font-semibold">{formatDuration(detail.summary.unproductiveSeconds)}</div>
            </div>
          </div>
          <div className="grid gap-3">
            {detail.topApps.map((app) => (
              <AppRow
                key={app.appName}
                appName={app.appName}
                value={formatDuration(app.totalSeconds)}
              />
            ))}
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Select a device from the table to inspect its activity.
        </p>
      )}
    </Card>
  );
}
