import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/status-badge";
import { SignalIndicator } from "@/components/signal-indicator";
import { TableSkeleton } from "@/components/loading-skeleton";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import {
  Plus,
  Search,
  Radio,
  MoreVertical,
  RefreshCw,
  Settings,
  Power,
  Eye,
  Download,
  Filter,
  X,
} from "lucide-react";
import type { Onu, Olt, ServiceProfile } from "@shared/schema";

export default function OnusPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [oltFilter, setOltFilter] = useState<string>("all");
  const [selectedOnu, setSelectedOnu] = useState<Onu | null>(null);
  const { toast } = useToast();

  const { data: onus, isLoading } = useQuery<Onu[]>({
    queryKey: ["/api/onus"],
  });

  const { data: olts } = useQuery<Olt[]>({
    queryKey: ["/api/olts"],
  });

  const { data: serviceProfiles } = useQuery<ServiceProfile[]>({
    queryKey: ["/api/service-profiles"],
  });

  const restartMutation = useMutation({
    mutationFn: async (onuId: string) => {
      return apiRequest("POST", `/api/onus/${onuId}/restart`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onus"] });
      toast({
        title: "ONU Restarted",
        description: "The ONU restart command has been sent",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to restart ONU",
        variant: "destructive",
      });
    },
  });

  const filteredOnus = onus?.filter((onu) => {
    const matchesSearch =
      onu.serialNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      onu.macAddress?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      onu.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      onu.subscriberName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      onu.ipAddress?.includes(searchQuery);

    const matchesStatus = statusFilter === "all" || onu.status === statusFilter;
    const matchesOlt = oltFilter === "all" || onu.oltId === oltFilter;

    return matchesSearch && matchesStatus && matchesOlt;
  });

  const getOltName = (oltId: string) => {
    return olts?.find((o) => o.id === oltId)?.name || "Unknown";
  };

  const getProfileName = (profileId: string | null) => {
    if (!profileId) return "-";
    return serviceProfiles?.find((p) => p.id === profileId)?.name || "Unknown";
  };

  const formatUptime = (seconds: number | null) => {
    if (!seconds) return "-";
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  };

  const hasActiveFilters = statusFilter !== "all" || oltFilter !== "all";

  const clearFilters = () => {
    setStatusFilter("all");
    setOltFilter("all");
    setSearchQuery("");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">ONU Management</h1>
          <p className="text-sm text-muted-foreground">
            View and manage Optical Network Units
          </p>
        </div>
        <Button data-testid="button-discover-onus">
          <RefreshCw className="h-4 w-4 mr-2" />
          Discover ONUs
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by SN, MAC, name, subscriber..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-onus"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32" data-testid="select-status-filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="online">Online</SelectItem>
              <SelectItem value="offline">Offline</SelectItem>
              <SelectItem value="los">LOS</SelectItem>
              <SelectItem value="dyinggasp">Dying Gasp</SelectItem>
            </SelectContent>
          </Select>
          <Select value={oltFilter} onValueChange={setOltFilter}>
            <SelectTrigger className="w-40" data-testid="select-olt-filter">
              <SelectValue placeholder="OLT" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All OLTs</SelectItem>
              {olts?.map((olt) => (
                <SelectItem key={olt.id} value={olt.id}>
                  {olt.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
          <Badge variant="secondary">{filteredOnus?.length || 0} ONUs</Badge>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton rows={8} />
          ) : filteredOnus && filteredOnus.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Serial Number</TableHead>
                    <TableHead>Name / Subscriber</TableHead>
                    <TableHead>OLT</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Signal</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Profile</TableHead>
                    <TableHead>Uptime</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOnus.map((onu) => (
                    <TableRow key={onu.id} data-testid={`onu-row-${onu.id}`}>
                      <TableCell>
                        <div>
                          <span className="font-mono text-sm">{onu.serialNumber}</span>
                          {onu.macAddress && (
                            <p className="text-xs text-muted-foreground font-mono">
                              {onu.macAddress}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium">{onu.name || "-"}</span>
                          {onu.subscriberName && (
                            <p className="text-xs text-muted-foreground">
                              {onu.subscriberName}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <span>{getOltName(onu.oltId)}</span>
                          <p className="text-xs text-muted-foreground">
                            Port {onu.ponPort || "-"} / ONU {onu.onuId || "-"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={onu.status || "offline"} />
                      </TableCell>
                      <TableCell>
                        <SignalIndicator rxPower={onu.rxPower} />
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm">{onu.ipAddress || "-"}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{getProfileName(onu.serviceProfileId)}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {formatUptime(onu.uptime)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`button-onu-menu-${onu.id}`}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setSelectedOnu(onu)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Settings className="h-4 w-4 mr-2" />
                              Configure
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => restartMutation.mutate(onu.id)}
                              disabled={restartMutation.isPending}
                            >
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Restart
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>
                              <Power className="h-4 w-4 mr-2" />
                              {onu.status === "offline" ? "Enable" : "Disable"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState
              icon={<Radio className="h-8 w-8" />}
              title="No ONUs Found"
              description={
                searchQuery || hasActiveFilters
                  ? "No ONUs match your search or filter criteria"
                  : "Start by discovering ONUs from your connected OLTs"
              }
              action={
                !searchQuery && !hasActiveFilters
                  ? {
                      label: "Discover ONUs",
                      onClick: () => {},
                    }
                  : undefined
              }
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedOnu} onOpenChange={() => setSelectedOnu(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>ONU Details</DialogTitle>
            <DialogDescription>
              {selectedOnu?.serialNumber}
            </DialogDescription>
          </DialogHeader>
          {selectedOnu && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Serial Number
                  </label>
                  <p className="font-mono">{selectedOnu.serialNumber}</p>
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    MAC Address
                  </label>
                  <p className="font-mono">{selectedOnu.macAddress || "-"}</p>
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Status
                  </label>
                  <div className="mt-1">
                    <StatusBadge status={selectedOnu.status || "offline"} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Signal Quality
                  </label>
                  <div className="mt-1">
                    <SignalIndicator rxPower={selectedOnu.rxPower} />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-3">Network Configuration</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      IP Mode
                    </label>
                    <p>{selectedOnu.ipMode?.toUpperCase() || "DHCP"}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      IP Address
                    </label>
                    <p className="font-mono">{selectedOnu.ipAddress || "-"}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Mode
                    </label>
                    <p>{selectedOnu.mode?.toUpperCase() || "BRIDGE"}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Service Profile
                    </label>
                    <p>{getProfileName(selectedOnu.serviceProfileId)}</p>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-3">Optical Levels</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      RX Power
                    </label>
                    <p className="font-mono">
                      {selectedOnu.rxPower?.toFixed(2) || "-"} dBm
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      TX Power
                    </label>
                    <p className="font-mono">
                      {selectedOnu.txPower?.toFixed(2) || "-"} dBm
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Distance
                    </label>
                    <p className="font-mono">
                      {selectedOnu.distance?.toFixed(2) || "-"} km
                    </p>
                  </div>
                </div>
              </div>

              {selectedOnu.subscriberName && (
                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium mb-3">Subscriber Info</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Name
                      </label>
                      <p>{selectedOnu.subscriberName}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Phone
                      </label>
                      <p>{selectedOnu.subscriberPhone || "-"}</p>
                    </div>
                    {selectedOnu.subscriberAddress && (
                      <div className="col-span-2">
                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Address
                        </label>
                        <p>{selectedOnu.subscriberAddress}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => setSelectedOnu(null)}>
                  Close
                </Button>
                <Button>
                  <Settings className="h-4 w-4 mr-2" />
                  Configure
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
