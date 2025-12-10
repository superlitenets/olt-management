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
  DialogTrigger,
  DialogFooter,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Server,
  Network,
  Download,
  Trash2,
  Edit,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Link2,
  Copy,
  Key,
} from "lucide-react";
import type { VpnGateway, VpnTunnel, Olt } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

export default function VpnPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("gateways");
  const [gatewayDialogOpen, setGatewayDialogOpen] = useState(false);
  const [tunnelDialogOpen, setTunnelDialogOpen] = useState(false);
  const [editingGateway, setEditingGateway] = useState<VpnGateway | null>(null);
  const [editingTunnel, setEditingTunnel] = useState<VpnTunnel | null>(null);
  const [deleteGatewayDialogOpen, setDeleteGatewayDialogOpen] = useState(false);
  const [deleteTunnelDialogOpen, setDeleteTunnelDialogOpen] = useState(false);
  const [gatewayToDelete, setGatewayToDelete] = useState<VpnGateway | null>(null);
  const [tunnelToDelete, setTunnelToDelete] = useState<VpnTunnel | null>(null);
  const { toast } = useToast();

  const [gatewayForm, setGatewayForm] = useState({
    name: "",
    description: "",
    vpnType: "wireguard" as const,
    endpoint: "",
    port: 51820,
    publicKey: "",
    privateKey: "",
    allowedIps: "0.0.0.0/0",
    dns: "",
    mtu: 1420,
    persistentKeepalive: 25,
    tenantId: "default",
  });

  const [tunnelForm, setTunnelForm] = useState({
    gatewayId: "",
    oltId: "",
    name: "",
    description: "",
    peerPublicKey: "",
    peerEndpoint: "",
    peerPort: 51820,
    localAddress: "",
    allowedIps: "0.0.0.0/0",
    preSharedKey: "",
  });

  const { data: gateways, isLoading: gatewaysLoading } = useQuery<VpnGateway[]>({
    queryKey: ["/api/vpn/gateways"],
  });

  const { data: tunnels, isLoading: tunnelsLoading } = useQuery<VpnTunnel[]>({
    queryKey: ["/api/vpn/tunnels"],
  });

  const { data: olts } = useQuery<Olt[]>({
    queryKey: ["/api/olts"],
  });

  const createGatewayMutation = useMutation({
    mutationFn: async (data: typeof gatewayForm) => {
      return apiRequest("POST", "/api/vpn/gateways", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vpn/gateways"] });
      setGatewayDialogOpen(false);
      resetGatewayForm();
      toast({
        title: "Gateway Created",
        description: "VPN gateway has been created successfully",
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
        description: "Failed to create gateway",
        variant: "destructive",
      });
    },
  });

  const updateGatewayMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof gatewayForm> }) => {
      return apiRequest("PUT", `/api/vpn/gateways/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vpn/gateways"] });
      setGatewayDialogOpen(false);
      setEditingGateway(null);
      resetGatewayForm();
      toast({
        title: "Gateway Updated",
        description: "VPN gateway has been updated successfully",
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
        description: "Failed to update gateway",
        variant: "destructive",
      });
    },
  });

  const deleteGatewayMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/vpn/gateways/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vpn/gateways"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vpn/tunnels"] });
      setDeleteGatewayDialogOpen(false);
      setGatewayToDelete(null);
      toast({
        title: "Gateway Deleted",
        description: "VPN gateway and associated tunnels have been deleted",
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
        description: "Failed to delete gateway",
        variant: "destructive",
      });
    },
  });

  const createTunnelMutation = useMutation({
    mutationFn: async (data: typeof tunnelForm) => {
      return apiRequest("POST", "/api/vpn/tunnels", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vpn/tunnels"] });
      setTunnelDialogOpen(false);
      resetTunnelForm();
      toast({
        title: "Tunnel Created",
        description: "VPN tunnel has been created successfully",
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
        description: "Failed to create tunnel",
        variant: "destructive",
      });
    },
  });

  const updateTunnelMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof tunnelForm> }) => {
      return apiRequest("PUT", `/api/vpn/tunnels/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vpn/tunnels"] });
      setTunnelDialogOpen(false);
      setEditingTunnel(null);
      resetTunnelForm();
      toast({
        title: "Tunnel Updated",
        description: "VPN tunnel has been updated successfully",
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
        description: "Failed to update tunnel",
        variant: "destructive",
      });
    },
  });

  const deleteTunnelMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/vpn/tunnels/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vpn/tunnels"] });
      setDeleteTunnelDialogOpen(false);
      setTunnelToDelete(null);
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
        description: "Failed to delete tunnel",
        variant: "destructive",
      });
    },
  });

  const resetGatewayForm = () => {
    setGatewayForm({
      name: "",
      description: "",
      vpnType: "wireguard",
      endpoint: "",
      port: 51820,
      publicKey: "",
      privateKey: "",
      allowedIps: "0.0.0.0/0",
      dns: "",
      mtu: 1420,
      persistentKeepalive: 25,
      tenantId: "default",
    });
  };

  const resetTunnelForm = () => {
    setTunnelForm({
      gatewayId: "",
      oltId: "",
      name: "",
      description: "",
      peerPublicKey: "",
      peerEndpoint: "",
      peerPort: 51820,
      localAddress: "",
      allowedIps: "0.0.0.0/0",
      preSharedKey: "",
    });
  };

  const openEditGateway = (gateway: VpnGateway) => {
    setEditingGateway(gateway);
    setGatewayForm({
      name: gateway.name,
      description: gateway.description || "",
      vpnType: (gateway.vpnType as typeof gatewayForm.vpnType) || "wireguard",
      endpoint: gateway.endpoint || "",
      port: gateway.port || 51820,
      publicKey: gateway.publicKey || "",
      privateKey: gateway.privateKey || "",
      allowedIps: gateway.allowedIps || "0.0.0.0/0",
      dns: gateway.dns || "",
      mtu: gateway.mtu || 1420,
      persistentKeepalive: gateway.persistentKeepalive || 25,
      tenantId: gateway.tenantId,
    });
    setGatewayDialogOpen(true);
  };

  const openEditTunnel = (tunnel: VpnTunnel) => {
    setEditingTunnel(tunnel);
    setTunnelForm({
      gatewayId: tunnel.gatewayId,
      oltId: tunnel.oltId || "",
      name: tunnel.name,
      description: tunnel.description || "",
      peerPublicKey: tunnel.peerPublicKey || "",
      peerEndpoint: tunnel.peerEndpoint || "",
      peerPort: tunnel.peerPort || 51820,
      localAddress: tunnel.localAddress || "",
      allowedIps: tunnel.allowedIps || "0.0.0.0/0",
      preSharedKey: tunnel.preSharedKey || "",
    });
    setTunnelDialogOpen(true);
  };

  const handleGatewaySubmit = () => {
    if (editingGateway) {
      updateGatewayMutation.mutate({ id: editingGateway.id, data: gatewayForm });
    } else {
      createGatewayMutation.mutate(gatewayForm);
    }
  };

  const handleTunnelSubmit = () => {
    if (editingTunnel) {
      updateTunnelMutation.mutate({ id: editingTunnel.id, data: tunnelForm });
    } else {
      createTunnelMutation.mutate(tunnelForm);
    }
  };

  const downloadConfig = async (tunnelId: string, tunnelName: string) => {
    try {
      const response = await fetch(`/api/vpn/tunnels/${tunnelId}/config`);
      if (!response.ok) throw new Error("Failed to download config");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${tunnelName}.conf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({
        title: "Config Downloaded",
        description: "WireGuard configuration file has been downloaded",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to download configuration",
        variant: "destructive",
      });
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: `${label} copied to clipboard`,
    });
  };

  const filteredGateways = gateways?.filter(
    (g) =>
      g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.endpoint?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTunnels = tunnels?.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.peerEndpoint?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "connected":
        return <Badge variant="default" className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Connected</Badge>;
      case "connecting":
        return <Badge variant="secondary"><RefreshCw className="h-3 w-3 mr-1 animate-spin" />Connecting</Badge>;
      case "error":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Error</Badge>;
      default:
        return <Badge variant="outline"><XCircle className="h-3 w-3 mr-1" />Disconnected</Badge>;
    }
  };

  const getVpnTypeBadge = (type: string | null) => {
    switch (type) {
      case "wireguard":
        return <Badge variant="secondary">WireGuard</Badge>;
      case "openvpn":
        return <Badge variant="secondary">OpenVPN</Badge>;
      case "ipsec":
        return <Badge variant="secondary">IPsec</Badge>;
      case "ssh_tunnel":
        return <Badge variant="secondary">SSH Tunnel</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getGatewayName = (gatewayId: string) => {
    const gateway = gateways?.find((g) => g.id === gatewayId);
    return gateway?.name || "Unknown Gateway";
  };

  const getOltName = (oltId: string | null) => {
    if (!oltId) return "Not assigned";
    const olt = olts?.find((o) => o.id === oltId);
    return olt?.name || "Unknown OLT";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-page-title">VPN Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage VPN gateways and tunnels for secure OLT connectivity
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Gateways</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-gateways">{gateways?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              {gateways?.filter((g) => g.status === "connected").length || 0} connected
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Tunnels</CardTitle>
            <Network className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-tunnels">
              {tunnels?.filter((t) => t.status === "connected").length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              of {tunnels?.length || 0} total tunnels
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">VPN Type</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-vpn-type">WireGuard</div>
            <p className="text-xs text-muted-foreground">
              Configuration management mode
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabsList>
            <TabsTrigger value="gateways" data-testid="tab-gateways">
              <Server className="h-4 w-4 mr-2" />
              Gateways
            </TabsTrigger>
            <TabsTrigger value="tunnels" data-testid="tab-tunnels">
              <Network className="h-4 w-4 mr-2" />
              Tunnels
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                className="pl-8 w-[200px]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search"
              />
            </div>
            {activeTab === "gateways" ? (
              <Dialog open={gatewayDialogOpen} onOpenChange={(open) => {
                setGatewayDialogOpen(open);
                if (!open) {
                  setEditingGateway(null);
                  resetGatewayForm();
                }
              }}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-gateway">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Gateway
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingGateway ? "Edit Gateway" : "Add VPN Gateway"}</DialogTitle>
                    <DialogDescription>
                      Configure a WireGuard VPN gateway for secure OLT connectivity
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="gateway-name">Name</Label>
                        <Input
                          id="gateway-name"
                          placeholder="Primary Gateway"
                          value={gatewayForm.name}
                          onChange={(e) => setGatewayForm({ ...gatewayForm, name: e.target.value })}
                          data-testid="input-gateway-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="gateway-type">VPN Type</Label>
                        <Select
                          value={gatewayForm.vpnType}
                          onValueChange={(value: typeof gatewayForm.vpnType) => setGatewayForm({ ...gatewayForm, vpnType: value })}
                        >
                          <SelectTrigger data-testid="select-vpn-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="wireguard">WireGuard</SelectItem>
                            <SelectItem value="openvpn">OpenVPN</SelectItem>
                            <SelectItem value="ipsec">IPsec</SelectItem>
                            <SelectItem value="ssh_tunnel">SSH Tunnel</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gateway-description">Description</Label>
                      <Textarea
                        id="gateway-description"
                        placeholder="Gateway description..."
                        value={gatewayForm.description}
                        onChange={(e) => setGatewayForm({ ...gatewayForm, description: e.target.value })}
                        data-testid="input-gateway-description"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="gateway-endpoint">Endpoint</Label>
                        <Input
                          id="gateway-endpoint"
                          placeholder="vpn.example.com"
                          value={gatewayForm.endpoint}
                          onChange={(e) => setGatewayForm({ ...gatewayForm, endpoint: e.target.value })}
                          data-testid="input-gateway-endpoint"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="gateway-port">Port</Label>
                        <Input
                          id="gateway-port"
                          type="number"
                          placeholder="51820"
                          value={gatewayForm.port}
                          onChange={(e) => setGatewayForm({ ...gatewayForm, port: parseInt(e.target.value) || 51820 })}
                          data-testid="input-gateway-port"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gateway-public-key">Public Key</Label>
                      <Input
                        id="gateway-public-key"
                        placeholder="Base64 encoded public key"
                        value={gatewayForm.publicKey}
                        onChange={(e) => setGatewayForm({ ...gatewayForm, publicKey: e.target.value })}
                        data-testid="input-gateway-public-key"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gateway-private-key">Private Key</Label>
                      <Input
                        id="gateway-private-key"
                        type="password"
                        placeholder="Base64 encoded private key"
                        value={gatewayForm.privateKey}
                        onChange={(e) => setGatewayForm({ ...gatewayForm, privateKey: e.target.value })}
                        data-testid="input-gateway-private-key"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="gateway-dns">DNS</Label>
                        <Input
                          id="gateway-dns"
                          placeholder="1.1.1.1"
                          value={gatewayForm.dns}
                          onChange={(e) => setGatewayForm({ ...gatewayForm, dns: e.target.value })}
                          data-testid="input-gateway-dns"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="gateway-mtu">MTU</Label>
                        <Input
                          id="gateway-mtu"
                          type="number"
                          placeholder="1420"
                          value={gatewayForm.mtu}
                          onChange={(e) => setGatewayForm({ ...gatewayForm, mtu: parseInt(e.target.value) || 1420 })}
                          data-testid="input-gateway-mtu"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="gateway-keepalive">Keepalive (s)</Label>
                        <Input
                          id="gateway-keepalive"
                          type="number"
                          placeholder="25"
                          value={gatewayForm.persistentKeepalive}
                          onChange={(e) => setGatewayForm({ ...gatewayForm, persistentKeepalive: parseInt(e.target.value) || 25 })}
                          data-testid="input-gateway-keepalive"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gateway-allowed-ips">Allowed IPs</Label>
                      <Input
                        id="gateway-allowed-ips"
                        placeholder="0.0.0.0/0"
                        value={gatewayForm.allowedIps}
                        onChange={(e) => setGatewayForm({ ...gatewayForm, allowedIps: e.target.value })}
                        data-testid="input-gateway-allowed-ips"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setGatewayDialogOpen(false);
                        setEditingGateway(null);
                        resetGatewayForm();
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleGatewaySubmit}
                      disabled={createGatewayMutation.isPending || updateGatewayMutation.isPending || !gatewayForm.name}
                      data-testid="button-save-gateway"
                    >
                      {(createGatewayMutation.isPending || updateGatewayMutation.isPending) && (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      {editingGateway ? "Update" : "Create"} Gateway
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ) : (
              <Dialog open={tunnelDialogOpen} onOpenChange={(open) => {
                setTunnelDialogOpen(open);
                if (!open) {
                  setEditingTunnel(null);
                  resetTunnelForm();
                }
              }}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-tunnel" disabled={!gateways?.length}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Tunnel
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingTunnel ? "Edit Tunnel" : "Add VPN Tunnel"}</DialogTitle>
                    <DialogDescription>
                      Configure a tunnel to connect to a remote OLT
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="tunnel-name">Name</Label>
                        <Input
                          id="tunnel-name"
                          placeholder="OLT-Site-A Tunnel"
                          value={tunnelForm.name}
                          onChange={(e) => setTunnelForm({ ...tunnelForm, name: e.target.value })}
                          data-testid="input-tunnel-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="tunnel-gateway">Gateway</Label>
                        <Select
                          value={tunnelForm.gatewayId}
                          onValueChange={(value) => setTunnelForm({ ...tunnelForm, gatewayId: value })}
                        >
                          <SelectTrigger data-testid="select-tunnel-gateway">
                            <SelectValue placeholder="Select gateway" />
                          </SelectTrigger>
                          <SelectContent>
                            {gateways?.map((g) => (
                              <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tunnel-olt">Link to OLT (Optional)</Label>
                      <Select
                        value={tunnelForm.oltId}
                        onValueChange={(value) => setTunnelForm({ ...tunnelForm, oltId: value })}
                      >
                        <SelectTrigger data-testid="select-tunnel-olt">
                          <SelectValue placeholder="Select OLT (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          {olts?.map((o) => (
                            <SelectItem key={o.id} value={o.id}>{o.name} ({o.ipAddress})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tunnel-description">Description</Label>
                      <Textarea
                        id="tunnel-description"
                        placeholder="Tunnel description..."
                        value={tunnelForm.description}
                        onChange={(e) => setTunnelForm({ ...tunnelForm, description: e.target.value })}
                        data-testid="input-tunnel-description"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="tunnel-peer-endpoint">Peer Endpoint</Label>
                        <Input
                          id="tunnel-peer-endpoint"
                          placeholder="192.168.1.1"
                          value={tunnelForm.peerEndpoint}
                          onChange={(e) => setTunnelForm({ ...tunnelForm, peerEndpoint: e.target.value })}
                          data-testid="input-tunnel-peer-endpoint"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="tunnel-peer-port">Peer Port</Label>
                        <Input
                          id="tunnel-peer-port"
                          type="number"
                          placeholder="51820"
                          value={tunnelForm.peerPort}
                          onChange={(e) => setTunnelForm({ ...tunnelForm, peerPort: parseInt(e.target.value) || 51820 })}
                          data-testid="input-tunnel-peer-port"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tunnel-peer-public-key">Peer Public Key</Label>
                      <Input
                        id="tunnel-peer-public-key"
                        placeholder="Base64 encoded peer public key"
                        value={tunnelForm.peerPublicKey}
                        onChange={(e) => setTunnelForm({ ...tunnelForm, peerPublicKey: e.target.value })}
                        data-testid="input-tunnel-peer-public-key"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="tunnel-local-address">Local Address</Label>
                        <Input
                          id="tunnel-local-address"
                          placeholder="10.0.0.1/24"
                          value={tunnelForm.localAddress}
                          onChange={(e) => setTunnelForm({ ...tunnelForm, localAddress: e.target.value })}
                          data-testid="input-tunnel-local-address"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="tunnel-allowed-ips">Allowed IPs</Label>
                        <Input
                          id="tunnel-allowed-ips"
                          placeholder="0.0.0.0/0"
                          value={tunnelForm.allowedIps}
                          onChange={(e) => setTunnelForm({ ...tunnelForm, allowedIps: e.target.value })}
                          data-testid="input-tunnel-allowed-ips"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tunnel-psk">Pre-Shared Key (Optional)</Label>
                      <Input
                        id="tunnel-psk"
                        type="password"
                        placeholder="Optional pre-shared key"
                        value={tunnelForm.preSharedKey}
                        onChange={(e) => setTunnelForm({ ...tunnelForm, preSharedKey: e.target.value })}
                        data-testid="input-tunnel-psk"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setTunnelDialogOpen(false);
                        setEditingTunnel(null);
                        resetTunnelForm();
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleTunnelSubmit}
                      disabled={createTunnelMutation.isPending || updateTunnelMutation.isPending || !tunnelForm.name || !tunnelForm.gatewayId}
                      data-testid="button-save-tunnel"
                    >
                      {(createTunnelMutation.isPending || updateTunnelMutation.isPending) && (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      {editingTunnel ? "Update" : "Create"} Tunnel
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        <TabsContent value="gateways" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              {gatewaysLoading ? (
                <TableSkeleton />
              ) : !filteredGateways?.length ? (
                <EmptyState
                  icon={<Server className="h-8 w-8" />}
                  title="No VPN Gateways"
                  description="Create your first VPN gateway to establish secure connections to remote OLTs."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Endpoint</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Public Key</TableHead>
                      <TableHead>Tunnels</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredGateways.map((gateway) => (
                      <TableRow key={gateway.id} data-testid={`row-gateway-${gateway.id}`}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{gateway.name}</span>
                            {gateway.description && (
                              <span className="text-xs text-muted-foreground">{gateway.description}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getVpnTypeBadge(gateway.vpnType)}</TableCell>
                        <TableCell>
                          {gateway.endpoint ? (
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                              {gateway.endpoint}:{gateway.port}
                            </code>
                          ) : (
                            <span className="text-muted-foreground">Not set</span>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(gateway.status)}</TableCell>
                        <TableCell>
                          {gateway.publicKey ? (
                            <div className="flex items-center gap-1">
                              <code className="text-xs bg-muted px-1.5 py-0.5 rounded truncate max-w-[120px]">
                                {gateway.publicKey.substring(0, 20)}...
                              </code>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => copyToClipboard(gateway.publicKey!, "Public key")}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Not set</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {tunnels?.filter((t) => t.gatewayId === gateway.id).length || 0}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" data-testid={`button-gateway-menu-${gateway.id}`}>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditGateway(gateway)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              {gateway.publicKey && (
                                <DropdownMenuItem onClick={() => copyToClipboard(gateway.publicKey!, "Public key")}>
                                  <Key className="h-4 w-4 mr-2" />
                                  Copy Public Key
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => {
                                  setGatewayToDelete(gateway);
                                  setDeleteGatewayDialogOpen(true);
                                }}
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
        </TabsContent>

        <TabsContent value="tunnels" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              {tunnelsLoading ? (
                <TableSkeleton />
              ) : !filteredTunnels?.length ? (
                <EmptyState
                  icon={<Network className="h-8 w-8" />}
                  title="No VPN Tunnels"
                  description="Create tunnels to connect to your remote OLT devices securely."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Gateway</TableHead>
                      <TableHead>Peer Endpoint</TableHead>
                      <TableHead>Local Address</TableHead>
                      <TableHead>Linked OLT</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTunnels.map((tunnel) => (
                      <TableRow key={tunnel.id} data-testid={`row-tunnel-${tunnel.id}`}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{tunnel.name}</span>
                            {tunnel.description && (
                              <span className="text-xs text-muted-foreground">{tunnel.description}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{getGatewayName(tunnel.gatewayId)}</Badge>
                        </TableCell>
                        <TableCell>
                          {tunnel.peerEndpoint ? (
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                              {tunnel.peerEndpoint}:{tunnel.peerPort}
                            </code>
                          ) : (
                            <span className="text-muted-foreground">Not set</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {tunnel.localAddress ? (
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                              {tunnel.localAddress}
                            </code>
                          ) : (
                            <span className="text-muted-foreground">Not set</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {tunnel.oltId ? (
                            <div className="flex items-center gap-1">
                              <Link2 className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm">{getOltName(tunnel.oltId)}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Not linked</span>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(tunnel.status)}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" data-testid={`button-tunnel-menu-${tunnel.id}`}>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditTunnel(tunnel)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => downloadConfig(tunnel.id, tunnel.name)}>
                                <Download className="h-4 w-4 mr-2" />
                                Download Config
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => {
                                  setTunnelToDelete(tunnel);
                                  setDeleteTunnelDialogOpen(true);
                                }}
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
        </TabsContent>
      </Tabs>

      <AlertDialog open={deleteGatewayDialogOpen} onOpenChange={setDeleteGatewayDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete VPN Gateway</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{gatewayToDelete?.name}"? This will also delete all associated tunnels. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setGatewayToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => gatewayToDelete && deleteGatewayMutation.mutate(gatewayToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-gateway"
            >
              {deleteGatewayMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteTunnelDialogOpen} onOpenChange={setDeleteTunnelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete VPN Tunnel</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{tunnelToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTunnelToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => tunnelToDelete && deleteTunnelMutation.mutate(tunnelToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-tunnel"
            >
              {deleteTunnelMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
