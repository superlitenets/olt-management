import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Server, Radio, Shield, Activity, Zap, Globe, ChevronRight } from "lucide-react";

const features = [
  {
    icon: Server,
    title: "Multi-Vendor Support",
    description: "Manage OLTs from Huawei, ZTE, FiberHome, Nokia and more from a single dashboard",
  },
  {
    icon: Radio,
    title: "Zero-Touch Provisioning",
    description: "New ONUs activate automatically with minimal manual configuration",
  },
  {
    icon: Activity,
    title: "Real-Time Monitoring",
    description: "Track signal strength, optical power, traffic, and device health in real-time",
  },
  {
    icon: Shield,
    title: "Role-Based Access",
    description: "Multi-tenant architecture with granular permissions for teams",
  },
  {
    icon: Zap,
    title: "Remote Management",
    description: "Restart, configure, and troubleshoot ONUs without field visits",
  },
  {
    icon: Globe,
    title: "Triple-Play Services",
    description: "Manage Internet, IPTV, and VoIP services with flexible VLAN configuration",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Server className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold">OLT Manager</span>
          </div>
          <Button asChild data-testid="button-login">
            <a href="/api/login">
              Sign In
              <ChevronRight className="ml-1 h-4 w-4" />
            </a>
          </Button>
        </div>
      </header>

      <main>
        <section className="py-20 px-4">
          <div className="container mx-auto text-center max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
              Centralized OLT & ONU Management
            </h1>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Cloud-based network management for GPON and EPON deployments. Monitor, configure, and 
              troubleshoot your fiber network from anywhere.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button size="lg" asChild data-testid="button-get-started">
                <a href="/api/login">
                  Get Started
                  <ChevronRight className="ml-1 h-4 w-4" />
                </a>
              </Button>
              <Button size="lg" variant="outline" data-testid="button-learn-more">
                Learn More
              </Button>
            </div>
          </div>
        </section>

        <section className="py-16 px-4 bg-muted/50">
          <div className="container mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-3xl font-bold mb-4">
                Everything You Need to Manage Your Network
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                A complete solution for ISPs and network operators to manage fiber optic infrastructure
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature) => (
                <Card key={feature.title} className="border-0 shadow-none bg-transparent">
                  <CardContent className="p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary mb-4">
                      <feature.icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 px-4">
          <div className="container mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              <div>
                <div className="text-3xl md:text-4xl font-bold text-primary mb-1">99.9%</div>
                <div className="text-sm text-muted-foreground">Uptime SLA</div>
              </div>
              <div>
                <div className="text-3xl md:text-4xl font-bold text-primary mb-1">1M+</div>
                <div className="text-sm text-muted-foreground">ONUs Managed</div>
              </div>
              <div>
                <div className="text-3xl md:text-4xl font-bold text-primary mb-1">50+</div>
                <div className="text-sm text-muted-foreground">ISP Partners</div>
              </div>
              <div>
                <div className="text-3xl md:text-4xl font-bold text-primary mb-1">24/7</div>
                <div className="text-sm text-muted-foreground">Support</div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 px-4 bg-muted/50">
          <div className="container mx-auto text-center max-w-2xl">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Ready to Streamline Your Network Operations?
            </h2>
            <p className="text-muted-foreground mb-8">
              Join hundreds of ISPs who trust our platform to manage their fiber infrastructure
            </p>
            <Button size="lg" asChild data-testid="button-cta">
              <a href="/api/login">
                Start Managing Your Network
                <ChevronRight className="ml-1 h-4 w-4" />
              </a>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t py-8 px-4">
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">OLT Manager</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Cloud-based network management for modern ISPs
          </p>
        </div>
      </footer>
    </div>
  );
}
