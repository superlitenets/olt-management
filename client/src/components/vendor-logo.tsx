import { cn } from "@/lib/utils";

interface VendorLogoProps {
  vendor: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const vendorColors: Record<string, string> = {
  huawei: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  zte: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  fiberhome: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  nokia: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
  other: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20",
};

const vendorLabels: Record<string, string> = {
  huawei: "HW",
  zte: "ZTE",
  fiberhome: "FH",
  nokia: "NK",
  other: "OTH",
};

export function VendorLogo({ vendor, className, size = "md" }: VendorLogoProps) {
  const vendorLower = vendor.toLowerCase();
  const colorClass = vendorColors[vendorLower] || vendorColors.other;
  const label = vendorLabels[vendorLower] || vendor.slice(0, 3).toUpperCase();

  const sizeClasses = {
    sm: "h-6 w-6 text-[10px]",
    md: "h-8 w-8 text-xs",
    lg: "h-10 w-10 text-sm",
  };

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-md border font-bold",
        sizeClasses[size],
        colorClass,
        className
      )}
    >
      {label}
    </div>
  );
}
