import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/status-badge";
import { SignalIndicator } from "@/components/signal-indicator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import {
  ArrowLeft,
  Radio,
  Activity,
  Settings,
  Wifi,
  Phone,
  Network,
  RotateCcw,
  Zap,
  Download,
  Power,
  Link2,
  FileText,
  History,
  Eye,
  CheckCircle,
  AlertCircle,
  WifiOff,
  Clock,
  List,
  Edit2,
  Save,
  X,
} from "lucide-react";
import type { Onu, Olt, ServiceProfile, Tr069Device, OnuEvent } from "@shared/schema";

export default function OnuDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [wifiDialogOpen, setWifiDialogOpen] = useState(false);
  const [voipDialogOpen, setVoipDialogOpen] = useState(false);
  const [vlanDialogOpen, setVlanDialogOpen] = useState(false);
  const [parametersDialogOpen, setParametersDialogOpen] = useState(false);
  const [wifiBandTab, setWifiBandTab] = useState<"2.4ghz" | "5ghz">("2.4ghz");

  const [wifiConfig, setWifiConfig] = useState({
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

  const [voipConfig, setVoipConfig] = useState({
    sipServer: "",
    sipPort: "5060",
    username: "",
    password: "",
    displayName: "",
    lineNumber: "1",
    enabled: true,
  });

  const [wanConfig, setWanConfig] = useState({
    wanMode: "route" as "route" | "bridge",
    connectionType: "DHCP" as "DHCP" | "Static" | "PPPoE",
    ipAddress: "",
    subnetMask: "255.255.255.0",
    gateway: "",
    primaryDns: "",
    secondaryDns: "",
    pppoeUsername: "",
    pppoePassword: "",
    pppoeServiceName: "",
    mtu: "1500",
    natEnabled: true,
    enabled: true,
  });

  const [layer2Config, setLayer2Config] = useState({
    vlanId: "",
    vlanPriority: "0",
    vlanTagMode: "tagged" as "tagged" | "untagged",
    bridgeMode: "disabled" as "disabled" | "enabled",
    bridgeVlanId: "",
    serviceType: "internet" as "internet" | "voip" | "iptv" | "management",
    enabled: true,
  });

  const [wanDialogTab, setWanDialogTab] = useState<"wan" | "layer2">("wan");

  const [parametersFilter, setParametersFilter] = useState("");
  const [editingParameter, setEditingParameter] = useState<{ path: string; value: string; type?: string } | null>(null);
  const [newParameterValue, setNewParameterValue] = useState("");
  const [newParameterType, setNewParameterType] = useState<string>("xsd:string");
  const [fetchingParams, setFetchingParams] = useState(false);

  const { data: onu, isLoading: onuLoading } = useQuery<Onu>({
    queryKey: ["/api/onus", id],
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
    queryKey: id ? [`/api/onus/${id}/tr069`] : ["/api/onus/tr069-placeholder"],
    enabled: !!id,
  });

  const { data: onuEvents, isLoading: eventsLoading } = useQuery<OnuEvent[]>({
    queryKey: id ? ["/api/onus", id, "events"] : ["/api/onus/events-placeholder"],
    enabled: !!id,
  });

  const { data: tr069Parameters } = useQuery<any[]>({
    queryKey: linkedTr069Device ? ["/api/tr069/devices", linkedTr069Device.id, "parameters"] : ["/api/tr069/parameters-placeholder"],
    enabled: !!linkedTr069Device,
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onus", id, "tr069", "tasks"] });
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

  const factoryResetMutation = useMutation({
    mutationFn: async (onuId: string) => {
      return apiRequest("POST", `/api/onus/${onuId}/tr069/tasks`, {
        taskType: "factory_reset",
        parameters: {}
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onus", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/onus", id, "tr069", "tasks"] });
      toast({
        title: "Factory Reset Queued",
        description: "TR-069 factory reset task has been scheduled",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Factory Reset Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const rebootOnuMutation = useMutation({
    mutationFn: async (onuId: string) => {
      return apiRequest("POST", `/api/onus/${onuId}/tr069/tasks`, {
        taskType: "reboot",
        parameters: {}
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onus", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/onus", id, "tr069", "tasks"] });
      toast({
        title: "Reboot Queued",
        description: "TR-069 reboot task has been scheduled",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Reboot Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const pollOnuMutation = useMutation({
    mutationFn: async (onuId: string) => {
      return apiRequest("POST", `/api/onus/${onuId}/poll`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onus", id] });
      toast({
        title: "Power Levels Updated",
        description: "ONU optical levels have been refreshed",
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

  const handleWifiSubmit = () => {
    if (!id) return;
    const parameterValues: { name: string; value: string; type?: string }[] = [];

    if (wifiConfig.ssid_2g) {
      parameterValues.push(
        { name: "Device.WiFi.SSID.1.SSID", value: wifiConfig.ssid_2g },
        { name: "Device.WiFi.SSID.1.Enable", value: wifiConfig.enabled_2g ? "1" : "0" },
        { name: "Device.WiFi.AccessPoint.1.Security.ModeEnabled", value: wifiConfig.securityMode_2g },
        { name: "Device.WiFi.AccessPoint.1.Security.KeyPassphrase", value: wifiConfig.password_2g },
        { name: "Device.WiFi.Radio.1.Channel", value: wifiConfig.channel_2g === "auto" ? "0" : wifiConfig.channel_2g },
        { name: "Device.WiFi.Radio.1.OperatingChannelBandwidth", value: wifiConfig.bandwidth_2g }
      );
    }

    if (wifiConfig.ssid_5g) {
      parameterValues.push(
        { name: "Device.WiFi.SSID.2.SSID", value: wifiConfig.ssid_5g },
        { name: "Device.WiFi.SSID.2.Enable", value: wifiConfig.enabled_5g ? "1" : "0" },
        { name: "Device.WiFi.AccessPoint.2.Security.ModeEnabled", value: wifiConfig.securityMode_5g },
        { name: "Device.WiFi.AccessPoint.2.Security.KeyPassphrase", value: wifiConfig.password_5g },
        { name: "Device.WiFi.Radio.2.Channel", value: wifiConfig.channel_5g === "auto" ? "0" : wifiConfig.channel_5g },
        { name: "Device.WiFi.Radio.2.OperatingChannelBandwidth", value: wifiConfig.bandwidth_5g }
      );
    }

    if (wifiConfig.enabled_guest && wifiConfig.ssid_guest) {
      parameterValues.push(
        { name: "Device.WiFi.SSID.3.SSID", value: wifiConfig.ssid_guest },
        { name: "Device.WiFi.SSID.3.Enable", value: "1" },
        { name: "Device.WiFi.AccessPoint.3.Security.KeyPassphrase", value: wifiConfig.password_guest },
        { name: "Device.WiFi.AccessPoint.3.IsolationEnable", value: wifiConfig.guestIsolation ? "1" : "0" }
      );
    }

    if (parameterValues.length > 0) {
      createTr069TaskMutation.mutate({
        onuId: id,
        taskType: "set_parameter_values",
        parameters: { parameterValues },
      });
    }
    setWifiDialogOpen(false);
  };

  const handleVoipSubmit = () => {
    if (!id || !voipConfig.sipServer) return;
    const lineNum = voipConfig.lineNumber;
    createTr069TaskMutation.mutate({
      onuId: id,
      taskType: "set_parameter_values",
      parameters: {
        parameterValues: [
          { name: `Device.Services.VoiceService.1.VoiceProfile.1.Enable`, value: voipConfig.enabled ? "Enabled" : "Disabled" },
          { name: `Device.Services.VoiceService.1.VoiceProfile.1.SIP.ProxyServer`, value: voipConfig.sipServer },
          { name: `Device.Services.VoiceService.1.VoiceProfile.1.SIP.ProxyServerPort`, value: voipConfig.sipPort },
          { name: `Device.Services.VoiceService.1.VoiceProfile.1.Line.${lineNum}.SIP.AuthUserName`, value: voipConfig.username },
          { name: `Device.Services.VoiceService.1.VoiceProfile.1.Line.${lineNum}.SIP.AuthPassword`, value: voipConfig.password },
          { name: `Device.Services.VoiceService.1.VoiceProfile.1.Line.${lineNum}.CallingFeatures.CallerIDName`, value: voipConfig.displayName },
          { name: `Device.Services.VoiceService.1.VoiceProfile.1.Line.${lineNum}.Enable`, value: "Enabled" },
        ],
      },
    });
    setVoipDialogOpen(false);
  };

  const handleWanSubmit = () => {
    if (!id) return;
    const parameterValues: { name: string; value: string }[] = [];

    parameterValues.push(
      { name: "Device.IP.Interface.1.Enable", value: wanConfig.enabled ? "1" : "0" },
      { name: "Device.Ethernet.Interface.1.MaxMTUSize", value: wanConfig.mtu }
    );

    if (wanConfig.wanMode === "route") {
      parameterValues.push(
        { name: "Device.NAT.InterfaceSetting.1.Enable", value: wanConfig.natEnabled ? "1" : "0" }
      );

      if (wanConfig.connectionType === "DHCP") {
        parameterValues.push(
          { name: "Device.IP.Interface.1.IPv4Address.1.AddressingType", value: "DHCP" },
          { name: "Device.DHCPv4.Client.1.Enable", value: "1" }
        );
      } else if (wanConfig.connectionType === "Static") {
        parameterValues.push(
          { name: "Device.IP.Interface.1.IPv4Address.1.AddressingType", value: "Static" },
          { name: "Device.DHCPv4.Client.1.Enable", value: "0" },
          { name: "Device.IP.Interface.1.IPv4Address.1.IPAddress", value: wanConfig.ipAddress },
          { name: "Device.IP.Interface.1.IPv4Address.1.SubnetMask", value: wanConfig.subnetMask },
          { name: "Device.Routing.Router.1.IPv4Forwarding.1.GatewayIPAddress", value: wanConfig.gateway }
        );
        if (wanConfig.primaryDns) {
          parameterValues.push({ name: "Device.DNS.Client.Server.1.DNSServer", value: wanConfig.primaryDns });
        }
        if (wanConfig.secondaryDns) {
          parameterValues.push({ name: "Device.DNS.Client.Server.2.DNSServer", value: wanConfig.secondaryDns });
        }
      } else if (wanConfig.connectionType === "PPPoE") {
        parameterValues.push(
          { name: "Device.PPP.Interface.1.Enable", value: "1" },
          { name: "Device.PPP.Interface.1.Username", value: wanConfig.pppoeUsername },
          { name: "Device.PPP.Interface.1.Password", value: wanConfig.pppoePassword },
          { name: "Device.PPP.Interface.1.ConnectionTrigger", value: "AlwaysOn" }
        );
        if (wanConfig.pppoeServiceName) {
          parameterValues.push({ name: "Device.PPP.Interface.1.ServiceName", value: wanConfig.pppoeServiceName });
        }
      }
    } else {
      parameterValues.push(
        { name: "Device.IP.Interface.1.IPv4Address.1.AddressingType", value: "Static" },
        { name: "Device.Bridging.Bridge.1.Enable", value: "1" },
        { name: "Device.NAT.InterfaceSetting.1.Enable", value: "0" }
      );
    }

    createTr069TaskMutation.mutate({
      onuId: id,
      taskType: "set_parameter_values",
      parameters: { parameterValues },
    });
    setVlanDialogOpen(false);
  };

  const handleLayer2Submit = () => {
    if (!id) return;
    const parameterValues: { name: string; value: string }[] = [];

    parameterValues.push(
      { name: "Device.Ethernet.Interface.1.Enable", value: layer2Config.enabled ? "1" : "0" }
    );

    if (layer2Config.vlanId) {
      parameterValues.push(
        { name: "Device.Ethernet.VLANTermination.1.VLANID", value: layer2Config.vlanId },
        { name: "Device.Ethernet.VLANTermination.1.Enable", value: "1" }
      );
      if (layer2Config.vlanTagMode === "tagged") {
        parameterValues.push({ name: "Device.Ethernet.VLANTermination.1.X_TagMode", value: "Tagged" });
      } else {
        parameterValues.push({ name: "Device.Ethernet.VLANTermination.1.X_TagMode", value: "Untagged" });
      }
      if (layer2Config.vlanPriority) {
        parameterValues.push({ name: "Device.Ethernet.VLANTermination.1.X_Priority", value: layer2Config.vlanPriority });
      }
    }

    if (layer2Config.bridgeMode === "enabled" && layer2Config.bridgeVlanId) {
      parameterValues.push(
        { name: "Device.Bridging.Bridge.1.Enable", value: "1" },
        { name: "Device.Bridging.Bridge.1.VLAN.1.VLANID", value: layer2Config.bridgeVlanId },
        { name: "Device.Bridging.Bridge.1.VLAN.1.Enable", value: "1" }
      );
    }

    createTr069TaskMutation.mutate({
      onuId: id,
      taskType: "set_parameter_values",
      parameters: { parameterValues },
    });
    setVlanDialogOpen(false);
  };

  const handleParameterEdit = () => {
    if (!id || !editingParameter) return;

    let valueToSend = newParameterValue;
    if (newParameterType === "xsd:boolean") {
      valueToSend = newParameterValue === "true" || newParameterValue === "1" ? "1" : "0";
    }

    createTr069TaskMutation.mutate({
      onuId: id,
      taskType: "set_parameter_values",
      parameters: {
        parameterValues: [
          { name: editingParameter.path, value: valueToSend, type: newParameterType },
        ],
      },
    });
    setEditingParameter(null);
    setNewParameterValue("");
    setNewParameterType("xsd:string");
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
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

  const getEventColor = (eventType: string) => {
    switch (eventType) {
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

  if (onuLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-32 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-48 bg-muted animate-pulse rounded" />
          <div className="h-48 bg-muted animate-pulse rounded" />
        </div>
      </div>
    );
  }

  if (!onu) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Radio className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">ONU Not Found</h2>
        <p className="text-muted-foreground">The requested ONU does not exist.</p>
        <Button onClick={() => navigate("/onus")} data-testid="button-back-to-onus">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to ONUs
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/onus")} data-testid="button-back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold font-mono">{onu.serialNumber}</h1>
            <StatusBadge status={onu.status || "offline"} />
          </div>
          <p className="text-sm text-muted-foreground">
            {onu.name || "No description"} | {getOltName(onu.oltId)} - Port {onu.ponPort || "-"} / ONU {onu.onuId || "-"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => pollOnuMutation.mutate(onu.id)}
            disabled={pollOnuMutation.isPending}
            data-testid="button-poll-onu"
          >
            <Activity className="h-4 w-4 mr-2" />
            {pollOnuMutation.isPending ? "Polling..." : "Poll"}
          </Button>
          <Button
            variant="outline"
            onClick={() => rebootOnuMutation.mutate(onu.id)}
            disabled={rebootOnuMutation.isPending}
            data-testid="button-reboot-onu"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reboot
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Device Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Serial Number
                  </label>
                  <p className="font-mono" data-testid="text-serial-number">{onu.serialNumber}</p>
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    MAC Address
                  </label>
                  <p className="font-mono">{onu.macAddress || "-"}</p>
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    IP Address
                  </label>
                  <p className="font-mono">{onu.ipAddress || "-"}</p>
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Uptime
                  </label>
                  <p>{formatUptime(onu.uptime)}</p>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="text-sm font-medium mb-3">Optical Levels</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      RX Power
                    </label>
                    <p className="font-mono text-lg">
                      {onu.rxPower?.toFixed(2) || "-"} <span className="text-sm text-muted-foreground">dBm</span>
                    </p>
                    <SignalIndicator rxPower={onu.rxPower} />
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      TX Power
                    </label>
                    <p className="font-mono text-lg">
                      {onu.txPower?.toFixed(2) || "-"} <span className="text-sm text-muted-foreground">dBm</span>
                    </p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Distance
                    </label>
                    <p className="font-mono text-lg">
                      {onu.distance?.toFixed(2) || "-"} <span className="text-sm text-muted-foreground">km</span>
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="text-sm font-medium mb-3">Network Configuration</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      IP Mode
                    </label>
                    <p>{onu.ipMode?.toUpperCase() || "DHCP"}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Mode
                    </label>
                    <p>{onu.mode?.toUpperCase() || "BRIDGE"}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Service Profile
                    </label>
                    <p>{getProfileName(onu.serviceProfileId)}</p>
                  </div>
                </div>
              </div>

              {onu.subscriberName && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-medium mb-3">Subscriber Info</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Name
                        </label>
                        <p>{onu.subscriberName}</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Phone
                        </label>
                        <p>{onu.subscriberPhone || "-"}</p>
                      </div>
                      {onu.subscriberAddress && (
                        <div className="col-span-2">
                          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Address
                          </label>
                          <p>{onu.subscriberAddress}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                TR-069/ACS Configuration
              </CardTitle>
              <CardDescription>
                Remote CPE management via CWMP
              </CardDescription>
            </CardHeader>
            <CardContent>
              {linkedTr069Device ? (
                <div className="space-y-4">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
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
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Button
                      variant="outline"
                      className="flex flex-col items-center gap-2 h-auto py-4"
                      onClick={() => setWifiDialogOpen(true)}
                      disabled={createTr069TaskMutation.isPending}
                      data-testid="button-configure-wifi"
                    >
                      <Wifi className="h-5 w-5" />
                      <span className="text-xs">WiFi</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="flex flex-col items-center gap-2 h-auto py-4"
                      onClick={() => setVoipDialogOpen(true)}
                      disabled={createTr069TaskMutation.isPending}
                      data-testid="button-configure-voip"
                    >
                      <Phone className="h-5 w-5" />
                      <span className="text-xs">VoIP</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="flex flex-col items-center gap-2 h-auto py-4"
                      onClick={() => setVlanDialogOpen(true)}
                      disabled={createTr069TaskMutation.isPending}
                      data-testid="button-configure-vlan"
                    >
                      <Network className="h-5 w-5" />
                      <span className="text-xs">WAN/VLAN</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="flex flex-col items-center gap-2 h-auto py-4"
                      onClick={() => setParametersDialogOpen(true)}
                      disabled={createTr069TaskMutation.isPending}
                      data-testid="button-view-parameters"
                    >
                      <List className="h-5 w-5" />
                      <span className="text-xs">Parameters</span>
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Button
                      variant="outline"
                      className="flex flex-col items-center gap-2 h-auto py-4"
                      onClick={() => createTr069TaskMutation.mutate({
                        onuId: onu.id,
                        taskType: "get_parameter_values",
                        parameters: { parameterNames: ["Device."] }
                      })}
                      disabled={createTr069TaskMutation.isPending}
                      data-testid="button-get-params"
                    >
                      <FileText className="h-5 w-5" />
                      <span className="text-xs">Get Params</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="flex flex-col items-center gap-2 h-auto py-4"
                      onClick={() => createTr069TaskMutation.mutate({
                        onuId: onu.id,
                        taskType: "reboot",
                        parameters: {}
                      })}
                      disabled={createTr069TaskMutation.isPending}
                      data-testid="button-tr069-reboot"
                    >
                      <RotateCcw className="h-5 w-5" />
                      <span className="text-xs">TR-069 Reboot</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="flex flex-col items-center gap-2 h-auto py-4"
                      onClick={() => {
                        if (confirm("Are you sure you want to factory reset this device? This will erase all configuration.")) {
                          createTr069TaskMutation.mutate({
                            onuId: onu.id,
                            taskType: "factory_reset",
                            parameters: {}
                          });
                        }
                      }}
                      disabled={createTr069TaskMutation.isPending}
                      data-testid="button-factory-reset"
                    >
                      <Zap className="h-5 w-5" />
                      <span className="text-xs">Factory Reset</span>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="p-4 bg-muted/50 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                    <Link2 className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h4 className="font-medium mb-2">No TR-069 Device Linked</h4>
                  <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
                    Link this ONU to a TR-069/ACS managed device to enable remote configuration.
                  </p>
                  {tr069Devices && tr069Devices.filter(d => !d.onuId).length > 0 ? (
                    <Select
                      onValueChange={(value) => linkTr069Mutation.mutate({
                        onuId: onu.id,
                        tr069DeviceId: value
                      })}
                      disabled={linkTr069Mutation.isPending}
                    >
                      <SelectTrigger className="w-64 mx-auto" data-testid="select-tr069-device">
                        <SelectValue placeholder="Select device to link..." />
                      </SelectTrigger>
                      <SelectContent>
                        {tr069Devices.filter(d => !d.onuId).map((device) => (
                          <SelectItem key={device.id} value={device.id}>
                            {device.deviceId} ({device.manufacturer})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No unlinked TR-069 devices available.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Event History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {eventsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-muted animate-pulse rounded-md" />
                  ))}
                </div>
              ) : onuEvents && onuEvents.length > 0 ? (
                <ScrollArea className="h-80">
                  <div className="space-y-2">
                    {onuEvents.map((event) => (
                      <div
                        key={event.id}
                        className={`p-3 rounded-md border ${getEventColor(event.eventType)}`}
                        data-testid={`event-${event.id}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">{getEventIcon(event.eventType)}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
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
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No events recorded</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={wifiDialogOpen} onOpenChange={setWifiDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wifi className="h-5 w-5" />
              WiFi Configuration
            </DialogTitle>
            <DialogDescription>
              Configure wireless network settings via TR-069
            </DialogDescription>
          </DialogHeader>
          <Tabs value={wifiBandTab} onValueChange={(v) => setWifiBandTab(v as "2.4ghz" | "5ghz")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="2.4ghz">2.4 GHz</TabsTrigger>
              <TabsTrigger value="5ghz">5 GHz</TabsTrigger>
            </TabsList>
            <TabsContent value="2.4ghz" className="space-y-4 mt-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="enabled_2g"
                  checked={wifiConfig.enabled_2g}
                  onCheckedChange={(checked) => setWifiConfig({ ...wifiConfig, enabled_2g: !!checked })}
                />
                <Label htmlFor="enabled_2g">Enable 2.4 GHz WiFi</Label>
              </div>
              <div className="space-y-2">
                <Label>SSID</Label>
                <Input
                  value={wifiConfig.ssid_2g}
                  onChange={(e) => setWifiConfig({ ...wifiConfig, ssid_2g: e.target.value })}
                  placeholder="Network name"
                  data-testid="input-ssid-2g"
                />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  value={wifiConfig.password_2g}
                  onChange={(e) => setWifiConfig({ ...wifiConfig, password_2g: e.target.value })}
                  placeholder="WiFi password"
                  data-testid="input-password-2g"
                />
              </div>
              <div className="space-y-2">
                <Label>Security Mode</Label>
                <Select
                  value={wifiConfig.securityMode_2g}
                  onValueChange={(v) => setWifiConfig({ ...wifiConfig, securityMode_2g: v })}
                >
                  <SelectTrigger data-testid="select-security-2g">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WPA2-Personal">WPA2-Personal</SelectItem>
                    <SelectItem value="WPA3-Personal">WPA3-Personal</SelectItem>
                    <SelectItem value="WPA-WPA2-Personal">WPA/WPA2-Personal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Channel</Label>
                <Select
                  value={wifiConfig.channel_2g}
                  onValueChange={(v) => setWifiConfig({ ...wifiConfig, channel_2g: v })}
                >
                  <SelectTrigger data-testid="select-channel-2g">
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
            </TabsContent>
            <TabsContent value="5ghz" className="space-y-4 mt-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="enabled_5g"
                  checked={wifiConfig.enabled_5g}
                  onCheckedChange={(checked) => setWifiConfig({ ...wifiConfig, enabled_5g: !!checked })}
                />
                <Label htmlFor="enabled_5g">Enable 5 GHz WiFi</Label>
              </div>
              <div className="space-y-2">
                <Label>SSID</Label>
                <Input
                  value={wifiConfig.ssid_5g}
                  onChange={(e) => setWifiConfig({ ...wifiConfig, ssid_5g: e.target.value })}
                  placeholder="Network name"
                  data-testid="input-ssid-5g"
                />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  value={wifiConfig.password_5g}
                  onChange={(e) => setWifiConfig({ ...wifiConfig, password_5g: e.target.value })}
                  placeholder="WiFi password"
                  data-testid="input-password-5g"
                />
              </div>
              <div className="space-y-2">
                <Label>Security Mode</Label>
                <Select
                  value={wifiConfig.securityMode_5g}
                  onValueChange={(v) => setWifiConfig({ ...wifiConfig, securityMode_5g: v })}
                >
                  <SelectTrigger data-testid="select-security-5g">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WPA2-Personal">WPA2-Personal</SelectItem>
                    <SelectItem value="WPA3-Personal">WPA3-Personal</SelectItem>
                    <SelectItem value="WPA-WPA2-Personal">WPA/WPA2-Personal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Channel</Label>
                <Select
                  value={wifiConfig.channel_5g}
                  onValueChange={(v) => setWifiConfig({ ...wifiConfig, channel_5g: v })}
                >
                  <SelectTrigger data-testid="select-channel-5g">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto</SelectItem>
                    <SelectItem value="36">36</SelectItem>
                    <SelectItem value="40">40</SelectItem>
                    <SelectItem value="44">44</SelectItem>
                    <SelectItem value="48">48</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWifiDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleWifiSubmit} disabled={createTr069TaskMutation.isPending} data-testid="button-save-wifi">
              Apply WiFi Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={voipDialogOpen} onOpenChange={setVoipDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              VoIP Configuration
            </DialogTitle>
            <DialogDescription>
              Configure SIP settings via TR-069
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="voip_enabled"
                checked={voipConfig.enabled}
                onCheckedChange={(checked) => setVoipConfig({ ...voipConfig, enabled: !!checked })}
              />
              <Label htmlFor="voip_enabled">Enable VoIP</Label>
            </div>
            <div className="space-y-2">
              <Label>SIP Server</Label>
              <Input
                value={voipConfig.sipServer}
                onChange={(e) => setVoipConfig({ ...voipConfig, sipServer: e.target.value })}
                placeholder="sip.example.com"
                data-testid="input-sip-server"
              />
            </div>
            <div className="space-y-2">
              <Label>SIP Port</Label>
              <Input
                value={voipConfig.sipPort}
                onChange={(e) => setVoipConfig({ ...voipConfig, sipPort: e.target.value })}
                placeholder="5060"
                data-testid="input-sip-port"
              />
            </div>
            <div className="space-y-2">
              <Label>Username</Label>
              <Input
                value={voipConfig.username}
                onChange={(e) => setVoipConfig({ ...voipConfig, username: e.target.value })}
                placeholder="SIP username"
                data-testid="input-sip-username"
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={voipConfig.password}
                onChange={(e) => setVoipConfig({ ...voipConfig, password: e.target.value })}
                placeholder="SIP password"
                data-testid="input-sip-password"
              />
            </div>
            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input
                value={voipConfig.displayName}
                onChange={(e) => setVoipConfig({ ...voipConfig, displayName: e.target.value })}
                placeholder="Caller ID name"
                data-testid="input-display-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Line Number</Label>
              <Select
                value={voipConfig.lineNumber}
                onValueChange={(v) => setVoipConfig({ ...voipConfig, lineNumber: v })}
              >
                <SelectTrigger data-testid="select-line-number">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Line 1</SelectItem>
                  <SelectItem value="2">Line 2</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoipDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleVoipSubmit} disabled={createTr069TaskMutation.isPending} data-testid="button-save-voip">
              Apply VoIP Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={vlanDialogOpen} onOpenChange={setVlanDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Network className="h-5 w-5" />
              Network Configuration
            </DialogTitle>
            <DialogDescription>
              Configure WAN and Layer 2 settings via TR-069
            </DialogDescription>
          </DialogHeader>
          <Tabs value={wanDialogTab} onValueChange={(v) => setWanDialogTab(v as "wan" | "layer2")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="wan">WAN Settings</TabsTrigger>
              <TabsTrigger value="layer2">Layer 2 / VLAN</TabsTrigger>
            </TabsList>
            <TabsContent value="wan" className="space-y-4 mt-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="wan_enabled"
                  checked={wanConfig.enabled}
                  onCheckedChange={(checked) => setWanConfig({ ...wanConfig, enabled: !!checked })}
                />
                <Label htmlFor="wan_enabled">Enable WAN Interface</Label>
              </div>
              <div className="space-y-2">
                <Label>WAN Mode</Label>
                <Select
                  value={wanConfig.wanMode}
                  onValueChange={(v) => setWanConfig({ ...wanConfig, wanMode: v as "route" | "bridge" })}
                >
                  <SelectTrigger data-testid="select-wan-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="route">Route (NAT)</SelectItem>
                    <SelectItem value="bridge">Bridge</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {wanConfig.wanMode === "route" && (
                <>
                  <div className="space-y-2">
                    <Label>Connection Type</Label>
                    <Select
                      value={wanConfig.connectionType}
                      onValueChange={(v) => setWanConfig({ ...wanConfig, connectionType: v as "DHCP" | "Static" | "PPPoE" })}
                    >
                      <SelectTrigger data-testid="select-connection-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DHCP">DHCP (Automatic)</SelectItem>
                        <SelectItem value="Static">Static IP</SelectItem>
                        <SelectItem value="PPPoE">PPPoE</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="nat_enabled"
                      checked={wanConfig.natEnabled}
                      onCheckedChange={(checked) => setWanConfig({ ...wanConfig, natEnabled: !!checked })}
                    />
                    <Label htmlFor="nat_enabled">Enable NAT</Label>
                  </div>
                  {wanConfig.connectionType === "Static" && (
                    <>
                      <div className="space-y-2">
                        <Label>IP Address</Label>
                        <Input
                          value={wanConfig.ipAddress}
                          onChange={(e) => setWanConfig({ ...wanConfig, ipAddress: e.target.value })}
                          placeholder="192.168.1.100"
                          data-testid="input-wan-ip-address"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Subnet Mask</Label>
                        <Input
                          value={wanConfig.subnetMask}
                          onChange={(e) => setWanConfig({ ...wanConfig, subnetMask: e.target.value })}
                          placeholder="255.255.255.0"
                          data-testid="input-wan-subnet-mask"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Gateway</Label>
                        <Input
                          value={wanConfig.gateway}
                          onChange={(e) => setWanConfig({ ...wanConfig, gateway: e.target.value })}
                          placeholder="192.168.1.1"
                          data-testid="input-wan-gateway"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Primary DNS</Label>
                          <Input
                            value={wanConfig.primaryDns}
                            onChange={(e) => setWanConfig({ ...wanConfig, primaryDns: e.target.value })}
                            placeholder="8.8.8.8"
                            data-testid="input-primary-dns"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Secondary DNS</Label>
                          <Input
                            value={wanConfig.secondaryDns}
                            onChange={(e) => setWanConfig({ ...wanConfig, secondaryDns: e.target.value })}
                            placeholder="8.8.4.4"
                            data-testid="input-secondary-dns"
                          />
                        </div>
                      </div>
                    </>
                  )}
                  {wanConfig.connectionType === "PPPoE" && (
                    <>
                      <div className="space-y-2">
                        <Label>PPPoE Username</Label>
                        <Input
                          value={wanConfig.pppoeUsername}
                          onChange={(e) => setWanConfig({ ...wanConfig, pppoeUsername: e.target.value })}
                          placeholder="username@isp.com"
                          data-testid="input-pppoe-username"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>PPPoE Password</Label>
                        <Input
                          type="password"
                          value={wanConfig.pppoePassword}
                          onChange={(e) => setWanConfig({ ...wanConfig, pppoePassword: e.target.value })}
                          placeholder="password"
                          data-testid="input-pppoe-password"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Service Name (Optional)</Label>
                        <Input
                          value={wanConfig.pppoeServiceName}
                          onChange={(e) => setWanConfig({ ...wanConfig, pppoeServiceName: e.target.value })}
                          placeholder="ISP service name"
                          data-testid="input-pppoe-service-name"
                        />
                      </div>
                    </>
                  )}
                </>
              )}
              {wanConfig.wanMode === "bridge" && (
                <div className="p-4 bg-muted/50 rounded-md">
                  <p className="text-sm text-muted-foreground">
                    In Bridge mode, the ONU will pass traffic transparently without NAT. 
                    IP configuration will be handled by the upstream device.
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label>MTU</Label>
                <Input
                  value={wanConfig.mtu}
                  onChange={(e) => setWanConfig({ ...wanConfig, mtu: e.target.value })}
                  placeholder="1500"
                  data-testid="input-wan-mtu"
                />
              </div>
              <DialogFooter className="pt-4">
                <Button variant="outline" onClick={() => setVlanDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleWanSubmit} disabled={createTr069TaskMutation.isPending} data-testid="button-save-wan">
                  Apply WAN Settings
                </Button>
              </DialogFooter>
            </TabsContent>
            <TabsContent value="layer2" className="space-y-4 mt-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="layer2_enabled"
                  checked={layer2Config.enabled}
                  onCheckedChange={(checked) => setLayer2Config({ ...layer2Config, enabled: !!checked })}
                />
                <Label htmlFor="layer2_enabled">Enable Interface</Label>
              </div>
              <div className="space-y-2">
                <Label>Service Type</Label>
                <Select
                  value={layer2Config.serviceType}
                  onValueChange={(v) => setLayer2Config({ ...layer2Config, serviceType: v as "internet" | "voip" | "iptv" | "management" })}
                >
                  <SelectTrigger data-testid="select-service-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internet">Internet</SelectItem>
                    <SelectItem value="voip">VoIP</SelectItem>
                    <SelectItem value="iptv">IPTV</SelectItem>
                    <SelectItem value="management">Management</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <h4 className="font-medium text-sm">VLAN Configuration</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>VLAN ID</Label>
                  <Input
                    value={layer2Config.vlanId}
                    onChange={(e) => setLayer2Config({ ...layer2Config, vlanId: e.target.value })}
                    placeholder="100"
                    data-testid="input-vlan-id"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Priority (0-7)</Label>
                  <Select
                    value={layer2Config.vlanPriority}
                    onValueChange={(v) => setLayer2Config({ ...layer2Config, vlanPriority: v })}
                  >
                    <SelectTrigger data-testid="select-vlan-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[0, 1, 2, 3, 4, 5, 6, 7].map((p) => (
                        <SelectItem key={p} value={String(p)}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tag Mode</Label>
                <Select
                  value={layer2Config.vlanTagMode}
                  onValueChange={(v) => setLayer2Config({ ...layer2Config, vlanTagMode: v as "tagged" | "untagged" })}
                >
                  <SelectTrigger data-testid="select-tag-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tagged">Tagged</SelectItem>
                    <SelectItem value="untagged">Untagged</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <h4 className="font-medium text-sm">Bridge Settings</h4>
              <div className="space-y-2">
                <Label>Bridge Mode</Label>
                <Select
                  value={layer2Config.bridgeMode}
                  onValueChange={(v) => setLayer2Config({ ...layer2Config, bridgeMode: v as "disabled" | "enabled" })}
                >
                  <SelectTrigger data-testid="select-bridge-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="disabled">Disabled</SelectItem>
                    <SelectItem value="enabled">Enabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {layer2Config.bridgeMode === "enabled" && (
                <div className="space-y-2">
                  <Label>Bridge VLAN ID</Label>
                  <Input
                    value={layer2Config.bridgeVlanId}
                    onChange={(e) => setLayer2Config({ ...layer2Config, bridgeVlanId: e.target.value })}
                    placeholder="100"
                    data-testid="input-bridge-vlan-id"
                  />
                </div>
              )}
              <DialogFooter className="pt-4">
                <Button variant="outline" onClick={() => setVlanDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleLayer2Submit} disabled={createTr069TaskMutation.isPending} data-testid="button-save-layer2">
                  Apply Layer 2 Settings
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <Dialog open={parametersDialogOpen} onOpenChange={setParametersDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <List className="h-5 w-5" />
              TR-069 Parameters
            </DialogTitle>
            <DialogDescription>
              View and edit device parameters
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Filter parameters..."
              value={parametersFilter}
              onChange={(e) => setParametersFilter(e.target.value)}
              data-testid="input-parameters-filter"
            />
            <ScrollArea className="h-96">
              {tr069Parameters && tr069Parameters.length > 0 ? (
                <div className="space-y-1">
                  {tr069Parameters
                    .filter((p) => p.path.toLowerCase().includes(parametersFilter.toLowerCase()))
                    .slice(0, 100)
                    .map((param, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-2 p-2 hover:bg-muted/50 rounded text-sm"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-xs truncate">{param.path}</p>
                          {editingParameter?.path === param.path ? (
                            <div className="flex gap-2 mt-1">
                              <Select
                                value={newParameterType}
                                onValueChange={setNewParameterType}
                              >
                                <SelectTrigger className="w-28 h-7 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="xsd:string">String</SelectItem>
                                  <SelectItem value="xsd:int">Integer</SelectItem>
                                  <SelectItem value="xsd:boolean">Boolean</SelectItem>
                                </SelectContent>
                              </Select>
                              <Input
                                value={newParameterValue}
                                onChange={(e) => setNewParameterValue(e.target.value)}
                                className="flex-1 h-7 text-xs"
                              />
                              <Button size="sm" className="h-7" onClick={handleParameterEdit}>
                                <Save className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7"
                                onClick={() => setEditingParameter(null)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <p className="text-muted-foreground truncate">{String(param.value)}</p>
                          )}
                        </div>
                        {!editingParameter && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingParameter({
                                path: param.path,
                                value: String(param.value),
                                type: param.type,
                              });
                              setNewParameterValue(String(param.value));
                              setNewParameterType(param.type || "xsd:string");
                            }}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">No parameters available</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => {
                      if (id) {
                        createTr069TaskMutation.mutate({
                          onuId: id,
                          taskType: "get_parameter_values",
                          parameters: { parameterNames: ["Device."] },
                        });
                      }
                    }}
                  >
                    Fetch Parameters
                  </Button>
                </div>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
