import type { ReactNode } from "react";
import { cn } from "../lib/utils";

interface PageHeroProps {
  eyebrow: string;
  title: string;
  description: string;
  aside?: ReactNode;
  className?: string;
}

export function PageHero({ eyebrow, title, description, aside, className }: PageHeroProps) {
  return (
    <section
      className={cn(
        "flex flex-col justify-between gap-6 rounded-[32px] border border-border/70 bg-card/80 px-6 py-7 shadow-panel backdrop-blur lg:flex-row lg:items-end",
        className,
      )}
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight md:text-5xl">{title}</h1>
        <p className="mt-3 max-w-3xl text-sm text-muted-foreground md:text-base">{description}</p>
      </div>
      {aside ? <div className="flex items-center gap-3">{aside}</div> : null}
    </section>
  );
}
