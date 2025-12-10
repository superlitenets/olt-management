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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
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
  Wifi,
  Phone,
  Link2,
  Activity,
  RotateCcw,
  FileText,
  Zap,
} from "lucide-react";
import type { Onu, Olt, ServiceProfile, Tr069Device } from "@shared/schema";

export default function OnusPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [oltFilter, setOltFilter] = useState<string>("all");
  const [selectedOnu, setSelectedOnu] = useState<Onu | null>(null);
  const [activeTab, setActiveTab] = useState("details");
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

  const { data: tr069Devices } = useQuery<Tr069Device[]>({
    queryKey: ["/api/tr069/devices"],
  });

  const { data: linkedTr069Device, refetch: refetchLinkedDevice } = useQuery<Tr069Device | null>({
    queryKey: selectedOnu ? [`/api/onus/${selectedOnu.id}/tr069`] : ["/api/onus/tr069-placeholder"],
    enabled: !!selectedOnu,
  });

  const linkTr069Mutation = useMutation({
    mutationFn: async ({ onuId, tr069DeviceId }: { onuId: string; tr069DeviceId: string }) => {
      return apiRequest("POST", `/api/onus/${onuId}/tr069/link`, { tr069DeviceId });
    },
    onSuccess: () => {
      refetchLinkedDevice();
      queryClient.invalidateQueries({ queryKey: ["/api/tr069/devices"] });
      toast({
        title: "Device Linked",
        description: "TR-069 device has been linked to this ONU",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        window.location.href = "/api/login";
        return;
      }
      toast({
        title: "Error",
        description: "Failed to link TR-069 device",
        variant: "destructive",
      });
    },
  });

  const createTr069TaskMutation = useMutation({
    mutationFn: async ({ onuId, taskType, parameters }: { onuId: string; taskType: string; parameters?: any }) => {
      return apiRequest("POST", `/api/onus/${onuId}/tr069/tasks`, { taskType, parameters });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/onus", variables.onuId, "tr069", "tasks"] });
      toast({
        title: "Task Created",
        description: "TR-069 task has been queued for execution",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        window.location.href = "/api/login";
        return;
      }
      toast({
        title: "Error",
        description: "Failed to create TR-069 task",
        variant: "destructive",
      });
    },
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

  const provisionTr069Mutation = useMutation({
    mutationFn: async (onuId: string) => {
      const res = await apiRequest("POST", `/api/onus/${onuId}/provision-tr069`);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/onus"] });
      toast({
        title: "TR-069 Provisioning Complete",
        description: `${data.commands?.length || 0} commands sent to ${data.vendor || 'OLT'}`,
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
        description: error.message || "Failed to provision ONU with TR-069",
        variant: "destructive",
      });
    },
  });

  const provisionOnuMutation = useMutation({
    mutationFn: async (onuId: string) => {
      const res = await apiRequest("POST", `/api/onus/${onuId}/provision`);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/onus"] });
      toast({
        title: "ONU Provisioned",
        description: `${data.commands?.length || 0} commands sent to ${data.vendor || 'OLT'}`,
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        window.location.href = "/api/login";
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to provision ONU",
        variant: "destructive",
      });
    },
  });

  const deprovisionOnuMutation = useMutation({
    mutationFn: async (onuId: string) => {
      const res = await apiRequest("POST", `/api/onus/${onuId}/deprovision`);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/onus"] });
      toast({
        title: "ONU Deprovisioned",
        description: `${data.commands?.length || 0} commands sent to ${data.vendor || 'OLT'}`,
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        window.location.href = "/api/login";
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to deprovision ONU",
        variant: "destructive",
      });
    },
  });

  const rebootOnuMutation = useMutation({
    mutationFn: async (onuId: string) => {
      const res = await apiRequest("POST", `/api/onus/${onuId}/reboot`);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/onus"] });
      toast({
        title: "ONU Reboot Initiated",
        description: `Reboot command sent to ${data.vendor || 'OLT'}`,
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        window.location.href = "/api/login";
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to reboot ONU",
        variant: "destructive",
      });
    },
  });

  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewCommands, setPreviewCommands] = useState<{ vendor: string; commands: string[]; action: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const previewCommandsFn = async (onuId: string, action: string) => {
    setPreviewLoading(true);
    try {
      const res = await apiRequest("POST", `/api/onus/${onuId}/preview-commands`, { action });
      const response = await res.json() as { vendor: string; commands: string[]; action: string };
      setPreviewCommands({ vendor: response.vendor, commands: response.commands, action });
      setPreviewDialogOpen(true);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to preview commands",
        variant: "destructive",
      });
    } finally {
      setPreviewLoading(false);
    }
  };

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

  // Bulk poll power levels for selected OLT
  const pollPowerMutation = useMutation({
    mutationFn: async (oltId: string) => {
      return apiRequest("POST", `/api/olts/${oltId}/poll-onus`);
    },
    onSuccess: (_, oltId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/onus"] });
      const oltName = olts?.find(o => o.id === oltId)?.name || "OLT";
      toast({
        title: "Power Levels Updated",
        description: `Successfully polled ONUs on ${oltName}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Poll Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handlePollPower = () => {
    if (oltFilter && oltFilter !== "all") {
      pollPowerMutation.mutate(oltFilter);
    } else if (olts && olts.length > 0) {
      // Poll all OLTs one by one
      olts.forEach(olt => pollPowerMutation.mutate(olt.id));
    }
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
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={handlePollPower}
            disabled={pollPowerMutation.isPending || !olts?.length}
            data-testid="button-poll-power"
          >
            <Activity className="h-4 w-4 mr-2" />
            {pollPowerMutation.isPending ? "Polling..." : "Poll Power"}
          </Button>
          <Button data-testid="button-discover-onus">
            <RefreshCw className="h-4 w-4 mr-2" />
            Discover ONUs
          </Button>
        </div>
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
                        <SignalIndicator rxPower={onu.rxPower} txPower={onu.txPower} />
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
                            <DropdownMenuItem onClick={() => previewCommandsFn(onu.id, "provision")}>
                              <FileText className="h-4 w-4 mr-2" />
                              Preview CLI Commands
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => provisionOnuMutation.mutate(onu.id)}
                              disabled={provisionOnuMutation.isPending}
                              data-testid={`button-provision-${onu.id}`}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Provision Service
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => provisionTr069Mutation.mutate(onu.id)}
                              disabled={provisionTr069Mutation.isPending}
                              data-testid={`button-provision-tr069-${onu.id}`}
                            >
                              <Zap className="h-4 w-4 mr-2" />
                              Provision TR-069
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => rebootOnuMutation.mutate(onu.id)}
                              disabled={rebootOnuMutation.isPending}
                              data-testid={`button-reboot-${onu.id}`}
                            >
                              <RotateCcw className="h-4 w-4 mr-2" />
                              Reboot ONU
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => deprovisionOnuMutation.mutate(onu.id)}
                              disabled={deprovisionOnuMutation.isPending}
                              className="text-destructive"
                              data-testid={`button-deprovision-${onu.id}`}
                            >
                              <Power className="h-4 w-4 mr-2" />
                              Deprovision
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

      <Dialog open={!!selectedOnu} onOpenChange={() => { setSelectedOnu(null); setActiveTab("details"); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ONU Details</DialogTitle>
            <DialogDescription>
              {selectedOnu?.serialNumber} {selectedOnu?.name && `- ${selectedOnu.name}`}
            </DialogDescription>
          </DialogHeader>
          {selectedOnu && (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="details" data-testid="tab-onu-details">
                  <Eye className="h-4 w-4 mr-2" />
                  Details
                </TabsTrigger>
                <TabsTrigger value="tr069" data-testid="tab-onu-tr069">
                  <Settings className="h-4 w-4 mr-2" />
                  TR-069/ACS
                </TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-6 mt-4">
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
              </TabsContent>

              <TabsContent value="tr069" className="space-y-6 mt-4">
                {linkedTr069Device ? (
                  <>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded-md">
                            <Activity className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{linkedTr069Device.deviceId}</p>
                            <p className="text-sm text-muted-foreground">
                              {linkedTr069Device.manufacturer} {linkedTr069Device.productClass}
                            </p>
                          </div>
                        </div>
                        <StatusBadge status={linkedTr069Device.isOnline ? "online" : "offline"} />
                      </div>
                      <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Serial Number:</span>
                          <span className="ml-2 font-mono">{linkedTr069Device.serialNumber || "-"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Software Version:</span>
                          <span className="ml-2 font-mono">{linkedTr069Device.softwareVersion || "-"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Connection IP:</span>
                          <span className="ml-2 font-mono">{linkedTr069Device.connectionRequestUrl?.split("/")[2]?.split(":")[0] || "-"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Last Inform:</span>
                          <span className="ml-2">
                            {linkedTr069Device.lastInformTime
                              ? new Date(linkedTr069Device.lastInformTime).toLocaleString()
                              : "Never"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <h4 className="text-sm font-medium mb-3">Quick Actions</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <Button
                          variant="outline"
                          className="flex flex-col items-center gap-2 h-auto py-4"
                          onClick={() => createTr069TaskMutation.mutate({
                            onuId: selectedOnu.id,
                            taskType: "getParameterValues",
                            parameters: { parameterNames: ["Device."] }
                          })}
                          disabled={createTr069TaskMutation.isPending}
                          data-testid="button-tr069-get-params"
                        >
                          <FileText className="h-5 w-5" />
                          <span className="text-xs">Get Parameters</span>
                        </Button>
                        <Button
                          variant="outline"
                          className="flex flex-col items-center gap-2 h-auto py-4"
                          onClick={() => createTr069TaskMutation.mutate({
                            onuId: selectedOnu.id,
                            taskType: "setParameterValues",
                            parameters: {
                              parameterList: [
                                { name: "Device.WiFi.SSID.1.SSID", value: "ONU_WiFi" },
                                { name: "Device.WiFi.SSID.1.Enable", value: "1" }
                              ]
                            }
                          })}
                          disabled={createTr069TaskMutation.isPending}
                          data-testid="button-tr069-wifi"
                        >
                          <Wifi className="h-5 w-5" />
                          <span className="text-xs">Configure WiFi</span>
                        </Button>
                        <Button
                          variant="outline"
                          className="flex flex-col items-center gap-2 h-auto py-4"
                          onClick={() => createTr069TaskMutation.mutate({
                            onuId: selectedOnu.id,
                            taskType: "setParameterValues",
                            parameters: {
                              parameterList: [
                                { name: "Device.Services.VoiceService.1.VoiceProfile.1.Enable", value: "Enabled" }
                              ]
                            }
                          })}
                          disabled={createTr069TaskMutation.isPending}
                          data-testid="button-tr069-voip"
                        >
                          <Phone className="h-5 w-5" />
                          <span className="text-xs">Configure VoIP</span>
                        </Button>
                        <Button
                          variant="outline"
                          className="flex flex-col items-center gap-2 h-auto py-4"
                          onClick={() => createTr069TaskMutation.mutate({
                            onuId: selectedOnu.id,
                            taskType: "reboot",
                            parameters: {}
                          })}
                          disabled={createTr069TaskMutation.isPending}
                          data-testid="button-tr069-reboot"
                        >
                          <RotateCcw className="h-5 w-5" />
                          <span className="text-xs">Reboot Device</span>
                        </Button>
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <h4 className="text-sm font-medium mb-3">Advanced Configuration</h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        Use the TR-069/ACS page for advanced device configuration, firmware updates, and detailed parameter management.
                      </p>
                      <Button variant="secondary" size="sm" asChild>
                        <a href={`/tr069?device=${linkedTr069Device.id}`} data-testid="link-tr069-advanced">
                          Open TR-069 Management
                        </a>
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <div className="p-4 bg-muted/50 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                      <Link2 className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h4 className="font-medium mb-2">No TR-069 Device Linked</h4>
                    <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
                      Link this ONU to a TR-069/ACS managed device to enable remote configuration of WiFi, VoIP, and other services.
                    </p>
                    {tr069Devices && tr069Devices.filter(d => !d.onuId).length > 0 ? (
                      <div className="space-y-3">
                        <Label className="text-sm">Select a TR-069 Device to Link</Label>
                        <Select
                          onValueChange={(value) => linkTr069Mutation.mutate({
                            onuId: selectedOnu.id,
                            tr069DeviceId: value
                          })}
                          disabled={linkTr069Mutation.isPending}
                        >
                          <SelectTrigger className="w-64 mx-auto" data-testid="select-tr069-device">
                            <SelectValue placeholder="Select device..." />
                          </SelectTrigger>
                          <SelectContent>
                            {tr069Devices.filter(d => !d.onuId).map((device) => (
                              <SelectItem key={device.id} value={device.id}>
                                {device.deviceId} ({device.manufacturer})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No unlinked TR-069 devices available. New devices will appear once they connect to the ACS server.
                      </p>
                    )}
                  </div>
                )}
              </TabsContent>

              <div className="flex justify-end gap-3 pt-4 border-t mt-6">
                <Button variant="outline" onClick={() => { setSelectedOnu(null); setActiveTab("details"); }}>
                  Close
                </Button>
              </div>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              CLI Commands Preview
            </DialogTitle>
            <DialogDescription>
              {previewCommands?.vendor && (
                <span className="flex items-center gap-2">
                  <Badge variant="outline">{previewCommands.vendor.toUpperCase()}</Badge>
                  <span className="capitalize">{previewCommands.action} Commands</span>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          {previewCommands && (
            <div className="space-y-4">
              <div className="bg-muted rounded-md p-4 font-mono text-sm overflow-x-auto">
                {previewCommands.commands.map((cmd, idx) => (
                  <div key={idx} className="py-1 border-b border-border/50 last:border-b-0">
                    <span className="text-muted-foreground mr-3">{idx + 1}.</span>
                    <span>{cmd}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Activity className="h-4 w-4" />
                <span>{previewCommands.commands.length} commands would be sent to the OLT</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Note: This is running in simulation mode. In production, these commands would be sent to the OLT via SSH.
              </p>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setPreviewDialogOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
