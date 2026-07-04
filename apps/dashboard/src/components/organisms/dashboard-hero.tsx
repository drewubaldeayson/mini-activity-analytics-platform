import { Button, Input, PageHero, Select } from "@mini-analytics/shared-ui";

interface DashboardHeroProps {
  rangePreset: string;
  fromDate: string;
  toDate: string;
  apiToken: string;
  onRangeChange: (value: string) => void;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
  onApiTokenChange: (value: string) => void;
  onApplyCustomRange: () => void;
  onResetFilters: () => void;
}

export function DashboardHero({
  rangePreset,
  fromDate,
  toDate,
  apiToken,
  onRangeChange,
  onFromDateChange,
  onToDateChange,
  onApiTokenChange,
  onApplyCustomRange,
  onResetFilters,
}: DashboardHeroProps) {
  return (
    <PageHero
      className="mb-6"
      eyebrow="Microfrontend Host Dashboard"
      title="Team activity at a glance"
      description="PostgreSQL-backed analytics with atomic UI composition, device drill-down, and range-based observability."
      aside={
        <div className="grid w-full gap-3 lg:min-w-[420px]">
          <div className="rounded-full border border-border bg-card/80 px-4 py-3 text-sm text-muted-foreground shadow-panel">
            Live refresh every 5 seconds
          </div>
          <div className="grid gap-3 rounded-[24px] border border-border bg-card/80 p-4 shadow-panel">
            <Select value={rangePreset} onChange={(event) => onRangeChange(event.target.value)}>
              <option value="1">Last 24 hours</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="custom">Custom range</option>
            </Select>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input type="date" value={fromDate} onChange={(event) => onFromDateChange(event.target.value)} />
              <Input type="date" value={toDate} onChange={(event) => onToDateChange(event.target.value)} />
            </div>
            <Input
              type="password"
              value={apiToken}
              onChange={(event) => onApiTokenChange(event.target.value)}
              placeholder="Optional API token"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Button onClick={onApplyCustomRange}>Apply filters</Button>
              <Button variant="outline" onClick={onResetFilters}>
                Reset
              </Button>
            </div>
          </div>
        </div>
      }
    />
  );
}
