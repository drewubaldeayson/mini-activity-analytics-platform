import type { ReactNode } from "react";

interface SettingsFieldProps {
  label: string;
  children: ReactNode;
}

export function SettingsField({ label, children }: SettingsFieldProps) {
  return (
    <label className="grid gap-2 text-sm font-medium text-foreground">
      <span>{label}</span>
      {children}
    </label>
  );
}
