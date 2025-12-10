import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { TableSkeleton } from "@/components/loading-skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import {
  Search,
  Bell,
  AlertTriangle,
  AlertCircle,
  Info,
  Check,
  X,
  Clock,
} from "lucide-react";
import type { Alert, Olt, Onu } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

export default function AlertsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("active");
  const { toast } = useToast();

  const { data: alerts, isLoading } = useQuery<Alert[]>({
    queryKey: ["/api/alerts"],
  });

  const { data: olts } = useQuery<Olt[]>({
    queryKey: ["/api/olts"],
  });

  const { data: onus } = useQuery<Onu[]>({
    queryKey: ["/api/onus"],
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async (alertId: string) => {
      return apiRequest("POST", `/api/alerts/${alertId}/acknowledge`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      toast({
        title: "Alert Acknowledged",
        description: "The alert has been acknowledged",
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
        description: "Failed to acknowledge alert",
        variant: "destructive",
      });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async (alertId: string) => {
      return apiRequest("POST", `/api/alerts/${alertId}/resolve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      toast({
        title: "Alert Resolved",
        description: "The alert has been marked as resolved",
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
        description: "Failed to resolve alert",
        variant: "destructive",
      });
    },
  });

  const getOltName = (oltId: string | null) => {
    if (!oltId) return null;
    return olts?.find((o) => o.id === oltId)?.name;
  };

  const getOnuName = (onuId: string | null) => {
    if (!onuId) return null;
    const onu = onus?.find((o) => o.id === onuId);
    return onu?.name || onu?.serialNumber;
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const filteredAlerts = alerts?.filter((alert) => {
    const matchesSearch =
      alert.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      alert.message.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesSeverity = severityFilter === "all" || alert.severity === severityFilter;
    
    const matchesTab =
      activeTab === "all" ||
      (activeTab === "active" && alert.status === "active") ||
      (activeTab === "acknowledged" && alert.status === "acknowledged") ||
      (activeTab === "resolved" && alert.status === "resolved");

    return matchesSearch && matchesSeverity && matchesTab;
  });

  const alertCounts = {
    all: alerts?.length || 0,
    active: alerts?.filter((a) => a.status === "active").length || 0,
    acknowledged: alerts?.filter((a) => a.status === "acknowledged").length || 0,
    resolved: alerts?.filter((a) => a.status === "resolved").length || 0,
  };

  const criticalCount = alerts?.filter((a) => a.severity === "critical" && a.status === "active").length || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Alerts</h1>
          <p className="text-sm text-muted-foreground">
            Monitor network alerts and notifications
          </p>
        </div>
        {criticalCount > 0 && (
          <Badge variant="destructive" className="text-sm">
            {criticalCount} Critical Alert{criticalCount > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <TabsList>
            <TabsTrigger value="active" data-testid="tab-active">
              Active
              {alertCounts.active > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {alertCounts.active}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="acknowledged" data-testid="tab-acknowledged">
              Acknowledged
              {alertCounts.acknowledged > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {alertCounts.acknowledged}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="resolved" data-testid="tab-resolved">
              Resolved
            </TabsTrigger>
            <TabsTrigger value="all" data-testid="tab-all">
              All
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mt-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search alerts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-alerts"
            />
          </div>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-36" data-testid="select-severity-filter">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severity</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="info">Info</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <TabsContent value={activeTab} className="mt-4">
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <TableSkeleton rows={6} />
              ) : filteredAlerts && filteredAlerts.length > 0 ? (
                <div className="divide-y">
                  {filteredAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="p-4 flex items-start gap-4 hover-elevate"
                      data-testid={`alert-item-${alert.id}`}
                    >
                      <div className="mt-0.5">{getSeverityIcon(alert.severity)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h4 className="font-medium">{alert.title}</h4>
                          <StatusBadge status={alert.severity} />
                          <StatusBadge status={alert.status || "active"} />
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {alert.message}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {alert.oltId && (
                            <span>OLT: {getOltName(alert.oltId)}</span>
                          )}
                          {alert.onuId && (
                            <span>ONU: {getOnuName(alert.onuId)}</span>
                          )}
                          {alert.source && <span>Source: {alert.source}</span>}
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {alert.createdAt
                              ? formatDistanceToNow(new Date(alert.createdAt), {
                                  addSuffix: true,
                                })
                              : "Unknown"}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {alert.status === "active" && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => acknowledgeMutation.mutate(alert.id)}
                              disabled={acknowledgeMutation.isPending}
                              data-testid={`button-acknowledge-${alert.id}`}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Acknowledge
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => resolveMutation.mutate(alert.id)}
                              disabled={resolveMutation.isPending}
                              data-testid={`button-resolve-${alert.id}`}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Resolve
                            </Button>
                          </>
                        )}
                        {alert.status === "acknowledged" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => resolveMutation.mutate(alert.id)}
                            disabled={resolveMutation.isPending}
                            data-testid={`button-resolve-${alert.id}`}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Resolve
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<Bell className="h-8 w-8" />}
                  title="No Alerts"
                  description={
                    searchQuery || severityFilter !== "all"
                      ? "No alerts match your search or filter criteria"
                      : activeTab === "active"
                      ? "No active alerts - all systems are operating normally"
                      : `No ${activeTab} alerts found`
                  }
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
