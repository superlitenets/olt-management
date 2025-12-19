import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TableSkeleton } from "@/components/loading-skeleton";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import {
  Search,
  MoreVertical,
  Plus,
  Shield,
  Trash2,
  Edit,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Upload,
  Info,
  Server,
  Download,
  Play,
  Square,
  RefreshCw,
  Loader2,
  Wifi,
  WifiOff,
  Clock,
  RotateCcw,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { VpnProfile } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

interface VpnEnvironmentInfo {
  isReplitEnvironment: boolean;
  isOpenVpnAvailable: boolean;
  hasTunDevice: boolean;
  canEstablishVpn: boolean;
  reason?: string;
}

interface VpnStatus {
  status: "connected" | "disconnected" | "connecting" | "error";
  connectedSince?: string;
  localIp?: string;
  remoteIp?: string;
  bytesReceived?: number;
  bytesSent?: number;
  error?: string;
}

export default function VpnPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<VpnProfile | null>(null);
  const [deleteProfileDialogOpen, setDeleteProfileDialogOpen] = useState(false);
  const [profileToDelete, setProfileToDelete] = useState<VpnProfile | null>(null);
  const { toast } = useToast();

  const [profileForm, setProfileForm] = useState({
    name: "",
    description: "",
    ovpnConfig: "",
    username: "",
    password: "",
    tr069Ips: "",
    managementIps: "",
  });

  const { data: profiles, isLoading: profilesLoading } = useQuery<VpnProfile[]>({
    queryKey: ["/api/vpn/profiles"],
  });

  const { data: environment } = useQuery<VpnEnvironmentInfo>({
    queryKey: ["/api/vpn/environment"],
  });

  const createProfileMutation = useMutation({
    mutationFn: async (data: typeof profileForm) => {
      const payload = {
        ...data,
        tr069Ips: data.tr069Ips ? data.tr069Ips.split(",").map(ip => ip.trim()).filter(Boolean) : [],
        managementIps: data.managementIps ? data.managementIps.split(",").map(ip => ip.trim()).filter(Boolean) : [],
        ovpnConfig: data.ovpnConfig || null,
      };
      return apiRequest("POST", "/api/vpn/profiles", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vpn/profiles"] });
      setProfileDialogOpen(false);
      resetProfileForm();
      toast({
        title: "Tunnel Created",
        description: "VPN tunnel created with MikroTik script auto-generated",
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
        description: "Failed to create profile",
        variant: "destructive",
      });
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof profileForm> }) => {
      const payload = {
        ...data,
        tr069Ips: data.tr069Ips ? data.tr069Ips.split(",").map(ip => ip.trim()).filter(Boolean) : [],
        managementIps: data.managementIps ? data.managementIps.split(",").map(ip => ip.trim()).filter(Boolean) : [],
        ovpnConfig: data.ovpnConfig || null,
      };
      return apiRequest("PATCH", `/api/vpn/profiles/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vpn/profiles"] });
      setProfileDialogOpen(false);
      setEditingProfile(null);
      resetProfileForm();
      toast({
        title: "Tunnel Updated",
        description: "VPN tunnel updated with MikroTik script regenerated",
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
        description: "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  const deleteProfileMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/vpn/profiles/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vpn/profiles"] });
      setDeleteProfileDialogOpen(false);
      setProfileToDelete(null);
      toast({
        title: "Tunnel Deleted",
        description: "VPN tunnel has been deleted",
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
        description: "Failed to delete profile",
        variant: "destructive",
      });
    },
  });

  const [connectingProfiles, setConnectingProfiles] = useState<Set<string>>(new Set());
  const [disconnectingProfiles, setDisconnectingProfiles] = useState<Set<string>>(new Set());
  const [testingProfiles, setTestingProfiles] = useState<Set<string>>(new Set());
  const [reprovisioningProfiles, setReprovisioningProfiles] = useState<Set<string>>(new Set());

  const connectMutation = useMutation({
    mutationFn: async (id: string) => {
      setConnectingProfiles(prev => new Set(prev).add(id));
      return apiRequest("POST", `/api/vpn/profiles/${id}/connect`);
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["/api/vpn/profiles"] });
      setConnectingProfiles(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      refreshStatus(id);
      toast({
        title: "Connecting",
        description: "VPN connection initiated",
      });
    },
    onError: (error: Error, id) => {
      setConnectingProfiles(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to establish VPN connection",
        variant: "destructive",
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (id: string) => {
      setDisconnectingProfiles(prev => new Set(prev).add(id));
      return apiRequest("POST", `/api/vpn/profiles/${id}/disconnect`);
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["/api/vpn/profiles"] });
      setDisconnectingProfiles(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      refreshStatus(id);
      toast({
        title: "Disconnected",
        description: "VPN connection terminated",
      });
    },
    onError: (error: Error, id) => {
      setDisconnectingProfiles(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast({
        title: "Disconnect Failed",
        description: error.message || "Failed to disconnect VPN",
        variant: "destructive",
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: async (id: string) => {
      setTestingProfiles(prev => new Set(prev).add(id));
      const response = await apiRequest("POST", `/api/vpn/profiles/${id}/test`);
      return response.json();
    },
    onSuccess: (data, id) => {
      setTestingProfiles(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      if (data.valid) {
        toast({
          title: "Configuration Valid",
          description: "OpenVPN configuration is valid and ready to use",
        });
      } else {
        toast({
          title: "Configuration Issue",
          description: data.error || "There may be issues with this configuration",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error, id) => {
      setTestingProfiles(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast({
        title: "Test Failed",
        description: error.message || "Failed to test VPN configuration",
        variant: "destructive",
      });
    },
  });

  const reprovisionMutation = useMutation({
    mutationFn: async (id: string) => {
      setReprovisioningProfiles(prev => new Set(prev).add(id));
      const response = await apiRequest("POST", `/api/vpn/profiles/${id}/reprovision`);
      return response.json();
    },
    onSuccess: (data, id) => {
      queryClient.invalidateQueries({ queryKey: ["/api/vpn/profiles"] });
      setReprovisioningProfiles(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      if (data.result?.status === "success") {
        toast({
          title: "VPS Provisioned",
          description: "Firewall rules and OpenVPN configuration applied successfully",
        });
      } else {
        toast({
          title: "Provisioning Complete",
          description: data.result?.message || "VPS provisioning completed with warnings",
          variant: data.result?.errors?.length ? "destructive" : "default",
        });
      }
    },
    onError: (error: Error, id) => {
      setReprovisioningProfiles(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast({
        title: "Provisioning Failed",
        description: error.message || "Failed to provision VPS",
        variant: "destructive",
      });
    },
  });

  const getVpnStatus = async (profileId: string): Promise<VpnStatus> => {
    const response = await fetch(`/api/vpn/profiles/${profileId}/status`);
    if (!response.ok) throw new Error("Failed to fetch status");
    return response.json();
  };

  const [vpnStatuses, setVpnStatuses] = useState<Record<string, VpnStatus>>({});
  const [loadingStatuses, setLoadingStatuses] = useState<Record<string, boolean>>({});

  const refreshStatus = async (profileId: string) => {
    setLoadingStatuses(prev => ({ ...prev, [profileId]: true }));
    try {
      const status = await getVpnStatus(profileId);
      setVpnStatuses(prev => ({ ...prev, [profileId]: status }));
    } catch {
      setVpnStatuses(prev => ({ ...prev, [profileId]: { status: "error", error: "Failed to fetch status" } }));
    } finally {
      setLoadingStatuses(prev => ({ ...prev, [profileId]: false }));
    }
  };

  const resetProfileForm = () => {
    setProfileForm({
      name: "",
      description: "",
      ovpnConfig: "",
      username: "",
      password: "",
      tr069Ips: "",
      managementIps: "",
    });
  };

  const openEditProfile = (profile: VpnProfile) => {
    setEditingProfile(profile);
    setProfileForm({
      name: profile.name,
      description: profile.description || "",
      ovpnConfig: profile.ovpnConfig || "",
      tr069Ips: (profile.tr069Ips || []).join(", "),
      managementIps: (profile.managementIps || []).join(", "),
      username: profile.username || "",
      password: profile.password || "",
    });
    setProfileDialogOpen(true);
  };

  const handleProfileSubmit = () => {
    if (editingProfile) {
      updateProfileMutation.mutate({ id: editingProfile.id, data: profileForm });
    } else {
      createProfileMutation.mutate(profileForm);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setProfileForm({ ...profileForm, ovpnConfig: content });
        if (!profileForm.name) {
          const fileName = file.name.replace(/\.ovpn$/, "");
          setProfileForm((prev) => ({ ...prev, name: fileName, ovpnConfig: content }));
        }
      };
      reader.readAsText(file);
    }
  };

  const filteredProfiles = profiles?.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-page-title">VPN Tunnels</h1>
          <p className="text-sm text-muted-foreground">
            Manage OpenVPN tunnels for secure OLT connectivity
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingProfile(null);
            resetProfileForm();
            setProfileDialogOpen(true);
          }}
          data-testid="button-add-tunnel"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Tunnel
        </Button>
      </div>

      {environment && !environment.canEstablishVpn && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="flex items-start gap-3 pt-4">
            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-amber-700 dark:text-amber-400">VPN Connections Limited</p>
              <p className="text-sm text-muted-foreground mt-1">
                {environment.reason || "VPN connections are not available in this environment."}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                You can still create and manage VPN profiles here. They will be used when the application is deployed with Docker and proper network capabilities.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tunnels</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-tunnels">{profiles?.length || 0}</div>
            <p className="text-xs text-muted-foreground">OpenVPN configurations</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Environment</CardTitle>
            <Info className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-environment">
              {environment?.isReplitEnvironment ? "Replit" : "Docker/Local"}
            </div>
            <p className="text-xs text-muted-foreground">
              {environment?.canEstablishVpn ? "VPN capable" : "VPN limited"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">OpenVPN Status</CardTitle>
            {environment?.isOpenVpnAvailable ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-openvpn-status">
              {environment?.isOpenVpnAvailable ? "Available" : "Not Found"}
            </div>
            <p className="text-xs text-muted-foreground">
              {environment?.hasTunDevice ? "TUN device available" : "TUN device not available"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle>VPN Tunnels</CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tunnels..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
                data-testid="input-search-tunnels"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {profilesLoading ? (
            <TableSkeleton rows={5} />
          ) : !filteredProfiles?.length ? (
            <EmptyState
              icon={<Shield className="h-8 w-8" />}
              title="No VPN Tunnels"
              description="Create a VPN tunnel to enable secure OLT connections. A MikroTik script will be auto-generated."
              action={{
                label: "Add Tunnel",
                onClick: () => {
                  setEditingProfile(null);
                  resetProfileForm();
                  setProfileDialogOpen(true);
                },
              }}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Authentication</TableHead>
                  <TableHead>VPS Provisioning</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProfiles.map((profile) => (
                  <TableRow key={profile.id} data-testid={`row-profile-${profile.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{profile.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {profile.description || "-"}
                    </TableCell>
                    <TableCell>
                      {profile.username ? (
                        <Badge variant="secondary">Username/Password</Badge>
                      ) : (
                        <Badge variant="outline">Certificate Only</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {profile.provisioningStatus === "success" ? (
                          <Badge variant="default" className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Provisioned
                          </Badge>
                        ) : profile.provisioningStatus === "running" ? (
                          <Badge variant="secondary">
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            Provisioning
                          </Badge>
                        ) : profile.provisioningStatus === "failed" ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="destructive" className="cursor-help">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Failed
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{profile.provisioningMessage || "Provisioning failed"}</p>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <Badge variant="outline">
                            <Clock className="h-3 w-3 mr-1" />
                            Pending
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {environment?.canEstablishVpn ? (
                        <div className="flex items-center gap-2">
                          {loadingStatuses[profile.id] ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          ) : vpnStatuses[profile.id]?.status === "connected" ? (
                            <Badge variant="default" className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                              <Wifi className="h-3 w-3 mr-1" />
                              Connected
                            </Badge>
                          ) : vpnStatuses[profile.id]?.status === "connecting" ? (
                            <Badge variant="secondary">
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              Connecting
                            </Badge>
                          ) : vpnStatuses[profile.id]?.status === "error" ? (
                            <Badge variant="destructive">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Error
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              <WifiOff className="h-3 w-3 mr-1" />
                              Disconnected
                            </Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => refreshStatus(profile.id)}
                            disabled={loadingStatuses[profile.id]}
                            data-testid={`button-refresh-status-${profile.id}`}
                          >
                            <RefreshCw className={`h-3 w-3 ${loadingStatuses[profile.id] ? 'animate-spin' : ''}`} />
                          </Button>
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          N/A
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {profile.createdAt
                        ? formatDistanceToNow(new Date(profile.createdAt), { addSuffix: true })
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`button-profile-menu-${profile.id}`}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {environment?.canEstablishVpn && (
                            <>
                              {vpnStatuses[profile.id]?.status === "connected" ? (
                                <DropdownMenuItem
                                  onClick={() => disconnectMutation.mutate(profile.id)}
                                  disabled={disconnectingProfiles.has(profile.id)}
                                  data-testid={`button-disconnect-${profile.id}`}
                                >
                                  {disconnectingProfiles.has(profile.id) ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  ) : (
                                    <Square className="h-4 w-4 mr-2" />
                                  )}
                                  Disconnect
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => connectMutation.mutate(profile.id)}
                                  disabled={connectingProfiles.has(profile.id)}
                                  data-testid={`button-connect-${profile.id}`}
                                >
                                  {connectingProfiles.has(profile.id) ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  ) : (
                                    <Play className="h-4 w-4 mr-2" />
                                  )}
                                  Connect
                                </DropdownMenuItem>
                              )}
                            </>
                          )}
                          <DropdownMenuItem
                            onClick={() => testMutation.mutate(profile.id)}
                            disabled={testingProfiles.has(profile.id)}
                            data-testid={`button-test-config-${profile.id}`}
                          >
                            {testingProfiles.has(profile.id) ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                            )}
                            Test Configuration
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => window.open(`/api/vpn/profiles/${profile.id}/mikrotik-script`, "_blank")}
                            data-testid={`button-mikrotik-script-${profile.id}`}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            MikroTik Client Script
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => window.open(`/api/vpn/profiles/${profile.id}/vps-firewall-script`, "_blank")}
                            data-testid={`button-vps-firewall-${profile.id}`}
                          >
                            <Shield className="h-4 w-4 mr-2" />
                            VPS Firewall Script
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => window.open(`/api/vpn/profiles/${profile.id}/server-config`, "_blank")}
                            data-testid={`button-server-config-${profile.id}`}
                          >
                            <Server className="h-4 w-4 mr-2" />
                            OpenVPN Server Config
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => reprovisionMutation.mutate(profile.id)}
                            disabled={reprovisioningProfiles.has(profile.id)}
                            data-testid={`button-reprovision-${profile.id}`}
                          >
                            {reprovisioningProfiles.has(profile.id) ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <RotateCcw className="h-4 w-4 mr-2" />
                            )}
                            Reprovision VPS
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => openEditProfile(profile)}
                            data-testid={`button-edit-profile-${profile.id}`}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setProfileToDelete(profile);
                              setDeleteProfileDialogOpen(true);
                            }}
                            className="text-destructive"
                            data-testid={`button-delete-profile-${profile.id}`}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={profileDialogOpen}
        onOpenChange={(open) => {
          setProfileDialogOpen(open);
          if (!open) {
            setEditingProfile(null);
            resetProfileForm();
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProfile ? "Edit VPN Tunnel" : "Add VPN Tunnel"}</DialogTitle>
            <DialogDescription>
              {editingProfile
                ? "Update the VPN tunnel configuration"
                : "Create a new VPN tunnel. A MikroTik script will be auto-generated."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="profile-name">Profile Name</Label>
              <Input
                id="profile-name"
                value={profileForm.name}
                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                placeholder="e.g., Data Center VPN"
                data-testid="input-profile-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-description">Description</Label>
              <Input
                id="profile-description"
                value={profileForm.description}
                onChange={(e) => setProfileForm({ ...profileForm, description: e.target.value })}
                placeholder="Optional description"
                data-testid="input-profile-description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tr069-ips">TR-069/ACS Server IPs</Label>
              <Input
                id="tr069-ips"
                value={profileForm.tr069Ips}
                onChange={(e) => setProfileForm({ ...profileForm, tr069Ips: e.target.value })}
                placeholder="e.g., 192.168.1.100, 10.0.0.50"
                data-testid="input-tr069-ips"
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated IP addresses of TR-069/ACS servers to route through VPN
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="management-ips">OLT Management IPs</Label>
              <Input
                id="management-ips"
                value={profileForm.managementIps}
                onChange={(e) => setProfileForm({ ...profileForm, managementIps: e.target.value })}
                placeholder="e.g., 192.168.10.0/24, 10.10.0.1"
                data-testid="input-management-ips"
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated OLT management IPs or subnets (CIDR notation supported)
              </p>
            </div>
            <div className="space-y-2">
              <Label>OpenVPN Configuration (.ovpn) - Optional</Label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => document.getElementById("ovpn-file-input")?.click()}
                  className="w-full"
                  data-testid="button-upload-ovpn"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload .ovpn File
                </Button>
                <input
                  id="ovpn-file-input"
                  type="file"
                  accept=".ovpn,.conf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
              {profileForm.ovpnConfig && (
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-xs text-muted-foreground">
                    OVPN configuration loaded ({profileForm.ovpnConfig.split("\n").length} lines) - 
                    MikroTik will fetch this file automatically
                  </p>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="profile-username">Username (Optional)</Label>
                <Input
                  id="profile-username"
                  value={profileForm.username}
                  onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })}
                  placeholder="VPN username"
                  data-testid="input-profile-username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-password">Password (Optional)</Label>
                <Input
                  id="profile-password"
                  type="password"
                  value={profileForm.password}
                  onChange={(e) => setProfileForm({ ...profileForm, password: e.target.value })}
                  placeholder="VPN password"
                  data-testid="input-profile-password"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              If your OpenVPN config uses auth-user-pass, provide the username and password here.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setProfileDialogOpen(false);
                setEditingProfile(null);
                resetProfileForm();
              }}
              data-testid="button-cancel-profile"
            >
              Cancel
            </Button>
            <Button
              onClick={handleProfileSubmit}
              disabled={
                !profileForm.name ||
                createProfileMutation.isPending ||
                updateProfileMutation.isPending
              }
              data-testid="button-save-profile"
            >
              {createProfileMutation.isPending || updateProfileMutation.isPending
                ? "Saving..."
                : editingProfile
                ? "Update Profile"
                : "Create Profile"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteProfileDialogOpen} onOpenChange={setDeleteProfileDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete VPN Profile</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the profile "{profileToDelete?.name}"? This action
              cannot be undone. OLTs using this profile will need to be updated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => profileToDelete && deleteProfileMutation.mutate(profileToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteProfileMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
