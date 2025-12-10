import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/empty-state";
import { OltCardSkeleton } from "@/components/loading-skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import {
  Plus,
  Search,
  Building2,
  MoreVertical,
  Edit,
  Users,
  Server,
  Radio,
  Ban,
  Mail,
  Phone,
} from "lucide-react";
import { insertTenantSchema, type Tenant, type InsertTenant, type User, type Olt, type Onu } from "@shared/schema";

const createTenantFormSchema = insertTenantSchema
  .omit({ id: true, isActive: true, createdAt: true, updatedAt: true })
  .extend({
    name: z.string().min(1, "Name is required"),
    contactEmail: z.string().email().optional().or(z.literal("")),
  });

type CreateTenantForm = z.infer<typeof createTenantFormSchema>;

export default function TenantsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const { data: tenants, isLoading } = useQuery<Tenant[]>({
    queryKey: ["/api/tenants"],
  });

  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: olts } = useQuery<Olt[]>({
    queryKey: ["/api/olts"],
  });

  const { data: onus } = useQuery<Onu[]>({
    queryKey: ["/api/onus"],
  });

  const form = useForm<CreateTenantForm>({
    resolver: zodResolver(createTenantFormSchema),
    defaultValues: {
      name: "",
      description: "",
      contactEmail: "",
      contactPhone: "",
      maxOlts: 10,
      maxOnus: 1000,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateTenantForm) => {
      return apiRequest("POST", "/api/tenants", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });
      setIsDialogOpen(false);
      form.reset();
      toast({
        title: "Tenant Created",
        description: "The tenant has been created successfully",
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
        description: "Failed to create tenant",
        variant: "destructive",
      });
    },
  });

  const getTenantStats = (tenantId: string) => {
    const tenantUsers = users?.filter((u) => u.tenantId === tenantId).length || 0;
    const tenantOlts = olts?.filter((o) => o.tenantId === tenantId).length || 0;
    const tenantOnus = onus?.filter((o) => o.tenantId === tenantId).length || 0;
    return { users: tenantUsers, olts: tenantOlts, onus: tenantOnus };
  };

  const filteredTenants = tenants?.filter(
    (tenant) =>
      tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tenant.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const onSubmit = (data: CreateTenantForm) => {
    createMutation.mutate(data);
  };

  const isSuperAdmin = currentUser?.role === "super_admin";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Tenant Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage organizations and their resource limits
          </p>
        </div>
        {isSuperAdmin && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-tenant">
                <Plus className="h-4 w-4 mr-2" />
                Add Tenant
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Tenant</DialogTitle>
                <DialogDescription>
                  Add a new organization to the system
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Organization Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Acme ISP" {...field} data-testid="input-tenant-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Brief description..."
                            {...field}
                            data-testid="input-tenant-desc"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="contactEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Email</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="contact@example.com"
                              {...field}
                              data-testid="input-tenant-email"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="contactPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Phone</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="+1 234 567 8900"
                              {...field}
                              data-testid="input-tenant-phone"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="maxOlts"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Max OLTs</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} data-testid="input-tenant-max-olts" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="maxOnus"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Max ONUs</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} data-testid="input-tenant-max-onus" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                      data-testid="button-cancel"
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-tenant">
                      {createMutation.isPending ? "Creating..." : "Create Tenant"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tenants..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-tenants"
          />
        </div>
        <Badge variant="secondary">{filteredTenants?.length || 0} Tenants</Badge>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <OltCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredTenants && filteredTenants.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTenants.map((tenant) => {
            const stats = getTenantStats(tenant.id);
            return (
              <Card key={tenant.id} className="hover-elevate" data-testid={`tenant-card-${tenant.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium">{tenant.name}</h3>
                          <Badge
                            variant="outline"
                            className={
                              tenant.isActive
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                                : "bg-gray-500/15 text-gray-600 dark:text-gray-400 border-gray-500/30"
                            }
                          >
                            {tenant.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        {tenant.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {tenant.description}
                          </p>
                        )}
                      </div>
                    </div>
                    {isSuperAdmin && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`button-tenant-menu-${tenant.id}`}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Users className="h-4 w-4 mr-2" />
                            Manage Users
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive">
                            <Ban className="h-4 w-4 mr-2" />
                            {tenant.isActive ? "Deactivate" : "Activate"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className="flex items-center gap-2 text-xs">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{stats.users} Users</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <Server className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>
                        {stats.olts}/{tenant.maxOlts} OLTs
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <Radio className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>
                        {stats.onus}/{tenant.maxOnus} ONUs
                      </span>
                    </div>
                  </div>

                  {(tenant.contactEmail || tenant.contactPhone) && (
                    <div className="mt-3 pt-3 border-t flex items-center gap-4 text-xs text-muted-foreground">
                      {tenant.contactEmail && (
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          <span className="truncate">{tenant.contactEmail}</span>
                        </div>
                      )}
                      {tenant.contactPhone && (
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          <span>{tenant.contactPhone}</span>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<Building2 className="h-8 w-8" />}
              title="No Tenants Found"
              description={
                searchQuery
                  ? "No tenants match your search"
                  : "Create tenants to organize your network by region or customer"
              }
              action={
                !searchQuery && isSuperAdmin
                  ? {
                      label: "Add Tenant",
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
