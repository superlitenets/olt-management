import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableSkeleton } from "@/components/loading-skeleton";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import {
  Search,
  MoreVertical,
  Plus,
  Router,
  Trash2,
  Edit,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  Cpu,
  HardDrive,
  Download,
  FileCode,
} from "lucide-react";
import type { MikrotikDevice, VpnProfile } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

export default function MikrotikPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [deviceDialogOpen, setDeviceDialogOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<MikrotikDevice | null>(null);
  const [deleteDeviceDialogOpen, setDeleteDeviceDialogOpen] = useState(false);
  const [deviceToDelete, setDeviceToDelete] = useState<MikrotikDevice | null>(null);
  const { toast } = useToast();

  const [deviceForm, setDeviceForm] = useState({
    name: "",
    description: "",
    ipAddress: "",
    apiPort: 8728,
    useTls: false,
    username: "",
    password: "",
    siteName: "",
    siteAddress: "",
    vpnProfileId: "",
    vpnTunnelIp: "",
  });

  const { data: devices, isLoading: devicesLoading } = useQuery<MikrotikDevice[]>({
    queryKey: ["/api/mikrotik/devices"],
  });

  const { data: vpnProfiles } = useQuery<VpnProfile[]>({
    queryKey: ["/api/vpn/profiles"],
  });

  const createDeviceMutation = useMutation({
    mutationFn: async (data: typeof deviceForm) => {
      const submitData = {
        ...data,
        vpnProfileId: data.vpnProfileId || null,
      };
      return apiRequest("POST", "/api/mikrotik/devices", submitData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mikrotik/devices"] });
      setDeviceDialogOpen(false);
      resetDeviceForm();
      toast({
        title: "Device Created",
        description: "Mikrotik device has been added successfully",
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
        description: "Failed to create device",
        variant: "destructive",
      });
    },
  });

  const updateDeviceMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof deviceForm> }) => {
      const submitData = {
        ...data,
        vpnProfileId: data.vpnProfileId || null,
      };
      return apiRequest("PATCH", `/api/mikrotik/devices/${id}`, submitData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mikrotik/devices"] });
      setDeviceDialogOpen(false);
      setEditingDevice(null);
      resetDeviceForm();
      toast({
        title: "Device Updated",
        description: "Mikrotik device has been updated successfully",
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
        description: "Failed to update device",
        variant: "destructive",
      });
    },
  });

  const deleteDeviceMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/mikrotik/devices/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mikrotik/devices"] });
      setDeleteDeviceDialogOpen(false);
      setDeviceToDelete(null);
      toast({
        title: "Device Deleted",
        description: "Mikrotik device has been removed",
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
        description: "Failed to delete device",
        variant: "destructive",
      });
    },
  });

  const resetDeviceForm = () => {
    setDeviceForm({
      name: "",
      description: "",
      ipAddress: "",
      apiPort: 8728,
      useTls: false,
      username: "",
      password: "",
      siteName: "",
      siteAddress: "",
      vpnProfileId: "",
      vpnTunnelIp: "",
    });
  };

  const openEditDevice = (device: MikrotikDevice) => {
    setEditingDevice(device);
    setDeviceForm({
      name: device.name,
      description: device.description || "",
      ipAddress: device.ipAddress,
      apiPort: device.apiPort || 8728,
      useTls: device.useTls || false,
      username: device.username || "",
      password: device.password || "",
      siteName: device.siteName || "",
      siteAddress: device.siteAddress || "",
      vpnProfileId: device.vpnProfileId || "",
      vpnTunnelIp: device.vpnTunnelIp || "",
    });
    setDeviceDialogOpen(true);
  };

  const handleDeviceSubmit = () => {
    if (editingDevice) {
      updateDeviceMutation.mutate({ id: editingDevice.id, data: deviceForm });
    } else {
      createDeviceMutation.mutate(deviceForm);
    }
  };

  const filteredDevices = devices?.filter(
    (d) =>
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.ipAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.siteName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const onlineDevices = devices?.filter((d) => d.status === "online").length || 0;
  const offlineDevices = devices?.filter((d) => d.status === "offline").length || 0;

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "online":
        return (
          <Badge variant="default" className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Online
          </Badge>
        );
      case "offline":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Offline
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Unknown
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-page-title">Mikrotik Devices</h1>
          <p className="text-sm text-muted-foreground">
            Manage Mikrotik routers as VPN gateways for OLT connectivity
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingDevice(null);
            resetDeviceForm();
            setDeviceDialogOpen(true);
          }}
          data-testid="button-add-device"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Mikrotik
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
            <Router className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-devices">{devices?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Mikrotik routers</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Online</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-online-devices">{onlineDevices}</div>
            <p className="text-xs text-muted-foreground">Connected devices</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Offline</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive" data-testid="text-offline-devices">{offlineDevices}</div>
            <p className="text-xs text-muted-foreground">Disconnected devices</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">VPN Profiles</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-vpn-profiles">{vpnProfiles?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Available for assignment</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle>Mikrotik Routers</CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search devices..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
                data-testid="input-search-devices"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {devicesLoading ? (
            <TableSkeleton rows={5} />
          ) : !filteredDevices?.length ? (
            <EmptyState
              icon={<Router className="h-8 w-8" />}
              title="No Mikrotik Devices"
              description="Add a Mikrotik router to use as a VPN gateway for OLT connectivity"
              action={{
                label: "Add Mikrotik",
                onClick: () => {
                  setEditingDevice(null);
                  resetDeviceForm();
                  setDeviceDialogOpen(true);
                },
              }}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Last Seen</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDevices.map((device) => (
                  <TableRow key={device.id} data-testid={`row-device-${device.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Router className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <span className="font-medium">{device.name}</span>
                          {device.description && (
                            <p className="text-xs text-muted-foreground">{device.description}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {device.vpnTunnelIp || device.ipAddress}
                      {device.vpnTunnelIp && (
                        <p className="text-xs text-muted-foreground">VPN: {device.ipAddress}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      {device.siteName ? (
                        <div>
                          <span>{device.siteName}</span>
                          {device.siteAddress && (
                            <p className="text-xs text-muted-foreground">{device.siteAddress}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(device.status)}</TableCell>
                    <TableCell>
                      {device.routerModel ? (
                        <div className="flex items-center gap-1">
                          <Cpu className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{device.routerModel}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {device.lastSeen
                        ? formatDistanceToNow(new Date(device.lastSeen), { addSuffix: true })
                        : "Never"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`button-device-menu-${device.id}`}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => window.open(`/api/mikrotik/devices/${device.id}/onboarding-script`, "_blank")}
                            data-testid={`button-download-script-${device.id}`}
                          >
                            <FileCode className="h-4 w-4 mr-2" />
                            Download Onboarding Script
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => openEditDevice(device)}
                            data-testid={`button-edit-device-${device.id}`}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setDeviceToDelete(device);
                              setDeleteDeviceDialogOpen(true);
                            }}
                            className="text-destructive"
                            data-testid={`button-delete-device-${device.id}`}
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
        open={deviceDialogOpen}
        onOpenChange={(open) => {
          setDeviceDialogOpen(open);
          if (!open) {
            setEditingDevice(null);
            resetDeviceForm();
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingDevice ? "Edit Mikrotik Device" : "Add Mikrotik Device"}</DialogTitle>
            <DialogDescription>
              {editingDevice
                ? "Update the Mikrotik router configuration"
                : "Add a new Mikrotik router as VPN gateway"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="device-name">Device Name</Label>
                <Input
                  id="device-name"
                  value={deviceForm.name}
                  onChange={(e) => setDeviceForm({ ...deviceForm, name: e.target.value })}
                  placeholder="e.g., Site A Router"
                  data-testid="input-device-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="device-description">Description</Label>
                <Input
                  id="device-description"
                  value={deviceForm.description}
                  onChange={(e) => setDeviceForm({ ...deviceForm, description: e.target.value })}
                  placeholder="Optional description"
                  data-testid="input-device-description"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="device-ip">IP Address</Label>
                <Input
                  id="device-ip"
                  value={deviceForm.ipAddress}
                  onChange={(e) => setDeviceForm({ ...deviceForm, ipAddress: e.target.value })}
                  placeholder="192.168.1.1"
                  data-testid="input-device-ip"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="device-port">API Port</Label>
                <Input
                  id="device-port"
                  type="number"
                  value={deviceForm.apiPort}
                  onChange={(e) => setDeviceForm({ ...deviceForm, apiPort: parseInt(e.target.value) || 8728 })}
                  placeholder="8728"
                  data-testid="input-device-port"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="use-tls"
                checked={deviceForm.useTls}
                onCheckedChange={(checked) => setDeviceForm({ ...deviceForm, useTls: checked })}
                data-testid="switch-use-tls"
              />
              <Label htmlFor="use-tls">Use TLS (port 8729)</Label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="device-username">API Username</Label>
                <Input
                  id="device-username"
                  value={deviceForm.username}
                  onChange={(e) => setDeviceForm({ ...deviceForm, username: e.target.value })}
                  placeholder="admin"
                  data-testid="input-device-username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="device-password">API Password</Label>
                <Input
                  id="device-password"
                  type="password"
                  value={deviceForm.password}
                  onChange={(e) => setDeviceForm({ ...deviceForm, password: e.target.value })}
                  placeholder="Password"
                  data-testid="input-device-password"
                />
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-3">Site Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="site-name">Site Name</Label>
                  <Input
                    id="site-name"
                    value={deviceForm.siteName}
                    onChange={(e) => setDeviceForm({ ...deviceForm, siteName: e.target.value })}
                    placeholder="e.g., Main Office"
                    data-testid="input-site-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="site-address">Site Address</Label>
                  <Input
                    id="site-address"
                    value={deviceForm.siteAddress}
                    onChange={(e) => setDeviceForm({ ...deviceForm, siteAddress: e.target.value })}
                    placeholder="123 Main St, City"
                    data-testid="input-site-address"
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-3">VPN Configuration</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="vpn-profile">VPN Profile</Label>
                  <Select
                    value={deviceForm.vpnProfileId}
                    onValueChange={(value) => setDeviceForm({ ...deviceForm, vpnProfileId: value })}
                  >
                    <SelectTrigger data-testid="select-vpn-profile">
                      <SelectValue placeholder="Select VPN profile" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {vpnProfiles?.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vpn-tunnel-ip">VPN Tunnel IP</Label>
                  <Input
                    id="vpn-tunnel-ip"
                    value={deviceForm.vpnTunnelIp}
                    onChange={(e) => setDeviceForm({ ...deviceForm, vpnTunnelIp: e.target.value })}
                    placeholder="10.8.0.2"
                    data-testid="input-vpn-tunnel-ip"
                  />
                  <p className="text-xs text-muted-foreground">
                    The IP address assigned to this device in the VPN tunnel
                  </p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeviceDialogOpen(false);
                setEditingDevice(null);
                resetDeviceForm();
              }}
              data-testid="button-cancel-device"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeviceSubmit}
              disabled={
                !deviceForm.name ||
                !deviceForm.ipAddress ||
                createDeviceMutation.isPending ||
                updateDeviceMutation.isPending
              }
              data-testid="button-save-device"
            >
              {createDeviceMutation.isPending || updateDeviceMutation.isPending
                ? "Saving..."
                : editingDevice
                ? "Update Device"
                : "Add Device"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDeviceDialogOpen} onOpenChange={setDeleteDeviceDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Mikrotik Device</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deviceToDelete?.name}"? This will remove the device
              and any OLTs associated with it will need to be updated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deviceToDelete && deleteDeviceMutation.mutate(deviceToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteDeviceMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
