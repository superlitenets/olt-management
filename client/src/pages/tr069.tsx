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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TableSkeleton } from "@/components/loading-skeleton";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import {
  Search,
  MoreVertical,
  RefreshCw,
  Settings,
  Power,
  Download,
  Wifi,
  Upload,
  Trash2,
  Play,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Cpu,
} from "lucide-react";
import type { Tr069Device, Tr069Task, Tr069Preset, Tr069Firmware } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

export default function Tr069Page() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("devices");
  const [selectedDevice, setSelectedDevice] = useState<Tr069Device | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deviceToDelete, setDeviceToDelete] = useState<Tr069Device | null>(null);
  const [taskType, setTaskType] = useState<string>("");
  const [parameterPaths, setParameterPaths] = useState("");
  const [setParameterJson, setSetParameterJson] = useState("");
  const [selectedFirmware, setSelectedFirmware] = useState("");
  const { toast } = useToast();

  const { data: devices, isLoading: devicesLoading } = useQuery<Tr069Device[]>({
    queryKey: ["/api/tr069/devices"],
  });

  const { data: tasks, isLoading: tasksLoading } = useQuery<Tr069Task[]>({
    queryKey: ["/api/tr069/tasks"],
  });

  const { data: presets, isLoading: presetsLoading } = useQuery<Tr069Preset[]>({
    queryKey: ["/api/tr069/presets"],
  });

  const { data: firmware, isLoading: firmwareLoading } = useQuery<Tr069Firmware[]>({
    queryKey: ["/api/tr069/firmware"],
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: { deviceId: string; taskType: string; parameters?: any }) => {
      return apiRequest("POST", "/api/tr069/tasks", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tr069/tasks"] });
      setTaskDialogOpen(false);
      toast({
        title: "Task Created",
        description: "The task has been queued for the device",
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
        description: "Failed to create task",
        variant: "destructive",
      });
    },
  });

  const deleteDeviceMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      return apiRequest("DELETE", `/api/tr069/devices/${deviceId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tr069/devices"] });
      setDeleteDialogOpen(false);
      setDeviceToDelete(null);
      toast({
        title: "Device Deleted",
        description: "The device has been removed",
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
        description: "Failed to delete device. Please try again.",
        variant: "destructive",
      });
    },
  });

  const filteredDevices = devices?.filter((device) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      device.serialNumber?.toLowerCase().includes(searchLower) ||
      device.manufacturer?.toLowerCase().includes(searchLower) ||
      device.modelName?.toLowerCase().includes(searchLower) ||
      device.externalIp?.includes(searchQuery) ||
      device.deviceId.toLowerCase().includes(searchLower)
    );
  });

  const handleCreateTask = (device: Tr069Device, type: string) => {
    setSelectedDevice(device);
    setTaskType(type);
    setParameterPaths("");
    setSetParameterJson("");
    setSelectedFirmware("");
    
    if (type === "reboot" || type === "factory_reset") {
      createTaskMutation.mutate({
        deviceId: device.id,
        taskType: type,
      });
    } else {
      setTaskDialogOpen(true);
    }
  };

  const handleDeleteDevice = (device: Tr069Device) => {
    setDeviceToDelete(device);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteDevice = () => {
    if (deviceToDelete) {
      deleteDeviceMutation.mutate(deviceToDelete.id);
    }
  };

  const submitTask = () => {
    if (!selectedDevice) return;
    
    const parameters: Record<string, any> = {};
    
    if (taskType === "get_parameter_values" && parameterPaths) {
      parameters.paths = parameterPaths.split(",").map(p => p.trim());
    }
    
    if (taskType === "set_parameter_values" && setParameterJson) {
      try {
        parameters.values = JSON.parse(setParameterJson);
      } catch (e) {
        toast({
          title: "Invalid JSON",
          description: "Please enter valid JSON for the parameter values",
          variant: "destructive",
        });
        return;
      }
    }
    
    if (taskType === "download" && selectedFirmware) {
      parameters.firmwareId = selectedFirmware;
    }
    
    createTaskMutation.mutate({
      deviceId: selectedDevice.id,
      taskType: taskType,
      parameters: Object.keys(parameters).length > 0 ? parameters : undefined,
    });
  };

  const getTaskStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary"><Clock className="mr-1 h-3 w-3" />Pending</Badge>;
      case "in_progress":
        return <Badge variant="default"><RefreshCw className="mr-1 h-3 w-3 animate-spin" />In Progress</Badge>;
      case "completed":
        return <Badge variant="outline" className="text-green-600"><CheckCircle2 className="mr-1 h-3 w-3" />Completed</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Failed</Badge>;
      case "expired":
        return <Badge variant="outline"><AlertCircle className="mr-1 h-3 w-3" />Expired</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatLastInform = (date: Date | string | null) => {
    if (!date) return "Never";
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true });
    } catch {
      return "Unknown";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-page-title">
            TR-069/ACS Management
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage CPE devices via TR-069 protocol for advanced configuration
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="devices" data-testid="tab-devices">
            Devices ({devices?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="tasks" data-testid="tab-tasks">
            Tasks ({tasks?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="presets" data-testid="tab-presets">
            Presets ({presets?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="firmware" data-testid="tab-firmware">
            Firmware ({firmware?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="devices" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
              <CardTitle className="text-lg">Connected Devices</CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search devices..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-64"
                    data-testid="input-search-devices"
                  />
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/tr069/devices"] })}
                  data-testid="button-refresh-devices"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {devicesLoading ? (
                <TableSkeleton rows={5} />
              ) : !filteredDevices?.length ? (
                <EmptyState
                  icon={<Cpu className="h-8 w-8" />}
                  title="No TR-069 devices"
                  description="Devices will appear here when they connect to the ACS server on port 7547"
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Device</TableHead>
                      <TableHead>Manufacturer</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Software</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Last Inform</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDevices.map((device) => (
                      <TableRow key={device.id} data-testid={`row-device-${device.id}`}>
                        <TableCell>
                          <div className="font-medium">{device.serialNumber || device.deviceId}</div>
                          <div className="text-xs text-muted-foreground font-mono">{device.oui}</div>
                        </TableCell>
                        <TableCell>{device.manufacturer || "-"}</TableCell>
                        <TableCell>{device.modelName || device.productClass || "-"}</TableCell>
                        <TableCell className="font-mono text-xs">{device.softwareVersion || "-"}</TableCell>
                        <TableCell className="font-mono text-xs">{device.externalIp || "-"}</TableCell>
                        <TableCell className="text-sm">{formatLastInform(device.lastInformTime)}</TableCell>
                        <TableCell>
                          {device.isOnline ? (
                            <Badge variant="outline" className="text-green-600">Online</Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">Offline</Badge>
                          )}
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
                                onClick={() => handleCreateTask(device, "get_parameter_values")}
                                data-testid="menu-get-parameters"
                              >
                                <Download className="mr-2 h-4 w-4" />
                                Get Parameters
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleCreateTask(device, "set_parameter_values")}
                                data-testid="menu-set-parameters"
                              >
                                <Upload className="mr-2 h-4 w-4" />
                                Set Parameters
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleCreateTask(device, "download")}
                                data-testid="menu-firmware-upgrade"
                              >
                                <Settings className="mr-2 h-4 w-4" />
                                Firmware Upgrade
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleCreateTask(device, "reboot")}
                                data-testid="menu-reboot"
                              >
                                <Power className="mr-2 h-4 w-4" />
                                Reboot
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleCreateTask(device, "factory_reset")}
                                className="text-destructive"
                                data-testid="menu-factory-reset"
                              >
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Factory Reset
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDeleteDevice(device)}
                                className="text-destructive"
                                data-testid="menu-delete-device"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Device
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

        <TabsContent value="tasks" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
              <CardTitle className="text-lg">Task Queue</CardTitle>
              <Button
                variant="outline"
                size="icon"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/tr069/tasks"] })}
                data-testid="button-refresh-tasks"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {tasksLoading ? (
                <TableSkeleton rows={5} />
              ) : !tasks?.length ? (
                <EmptyState
                  icon={<Play className="h-8 w-8" />}
                  title="No pending tasks"
                  description="Tasks will appear here when you send commands to devices"
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Device</TableHead>
                      <TableHead>Task Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Completed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.map((task) => (
                      <TableRow key={task.id} data-testid={`row-task-${task.id}`}>
                        <TableCell className="font-mono text-xs">{task.deviceId}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{task.taskType.replace(/_/g, " ")}</Badge>
                        </TableCell>
                        <TableCell>{getTaskStatusBadge(task.status || "pending")}</TableCell>
                        <TableCell className="text-sm">{formatLastInform(task.createdAt)}</TableCell>
                        <TableCell className="text-sm">{formatLastInform(task.startedAt)}</TableCell>
                        <TableCell className="text-sm">{formatLastInform(task.completedAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="presets" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
              <CardTitle className="text-lg">Configuration Presets</CardTitle>
              <Button data-testid="button-add-preset">
                Add Preset
              </Button>
            </CardHeader>
            <CardContent>
              {presetsLoading ? (
                <TableSkeleton rows={3} />
              ) : !presets?.length ? (
                <EmptyState
                  icon={<Settings className="h-8 w-8" />}
                  title="No presets configured"
                  description="Create presets to auto-configure devices when they connect"
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Weight</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {presets.map((preset) => (
                      <TableRow key={preset.id} data-testid={`row-preset-${preset.id}`}>
                        <TableCell className="font-medium">{preset.name}</TableCell>
                        <TableCell className="text-muted-foreground">{preset.description || "-"}</TableCell>
                        <TableCell>{preset.weight}</TableCell>
                        <TableCell>
                          {preset.isActive ? (
                            <Badge variant="outline" className="text-green-600">Active</Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="firmware" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
              <CardTitle className="text-lg">Firmware Images</CardTitle>
              <Button data-testid="button-add-firmware">
                Upload Firmware
              </Button>
            </CardHeader>
            <CardContent>
              {firmwareLoading ? (
                <TableSkeleton rows={3} />
              ) : !firmware?.length ? (
                <EmptyState
                  icon={<Download className="h-8 w-8" />}
                  title="No firmware uploaded"
                  description="Upload firmware images to deploy to devices"
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Manufacturer</TableHead>
                      <TableHead>Product Class</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {firmware.map((fw) => (
                      <TableRow key={fw.id} data-testid={`row-firmware-${fw.id}`}>
                        <TableCell className="font-medium">{fw.name}</TableCell>
                        <TableCell className="font-mono text-xs">{fw.version}</TableCell>
                        <TableCell>{fw.manufacturer || "-"}</TableCell>
                        <TableCell>{fw.productClass || "-"}</TableCell>
                        <TableCell>{fw.fileSize ? `${Math.round(fw.fileSize / 1024 / 1024)} MB` : "-"}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
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

      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Task</DialogTitle>
            <DialogDescription>
              Configure the task for device: {selectedDevice?.serialNumber || selectedDevice?.deviceId}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Task Type</label>
              <Select value={taskType} onValueChange={setTaskType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select task type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="get_parameter_values">Get Parameter Values</SelectItem>
                  <SelectItem value="set_parameter_values">Set Parameter Values</SelectItem>
                  <SelectItem value="download">Download (Firmware)</SelectItem>
                  <SelectItem value="reboot">Reboot</SelectItem>
                  <SelectItem value="factory_reset">Factory Reset</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {taskType === "get_parameter_values" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Parameter Paths</label>
                <Input
                  placeholder="e.g., InternetGatewayDevice.DeviceInfo."
                  value={parameterPaths}
                  onChange={(e) => setParameterPaths(e.target.value)}
                  data-testid="input-parameter-paths"
                />
                <p className="text-xs text-muted-foreground">Enter comma-separated parameter paths</p>
              </div>
            )}
            {taskType === "set_parameter_values" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Parameters (JSON)</label>
                <Input
                  placeholder='e.g., {"InternetGatewayDevice.DeviceInfo.FriendlyName": "MyDevice"}'
                  value={setParameterJson}
                  onChange={(e) => setSetParameterJson(e.target.value)}
                  data-testid="input-set-parameters"
                />
                <p className="text-xs text-muted-foreground">Enter parameter name and value pairs as JSON</p>
              </div>
            )}
            {taskType === "download" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Firmware</label>
                <Select value={selectedFirmware} onValueChange={setSelectedFirmware}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select firmware" />
                  </SelectTrigger>
                  <SelectContent>
                    {firmware?.map((fw) => (
                      <SelectItem key={fw.id} value={fw.id}>
                        {fw.name} - {fw.version}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setTaskDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={submitTask}
              disabled={createTaskMutation.isPending}
              data-testid="button-submit-task"
            >
              {createTaskMutation.isPending ? "Creating..." : "Create Task"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Device</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete device "{deviceToDelete?.serialNumber || deviceToDelete?.deviceId}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteDevice}
              disabled={deleteDeviceMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteDeviceMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
