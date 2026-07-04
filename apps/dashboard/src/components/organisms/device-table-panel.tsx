import type { DeviceStatus } from "@mini-analytics/shared";
import { Card, PanelHeader } from "@mini-analytics/shared-ui";
import { friendlyAppName, friendlyWindowTitle, formatDuration } from "../../lib/view-formatters";

interface DeviceTablePanelProps {
  devices: DeviceStatus[];
  selectedDeviceId: string | null;
  onSelect: (deviceId: string) => void;
  onOpenDetail: (deviceId: string) => void;
}

export function DeviceTablePanel({
  devices,
  selectedDeviceId,
  onSelect,
  onOpenDetail,
}: DeviceTablePanelProps) {
  return (
    <Card>
      <PanelHeader title="Devices" caption="Select a device for detail" />
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="border-b border-border px-2 py-3 text-left text-sm text-muted-foreground">Device</th>
              <th className="border-b border-border px-2 py-3 text-left text-sm text-muted-foreground">Status</th>
              <th className="border-b border-border px-2 py-3 text-left text-sm text-muted-foreground">Last app</th>
              <th className="border-b border-border px-2 py-3 text-left text-sm text-muted-foreground">Range totals</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((device) => (
              <tr
                key={device.deviceId}
                onClick={() => onSelect(device.deviceId)}
                className={selectedDeviceId === device.deviceId ? "cursor-pointer bg-secondary/70" : "cursor-pointer"}
              >
                <td className="border-b border-border px-2 py-4 align-top">
                  <strong>{device.deviceName}</strong>
                  <div className="text-sm text-muted-foreground">{device.platform}</div>
                </td>
                <td className="border-b border-border px-2 py-4 align-top capitalize">{device.status}</td>
                <td className="border-b border-border px-2 py-4 align-top">
                  <strong>{friendlyAppName(device.lastAppName)}</strong>
                  <div className="text-sm text-muted-foreground">{friendlyWindowTitle(device.lastWindowTitle)}</div>
                </td>
                <td className="border-b border-border px-2 py-4 align-top">
                  <strong>{formatDuration(device.activeSeconds)}</strong>
                  <div className="text-sm text-muted-foreground">Idle {formatDuration(device.idleSeconds)}</div>
                  <button
                    className="mt-3 text-xs font-semibold uppercase tracking-wide text-primary"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenDetail(device.deviceId);
                    }}
                    type="button"
                  >
                    Open detail
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
