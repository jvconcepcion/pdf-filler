import { cn } from "cn";
import type { DocumentStatus } from "@/schemas/document";

/*
  Status -> token color + label, in one place. The config is keyed by
  DocumentStatus (the schema's status enum), so adding a status to the schema
  forces a matching entry here or the build fails. That keeps the pill aligned
  with the schema and prevents inventing statuses. Colors are status tokens.
*/
const STATUS_CONFIG: Record<DocumentStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
  ready: { label: "Ready", className: "bg-status-ready text-status-ready-foreground" },
};

export interface StatusPillProps {
  status: DocumentStatus;
  className?: string;
}

export function StatusPill({ status, className }: StatusPillProps) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-pill px-2 py-0.5 text-caption font-medium",
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  );
}
