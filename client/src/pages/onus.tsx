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
import { Checkbox } from "@/components/ui/checkbox";
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
  Trash2,
  CheckSquare,
  Square,
  History,
  AlertCircle,
  CheckCircle,
  WifiOff,
  Clock,
  List,
  Edit2,
  Save,
  Network,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Onu, Olt, ServiceProfile, Tr069Device, OnuEvent } from "@shared/schema";

export default function OnusPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [oltFilter, setOltFilter] = useState<string>("all");
  const [authTab, setAuthTab] = useState<"all" | "authorized" | "unauthorized">("all");
  const [selectedOnu, setSelectedOnu] = useState<Onu | null>(null);
  const [activeTab, setActiveTab] = useState("details");
  const [selectedOnuIds, setSelectedOnuIds] = useState<Set<string>>(new Set());
  const [wifiDialogOpen, setWifiDialogOpen] = useState(false);
  const [voipDialogOpen, setVoipDialogOpen] = useState(false);
  const [wifiBandTab, setWifiBandTab] = useState<"2.4ghz" | "5ghz">("2.4ghz");
  const [wifiConfig, setWifiConfig] = useState({
    // 2.4GHz band (Radio.1, SSID.1)
    ssid_2g: "",
    password_2g: "",
    securityMode_2g: "WPA2-Personal",
    channel_2g: "auto",
    enabled_2g: true,
    bandwidth_2g: "20MHz",
    // 5GHz band (Radio.2, SSID.2)
    ssid_5g: "",
    password_5g: "",
    securityMode_5g: "WPA2-Personal",
    channel_5g: "auto",
    enabled_5g: true,
    bandwidth_5g: "80MHz",
    // Guest network (SSID.3)
    ssid_guest: "",
    password_guest: "",
    enabled_guest: false,
    guestIsolation: true,
  });
  const [voipConfig, setVoipConfig] = useState({
    sipServer: "",
    sipPort: "5060",
    username: "",
    password: "",
    displayName: "",
    lineNumber: "1",
    enabled: true,
  });
  const [parametersDialogOpen, setParametersDialogOpen] = useState(false);
  const [parametersFilter, setParametersFilter] = useState("");
  const [editingParameter, setEditingParameter] = useState<{ path: string; value: string; type?: string } | null>(null);
  const [newParameterValue, setNewParameterValue] = useState("");
  const [newParameterType, setNewParameterType] = useState<string>("xsd:string");
  const [fetchingParams, setFetchingParams] = useState(false);
  const [vlanDialogOpen, setVlanDialogOpen] = useState(false);
  const [vlanConfig, setVlanConfig] = useState({
    vlanId: "",
    ipMode: "DHCP" as "DHCP" | "Static" | "PPPoE",
    ipAddress: "",
    subnetMask: "255.255.255.0",
    gateway: "",
    dnsServer: "",
    pppoeUsername: "",
    pppoePassword: "",
    mtu: "1500",
    enabled: true,
  });
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

  const { data: onuEvents, isLoading: eventsLoading } = useQuery<OnuEvent[]>({
    queryKey: selectedOnu ? ["/api/onus", selectedOnu.id, "events"] : ["/api/onus/events-placeholder"],
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

  // Comprehensive provisioning - combines OMCI (Layer 2) and TR-069 (Layer 3)
  const fullProvisionMutation = useMutation({
    mutationFn: async (onuId: string) => {
      let omciData: { commands?: string[]; vendor?: string; error?: string } | null = null;
      let tr069Data: { commands?: string[]; vendor?: string; error?: string } | null = null;
      let omciError: string | null = null;
      let tr069Error: string | null = null;
      
      // First, run OMCI provisioning (Layer 2: VLAN, GEM ports)
      try {
        const omciRes = await apiRequest("POST", `/api/onus/${onuId}/provision`);
        omciData = await omciRes.json() as { commands?: string[]; vendor?: string };
      } catch (err) {
        omciError = err instanceof Error ? err.message : "OMCI provisioning failed";
      }
      
      // Then, run TR-069 provisioning (Layer 3: ACS settings) - even if OMCI failed
      try {
        const tr069Res = await apiRequest("POST", `/api/onus/${onuId}/provision-tr069`);
        tr069Data = await tr069Res.json() as { commands?: string[]; vendor?: string };
      } catch (err) {
        tr069Error = err instanceof Error ? err.message : "TR-069 provisioning failed";
      }
      
      return {
        omci: omciData,
        tr069: tr069Data,
        omciError,
        tr069Error,
        omciSuccess: !omciError,
        tr069Success: !tr069Error,
        totalCommands: (omciData?.commands?.length || 0) + (tr069Data?.commands?.length || 0)
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/onus"] });
      
      // Handle partial failures with detailed feedback
      if (data.omciSuccess && data.tr069Success) {
        toast({
          title: "Full Provisioning Complete",
          description: `${data.totalCommands} commands sent (OMCI: ${data.omci?.commands?.length || 0}, TR-069: ${data.tr069?.commands?.length || 0})`,
        });
      } else if (data.omciSuccess && !data.tr069Success) {
        toast({
          title: "Partial Provisioning",
          description: `OMCI succeeded (${data.omci?.commands?.length || 0} commands), but TR-069 failed: ${data.tr069Error}`,
          variant: "destructive",
        });
      } else if (!data.omciSuccess && data.tr069Success) {
        toast({
          title: "Partial Provisioning",
          description: `OMCI failed: ${data.omciError}, but TR-069 succeeded (${data.tr069?.commands?.length || 0} commands)`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Provisioning Failed",
          description: `OMCI: ${data.omciError}. TR-069: ${data.tr069Error}`,
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        window.location.href = "/api/login";
        return;
      }
      toast({
        title: "Provisioning Error",
        description: error.message || "Failed to complete full provisioning",
        variant: "destructive",
      });
    },
  });

  // Batch operations
  const batchPollMutation = useMutation({
    mutationFn: async (onuIds: string[]) => {
      const res = await apiRequest("POST", "/api/onus/batch/poll", { onuIds });
      return res.json();
    },
    onSuccess: (data: { successCount: number; totalCount: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/onus"] });
      setSelectedOnuIds(new Set());
      toast({
        title: "Batch Poll Complete",
        description: `Successfully polled ${data.successCount}/${data.totalCount} ONUs`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Batch Poll Failed",
        description: error.message || "Failed to poll ONUs",
        variant: "destructive",
      });
    },
  });

  const batchRebootMutation = useMutation({
    mutationFn: async (onuIds: string[]) => {
      const res = await apiRequest("POST", "/api/onus/batch/reboot", { onuIds });
      return res.json();
    },
    onSuccess: (data: { successCount: number; totalCount: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/onus"] });
      setSelectedOnuIds(new Set());
      toast({
        title: "Batch Reboot Complete",
        description: `Successfully rebooted ${data.successCount}/${data.totalCount} ONUs`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Batch Reboot Failed",
        description: error.message || "Failed to reboot ONUs",
        variant: "destructive",
      });
    },
  });

  const batchDeleteMutation = useMutation({
    mutationFn: async (onuIds: string[]) => {
      const res = await apiRequest("POST", "/api/onus/batch/delete", { onuIds });
      return res.json();
    },
    onSuccess: (data: { successCount: number; totalCount: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/onus"] });
      setSelectedOnuIds(new Set());
      toast({
        title: "Batch Delete Complete",
        description: `Successfully deleted ${data.successCount}/${data.totalCount} ONUs`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Batch Delete Failed",
        description: error.message || "Failed to delete ONUs",
        variant: "destructive",
      });
    },
  });

  // Selection helpers
  const toggleOnuSelection = (onuId: string) => {
    const newSelection = new Set(selectedOnuIds);
    if (newSelection.has(onuId)) {
      newSelection.delete(onuId);
    } else {
      newSelection.add(onuId);
    }
    setSelectedOnuIds(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedOnuIds.size === filteredOnus?.length) {
      setSelectedOnuIds(new Set());
    } else {
      setSelectedOnuIds(new Set(filteredOnus?.map(o => o.id) || []));
    }
  };

  const clearSelection = () => {
    setSelectedOnuIds(new Set());
  };

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
    
    // Authorization filter: ONUs with service profiles are considered "authorized"
    const isAuthorized = !!onu.serviceProfileId;
    const matchesAuth = 
      authTab === "all" || 
      (authTab === "authorized" && isAuthorized) || 
      (authTab === "unauthorized" && !isAuthorized);

    return matchesSearch && matchesStatus && matchesOlt && matchesAuth;
  });
  
  // Count for badges
  const authorizedCount = onus?.filter(o => !!o.serviceProfileId).length || 0;
  const unauthorizedCount = onus?.filter(o => !o.serviceProfileId).length || 0;

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

      {/* Authorization Tabs */}
      <Tabs value={authTab} onValueChange={(v) => setAuthTab(v as "all" | "authorized" | "unauthorized")}>
        <TabsList data-testid="tabs-auth-filter">
          <TabsTrigger value="all" data-testid="tab-all">
            All
            <Badge variant="secondary" className="ml-2">{onus?.length || 0}</Badge>
          </TabsTrigger>
          <TabsTrigger value="authorized" data-testid="tab-authorized">
            Authorized
            <Badge variant="secondary" className="ml-2">{authorizedCount}</Badge>
          </TabsTrigger>
          <TabsTrigger value="unauthorized" data-testid="tab-unauthorized">
            Unauthorized
            <Badge variant="secondary" className="ml-2">{unauthorizedCount}</Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by SN, MAC, description..."
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

      {/* Batch Actions Toolbar */}
      {selectedOnuIds.size > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <CheckSquare className="h-5 w-5 text-primary" />
                <span className="font-medium">{selectedOnuIds.size} ONU{selectedOnuIds.size > 1 ? 's' : ''} selected</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => batchPollMutation.mutate(Array.from(selectedOnuIds))}
                  disabled={batchPollMutation.isPending}
                  data-testid="button-batch-poll"
                >
                  <Activity className="h-4 w-4 mr-2" />
                  {batchPollMutation.isPending ? "Polling..." : "Poll Selected"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => batchRebootMutation.mutate(Array.from(selectedOnuIds))}
                  disabled={batchRebootMutation.isPending}
                  data-testid="button-batch-reboot"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  {batchRebootMutation.isPending ? "Rebooting..." : "Reboot Selected"}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (confirm(`Are you sure you want to delete ${selectedOnuIds.size} ONUs? This action cannot be undone.`)) {
                      batchDeleteMutation.mutate(Array.from(selectedOnuIds));
                    }
                  }}
                  disabled={batchDeleteMutation.isPending}
                  data-testid="button-batch-delete"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {batchDeleteMutation.isPending ? "Deleting..." : "Delete Selected"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                  data-testid="button-clear-selection"
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear Selection
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton rows={8} />
          ) : filteredOnus && filteredOnus.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={filteredOnus?.length > 0 && selectedOnuIds.size === filteredOnus.length}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all"
                        data-testid="checkbox-select-all"
                      />
                    </TableHead>
                    <TableHead>Serial Number</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>OLT</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Signal</TableHead>
                    <TableHead>Distance</TableHead>
                    <TableHead>Profile</TableHead>
                    <TableHead>Uptime</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOnus.map((onu) => (
                    <TableRow key={onu.id} data-testid={`onu-row-${onu.id}`} className={selectedOnuIds.has(onu.id) ? "bg-primary/5" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={selectedOnuIds.has(onu.id)}
                          onCheckedChange={() => toggleOnuSelection(onu.id)}
                          aria-label={`Select ${onu.serialNumber}`}
                          data-testid={`checkbox-onu-${onu.id}`}
                        />
                      </TableCell>
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
                        <span className="text-sm" title={onu.name || ""}>
                          {onu.name ? (onu.name.length > 9 ? onu.name.slice(0, 9) + "..." : onu.name) : "-"}
                        </span>
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
                        <span className="font-mono text-sm">
                          {onu.distance ? `${onu.distance}m` : "-"}
                        </span>
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
                              onClick={() => fullProvisionMutation.mutate(onu.id)}
                              disabled={fullProvisionMutation.isPending}
                              data-testid={`button-full-provision-${onu.id}`}
                            >
                              <Zap className="h-4 w-4 mr-2" />
                              Full Provisioning (OMCI + TR-069)
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => provisionOnuMutation.mutate(onu.id)}
                              disabled={provisionOnuMutation.isPending}
                              data-testid={`button-provision-${onu.id}`}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Provision Service (OMCI)
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => provisionTr069Mutation.mutate(onu.id)}
                              disabled={provisionTr069Mutation.isPending}
                              data-testid={`button-provision-tr069-${onu.id}`}
                            >
                              <Settings className="h-4 w-4 mr-2" />
                              Provision TR-069 Only
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
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details" data-testid="tab-onu-details">
                  <Eye className="h-4 w-4 mr-2" />
                  Details
                </TabsTrigger>
                <TabsTrigger value="events" data-testid="tab-onu-events">
                  <History className="h-4 w-4 mr-2" />
                  Events
                </TabsTrigger>
                <TabsTrigger value="tr069" data-testid="tab-onu-tr069">
                  <Settings className="h-4 w-4 mr-2" />
                  TR-069
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

              <TabsContent value="events" className="space-y-4 mt-4">
                <div className="flex items-center justify-between gap-4">
                  <h4 className="text-sm font-medium">Event History</h4>
                  <Badge variant="secondary">{onuEvents?.length || 0} events</Badge>
                </div>
                
                {eventsLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-16 bg-muted animate-pulse rounded-md" />
                    ))}
                  </div>
                ) : onuEvents && onuEvents.length > 0 ? (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {onuEvents.map((event) => {
                      const getEventIcon = () => {
                        switch (event.eventType) {
                          case "online":
                            return <CheckCircle className="h-4 w-4 text-emerald-500" />;
                          case "offline":
                            return <AlertCircle className="h-4 w-4 text-gray-500" />;
                          case "los":
                            return <WifiOff className="h-4 w-4 text-red-500" />;
                          case "power_fail":
                            return <AlertCircle className="h-4 w-4 text-amber-500" />;
                          case "rebooted":
                            return <RotateCcw className="h-4 w-4 text-blue-500" />;
                          default:
                            return <Clock className="h-4 w-4 text-muted-foreground" />;
                        }
                      };

                      const getEventColor = () => {
                        switch (event.eventType) {
                          case "online":
                            return "bg-emerald-500/10 border-emerald-500/20";
                          case "offline":
                            return "bg-gray-500/10 border-gray-500/20";
                          case "los":
                            return "bg-red-500/10 border-red-500/20";
                          case "power_fail":
                            return "bg-amber-500/10 border-amber-500/20";
                          default:
                            return "bg-muted/50";
                        }
                      };

                      return (
                        <div
                          key={event.id}
                          className={`p-3 rounded-md border ${getEventColor()}`}
                          data-testid={`event-${event.id}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5">{getEventIcon()}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium text-sm capitalize">
                                  {event.eventType.replace(/_/g, " ")}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {event.createdAt
                                    ? new Date(event.createdAt).toLocaleString()
                                    : "-"}
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {event.previousStatus && event.newStatus && (
                                  <span>
                                    {event.previousStatus} → {event.newStatus}
                                  </span>
                                )}
                                {event.details && (
                                  <p className="mt-1">{event.details}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No events recorded for this ONU</p>
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
                            taskType: "get_parameter_values",
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
                          onClick={() => {
                            setWifiConfig({
                              ssid_2g: "",
                              password_2g: "",
                              securityMode_2g: "WPA2-Personal",
                              channel_2g: "auto",
                              enabled_2g: true,
                              bandwidth_2g: "20MHz",
                              ssid_5g: "",
                              password_5g: "",
                              securityMode_5g: "WPA2-Personal",
                              channel_5g: "auto",
                              enabled_5g: true,
                              bandwidth_5g: "80MHz",
                              ssid_guest: "",
                              password_guest: "",
                              enabled_guest: false,
                              guestIsolation: true,
                            });
                            setWifiBandTab("2.4ghz");
                            setWifiDialogOpen(true);
                          }}
                          disabled={createTr069TaskMutation.isPending}
                          data-testid="button-tr069-wifi"
                        >
                          <Wifi className="h-5 w-5" />
                          <span className="text-xs">Configure WiFi</span>
                        </Button>
                        <Button
                          variant="outline"
                          className="flex flex-col items-center gap-2 h-auto py-4"
                          onClick={() => {
                            setVoipConfig({
                              sipServer: "",
                              sipPort: "5060",
                              username: "",
                              password: "",
                              displayName: "",
                              lineNumber: "1",
                              enabled: true,
                            });
                            setVoipDialogOpen(true);
                          }}
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
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                        <Button
                          variant="outline"
                          className="flex flex-col items-center gap-2 h-auto py-4"
                          onClick={() => {
                            setParametersFilter("");
                            setEditingParameter(null);
                            setParametersDialogOpen(true);
                          }}
                          disabled={createTr069TaskMutation.isPending}
                          data-testid="button-tr069-parameters"
                        >
                          <List className="h-5 w-5" />
                          <span className="text-xs">View Parameters</span>
                        </Button>
                        <Button
                          variant="outline"
                          className="flex flex-col items-center gap-2 h-auto py-4"
                          onClick={() => {
                            if (confirm("Are you sure you want to factory reset this device? This will erase all configuration.")) {
                              createTr069TaskMutation.mutate({
                                onuId: selectedOnu.id,
                                taskType: "factory_reset",
                                parameters: {}
                              });
                            }
                          }}
                          disabled={createTr069TaskMutation.isPending}
                          data-testid="button-tr069-factory-reset"
                        >
                          <Zap className="h-5 w-5" />
                          <span className="text-xs">Factory Reset</span>
                        </Button>
                        <Button
                          variant="outline"
                          className="flex flex-col items-center gap-2 h-auto py-4"
                          onClick={() => {
                            setVlanConfig({
                              vlanId: "",
                              ipMode: "DHCP",
                              ipAddress: "",
                              subnetMask: "255.255.255.0",
                              gateway: "",
                              dnsServer: "",
                              pppoeUsername: "",
                              pppoePassword: "",
                              mtu: "1500",
                              enabled: true,
                            });
                            setVlanDialogOpen(true);
                          }}
                          disabled={createTr069TaskMutation.isPending}
                          data-testid="button-tr069-vlan"
                        >
                          <Network className="h-5 w-5" />
                          <span className="text-xs">Configure WAN/VLAN</span>
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

      <Dialog open={wifiDialogOpen} onOpenChange={setWifiDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wifi className="h-5 w-5" />
              Configure WiFi (Dual-Band)
            </DialogTitle>
            <DialogDescription>
              Configure 2.4GHz and 5GHz wireless networks via TR-069
            </DialogDescription>
          </DialogHeader>
          <Tabs value={wifiBandTab} onValueChange={(v) => setWifiBandTab(v as "2.4ghz" | "5ghz")} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="2.4ghz" data-testid="tab-wifi-2g">
                2.4 GHz
                {wifiConfig.enabled_2g && <Badge variant="secondary" className="ml-2">On</Badge>}
              </TabsTrigger>
              <TabsTrigger value="5ghz" data-testid="tab-wifi-5g">
                5 GHz
                {wifiConfig.enabled_5g && <Badge variant="secondary" className="ml-2">On</Badge>}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="2.4ghz" className="space-y-4 pt-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="wifi-enabled-2g"
                  checked={wifiConfig.enabled_2g}
                  onCheckedChange={(checked) => setWifiConfig({ ...wifiConfig, enabled_2g: !!checked })}
                  data-testid="checkbox-wifi-enabled-2g"
                />
                <Label htmlFor="wifi-enabled-2g">Enable 2.4GHz Radio</Label>
              </div>
              <div className="space-y-2">
                <Label>SSID (Network Name)</Label>
                <Input
                  value={wifiConfig.ssid_2g}
                  onChange={(e) => setWifiConfig({ ...wifiConfig, ssid_2g: e.target.value })}
                  placeholder="Enter 2.4GHz WiFi network name"
                  data-testid="input-wifi-ssid-2g"
                  disabled={!wifiConfig.enabled_2g}
                />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  value={wifiConfig.password_2g}
                  onChange={(e) => setWifiConfig({ ...wifiConfig, password_2g: e.target.value })}
                  placeholder="Min 8 characters"
                  data-testid="input-wifi-password-2g"
                  disabled={!wifiConfig.enabled_2g}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Security</Label>
                  <Select
                    value={wifiConfig.securityMode_2g}
                    onValueChange={(value) => setWifiConfig({ ...wifiConfig, securityMode_2g: value })}
                    disabled={!wifiConfig.enabled_2g}
                  >
                    <SelectTrigger data-testid="select-wifi-security-2g">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WPA2-Personal">WPA2-Personal</SelectItem>
                      <SelectItem value="WPA3-Personal">WPA3-Personal</SelectItem>
                      <SelectItem value="WPA-WPA2-Personal">WPA/WPA2 Mixed</SelectItem>
                      <SelectItem value="None">Open</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Channel</Label>
                  <Select
                    value={wifiConfig.channel_2g}
                    onValueChange={(value) => setWifiConfig({ ...wifiConfig, channel_2g: value })}
                    disabled={!wifiConfig.enabled_2g}
                  >
                    <SelectTrigger data-testid="select-wifi-channel-2g">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto</SelectItem>
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="6">6</SelectItem>
                      <SelectItem value="11">11</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Bandwidth</Label>
                <Select
                  value={wifiConfig.bandwidth_2g}
                  onValueChange={(value) => setWifiConfig({ ...wifiConfig, bandwidth_2g: value })}
                  disabled={!wifiConfig.enabled_2g}
                >
                  <SelectTrigger data-testid="select-wifi-bandwidth-2g">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20MHz">20 MHz</SelectItem>
                    <SelectItem value="40MHz">40 MHz</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>
            <TabsContent value="5ghz" className="space-y-4 pt-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="wifi-enabled-5g"
                  checked={wifiConfig.enabled_5g}
                  onCheckedChange={(checked) => setWifiConfig({ ...wifiConfig, enabled_5g: !!checked })}
                  data-testid="checkbox-wifi-enabled-5g"
                />
                <Label htmlFor="wifi-enabled-5g">Enable 5GHz Radio</Label>
              </div>
              <div className="space-y-2">
                <Label>SSID (Network Name)</Label>
                <Input
                  value={wifiConfig.ssid_5g}
                  onChange={(e) => setWifiConfig({ ...wifiConfig, ssid_5g: e.target.value })}
                  placeholder="Enter 5GHz WiFi network name"
                  data-testid="input-wifi-ssid-5g"
                  disabled={!wifiConfig.enabled_5g}
                />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  value={wifiConfig.password_5g}
                  onChange={(e) => setWifiConfig({ ...wifiConfig, password_5g: e.target.value })}
                  placeholder="Min 8 characters"
                  data-testid="input-wifi-password-5g"
                  disabled={!wifiConfig.enabled_5g}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Security</Label>
                  <Select
                    value={wifiConfig.securityMode_5g}
                    onValueChange={(value) => setWifiConfig({ ...wifiConfig, securityMode_5g: value })}
                    disabled={!wifiConfig.enabled_5g}
                  >
                    <SelectTrigger data-testid="select-wifi-security-5g">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WPA2-Personal">WPA2-Personal</SelectItem>
                      <SelectItem value="WPA3-Personal">WPA3-Personal</SelectItem>
                      <SelectItem value="WPA-WPA2-Personal">WPA/WPA2 Mixed</SelectItem>
                      <SelectItem value="None">Open</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Channel</Label>
                  <Select
                    value={wifiConfig.channel_5g}
                    onValueChange={(value) => setWifiConfig({ ...wifiConfig, channel_5g: value })}
                    disabled={!wifiConfig.enabled_5g}
                  >
                    <SelectTrigger data-testid="select-wifi-channel-5g">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto</SelectItem>
                      <SelectItem value="36">36</SelectItem>
                      <SelectItem value="40">40</SelectItem>
                      <SelectItem value="44">44</SelectItem>
                      <SelectItem value="48">48</SelectItem>
                      <SelectItem value="149">149</SelectItem>
                      <SelectItem value="153">153</SelectItem>
                      <SelectItem value="157">157</SelectItem>
                      <SelectItem value="161">161</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Bandwidth</Label>
                <Select
                  value={wifiConfig.bandwidth_5g}
                  onValueChange={(value) => setWifiConfig({ ...wifiConfig, bandwidth_5g: value })}
                  disabled={!wifiConfig.enabled_5g}
                >
                  <SelectTrigger data-testid="select-wifi-bandwidth-5g">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20MHz">20 MHz</SelectItem>
                    <SelectItem value="40MHz">40 MHz</SelectItem>
                    <SelectItem value="80MHz">80 MHz</SelectItem>
                    <SelectItem value="160MHz">160 MHz</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>
          </Tabs>
          <div className="border-t pt-4 mt-2">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="wifi-guest-enabled"
                  checked={wifiConfig.enabled_guest}
                  onCheckedChange={(checked) => setWifiConfig({ ...wifiConfig, enabled_guest: !!checked })}
                  data-testid="checkbox-wifi-guest-enabled"
                />
                <Label htmlFor="wifi-guest-enabled" className="font-medium">Guest Network</Label>
              </div>
              {wifiConfig.enabled_guest && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="wifi-guest-isolation"
                    checked={wifiConfig.guestIsolation}
                    onCheckedChange={(checked) => setWifiConfig({ ...wifiConfig, guestIsolation: !!checked })}
                    data-testid="checkbox-wifi-guest-isolation"
                  />
                  <Label htmlFor="wifi-guest-isolation" className="text-sm text-muted-foreground">Client Isolation</Label>
                </div>
              )}
            </div>
            {wifiConfig.enabled_guest && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Guest SSID</Label>
                  <Input
                    value={wifiConfig.ssid_guest}
                    onChange={(e) => setWifiConfig({ ...wifiConfig, ssid_guest: e.target.value })}
                    placeholder="Guest network name"
                    data-testid="input-wifi-ssid-guest"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Guest Password</Label>
                  <Input
                    type="password"
                    value={wifiConfig.password_guest}
                    onChange={(e) => setWifiConfig({ ...wifiConfig, password_guest: e.target.value })}
                    placeholder="Min 8 characters"
                    data-testid="input-wifi-password-guest"
                  />
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setWifiDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!selectedOnu) return;
                const parameterValues: Array<{ name: string; value: string; type?: string }> = [];
                
                // 2.4GHz Radio.1 and SSID.1 configuration
                parameterValues.push({ name: "Device.WiFi.Radio.1.Enable", value: wifiConfig.enabled_2g ? "true" : "false", type: "xsd:boolean" });
                if (wifiConfig.enabled_2g) {
                  if (!wifiConfig.ssid_2g) {
                    toast({ title: "Error", description: "2.4GHz SSID is required", variant: "destructive" });
                    return;
                  }
                  if (wifiConfig.securityMode_2g !== "None" && wifiConfig.password_2g.length < 8) {
                    toast({ title: "Error", description: "2.4GHz password must be at least 8 characters", variant: "destructive" });
                    return;
                  }
                  parameterValues.push({ name: "Device.WiFi.SSID.1.SSID", value: wifiConfig.ssid_2g, type: "xsd:string" });
                  parameterValues.push({ name: "Device.WiFi.SSID.1.Enable", value: "true", type: "xsd:boolean" });
                  parameterValues.push({ name: "Device.WiFi.AccessPoint.1.Security.ModeEnabled", value: wifiConfig.securityMode_2g, type: "xsd:string" });
                  if (wifiConfig.password_2g) {
                    parameterValues.push({ name: "Device.WiFi.AccessPoint.1.Security.KeyPassphrase", value: wifiConfig.password_2g, type: "xsd:string" });
                  }
                  if (wifiConfig.channel_2g !== "auto") {
                    parameterValues.push({ name: "Device.WiFi.Radio.1.Channel", value: wifiConfig.channel_2g, type: "xsd:unsignedInt" });
                    parameterValues.push({ name: "Device.WiFi.Radio.1.AutoChannelEnable", value: "false", type: "xsd:boolean" });
                  } else {
                    parameterValues.push({ name: "Device.WiFi.Radio.1.AutoChannelEnable", value: "true", type: "xsd:boolean" });
                  }
                  parameterValues.push({ name: "Device.WiFi.Radio.1.OperatingChannelBandwidth", value: wifiConfig.bandwidth_2g, type: "xsd:string" });
                }
                
                // 5GHz Radio.2 and SSID.2 configuration
                parameterValues.push({ name: "Device.WiFi.Radio.2.Enable", value: wifiConfig.enabled_5g ? "true" : "false", type: "xsd:boolean" });
                if (wifiConfig.enabled_5g) {
                  if (!wifiConfig.ssid_5g) {
                    toast({ title: "Error", description: "5GHz SSID is required", variant: "destructive" });
                    return;
                  }
                  if (wifiConfig.securityMode_5g !== "None" && wifiConfig.password_5g.length < 8) {
                    toast({ title: "Error", description: "5GHz password must be at least 8 characters", variant: "destructive" });
                    return;
                  }
                  parameterValues.push({ name: "Device.WiFi.SSID.2.SSID", value: wifiConfig.ssid_5g, type: "xsd:string" });
                  parameterValues.push({ name: "Device.WiFi.SSID.2.Enable", value: "true", type: "xsd:boolean" });
                  parameterValues.push({ name: "Device.WiFi.AccessPoint.2.Security.ModeEnabled", value: wifiConfig.securityMode_5g, type: "xsd:string" });
                  if (wifiConfig.password_5g) {
                    parameterValues.push({ name: "Device.WiFi.AccessPoint.2.Security.KeyPassphrase", value: wifiConfig.password_5g, type: "xsd:string" });
                  }
                  if (wifiConfig.channel_5g !== "auto") {
                    parameterValues.push({ name: "Device.WiFi.Radio.2.Channel", value: wifiConfig.channel_5g, type: "xsd:unsignedInt" });
                    parameterValues.push({ name: "Device.WiFi.Radio.2.AutoChannelEnable", value: "false", type: "xsd:boolean" });
                  } else {
                    parameterValues.push({ name: "Device.WiFi.Radio.2.AutoChannelEnable", value: "true", type: "xsd:boolean" });
                  }
                  parameterValues.push({ name: "Device.WiFi.Radio.2.OperatingChannelBandwidth", value: wifiConfig.bandwidth_5g, type: "xsd:string" });
                }
                
                // Guest network SSID.3 configuration
                if (wifiConfig.enabled_guest) {
                  if (!wifiConfig.ssid_guest) {
                    toast({ title: "Error", description: "Guest SSID is required", variant: "destructive" });
                    return;
                  }
                  if (wifiConfig.password_guest.length < 8) {
                    toast({ title: "Error", description: "Guest password must be at least 8 characters", variant: "destructive" });
                    return;
                  }
                  parameterValues.push({ name: "Device.WiFi.SSID.3.SSID", value: wifiConfig.ssid_guest, type: "xsd:string" });
                  parameterValues.push({ name: "Device.WiFi.SSID.3.Enable", value: "true", type: "xsd:boolean" });
                  parameterValues.push({ name: "Device.WiFi.AccessPoint.3.Security.ModeEnabled", value: "WPA2-Personal", type: "xsd:string" });
                  parameterValues.push({ name: "Device.WiFi.AccessPoint.3.Security.KeyPassphrase", value: wifiConfig.password_guest, type: "xsd:string" });
                  parameterValues.push({ name: "Device.WiFi.AccessPoint.3.IsolationEnable", value: wifiConfig.guestIsolation ? "true" : "false", type: "xsd:boolean" });
                } else {
                  parameterValues.push({ name: "Device.WiFi.SSID.3.Enable", value: "false", type: "xsd:boolean" });
                }
                
                createTr069TaskMutation.mutate({
                  onuId: selectedOnu.id,
                  taskType: "set_parameter_values",
                  parameters: { parameterValues }
                });
                setWifiDialogOpen(false);
              }}
              disabled={createTr069TaskMutation.isPending}
              data-testid="button-wifi-submit"
            >
              Apply Configuration
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={voipDialogOpen} onOpenChange={setVoipDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Configure VoIP
            </DialogTitle>
            <DialogDescription>
              Configure SIP/VoIP settings for this ONU via TR-069
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>SIP Server</Label>
              <Input
                value={voipConfig.sipServer}
                onChange={(e) => setVoipConfig({ ...voipConfig, sipServer: e.target.value })}
                placeholder="sip.example.com"
                data-testid="input-voip-server"
              />
            </div>
            <div className="space-y-2">
              <Label>SIP Port</Label>
              <Input
                value={voipConfig.sipPort}
                onChange={(e) => setVoipConfig({ ...voipConfig, sipPort: e.target.value })}
                placeholder="5060"
                data-testid="input-voip-port"
              />
            </div>
            <div className="space-y-2">
              <Label>Username</Label>
              <Input
                value={voipConfig.username}
                onChange={(e) => setVoipConfig({ ...voipConfig, username: e.target.value })}
                placeholder="SIP account username"
                data-testid="input-voip-username"
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={voipConfig.password}
                onChange={(e) => setVoipConfig({ ...voipConfig, password: e.target.value })}
                placeholder="SIP account password"
                data-testid="input-voip-password"
              />
            </div>
            <div className="space-y-2">
              <Label>Display Name (Caller ID)</Label>
              <Input
                value={voipConfig.displayName}
                onChange={(e) => setVoipConfig({ ...voipConfig, displayName: e.target.value })}
                placeholder="John Doe"
                data-testid="input-voip-display-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Line Number</Label>
              <Select
                value={voipConfig.lineNumber}
                onValueChange={(value) => setVoipConfig({ ...voipConfig, lineNumber: value })}
              >
                <SelectTrigger data-testid="select-voip-line">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Line 1</SelectItem>
                  <SelectItem value="2">Line 2</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="voip-enabled"
                checked={voipConfig.enabled}
                onCheckedChange={(checked) => setVoipConfig({ ...voipConfig, enabled: !!checked })}
                data-testid="checkbox-voip-enabled"
              />
              <Label htmlFor="voip-enabled">Enable VoIP</Label>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setVoipDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!selectedOnu) return;
                if (!voipConfig.sipServer) {
                  toast({ title: "Error", description: "SIP Server is required", variant: "destructive" });
                  return;
                }
                if (!voipConfig.username) {
                  toast({ title: "Error", description: "Username is required", variant: "destructive" });
                  return;
                }
                const lineNum = voipConfig.lineNumber;
                const parameterValues: Array<{ name: string; value: string; type?: string }> = [
                  { name: `Device.Services.VoiceService.1.VoiceProfile.1.Enable`, value: voipConfig.enabled ? "Enabled" : "Disabled", type: "xsd:string" },
                  { name: `Device.Services.VoiceService.1.VoiceProfile.1.SIP.ProxyServer`, value: voipConfig.sipServer, type: "xsd:string" },
                  { name: `Device.Services.VoiceService.1.VoiceProfile.1.SIP.ProxyServerPort`, value: voipConfig.sipPort, type: "xsd:unsignedInt" },
                  { name: `Device.Services.VoiceService.1.VoiceProfile.1.SIP.ProxyServerTransport`, value: "UDP", type: "xsd:string" },
                  { name: `Device.Services.VoiceService.1.VoiceProfile.1.SIP.RegistrarServer`, value: voipConfig.sipServer, type: "xsd:string" },
                  { name: `Device.Services.VoiceService.1.VoiceProfile.1.SIP.RegistrarServerPort`, value: voipConfig.sipPort, type: "xsd:unsignedInt" },
                  { name: `Device.Services.VoiceService.1.VoiceProfile.1.SIP.RegistrarServerTransport`, value: "UDP", type: "xsd:string" },
                  { name: `Device.Services.VoiceService.1.VoiceProfile.1.Line.${lineNum}.Enable`, value: voipConfig.enabled ? "Enabled" : "Disabled", type: "xsd:string" },
                  { name: `Device.Services.VoiceService.1.VoiceProfile.1.Line.${lineNum}.DirectoryNumber`, value: voipConfig.username, type: "xsd:string" },
                  { name: `Device.Services.VoiceService.1.VoiceProfile.1.Line.${lineNum}.SIP.AuthUserName`, value: voipConfig.username, type: "xsd:string" },
                  { name: `Device.Services.VoiceService.1.VoiceProfile.1.Line.${lineNum}.SIP.AuthPassword`, value: voipConfig.password, type: "xsd:string" },
                  { name: `Device.Services.VoiceService.1.VoiceProfile.1.Line.${lineNum}.CallingFeatures.CallerIDName`, value: voipConfig.displayName || voipConfig.username, type: "xsd:string" },
                ];
                createTr069TaskMutation.mutate({
                  onuId: selectedOnu.id,
                  taskType: "set_parameter_values",
                  parameters: { parameterValues }
                });
                setVoipDialogOpen(false);
              }}
              disabled={createTr069TaskMutation.isPending}
              data-testid="button-voip-submit"
            >
              Apply Configuration
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={parametersDialogOpen} onOpenChange={setParametersDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <List className="h-5 w-5" />
              TR-069 Device Parameters
            </DialogTitle>
            <DialogDescription>
              View and edit device parameters via TR-069. Changes are sent as SetParameterValues tasks.
            </DialogDescription>
          </DialogHeader>
          {selectedOnu && linkedTr069Device ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <Input
                    placeholder="Filter parameters (e.g. WiFi, SSID, Device.Info)"
                    value={parametersFilter}
                    onChange={(e) => setParametersFilter(e.target.value)}
                    data-testid="input-parameters-filter"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFetchingParams(true);
                    createTr069TaskMutation.mutate({
                      onuId: selectedOnu.id,
                      taskType: "get_parameter_values",
                      parameters: { parameterNames: ["Device."] }
                    }, {
                      onSettled: () => setFetchingParams(false)
                    });
                  }}
                  disabled={fetchingParams || createTr069TaskMutation.isPending}
                  data-testid="button-refresh-parameters"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${fetchingParams ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
              
              <ScrollArea className="h-[400px] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50%]">Parameter Path</TableHead>
                      <TableHead className="w-[35%]">Value</TableHead>
                      <TableHead className="w-[15%]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linkedTr069Device.parameterCache && typeof linkedTr069Device.parameterCache === 'object' ? (
                      Object.entries(linkedTr069Device.parameterCache as Record<string, unknown>)
                        .filter(([path]) => 
                          !parametersFilter || 
                          path.toLowerCase().includes(parametersFilter.toLowerCase())
                        )
                        .slice(0, 100)
                        .map(([path, value]) => {
                          const inferType = (val: unknown): string => {
                            const strVal = String(val ?? "");
                            if (strVal === "true" || strVal === "false") return "xsd:boolean";
                            if (/^\d+$/.test(strVal) && !isNaN(parseInt(strVal))) return "xsd:unsignedInt";
                            return "xsd:string";
                          };
                          return (
                          <TableRow key={path}>
                            <TableCell className="font-mono text-xs break-all">{path}</TableCell>
                            <TableCell>
                              {editingParameter?.path === path ? (
                                <div className="flex flex-col gap-1">
                                  <Input
                                    value={newParameterValue}
                                    onChange={(e) => setNewParameterValue(e.target.value)}
                                    className="h-8 text-sm"
                                    data-testid={`input-param-${path}`}
                                  />
                                  <Select value={newParameterType} onValueChange={setNewParameterType}>
                                    <SelectTrigger className="h-7 text-xs" data-testid={`select-param-type-${path}`}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="xsd:string">String</SelectItem>
                                      <SelectItem value="xsd:unsignedInt">Integer</SelectItem>
                                      <SelectItem value="xsd:boolean">Boolean</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              ) : (
                                <span className="text-sm break-all">{String(value ?? "")}</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {editingParameter?.path === path ? (
                                <div className="flex items-center gap-1">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => {
                                      createTr069TaskMutation.mutate({
                                        onuId: selectedOnu.id,
                                        taskType: "set_parameter_values",
                                        parameters: {
                                          parameterValues: [{
                                            name: path,
                                            value: newParameterValue,
                                            type: newParameterType
                                          }]
                                        }
                                      });
                                      setEditingParameter(null);
                                    }}
                                    disabled={createTr069TaskMutation.isPending}
                                    data-testid={`button-save-param-${path}`}
                                  >
                                    <Save className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => setEditingParameter(null)}
                                    data-testid={`button-cancel-param-${path}`}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingParameter({ path, value: String(value ?? "") });
                                    setNewParameterValue(String(value ?? ""));
                                    setNewParameterType(inferType(value));
                                  }}
                                  data-testid={`button-edit-param-${path}`}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );})
                    ) : (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                          <div className="flex flex-col items-center gap-2">
                            <AlertCircle className="h-8 w-8" />
                            <p>No parameters cached yet.</p>
                            <p className="text-xs">Click "Refresh" to fetch parameters from the device.</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
              
              {(() => {
                const cache = linkedTr069Device.parameterCache;
                if (!cache || typeof cache !== 'object') return null;
                const entries = Object.entries(cache as Record<string, string>);
                const filtered = entries.filter(([path]) => !parametersFilter || path.toLowerCase().includes(parametersFilter.toLowerCase()));
                const total = entries.length;
                const shown = Math.min(100, filtered.length);
                return (
                  <p className="text-xs text-muted-foreground">
                    {`Showing ${shown} of ${total} parameters${parametersFilter ? ` (filtered by "${parametersFilter}")` : ""}`}
                  </p>
                );
              })()}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No TR-069 device linked to this ONU.</p>
              <p className="text-xs text-muted-foreground mt-1">Link a TR-069 device first to view parameters.</p>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setParametersDialogOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={vlanDialogOpen} onOpenChange={setVlanDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Network className="h-5 w-5" />
              Configure WAN/VLAN
            </DialogTitle>
            <DialogDescription>
              Configure WAN connection and VLAN settings for this ONU via TR-069
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>VLAN ID</Label>
                <Input
                  value={vlanConfig.vlanId}
                  onChange={(e) => setVlanConfig({ ...vlanConfig, vlanId: e.target.value })}
                  placeholder="100"
                  data-testid="input-vlan-id"
                />
              </div>
              <div className="space-y-2">
                <Label>MTU</Label>
                <Input
                  value={vlanConfig.mtu}
                  onChange={(e) => setVlanConfig({ ...vlanConfig, mtu: e.target.value })}
                  placeholder="1500"
                  data-testid="input-vlan-mtu"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>IP Mode</Label>
              <Select
                value={vlanConfig.ipMode}
                onValueChange={(value: "DHCP" | "Static" | "PPPoE") => setVlanConfig({ ...vlanConfig, ipMode: value })}
              >
                <SelectTrigger data-testid="select-vlan-ip-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DHCP">DHCP (Automatic)</SelectItem>
                  <SelectItem value="Static">Static IP</SelectItem>
                  <SelectItem value="PPPoE">PPPoE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {vlanConfig.ipMode === "Static" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>IP Address</Label>
                    <Input
                      value={vlanConfig.ipAddress}
                      onChange={(e) => setVlanConfig({ ...vlanConfig, ipAddress: e.target.value })}
                      placeholder="192.168.1.100"
                      data-testid="input-vlan-ip"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Subnet Mask</Label>
                    <Input
                      value={vlanConfig.subnetMask}
                      onChange={(e) => setVlanConfig({ ...vlanConfig, subnetMask: e.target.value })}
                      placeholder="255.255.255.0"
                      data-testid="input-vlan-subnet"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Gateway</Label>
                    <Input
                      value={vlanConfig.gateway}
                      onChange={(e) => setVlanConfig({ ...vlanConfig, gateway: e.target.value })}
                      placeholder="192.168.1.1"
                      data-testid="input-vlan-gateway"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>DNS Server</Label>
                    <Input
                      value={vlanConfig.dnsServer}
                      onChange={(e) => setVlanConfig({ ...vlanConfig, dnsServer: e.target.value })}
                      placeholder="8.8.8.8"
                      data-testid="input-vlan-dns"
                    />
                  </div>
                </div>
              </>
            )}
            {vlanConfig.ipMode === "PPPoE" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>PPPoE Username</Label>
                  <Input
                    value={vlanConfig.pppoeUsername}
                    onChange={(e) => setVlanConfig({ ...vlanConfig, pppoeUsername: e.target.value })}
                    placeholder="user@isp.com"
                    data-testid="input-pppoe-username"
                  />
                </div>
                <div className="space-y-2">
                  <Label>PPPoE Password</Label>
                  <Input
                    type="password"
                    value={vlanConfig.pppoePassword}
                    onChange={(e) => setVlanConfig({ ...vlanConfig, pppoePassword: e.target.value })}
                    placeholder="PPPoE password"
                    data-testid="input-pppoe-password"
                  />
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Checkbox
                id="vlan-enabled"
                checked={vlanConfig.enabled}
                onCheckedChange={(checked) => setVlanConfig({ ...vlanConfig, enabled: !!checked })}
                data-testid="checkbox-vlan-enabled"
              />
              <Label htmlFor="vlan-enabled">Enable WAN Interface</Label>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setVlanDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!selectedOnu) return;
                const parameterValues: Array<{ name: string; value: string; type?: string }> = [];
                if (vlanConfig.vlanId) {
                  parameterValues.push({ name: "Device.Ethernet.VLANTermination.1.VLANID", value: vlanConfig.vlanId, type: "xsd:unsignedInt" });
                }
                parameterValues.push({ name: "Device.IP.Interface.1.Enable", value: vlanConfig.enabled ? "true" : "false", type: "xsd:boolean" });
                parameterValues.push({ name: "Device.IP.Interface.1.IPv4Enable", value: vlanConfig.enabled ? "true" : "false", type: "xsd:boolean" });
                if (vlanConfig.mtu && vlanConfig.mtu !== "1500") {
                  parameterValues.push({ name: "Device.IP.Interface.1.MaxMTUSize", value: vlanConfig.mtu, type: "xsd:unsignedInt" });
                }
                if (vlanConfig.ipMode === "DHCP") {
                  parameterValues.push({ name: "Device.DHCPv4.Client.1.Enable", value: "true", type: "xsd:boolean" });
                  parameterValues.push({ name: "Device.IP.Interface.1.IPv4Address.1.AddressingType", value: "DHCP", type: "xsd:string" });
                } else if (vlanConfig.ipMode === "Static") {
                  parameterValues.push({ name: "Device.DHCPv4.Client.1.Enable", value: "false", type: "xsd:boolean" });
                  parameterValues.push({ name: "Device.IP.Interface.1.IPv4Address.1.AddressingType", value: "Static", type: "xsd:string" });
                  if (vlanConfig.ipAddress) {
                    parameterValues.push({ name: "Device.IP.Interface.1.IPv4Address.1.IPAddress", value: vlanConfig.ipAddress, type: "xsd:string" });
                  }
                  if (vlanConfig.subnetMask) {
                    parameterValues.push({ name: "Device.IP.Interface.1.IPv4Address.1.SubnetMask", value: vlanConfig.subnetMask, type: "xsd:string" });
                  }
                  if (vlanConfig.gateway) {
                    parameterValues.push({ name: "Device.Routing.Router.1.IPv4Forwarding.1.GatewayIPAddress", value: vlanConfig.gateway, type: "xsd:string" });
                  }
                  if (vlanConfig.dnsServer) {
                    parameterValues.push({ name: "Device.DNS.Client.Server.1.DNSServer", value: vlanConfig.dnsServer, type: "xsd:string" });
                  }
                } else if (vlanConfig.ipMode === "PPPoE") {
                  parameterValues.push({ name: "Device.PPP.Interface.1.Enable", value: "true", type: "xsd:boolean" });
                  if (vlanConfig.pppoeUsername) {
                    parameterValues.push({ name: "Device.PPP.Interface.1.Username", value: vlanConfig.pppoeUsername, type: "xsd:string" });
                  }
                  if (vlanConfig.pppoePassword) {
                    parameterValues.push({ name: "Device.PPP.Interface.1.Password", value: vlanConfig.pppoePassword, type: "xsd:string" });
                  }
                }
                createTr069TaskMutation.mutate({
                  onuId: selectedOnu.id,
                  taskType: "set_parameter_values",
                  parameters: { parameterValues }
                });
                setVlanDialogOpen(false);
              }}
              disabled={createTr069TaskMutation.isPending}
              data-testid="button-vlan-submit"
            >
              Apply Configuration
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
