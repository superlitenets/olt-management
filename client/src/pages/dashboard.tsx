import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { VendorLogo } from "@/components/vendor-logo";
import { DashboardSkeleton } from "@/components/loading-skeleton";
import { EmptyState } from "@/components/empty-state";
import { Server, Radio, AlertTriangle, Activity, TrendingUp, Wifi, WifiOff } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import type { Olt, Onu, Alert } from "@shared/schema";
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
} from "recharts";

const signalChartData = [
  { time: "00:00", signal: -24.5 },
  { time: "04:00", signal: -24.2 },
  { time: "08:00", signal: -25.1 },
  { time: "12:00", signal: -24.8 },
  { time: "16:00", signal: -25.3 },
  { time: "20:00", signal: -24.7 },
  { time: "Now", signal: -24.9 },
];

export default function Dashboard() {
  const { data: olts, isLoading: oltsLoading } = useQuery<Olt[]>({
    queryKey: ["/api/olts"],
  });

  const { data: onus, isLoading: onusLoading } = useQuery<Onu[]>({
    queryKey: ["/api/onus"],
  });

  const { data: alerts, isLoading: alertsLoading } = useQuery<Alert[]>({
    queryKey: ["/api/alerts", { status: "active" }],
  });

  const isLoading = oltsLoading || onusLoading || alertsLoading;

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const totalOlts = olts?.length || 0;
  const onlineOlts = olts?.filter((o) => o.status === "online").length || 0;
  const totalOnus = onus?.length || 0;
  const onlineOnus = onus?.filter((o) => o.status === "online").length || 0;
  const offlineOnus = onus?.filter((o) => o.status === "offline").length || 0;
  const activeAlerts = alerts?.filter((a) => a.status === "active").length || 0;
  const criticalAlerts = alerts?.filter((a) => a.severity === "critical" && a.status === "active").length || 0;

  const onuStatusData = [
    { name: "Online", value: onlineOnus, color: "hsl(142, 76%, 36%)" },
    { name: "Offline", value: offlineOnus, color: "hsl(0, 0%, 45%)" },
    { name: "LOS", value: onus?.filter((o) => o.status === "los").length || 0, color: "hsl(0, 84%, 60%)" },
  ];

  const recentAlerts = alerts?.slice(0, 5) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Network overview and key metrics</p>
        </div>
        <div className="flex items-center gap-2">
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
          trend={{ value: 5, label: "vs last month" }}
          status={onlineOlts === totalOlts ? "success" : "warning"}
        />
        <StatCard
          title="Online ONUs"
          value={`${onlineOnus}/${totalOnus}`}
          icon={<Radio className="h-5 w-5" />}
          trend={{ value: totalOnus > 0 ? Math.round((onlineOnus / totalOnus) * 100) - 95 : 0, label: "uptime" }}
          status={onlineOnus === totalOnus ? "success" : offlineOnus > 5 ? "danger" : "warning"}
        />
        <StatCard
          title="Active Alerts"
          value={activeAlerts}
          icon={<AlertTriangle className="h-5 w-5" />}
          status={criticalAlerts > 0 ? "danger" : activeAlerts > 0 ? "warning" : "success"}
        />
        <StatCard
          title="Avg Signal"
          value="-24.9 dBm"
          icon={<Activity className="h-5 w-5" />}
          trend={{ value: 2, label: "improvement" }}
          status="success"
        />
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
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={signalChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis
                    domain={[-30, -20]}
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                    tickFormatter={(value) => `${value}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                    }}
                    formatter={(value: number) => [`${value} dBm`, "RX Power"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="signal"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--primary))", r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
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
