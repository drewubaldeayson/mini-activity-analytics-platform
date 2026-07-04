import { Play, Pause, Square } from "lucide-react";
import { Badge, Button, Card, CardDescription } from "@mini-analytics/shared-ui";
import type { AgentStatus } from "../../types";

interface AgentControlPanelProps {
  status: AgentStatus;
  timer: string;
  onStart: () => void;
  onPause: () => void;
  onStop: () => void;
}

export function AgentControlPanel({
  status,
  timer,
  onStart,
  onPause,
  onStop,
}: AgentControlPanelProps) {
  return (
    <Card className="grid gap-4">
      <div className="flex items-center justify-between">
        <Badge variant={status.state} className="capitalize">
          {status.state}
        </Badge>
        <span className="text-sm text-muted-foreground">{status.sync_state}</span>
      </div>
      <div className="text-5xl font-semibold tracking-tight">{timer}</div>
      <CardDescription>
        Tracking foreground app, window focus, idle state, privacy exclusions, and sync health.
      </CardDescription>
      <div className="grid grid-cols-3 gap-3">
        <Button onClick={onStart} disabled={status.state === "active" || status.state === "idle"}>
          <Play className="mr-2 h-4 w-4" />
          Start
        </Button>
        <Button
          variant="secondary"
          onClick={onPause}
          disabled={status.state === "paused" || status.state === "stopped"}
        >
          <Pause className="mr-2 h-4 w-4" />
          Pause
        </Button>
        <Button variant="ghost" onClick={onStop} disabled={status.state === "stopped"}>
          <Square className="mr-2 h-4 w-4" />
          Stop
        </Button>
      </div>
      <div className="rounded-2xl bg-secondary px-4 py-3 text-sm text-secondary-foreground">
        {status.message}
      </div>
    </Card>
  );
}
