import { Card } from "../atoms/card";

interface StatCardProps {
  label: string;
  value: string | number;
}

export function StatCard({ label, value }: StatCardProps) {
  return (
    <Card className="grid gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <strong className="text-4xl font-semibold tracking-tight">{value}</strong>
    </Card>
  );
}
