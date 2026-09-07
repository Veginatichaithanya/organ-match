import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Blocks,
  CheckCircle2,
  Eye,
  EyeOff,
  HeartHandshake,
  Loader2,
  Lock,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { getDashboardForRole } from "@/lib/permissions";
import { FullScreenLoader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — OrganMatch Platform" },
      { name: "description", content: "Sign in to the secure organ donation matching network." },
      { property: "og:title", content: "Sign in — OrganMatch Platform" },
      {
        property: "og:description",
        content: "Sign in to the secure organ donation matching network.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { user, ready, login } = useAuth();
  const navigate = useNavigate();

  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Explicitly reset all form inputs and errors whenever login page mounts
  useEffect(() => {
    setUsernameOrEmail("");
    setPassword("");
    setErrorMsg(null);
    setLoading(false);
  }, []);

  // If user is already authenticated in active session and ready, navigate to dashboard
  if (ready && user) {
    return <Navigate to={getDashboardForRole(user.role)} replace />;
  }

  const doLogin = async (uname: string, pass: string) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const loggedUser = await login(uname, pass);
      toast.success(`Welcome back, ${loggedUser.name}!`);
      const targetPath = getDashboardForRole(loggedUser.role);
      navigate({ to: targetPath });
    } catch (err: any) {
      const msg = err?.message || "Invalid username/email or password.";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameOrEmail || !password) {
      setErrorMsg("Please enter both username/email and password.");
      return;
    }
    await doLogin(usernameOrEmail, password);
  };

  return (
    <div className="flex min-h-screen w-full bg-slate-900 text-slate-100 selection:bg-primary selection:text-white">
      {/* Left Brand Panel */}
      <div className="hidden lg:flex w-[46%] flex-col justify-between p-12 relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 border-r border-slate-800/80">
        {/* Decorative Grid & Glow Effect */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-25" />
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Top Brand Info */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-tr from-primary to-blue-500 flex items-center justify-center text-white shadow-lg shadow-primary/25 border border-white/10">
              <HeartHandshake className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-white block leading-tight">OrganMatch</span>
              <span className="text-[11px] font-mono text-primary-200/70 tracking-wider uppercase">National Organ Registry</span>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md text-xs text-slate-400 font-medium">
            <span className="h-2 w-2 rounded-full bg-slate-500" />
            Secure Clinical Network
          </div>
        </div>

        {/* Hero Features */}
        <div className="relative z-10 space-y-6 my-auto max-w-lg">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Post-Quantum Sealed Network
          </div>

          <h1 className="text-3xl xl:text-4xl font-extrabold tracking-tight text-white leading-tight">
            Cryptographically Verified Organ Donation &amp; Real-Time Matching.
          </h1>

          <p className="text-sm text-slate-400 leading-relaxed">
            Every donor registration, recipient assessment, and organ allocation is sealed against strict ABAC policies, cryptographically verified, and protected by multi-factor role access controls.
          </p>

          {/* Feature Badges */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm space-y-1">
              <div className="flex items-center gap-2 text-primary font-semibold text-xs">
                <Blocks className="h-4 w-4" />
                Immutable Ledger
              </div>
              <p className="text-[11px] text-slate-400">Blockchain-anchored state verification for tamper-evident records.</p>
            </div>

            <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm space-y-1">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                <ShieldCheck className="h-4 w-4" />
                ABAC / RBAC Security
              </div>
              <p className="text-[11px] text-slate-400">Hospital isolation &amp; strict medical role boundaries.</p>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>JWT Bearer Auth &amp; HttpOnly Cookie Active</span>
          </div>
          <span className="font-mono text-[11px] text-slate-500">OrganMatch Platform</span>
        </div>
      </div>

      {/* Right Login Form Container */}
      <div className="flex flex-1 items-center justify-center p-6 lg:p-12 bg-slate-950/60 relative">
        <div className="w-full max-w-md space-y-7">
          {/* Mobile Header */}
          <div className="flex items-center gap-3 lg:hidden justify-center mb-6">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-primary to-blue-500 flex items-center justify-center text-white shadow-md">
              <HeartHandshake className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">OrganMatch</span>
          </div>

          {/* Title Header */}
          <div className="space-y-2 text-center lg:text-left">
            <h2 className="text-2xl font-bold text-white tracking-tight">Sign in to your account</h2>
            <p className="text-sm text-slate-400">
              Enter your authorized network credentials to proceed to your role console.
            </p>
          </div>

          {/* Login Form Card */}
          <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4 bg-slate-900/90 border border-slate-800 p-7 rounded-2xl shadow-2xl backdrop-blur-xl">
            {errorMsg && (
              <div className="rounded-lg bg-red-500/10 p-3.5 text-xs text-red-400 font-medium border border-red-500/20 flex items-center gap-2 animate-shake">
                <ShieldCheck className="h-4 w-4 shrink-0 text-red-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="usernameOrEmail" className="text-xs font-semibold text-slate-300">
                Username or Email
              </Label>
              <div className="relative">
                <User className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                <Input
                  id="usernameOrEmail"
                  name="usernameOrEmail"
                  type="text"
                  placeholder="Username or email address"
                  value={usernameOrEmail}
                  onChange={(e) => setUsernameOrEmail(e.target.value)}
                  className="pl-10 h-11 bg-slate-950/80 border-slate-700/80 text-white placeholder:text-slate-500 text-sm focus:border-primary focus:ring-1 focus:ring-primary rounded-xl"
                  disabled={loading}
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-semibold text-slate-300">
                  Password
                </Label>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 h-11 bg-slate-950/80 border-slate-700/80 text-white placeholder:text-slate-500 text-sm focus:border-primary focus:ring-1 focus:ring-primary rounded-xl"
                  disabled={loading}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3 text-slate-500 hover:text-slate-300 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-semibold text-sm rounded-xl shadow-lg shadow-primary/25 transition-all gap-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Authenticating...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" /> Sign In
                </>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

