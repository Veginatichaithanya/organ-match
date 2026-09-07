import * as React from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  Blocks,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock,
  HeartHandshake,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  MoreVertical,
  ScrollText,
  Settings,
  ShieldAlert,
  Shuffle,
  UserCog,
  Users,
  Waves,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { canAccessPath, ROLE_LABELS } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const ADMIN_NAV_ITEMS = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard },
  { to: "/admin/users", label: "Users", icon: UserCog },
  { to: "/admin/roles", label: "Roles & Permissions", icon: KeyRound },
  { to: "/admin/hospitals", label: "Hospitals", icon: Building2 },
  { to: "/admin/settings", label: "System Settings", icon: Settings },
  { to: "/admin/monitoring", label: "System Monitoring", icon: Activity },
  { to: "/admin/tampering", label: "Tampering Alerts", icon: AlertTriangle },
  { to: "/admin/blockchain", label: "Blockchain Verification", icon: Blocks },
] as const;

const COORDINATOR_NAV_ITEMS = [
  { to: "/coordinator", label: "Overview", icon: LayoutDashboard },
  { to: "/coordinator/donors", label: "Donors", icon: HeartHandshake },
  { to: "/coordinator/organs", label: "Organs", icon: Waves },
  { to: "/coordinator/recipients", label: "Recipients", icon: Users },
  { to: "/coordinator/matching", label: "Matching", icon: Shuffle },
  { to: "/coordinator/allocations", label: "Allocations", icon: ClipboardCheck },
] as const;

const DOCTOR_NAV_ITEMS = [
  { to: "/doctor", label: "01 Overview", icon: LayoutDashboard },
  { to: "/doctor/assessments", label: "02 Clinical Assessments", icon: ClipboardList },
  { to: "/doctor/matches", label: "03 Match Reviews", icon: Shuffle },
  { to: "/doctor/history", label: "04 Review History", icon: Clock },
] as const;

const ALLOCATION_NAV_ITEMS = [
  { to: "/allocation", label: "Overview", icon: LayoutDashboard },
  { to: "/allocation/organs", label: "Available Organs", icon: Waves },
  { to: "/allocation/matches", label: "Match Reviews", icon: Shuffle },
  { to: "/allocation/queue", label: "Allocation Queue", icon: ClipboardCheck },
  { to: "/allocations", label: "Approved Allocations", icon: CheckCircle2 },
  { to: "/allocation/history", label: "Allocation History", icon: Clock },
] as const;

const AUDITOR_NAV_ITEMS = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/blockchain", label: "Blockchain Verification", icon: Blocks },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/donors", label: "Donors", icon: HeartHandshake },
  { to: "/recipients", label: "Recipients", icon: Users },
  { to: "/organs", label: "Organs", icon: Waves },
  { to: "/matching", label: "Matching", icon: Shuffle },
  { to: "/allocations", label: "Allocations", icon: ClipboardCheck },
  { to: "/audit", label: "Audit Log", icon: ScrollText },
  { to: "/blockchain", label: "Blockchain", icon: Blocks },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function NavLinks({
  isCollapsed = false,
  onNavigate,
}: {
  isCollapsed?: boolean;
  onNavigate?: () => void;
}) {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const isCoordinator = role === "hospital";
  const isDoctor = role === "doctor";
  const isAllocation = role === "transplant_center";
  const isAuditor = role === "auditor";

  const items = isAdmin
    ? ADMIN_NAV_ITEMS
    : isCoordinator
    ? COORDINATOR_NAV_ITEMS
    : isDoctor
    ? DOCTOR_NAV_ITEMS
    : isAllocation
    ? ALLOCATION_NAV_ITEMS
    : isAuditor
    ? AUDITOR_NAV_ITEMS
    : NAV_ITEMS.filter((item) => role && canAccessPath(role, item.to));

  const sectionTitle = isAdmin
    ? "ADMINISTRATION"
    : isCoordinator
    ? "COORDINATOR CONSOLE"
    : isDoctor
    ? "CLINICAL REVIEW"
    : isAllocation
    ? "ALLOCATION AUTHORITY"
    : isAuditor
    ? "AUDITOR INVESTIGATION"
    : null;

  return (
    <nav className="flex flex-col gap-1 px-3">
      {sectionTitle && !isCollapsed && (
        <div className="px-3.5 pt-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
          {sectionTitle}
        </div>
      )}
      {items.map(({ to, label, icon: Icon }) => {
        const isExactMatch =
          to === "/admin" ||
          to === "/coordinator" ||
          to === "/doctor" ||
          to === "/allocation" ||
          to === "/dashboard";

        const linkContent = (
          <Link
            key={to}
            to={to}
            onClick={onNavigate}
            activeOptions={{ exact: isExactMatch }}
            activeProps={{
              className:
                "bg-primary/10 text-primary font-semibold border border-primary/30 shadow-2xs",
            }}
            className={cn(
              "flex items-center gap-3 rounded-lg text-sm transition-all duration-150 border border-transparent hover:border-gray-200 hover:bg-muted/70 hover:text-foreground",
              isCollapsed
                ? "h-10 w-10 justify-center p-0 mx-auto"
                : "px-3.5 py-2.5 text-foreground/80 font-medium"
            )}
          >
            <Icon className="h-[18px] w-[18px] shrink-0 text-primary/80" />
            {!isCollapsed && <span className="truncate">{label}</span>}
          </Link>
        );

        if (isCollapsed) {
          return (
            <Tooltip key={to} delayDuration={100}>
              <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
              <TooltipContent side="right" className="font-medium text-xs">
                {label}
              </TooltipContent>
            </Tooltip>
          );
        }

        return linkContent;
      })}
    </nav>
  );
}

function SidebarBrand({ isCollapsed }: { isCollapsed?: boolean }) {
  const { role } = useAuth();
  const homeLink =
    role === "admin"
      ? "/admin"
      : role === "hospital"
      ? "/coordinator"
      : role === "doctor"
      ? "/doctor"
      : role === "transplant_center"
      ? "/allocation"
      : "/dashboard";

  const subtitle =
    role === "admin"
      ? "System Administration"
      : role === "hospital"
      ? "Hospital Operations"
      : role === "doctor"
      ? "Clinical Review"
      : role === "transplant_center"
      ? "National Organ Registry"
      : role === "auditor"
      ? "Security & Compliance Audit"
      : "Secure Donation Network";

  return (
    <Link
      to={homeLink}
      className={cn(
        "flex items-center gap-3 transition-all",
        isCollapsed ? "px-3 py-4 justify-center" : "px-5 py-4"
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
        <HeartHandshake className="h-5 w-5" />
      </div>
      {!isCollapsed && (
        <div className="leading-tight min-w-0 flex-1">
          <span className="block text-[15px] font-bold text-foreground tracking-tight truncate">
            OrganMatch
          </span>
          <span className="block text-[11px] font-medium text-muted-foreground truncate">
            {subtitle}
          </span>
        </div>
      )}
    </Link>
  );
}

function SidebarUserProfile({ isCollapsed }: { isCollapsed?: boolean }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <div className="border-t border-border/80 p-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "flex items-center gap-3 w-full rounded-xl p-2 transition-all hover:bg-muted/80 border border-transparent hover:border-gray-200/80 text-left",
              isCollapsed && "justify-center px-0"
            )}
          >
            <Avatar className="h-9 w-9 shrink-0 border border-primary/20">
              <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                {initials(user.name)}
              </AvatarFallback>
            </Avatar>

            {!isCollapsed && (
              <div className="min-w-0 flex-1 leading-tight">
                <span className="block text-xs font-semibold text-foreground truncate">
                  {user.name}
                </span>
                <span className="block text-[11px] text-muted-foreground truncate">
                  {ROLE_LABELS[user.role]}
                </span>
              </div>
            )}

            {!isCollapsed && (
              <MoreVertical className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align={isCollapsed ? "center" : "end"} side="right" className="w-56">
          <DropdownMenuLabel>
            <div className="text-sm font-medium">{user.name}</div>
            <div className="text-xs font-normal text-muted-foreground">{user.email}</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
            <Settings className="mr-2 h-4 w-4" /> Account Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              logout();
              navigate({ to: "/login" });
            }}
          >
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

export function AccessDenied({ path }: { path: string }) {
  const { role } = useAuth();
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <ShieldAlert className="h-7 w-7" />
      </span>
      <h1 className="text-xl font-medium text-foreground">Access denied</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        The {role ? ROLE_LABELS[role] : "current"} role does not have permission to view{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{path}</code>. This access attempt
        is governed by the role-based permission matrix.
      </p>
      <Link to="/dashboard">
        <Button variant="outline" size="sm">
          Back to dashboard
        </Button>
      </Link>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  if (!user) return null;

  return (
    <TooltipProvider>
      <div className="flex min-h-screen bg-background">
        {/* Desktop Collapsible Sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border/80 bg-card transition-all duration-300 ease-in-out md:flex",
            isCollapsed ? "w-[72px]" : "w-64"
          )}
        >
          {/* Top Brand Header */}
          <div className="flex items-center justify-between border-b border-border/80 pr-2">
            <SidebarBrand isCollapsed={isCollapsed} />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0 rounded-lg"
              title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
              aria-label={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Navigation Links Scroll Body */}
          <div className="flex-1 overflow-y-auto py-3">
            <NavLinks isCollapsed={isCollapsed} />
          </div>

          {/* Bottom User Profile Section */}
          <SidebarUserProfile isCollapsed={isCollapsed} />
        </aside>

        {/* Main Content Column */}
        <div
          className={cn(
            "flex min-h-screen flex-1 flex-col min-w-0 transition-all duration-300 ease-in-out",
            isCollapsed ? "md:pl-[72px]" : "md:pl-64"
          )}
        >
          {/* Header Bar */}
          <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border/80 bg-card px-4 md:px-6">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  aria-label="Open navigation"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0 flex flex-col justify-between">
                <div>
                  <SidebarBrand />
                  <div className="border-b border-border/80 mb-2" />
                  <NavLinks onNavigate={() => setMobileOpen(false)} />
                </div>
                <SidebarUserProfile />
              </SheetContent>
            </Sheet>

            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-muted-foreground">
                {user.organization}
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2.5 rounded-full py-1 pl-1.5 pr-3.5 border border-gray-200/80 bg-card hover:bg-muted/80 hover:border-gray-300 transition-all shadow-2xs">
                  <Avatar className="h-8 w-8 border border-primary/20">
                    <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                      {initials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden text-left sm:block">
                    <span className="block text-sm font-medium leading-tight text-foreground">
                      {user.name}
                    </span>
                    <span className="block text-xs leading-tight text-muted-foreground">
                      {ROLE_LABELS[user.role]}
                    </span>
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel>
                  <div className="text-sm font-medium">{user.name}</div>
                  <div className="text-xs font-normal text-muted-foreground">{user.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
                  <Settings className="mr-2 h-4 w-4" /> Account Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    logout();
                    navigate({ to: "/login" });
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          <main
            className={cn(
              "flex-1 px-4 py-6 md:px-8 min-w-0 w-full",
              pathname === "/dashboard" && "bg-muted/30"
            )}
          >
            <div className="mx-auto w-full max-w-7xl min-w-0">{children}</div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
