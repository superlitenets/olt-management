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
} from "lucide-react";
import type { VpnProfile } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

interface VpnEnvironmentInfo {
  isReplitEnvironment: boolean;
  isOpenVpnAvailable: boolean;
  hasTunDevice: boolean;
  canEstablishVpn: boolean;
  reason?: string;
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
  });

  const { data: profiles, isLoading: profilesLoading } = useQuery<VpnProfile[]>({
    queryKey: ["/api/vpn/profiles"],
  });

  const { data: environment } = useQuery<VpnEnvironmentInfo>({
    queryKey: ["/api/vpn/environment"],
  });

  const createProfileMutation = useMutation({
    mutationFn: async (data: typeof profileForm) => {
      return apiRequest("POST", "/api/vpn/profiles", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vpn/profiles"] });
      setProfileDialogOpen(false);
      resetProfileForm();
      toast({
        title: "Profile Created",
        description: "OpenVPN profile has been created successfully",
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
      return apiRequest("PATCH", `/api/vpn/profiles/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vpn/profiles"] });
      setProfileDialogOpen(false);
      setEditingProfile(null);
      resetProfileForm();
      toast({
        title: "Profile Updated",
        description: "OpenVPN profile has been updated successfully",
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
        title: "Profile Deleted",
        description: "OpenVPN profile has been deleted",
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

  const resetProfileForm = () => {
    setProfileForm({
      name: "",
      description: "",
      ovpnConfig: "",
      username: "",
      password: "",
    });
  };

  const openEditProfile = (profile: VpnProfile) => {
    setEditingProfile(profile);
    setProfileForm({
      name: profile.name,
      description: profile.description || "",
      ovpnConfig: profile.ovpnConfig,
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
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-page-title">VPN Profiles</h1>
          <p className="text-sm text-muted-foreground">
            Manage OpenVPN profiles for secure OLT connectivity
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingProfile(null);
            resetProfileForm();
            setProfileDialogOpen(true);
          }}
          data-testid="button-add-profile"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Profile
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
            <CardTitle className="text-sm font-medium">Total Profiles</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-profiles">{profiles?.length || 0}</div>
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
            <CardTitle>VPN Profiles</CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search profiles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
                data-testid="input-search-profiles"
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
              title="No VPN Profiles"
              description="Create an OpenVPN profile to enable secure OLT connections"
              action={{
                label: "Add Profile",
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
                          <DropdownMenuItem
                            onClick={() => window.open(`/api/vpn/profiles/${profile.id}/server-config`, "_blank")}
                            data-testid={`button-server-config-${profile.id}`}
                          >
                            <Server className="h-4 w-4 mr-2" />
                            Download Server Config
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
            <DialogTitle>{editingProfile ? "Edit VPN Profile" : "Add VPN Profile"}</DialogTitle>
            <DialogDescription>
              {editingProfile
                ? "Update the OpenVPN profile configuration"
                : "Create a new OpenVPN profile for OLT connectivity"}
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
              <Label>OpenVPN Configuration (.ovpn)</Label>
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
              <Textarea
                value={profileForm.ovpnConfig}
                onChange={(e) => setProfileForm({ ...profileForm, ovpnConfig: e.target.value })}
                placeholder="Paste OpenVPN configuration or upload a file..."
                className="font-mono text-sm min-h-[200px]"
                data-testid="textarea-ovpn-config"
              />
              {profileForm.ovpnConfig && (
                <p className="text-xs text-muted-foreground">
                  Configuration loaded ({profileForm.ovpnConfig.split("\n").length} lines)
                </p>
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
                !profileForm.ovpnConfig ||
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
