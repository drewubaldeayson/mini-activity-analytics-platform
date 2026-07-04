import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, PanelHeader } from "@mini-analytics/shared-ui";

interface ActivityChartPanelProps {
  data: Array<{ time: string; activeMinutes: number; idleMinutes: number }>;
}

export function ActivityChartPanel({ data }: ActivityChartPanelProps) {
  return (
    <Card className="min-h-[380px]">
      <PanelHeader title="Activity over time" caption="Range-based trend" />
      <div className="h-[290px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="activeFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1d7a54" stopOpacity={0.8} />
                <stop offset="100%" stopColor="#1d7a54" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="idleFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#d97706" stopOpacity={0.65} />
                <stop offset="100%" stopColor="#d97706" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#d9e4dc" strokeDasharray="3 3" />
            <XAxis dataKey="time" tickMargin={12} />
            <YAxis />
            <Tooltip />
            <Area dataKey="activeMinutes" stroke="#1d7a54" fill="url(#activeFill)" strokeWidth={2} />
            <Area dataKey="idleMinutes" stroke="#d97706" fill="url(#idleFill)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
