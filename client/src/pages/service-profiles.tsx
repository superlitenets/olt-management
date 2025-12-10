import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
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
  FormDescription,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/empty-state";
import { TableSkeleton } from "@/components/loading-skeleton";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import {
  Plus,
  Search,
  Package,
  MoreVertical,
  Edit,
  Copy,
  Trash2,
  Wifi,
  Tv,
  Phone,
  ArrowDown,
  ArrowUp,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { insertServiceProfileSchema, type ServiceProfile, type InsertServiceProfile } from "@shared/schema";

const createProfileFormSchema = insertServiceProfileSchema.omit({ tenantId: true }).extend({
  name: z.string().min(1, "Name is required"),
  downloadSpeed: z.coerce.number().min(1, "Download speed is required"),
  uploadSpeed: z.coerce.number().min(1, "Upload speed is required"),
});

type CreateProfileForm = z.infer<typeof createProfileFormSchema>;

export default function ServiceProfilesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: profiles, isLoading } = useQuery<ServiceProfile[]>({
    queryKey: ["/api/service-profiles"],
  });

  const form = useForm<CreateProfileForm>({
    resolver: zodResolver(createProfileFormSchema),
    defaultValues: {
      name: "",
      description: "",
      downloadSpeed: 100,
      uploadSpeed: 50,
      internetEnabled: true,
      iptvEnabled: false,
      voipEnabled: false,
      qosPriority: 0,
      isDefault: false,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateProfileForm) => {
      return apiRequest("POST", "/api/service-profiles", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-profiles"] });
      setIsDialogOpen(false);
      form.reset();
      toast({
        title: "Profile Created",
        description: "The service profile has been created successfully",
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

  const filteredProfiles = profiles?.filter(
    (profile) =>
      profile.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      profile.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const onSubmit = (data: CreateProfileForm) => {
    createMutation.mutate(data);
  };

  const downloadSpeed = form.watch("downloadSpeed");
  const uploadSpeed = form.watch("uploadSpeed");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Service Profiles</h1>
          <p className="text-sm text-muted-foreground">
            Manage bandwidth and service configurations
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-profile">
              <Plus className="h-4 w-4 mr-2" />
              Add Profile
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Service Profile</DialogTitle>
              <DialogDescription>
                Define bandwidth limits and service settings
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Profile Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Premium 100Mbps" {...field} data-testid="input-profile-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="qosPriority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>QoS Priority (0-7)</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} max={7} {...field} data-testid="input-profile-qos" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Profile description..." {...field} data-testid="input-profile-desc" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Bandwidth Settings</h4>
                  <div className="grid grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="downloadSpeed"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center justify-between">
                            <FormLabel className="flex items-center gap-2">
                              <ArrowDown className="h-4 w-4 text-emerald-500" />
                              Download
                            </FormLabel>
                            <span className="text-sm font-mono">{field.value} Mbps</span>
                          </div>
                          <FormControl>
                            <Slider
                              min={1}
                              max={1000}
                              step={1}
                              value={[field.value]}
                              onValueChange={(v) => field.onChange(v[0])}
                              data-testid="slider-download"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="uploadSpeed"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center justify-between">
                            <FormLabel className="flex items-center gap-2">
                              <ArrowUp className="h-4 w-4 text-blue-500" />
                              Upload
                            </FormLabel>
                            <span className="text-sm font-mono">{field.value} Mbps</span>
                          </div>
                          <FormControl>
                            <Slider
                              min={1}
                              max={500}
                              step={1}
                              value={[field.value]}
                              onValueChange={(v) => field.onChange(v[0])}
                              data-testid="slider-upload"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Services</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="internetEnabled"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-md border p-3">
                          <div className="flex items-center gap-2">
                            <Wifi className="h-4 w-4 text-primary" />
                            <FormLabel className="font-normal">Internet</FormLabel>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-internet"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="iptvEnabled"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-md border p-3">
                          <div className="flex items-center gap-2">
                            <Tv className="h-4 w-4 text-amber-500" />
                            <FormLabel className="font-normal">IPTV</FormLabel>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-iptv"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="voipEnabled"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-md border p-3">
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-green-500" />
                            <FormLabel className="font-normal">VoIP</FormLabel>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-voip"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-medium">VLAN Configuration</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="internetVlan"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Internet VLAN</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="100" {...field} data-testid="input-internet-vlan" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="iptvVlan"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>IPTV VLAN</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="200" {...field} data-testid="input-iptv-vlan" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="voipVlan"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>VoIP VLAN</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="300" {...field} data-testid="input-voip-vlan" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="isDefault"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-md border p-3">
                      <div>
                        <FormLabel className="font-normal">Set as Default Profile</FormLabel>
                        <FormDescription>
                          New ONUs will use this profile automatically
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-default"
                        />
                      </FormControl>
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
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-profile">
                    {createMutation.isPending ? "Creating..." : "Create Profile"}
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
            placeholder="Search profiles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-profiles"
          />
        </div>
        <Badge variant="secondary">{filteredProfiles?.length || 0} Profiles</Badge>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <TableSkeleton rows={1} />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredProfiles && filteredProfiles.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProfiles.map((profile) => (
            <Card key={profile.id} className="hover-elevate" data-testid={`profile-card-${profile.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Package className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium">{profile.name}</h3>
                        {profile.isDefault && (
                          <Badge variant="secondary" className="text-xs">
                            Default
                          </Badge>
                        )}
                      </div>
                      {profile.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {profile.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" data-testid={`button-profile-menu-${profile.id}`}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Bandwidth</span>
                    <span className="font-mono">
                      {profile.downloadSpeed}/{profile.uploadSpeed} Mbps
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {profile.internetEnabled && (
                      <Badge variant="outline" className="text-xs gap-1 no-default-hover-elevate no-default-active-elevate">
                        <Wifi className="h-3 w-3" />
                        Internet
                      </Badge>
                    )}
                    {profile.iptvEnabled && (
                      <Badge variant="outline" className="text-xs gap-1 no-default-hover-elevate no-default-active-elevate">
                        <Tv className="h-3 w-3" />
                        IPTV
                      </Badge>
                    )}
                    {profile.voipEnabled && (
                      <Badge variant="outline" className="text-xs gap-1 no-default-hover-elevate no-default-active-elevate">
                        <Phone className="h-3 w-3" />
                        VoIP
                      </Badge>
                    )}
                  </div>

                  {(profile.internetVlan || profile.iptvVlan || profile.voipVlan) && (
                    <div className="text-xs text-muted-foreground">
                      VLANs:{" "}
                      {[profile.internetVlan, profile.iptvVlan, profile.voipVlan]
                        .filter(Boolean)
                        .join(", ")}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<Package className="h-8 w-8" />}
              title="No Service Profiles"
              description={
                searchQuery
                  ? "No profiles match your search"
                  : "Create service profiles to define bandwidth and service settings"
              }
              action={
                !searchQuery
                  ? {
                      label: "Add Profile",
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
