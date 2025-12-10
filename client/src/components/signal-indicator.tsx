import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface SignalIndicatorProps {
  rxPower: number | null | undefined;
  txPower?: number | null | undefined;
  className?: string;
  showValue?: boolean;
}

export function SignalIndicator({ rxPower, txPower, className, showValue = true }: SignalIndicatorProps) {
  const getSignalInfo = (power: number | null | undefined) => {
    if (power === null || power === undefined) {
      return { level: "unknown", color: "bg-gray-400", label: "Unknown", bars: 0 };
    }
    
    if (power >= -25) {
      return { level: "excellent", color: "bg-emerald-500", label: "Excellent", bars: 4 };
    }
    if (power >= -27) {
      return { level: "good", color: "bg-emerald-500", label: "Good", bars: 3 };
    }
    if (power >= -28) {
      return { level: "fair", color: "bg-amber-500", label: "Fair", bars: 2 };
    }
    if (power >= -30) {
      return { level: "weak", color: "bg-orange-500", label: "Weak", bars: 1 };
    }
    return { level: "critical", color: "bg-red-500", label: "Critical", bars: 1 };
  };

  const info = getSignalInfo(rxPower);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn("flex items-center gap-2", className)}>
          <div className="flex items-end gap-0.5 h-4">
            {[1, 2, 3, 4].map((bar) => (
              <div
                key={bar}
                className={cn(
                  "w-1 rounded-sm transition-colors",
                  bar <= info.bars ? info.color : "bg-muted",
                  bar === 1 && "h-1",
                  bar === 2 && "h-2",
                  bar === 3 && "h-3",
                  bar === 4 && "h-4"
                )}
              />
            ))}
          </div>
          {showValue && rxPower !== null && rxPower !== undefined && (
            <span className="text-xs font-mono text-muted-foreground">
              {rxPower.toFixed(1)} dBm
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-medium">{info.label} Signal</p>
        {rxPower !== null && rxPower !== undefined && (
          <p className="text-xs text-muted-foreground">RX Power: {rxPower.toFixed(2)} dBm</p>
        )}
        {txPower !== null && txPower !== undefined && (
          <p className="text-xs text-muted-foreground">TX Power: {txPower.toFixed(2)} dBm</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
