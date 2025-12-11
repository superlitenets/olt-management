import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusType = "online" | "offline" | "degraded" | "maintenance" | "los" | "active" | "acknowledged" | "resolved" | "critical" | "warning" | "info";

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

const statusConfig: Record<StatusType, { label: string; className: string }> = {
  online: {
    label: "Online",
    className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  },
  offline: {
    label: "Offline",
    className: "bg-gray-500/15 text-gray-600 dark:text-gray-400 border-gray-500/30",
  },
  degraded: {
    label: "Degraded",
    className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  },
  maintenance: {
    label: "Maintenance",
    className: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
  },
  los: {
    label: "LOS",
    className: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
  },
  active: {
    label: "Active",
    className: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
  },
  acknowledged: {
    label: "Acknowledged",
    className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  },
  resolved: {
    label: "Resolved",
    className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  },
  critical: {
    label: "Critical",
    className: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
  },
  warning: {
    label: "Warning",
    className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  },
  info: {
    label: "Info",
    className: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.offline;

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs font-medium border no-default-hover-elevate no-default-active-elevate",
        config.className,
        className
      )}
    >
      <span className={cn(
        "mr-1.5 h-1.5 w-1.5 rounded-full",
        status === "online" && "bg-emerald-500 animate-pulse",
        status === "offline" && "bg-gray-500",
        status === "degraded" && "bg-amber-500",
        status === "maintenance" && "bg-blue-500",
        status === "los" && "bg-red-500 animate-pulse",
        status === "active" && "bg-red-500 animate-pulse",
        status === "acknowledged" && "bg-amber-500",
        status === "resolved" && "bg-emerald-500",
        status === "critical" && "bg-red-500 animate-pulse",
        status === "warning" && "bg-amber-500",
        status === "info" && "bg-blue-500"
      )} />
      {config.label}
    </Badge>
  );
}
