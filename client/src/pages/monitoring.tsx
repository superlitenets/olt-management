import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/stat-card";
import { DashboardSkeleton } from "@/components/loading-skeleton";
import { Activity, Server, Radio, Thermometer, Cpu, HardDrive, Wifi } from "lucide-react";
import type { Olt, Onu } from "@shared/schema";


export default function MonitoringPage() {
  const { data: olts, isLoading: oltsLoading } = useQuery<Olt[]>({
    queryKey: ["/api/olts"],
  });

  const { data: onus, isLoading: onusLoading } = useQuery<Onu[]>({
    queryKey: ["/api/onus"],
  });

  const isLoading = oltsLoading || onusLoading;

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const totalOlts = olts?.length || 0;
  const onlineOlts = olts?.filter((o) => o.status === "online").length || 0;
  const totalOnus = onus?.length || 0;
  const onlineOnus = onus?.filter((o) => o.status === "online").length || 0;

  const avgCpu = olts?.reduce((sum, o) => sum + (o.cpuUsage || 0), 0) / (totalOlts || 1);
  const avgMemory = olts?.reduce((sum, o) => sum + (o.memoryUsage || 0), 0) / (totalOlts || 1);
  const avgTemp = olts?.reduce((sum, o) => sum + (o.temperature || 0), 0) / (totalOlts || 1);

  const avgRxPower =
    onus?.reduce((sum, o) => sum + (o.rxPower || 0), 0) / (onlineOnus || 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Network Monitoring</h1>
          <p className="text-sm text-muted-foreground">
            Real-time network performance and health metrics
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Live Monitoring
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="OLT Uptime"
          value={`${Math.round((onlineOlts / totalOlts) * 100) || 0}%`}
          icon={<Server className="h-5 w-5" />}
          status={onlineOlts === totalOlts ? "success" : "warning"}
        />
        <StatCard
          title="ONU Uptime"
          value={`${Math.round((onlineOnus / totalOnus) * 100) || 0}%`}
          icon={<Radio className="h-5 w-5" />}
          status={onlineOnus >= totalOnus * 0.95 ? "success" : "warning"}
        />
        <StatCard
          title="Avg Signal"
          value={`${avgRxPower.toFixed(1)} dBm`}
          icon={<Wifi className="h-5 w-5" />}
          status={avgRxPower >= -27 ? "success" : avgRxPower >= -28 ? "warning" : "danger"}
        />
        <StatCard
          title="Active Connections"
          value={onlineOnus}
          icon={<Activity className="h-5 w-5" />}
          status="success"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <StatCard
          title="Avg CPU Usage"
          value={`${avgCpu.toFixed(1)}%`}
          icon={<Cpu className="h-5 w-5" />}
          status={avgCpu < 70 ? "success" : avgCpu < 85 ? "warning" : "danger"}
        />
        <StatCard
          title="Avg Memory"
          value={`${avgMemory.toFixed(1)}%`}
          icon={<HardDrive className="h-5 w-5" />}
          status={avgMemory < 70 ? "success" : avgMemory < 85 ? "warning" : "danger"}
        />
        <StatCard
          title="Avg Temperature"
          value={`${avgTemp.toFixed(1)}C`}
          icon={<Thermometer className="h-5 w-5" />}
          status={avgTemp < 50 ? "success" : avgTemp < 60 ? "warning" : "danger"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Network Traffic</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72 flex items-center justify-center">
              <p className="text-muted-foreground text-sm text-center">
                Traffic data will appear here once OLTs are polled
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Signal Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72 flex items-center justify-center">
              <p className="text-muted-foreground text-sm text-center">
                Signal distribution will appear here once ONUs are polled
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">OLT Health Status</CardTitle>
        </CardHeader>
        <CardContent>
          {olts && olts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {olts.map((olt) => (
                <div
                  key={olt.id}
                  className="p-4 rounded-md border bg-muted/50"
                  data-testid={`olt-health-${olt.id}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">{olt.name}</h4>
                    <Badge
                      variant={olt.status === "online" ? "default" : "secondary"}
                      className={
                        olt.status === "online"
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : ""
                      }
                    >
                      {olt.status}
                    </Badge>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">CPU</span>
                      <span className="font-mono">{olt.cpuUsage?.toFixed(1) || 0}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          (olt.cpuUsage || 0) < 70
                            ? "bg-emerald-500"
                            : (olt.cpuUsage || 0) < 85
                            ? "bg-amber-500"
                            : "bg-red-500"
                        }`}
                        style={{ width: `${olt.cpuUsage || 0}%` }}
                      />
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Memory</span>
                      <span className="font-mono">{olt.memoryUsage?.toFixed(1) || 0}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          (olt.memoryUsage || 0) < 70
                            ? "bg-emerald-500"
                            : (olt.memoryUsage || 0) < 85
                            ? "bg-amber-500"
                            : "bg-red-500"
                        }`}
                        style={{ width: `${olt.memoryUsage || 0}%` }}
                      />
                    </div>
                    <div className="flex justify-between pt-1">
                      <span className="text-muted-foreground">Temperature</span>
                      <span className="font-mono">{olt.temperature?.toFixed(0) || 0}C</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No OLTs configured. Add OLTs to see health metrics.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
