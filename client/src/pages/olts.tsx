import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/status-badge";
import { VendorLogo } from "@/components/vendor-logo";
import { OltCardSkeleton } from "@/components/loading-skeleton";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import {
  Plus,
  Search,
  Server,
  Settings,
  MoreVertical,
  RefreshCw,
  Cpu,
  HardDrive,
  Thermometer,
  Clock,
  MapPin,
  Eye,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { insertOltSchema, type Olt, type InsertOlt } from "@shared/schema";
import { Link } from "wouter";

const createOltFormSchema = insertOltSchema.omit({ tenantId: true }).extend({
  name: z.string().min(1, "Name is required"),
  ipAddress: z.string().min(1, "IP address is required"),
});

type CreateOltForm = z.infer<typeof createOltFormSchema>;

export default function OltsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: olts, isLoading } = useQuery<Olt[]>({
    queryKey: ["/api/olts"],
  });

  const form = useForm<CreateOltForm>({
    resolver: zodResolver(createOltFormSchema),
    defaultValues: {
      name: "",
      vendor: "huawei",
      model: "",
      ipAddress: "",
      snmpCommunity: "public",
      snmpPort: 161,
      sshUsername: "",
      sshPassword: "",
      sshPort: 22,
      networkType: "gpon",
      totalPorts: 16,
      location: "",
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateOltForm) => {
      return apiRequest("POST", "/api/olts", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/olts"] });
      setIsDialogOpen(false);
      form.reset();
      toast({
        title: "OLT Created",
        description: "The OLT has been added successfully",
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
        description: "Failed to create OLT",
        variant: "destructive",
      });
    },
  });

  const filteredOlts = olts?.filter(
    (olt) =>
      olt.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      olt.ipAddress.includes(searchQuery) ||
      olt.vendor.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const onSubmit = (data: CreateOltForm) => {
    createMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">OLT Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage and monitor your Optical Line Terminals
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-olt">
              <Plus className="h-4 w-4 mr-2" />
              Add OLT
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New OLT</DialogTitle>
              <DialogDescription>
                Configure a new Optical Line Terminal for your network
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="OLT-01" {...field} data-testid="input-olt-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="vendor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vendor</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-olt-vendor">
                              <SelectValue placeholder="Select vendor" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="huawei">Huawei</SelectItem>
                            <SelectItem value="zte">ZTE</SelectItem>
                            <SelectItem value="fiberhome">FiberHome</SelectItem>
                            <SelectItem value="nokia">Nokia</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="ipAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>IP Address</FormLabel>
                        <FormControl>
                          <Input placeholder="192.168.1.1" {...field} data-testid="input-olt-ip" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="model"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Model</FormLabel>
                        <FormControl>
                          <Input placeholder="MA5680T" {...field} data-testid="input-olt-model" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="networkType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Network Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-olt-network-type">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="gpon">GPON</SelectItem>
                            <SelectItem value="epon">EPON</SelectItem>
                            <SelectItem value="xgpon">XG-PON</SelectItem>
                            <SelectItem value="xgspon">XGS-PON</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="totalPorts"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total PON Ports</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} data-testid="input-olt-ports" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="snmpCommunity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SNMP Community</FormLabel>
                        <FormControl>
                          <Input placeholder="public" {...field} data-testid="input-olt-snmp" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="snmpPort"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SNMP Port</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} data-testid="input-olt-snmp-port" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="sshUsername"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SSH Username</FormLabel>
                        <FormControl>
                          <Input placeholder="admin" {...field} data-testid="input-olt-ssh-user" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="sshPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SSH Password</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} data-testid="input-olt-ssh-pass" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="sshPort"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SSH Port</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} data-testid="input-olt-ssh-port" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <Input placeholder="Data Center 1" {...field} data-testid="input-olt-location" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Additional notes..." {...field} data-testid="input-olt-notes" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-olt">
                    {createMutation.isPending ? "Creating..." : "Add OLT"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search OLTs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-olts"
          />
        </div>
        <Badge variant="secondary">{filteredOlts?.length || 0} OLTs</Badge>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <OltCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredOlts && filteredOlts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOlts.map((olt) => (
            <Card key={olt.id} className="hover-elevate" data-testid={`olt-card-${olt.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <VendorLogo vendor={olt.vendor} />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium">{olt.name}</h3>
                        <StatusBadge status={olt.status || "offline"} />
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">{olt.ipAddress}</p>
                      {olt.model && (
                        <p className="text-xs text-muted-foreground">{olt.model}</p>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" data-testid={`button-olt-menu-${olt.id}`}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/olts/${olt.id}`}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Settings className="h-4 w-4 mr-2" />
                        Configure
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Poll Now
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive">
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 text-xs">
                    <Server className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">{olt.activeOnus || 0} ONUs</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="outline" className="text-xs no-default-hover-elevate no-default-active-elevate">
                      {olt.networkType?.toUpperCase() || "GPON"}
                    </Badge>
                  </div>
                </div>

                {(olt.cpuUsage !== null || olt.memoryUsage !== null || olt.temperature !== null) && (
                  <div className="mt-3 pt-3 border-t flex items-center gap-4 text-xs text-muted-foreground">
                    {olt.cpuUsage !== null && (
                      <div className="flex items-center gap-1">
                        <Cpu className="h-3 w-3" />
                        <span>{olt.cpuUsage}%</span>
                      </div>
                    )}
                    {olt.memoryUsage !== null && (
                      <div className="flex items-center gap-1">
                        <HardDrive className="h-3 w-3" />
                        <span>{olt.memoryUsage}%</span>
                      </div>
                    )}
                    {olt.temperature !== null && (
                      <div className="flex items-center gap-1">
                        <Thermometer className="h-3 w-3" />
                        <span>{olt.temperature}C</span>
                      </div>
                    )}
                  </div>
                )}

                {olt.location && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span>{olt.location}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<Server className="h-8 w-8" />}
              title="No OLTs Found"
              description={
                searchQuery
                  ? "No OLTs match your search criteria"
                  : "Add your first OLT to start managing your network"
              }
              action={
                !searchQuery
                  ? {
                      label: "Add OLT",
                      onClick: () => setIsDialogOpen(true),
                    }
                  : undefined
              }
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
