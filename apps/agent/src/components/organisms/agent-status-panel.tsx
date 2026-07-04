import { Card, CardTitle, StatRow } from "@mini-analytics/shared-ui";
import type { AgentStatus } from "../../types";

interface AgentStatusPanelProps {
  status: AgentStatus;
}

export function AgentStatusPanel({ status }: AgentStatusPanelProps) {
  return (
    <Card>
      <CardTitle className="mb-4">Runtime Status</CardTitle>
      <div>
        <StatRow label="Device" value={status.device_name} />
        <StatRow label="Device ID" value={status.device_id} />
        <StatRow label="API URL" value={status.api_url} />
        <StatRow label="SQLite Queue" value={String(status.pending_queue_count)} />
        <StatRow label="Sync State" value={status.sync_state} />
        <StatRow
          label="Last App"
          value={status.last_app_name || "Waiting for tracked app"}
        />
        <StatRow
          label="Window Title"
          value={status.last_window_title || "No visible window detected"}
        />
        <StatRow
          label="Last Sync"
          value={status.last_sync_at ? new Date(status.last_sync_at).toLocaleString() : "Waiting for first sync"}
        />
      </div>
    </Card>
  );
}
