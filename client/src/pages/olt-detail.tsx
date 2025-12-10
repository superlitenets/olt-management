import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/status-badge";
import { VendorLogo } from "@/components/vendor-logo";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import {
  ArrowLeft,
  RefreshCw,
  Wifi,
  Server,
  Cpu,
  HardDrive,
  Thermometer,
  Clock,
  MapPin,
  Network,
  Settings,
  Loader2,
} from "lucide-react";
import type { Olt, Onu } from "@shared/schema";

export default function OltDetailPage() {
  const [, params] = useRoute("/olts/:id");
  const oltId = params?.id;
  const { toast } = useToast();

  const { data: olt, isLoading: oltLoading } = useQuery<Olt>({
    queryKey: ["/api/olts", oltId],
    enabled: !!oltId,
  });

  const { data: onus } = useQuery<Onu[]>({
    queryKey: ["/api/onus"],
  });

  const oltOnus = onus?.filter((onu) => onu.oltId === oltId) || [];

  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/olts/${oltId}/test-connection`);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/olts", oltId] });
      const results = data.results;
      toast({
        title: results.snmp || results.telnet ? "Connection Successful" : "Connection Failed",
        description: `SNMP: ${results.snmp ? "OK" : "Failed"}, Telnet: ${results.telnet ? "OK" : "Failed"}${results.errors.length > 0 ? ` - ${results.errors[0]}` : ""}`,
        variant: results.snmp || results.telnet ? "default" : "destructive",
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
        title: "Test Failed",
        description: "Could not test OLT connection",
        variant: "destructive",
      });
    },
  });

  const pollMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/olts/${oltId}/poll`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/olts", oltId] });
      toast({
        title: "Poll Complete",
        description: "OLT metrics have been updated",
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
        title: "Poll Failed",
        description: "Could not poll OLT metrics",
        variant: "destructive",
      });
    },
  });

  const discoverOnusMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/olts/${oltId}/discover-onus`);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/onus"] });
      queryClient.invalidateQueries({ queryKey: ["/api/olts", oltId] });
      toast({
        title: "Discovery Complete",
        description: `Found ${data.summary?.discovered || 0} ONUs: ${data.summary?.created || 0} new, ${data.summary?.updated || 0} updated`,
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
        title: "Discovery Failed",
        description: error.message || "Could not discover ONUs",
        variant: "destructive",
      });
    },
  });

  if (oltLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!olt) {
    return (
      <div className="space-y-6">
        <Link href="/olts">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to OLTs
          </Button>
        </Link>
        <Card>
          <CardContent className="p-8 text-center">
            <Server className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-lg font-medium mb-2">OLT Not Found</h2>
            <p className="text-sm text-muted-foreground">
              The OLT you're looking for doesn't exist or has been removed.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Link href="/olts">
            <Button variant="ghost" size="sm" data-testid="button-back-olts">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <VendorLogo vendor={olt.vendor} />
            <div>
              <h1 className="text-2xl font-semibold">{olt.name}</h1>
              <p className="text-sm text-muted-foreground font-mono">{olt.ipAddress}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => testConnectionMutation.mutate()}
            disabled={testConnectionMutation.isPending}
            data-testid="button-test-connection"
          >
            {testConnectionMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Wifi className="h-4 w-4 mr-2" />
            )}
            Test Connection
          </Button>
          <Button
            variant="outline"
            onClick={() => pollMutation.mutate()}
            disabled={pollMutation.isPending}
            data-testid="button-poll-olt"
          >
            {pollMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Poll Now
          </Button>
          <Button
            variant="outline"
            onClick={() => discoverOnusMutation.mutate()}
            disabled={discoverOnusMutation.isPending}
            data-testid="button-discover-onus"
          >
            {discoverOnusMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Network className="h-4 w-4 mr-2" />
            )}
            Discover ONUs
          </Button>
          <Button variant="outline" data-testid="button-configure-olt">
            <Settings className="h-4 w-4 mr-2" />
            Configure
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">OLT Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <StatusBadge status={olt.status || "offline"} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Vendor</p>
                <p className="font-medium capitalize">{olt.vendor}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Model</p>
                <p className="font-medium">{olt.model || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Network Type</p>
                <Badge variant="outline">{olt.networkType?.toUpperCase() || "GPON"}</Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total PON Ports</p>
                <p className="font-medium">{olt.totalPorts || 16}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active ONUs</p>
                <p className="font-medium">{olt.activeOnus || 0}</p>
              </div>
            </div>

            {olt.location && (
              <>
                <Separator />
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{olt.location}</span>
                </div>
              </>
            )}

            <Separator />

            <div>
              <h4 className="text-sm font-medium mb-3">Connection Settings</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">SNMP Read Community</p>
                  <p className="font-mono">{olt.snmpCommunity || "public"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">SNMP Write Community</p>
                  <p className="font-mono">{olt.snmpWriteCommunity || "private"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">SNMP Port</p>
                  <p className="font-mono">{olt.snmpPort || 161}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">CLI Port</p>
                  <p className="font-mono">{olt.sshPort || 23}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">CLI Username</p>
                  <p className="font-mono">{olt.sshUsername || "N/A"}</p>
                </div>
              </div>
            </div>

            {olt.acsEnabled && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-medium mb-3">TR-069/ACS Configuration</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="col-span-2">
                      <p className="text-muted-foreground">ACS URL</p>
                      <p className="font-mono text-xs break-all">{olt.acsUrl || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">ACS Username</p>
                      <p className="font-mono">{olt.acsUsername || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Periodic Inform</p>
                      <p className="font-mono">{olt.acsPeriodicInformInterval || 3600}s</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">System Metrics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">CPU Usage</span>
                </div>
                <span className="font-mono text-sm">
                  {olt.cpuUsage !== null ? `${olt.cpuUsage}%` : "N/A"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Memory Usage</span>
                </div>
                <span className="font-mono text-sm">
                  {olt.memoryUsage !== null ? `${olt.memoryUsage}%` : "N/A"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Thermometer className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Temperature</span>
                </div>
                <span className="font-mono text-sm">
                  {olt.temperature !== null ? `${olt.temperature}°C` : "N/A"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Uptime</span>
                </div>
                <span className="font-mono text-sm">
                  {olt.uptime ? formatUptime(olt.uptime) : "N/A"}
                </span>
              </div>
              {olt.lastPolled && (
                <p className="text-xs text-muted-foreground pt-2 border-t">
                  Last polled: {new Date(olt.lastPolled).toLocaleString()}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between gap-2">
                <span>Connected ONUs</span>
                <Badge variant="secondary">{oltOnus.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {oltOnus.length > 0 ? (
                <div className="space-y-2">
                  {oltOnus.slice(0, 5).map((onu) => (
                    <Link key={onu.id} href={`/onus`}>
                      <div className="flex items-center justify-between p-2 rounded-md hover-elevate cursor-pointer">
                        <div className="flex items-center gap-2">
                          <Network className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{onu.name || onu.serialNumber}</span>
                        </div>
                        <StatusBadge status={onu.status || "offline"} />
                      </div>
                    </Link>
                  ))}
                  {oltOnus.length > 5 && (
                    <Link href="/onus">
                      <Button variant="ghost" size="sm" className="w-full">
                        View all {oltOnus.length} ONUs
                      </Button>
                    </Link>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No ONUs connected to this OLT
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {olt.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{olt.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}
