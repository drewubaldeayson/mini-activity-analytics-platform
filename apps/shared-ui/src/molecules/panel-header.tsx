interface PanelHeaderProps {
  title: string;
  caption: string;
}

export function PanelHeader({ title, caption }: PanelHeaderProps) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-4">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <span className="text-sm text-muted-foreground">{caption}</span>
    </div>
  );
}
