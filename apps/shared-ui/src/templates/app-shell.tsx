import type { ReactNode } from "react";
import { cn } from "../lib/utils";

interface AppShellProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function AppShell({ children, className, contentClassName }: AppShellProps) {
  return (
    <main
      className={cn(
        "min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(29,122,84,0.16),transparent_30%),linear-gradient(180deg,#f5faf6_0%,#ebf3ed_100%)] px-5 py-6 text-foreground",
        className,
      )}
    >
      <div className={cn("mx-auto grid gap-5", contentClassName)}>{children}</div>
    </main>
  );
}
