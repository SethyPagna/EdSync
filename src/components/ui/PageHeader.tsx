import type { ReactNode } from "react";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton } from "./Button";
import { Badge } from "./Display";

export type PageHeaderProps = {
  title: ReactNode;
  icon?: LucideIcon;
  count?: number;
  back?: string;
  backLabel?: string;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export function PageHeader({
  title,
  icon: Icon,
  count,
  back,
  backLabel = "Back",
  actions,
  children,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("mb-6 flex min-w-0 flex-col gap-4", className)}>
      <div className="flex min-h-9 min-w-0 items-center gap-2.5">
        {back ? <IconButton href={back} icon={ArrowLeft} label={backLabel} className="-ml-1.5" /> : null}
        {Icon ? <Icon aria-hidden size={20} strokeWidth={1.75} className="shrink-0 text-fg-muted" /> : null}
        <h1 className="min-w-0 truncate text-[22px] font-semibold leading-tight tracking-tight text-fg sm:text-2xl">
          {title}
        </h1>
        {count !== undefined ? <Badge className="shrink-0 tabular-nums">{count}</Badge> : null}
        {actions ? <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </header>
  );
}

export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mb-4 flex min-w-0 flex-wrap items-center gap-2", className)}>{children}</div>;
}
