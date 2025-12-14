import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { VendorLogo } from "@/components/vendor-logo";
import { DashboardSkeleton } from "@/components/loading-skeleton";
import { EmptyState } from "@/components/empty-state";
import { Server, Radio, AlertTriangle, Activity, WifiOff, Zap, RefreshCw } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import type { Olt, Alert  } from "@shared/schema";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";

interface DashboardStats {
  totalOlts: number;
  onlineOlts: number;
  totalOnus: number;
  onlineOnus: number;
  offlineOnus: number;
  losOnus: number;
  activeAlerts: number;
  criticalAlerts: number;
  avgRxPower: number | null;
}


export default function Dashboard() {
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  const { data: olts, isLoading: oltsLoading } = useQuery<Olt[]>({
    queryKey: ["/api/olts"],
  });

  const { data: alerts, isLoading: alertsLoading } = useQuery<Alert[]>({
    queryKey: ["/api/alerts", { status: "active" }],
  });

  const isLoading = statsLoading || oltsLoading || alertsLoading;

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const totalOlts = stats?.totalOlts || 0;
  const onlineOlts = stats?.onlineOlts || 0;
  const totalOnus = stats?.totalOnus || 0;
  const onlineOnus = stats?.onlineOnus || 0;
  const offlineOnus = stats?.offlineOnus || 0;
  const losOnus = stats?.losOnus || 0;
  const activeAlerts = stats?.activeAlerts || 0;
  const criticalAlerts = stats?.criticalAlerts || 0;
  const avgRxPower = stats?.avgRxPower;

  const onuStatusData = [
    { name: "Online", value: onlineOnus, color: "hsl(142, 76%, 36%)" },
    { name: "Offline", value: offlineOnus, color: "hsl(0, 0%, 45%)" },
    { name: "LOS", value: losOnus, color: "hsl(0, 84%, 60%)" },
  ];

  const recentAlerts = alerts?.slice(0, 5) || [];
  
  // Calculate uptime percentage
  const uptimePercent = totalOnus > 0 ? Math.round((onlineOnus / totalOnus) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-dashboard-title">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Network overview and key metrics</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetchStats()}
            data-testid="button-refresh-stats"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total OLTs"
          value={totalOlts}
          icon={<Server className="h-5 w-5" />}
          trend={{ value: onlineOlts, label: "online" }}
          status={onlineOlts === totalOlts ? "success" : "warning"}
        />
        <StatCard
          title="Online ONUs"
          value={`${onlineOnus}/${totalOnus}`}
          icon={<Radio className="h-5 w-5" />}
          trend={{ value: uptimePercent, label: "% uptime" }}
          status={uptimePercent >= 98 ? "success" : uptimePercent >= 90 ? "warning" : "danger"}
        />
        <StatCard
          title="LOS / Offline"
          value={`${losOnus} / ${offlineOnus}`}
          icon={<WifiOff className="h-5 w-5" />}
          status={losOnus > 0 ? "danger" : offlineOnus > 0 ? "warning" : "success"}
        />
        <StatCard
          title="Avg Signal"
          value={avgRxPower != null ? `${avgRxPower.toFixed(1)} dBm` : "N/A"}
          icon={<Activity className="h-5 w-5" />}
          status={avgRxPower != null && avgRxPower > -27 ? "success" : avgRxPower != null && avgRxPower > -29 ? "warning" : "danger"}
        />
      </div>

      {/* Quick stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-emerald-500/10 border-emerald-500/20">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-emerald-500/20">
                <Zap className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400" data-testid="text-online-onus">{onlineOnus}</p>
                <p className="text-xs text-muted-foreground">Online ONUs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-red-500/10 border-red-500/20">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-red-500/20">
                <WifiOff className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400" data-testid="text-los-onus">{losOnus}</p>
                <p className="text-xs text-muted-foreground">LOS (Fiber Cut)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/10 border-amber-500/20">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-amber-500/20">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400" data-testid="text-active-alerts">{activeAlerts}</p>
                <p className="text-xs text-muted-foreground">Active Alerts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-blue-500/10 border-blue-500/20">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-blue-500/20">
                <Server className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400" data-testid="text-total-olts">{totalOlts}</p>
                <p className="text-xs text-muted-foreground">Active OLTs</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
            <CardTitle className="text-base font-medium">Signal Quality Trend</CardTitle>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-primary" />
                Avg RX Power
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Signal data will appear here</p>
                <p className="text-xs">as ONUs are polled and monitored</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">ONU Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={onuStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {onuStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 mt-2">
              {onuStatusData.map((item) => (
                <div key={item.name} className="flex items-center gap-1.5 text-xs">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  {item.name}: {item.value}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
            <CardTitle className="text-base font-medium">OLT Overview</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/olts" data-testid="link-view-all-olts">
                View All
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {(!olts || olts.length === 0) ? (
              <EmptyState
                icon={<Server className="h-8 w-8" />}
                title="No OLTs Configured"
                description="Add your first OLT to start managing your network"
                action={{
                  label: "Add OLT",
                  onClick: () => window.location.href = "/olts",
                }}
              />
            ) : (
              <div className="space-y-3">
                {olts.slice(0, 4).map((olt) => (
                  <div
                    key={olt.id}
                    className="flex items-center gap-3 p-3 rounded-md bg-muted/50 hover-elevate"
                    data-testid={`olt-card-${olt.id}`}
                  >
                    <VendorLogo vendor={olt.vendor} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{olt.name}</span>
                        <StatusBadge status={olt.status || "offline"} />
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">
                        {olt.ipAddress}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">{olt.activeOnus || 0}</div>
                      <div className="text-xs text-muted-foreground">ONUs</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
            <CardTitle className="text-base font-medium">Recent Alerts</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/alerts" data-testid="link-view-all-alerts">
                View All
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentAlerts.length === 0 ? (
              <EmptyState
                icon={<AlertTriangle className="h-8 w-8" />}
                title="No Active Alerts"
                description="All systems are operating normally"
              />
            ) : (
              <div className="space-y-3">
                {recentAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-start gap-3 p-3 rounded-md bg-muted/50"
                    data-testid={`alert-item-${alert.id}`}
                  >
                    <div
                      className={`mt-0.5 h-2 w-2 rounded-full ${
                        alert.severity === "critical"
                          ? "bg-red-500 animate-pulse"
                          : alert.severity === "warning"
                          ? "bg-amber-500"
                          : "bg-blue-500"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{alert.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {alert.message}
                      </p>
                    </div>
                    <StatusBadge status={alert.severity} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
