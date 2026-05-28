import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import logo from "@/assets/printonet-logo.svg";
import logoInverted from "@/assets/printonet-logo-inverted.svg";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Loader2, Mail, ArrowLeft, Check, Sparkles, Zap, Shield } from "lucide-react";
import { PasswordInput } from "@/components/PasswordInput";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

type Mode = "login" | "signup";

export default function Auth() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [showReset, setShowReset] = useState(false);

  useEffect(() => {
    if (user) navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("invite")) setMode("signup");
  }, []);

  return (
    <div className="min-h-screen bg-background grid lg:grid-cols-2">
      {/* Brand panel */}
      <aside className="relative hidden lg:flex flex-col p-12 overflow-hidden bg-[hsl(0_0%_7%)] text-white">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(hsl(51 100% 50%) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />
        <div
          aria-hidden
          className="absolute -top-32 -right-32 h-[28rem] w-[28rem] rounded-full blur-3xl opacity-30"
          style={{ background: "hsl(51 100% 50%)" }}
        />
        <div
          aria-hidden
          className="absolute -bottom-40 -left-20 h-[24rem] w-[24rem] rounded-full blur-3xl opacity-15"
          style={{ background: "hsl(51 100% 50%)" }}
        />

        <div className="relative z-10 flex items-center gap-2">
          <img src={logoInverted} alt="Printonet" className="h-8" />
        </div>

        <div className="relative z-10 flex-1 flex items-center justify-center">
          <div className="space-y-8 max-w-md">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-[hsl(51_100%_50%)] animate-pulse" />
            Built for modern print shops
          </div>
          <h1 className="font-display text-5xl leading-[1.05] tracking-tight">
            Run your print business{" "}
            <span className="text-[hsl(51_100%_50%)]">on autopilot.</span>
          </h1>
          <p className="text-white/60 text-lg leading-relaxed">
            Storefronts, custom design tools, and order workflows — unified in one platform.
          </p>

          <ul className="space-y-4 pt-2">
            {[
              { icon: Sparkles, text: "Embeddable customizer for any store" },
              { icon: Zap, text: "Push-to-store with Shopify & WooCommerce" },
              { icon: Shield, text: "Print-ready files, every time" },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-white/80">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[hsl(51_100%_50%)]/15 text-[hsl(51_100%_50%)]">
                  <Icon className="h-4 w-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
          </div>
        </div>

        <div className="relative z-10 text-xs text-white/40">
          © {new Date().getFullYear()} Printonet. All rights reserved.
        </div>
      </aside>

      {/* Form panel */}
      <main className="flex flex-col min-h-screen">
        <header className="flex items-center justify-between p-6 lg:p-8">
          <img src={logo} alt="Printonet" className="h-7 lg:hidden" />
          <div className="lg:ml-auto text-sm text-muted-foreground">
            {!showReset && (
              <>
                {mode === "login" ? "New here?" : "Already have an account?"}{" "}
                <button
                  onClick={() => setMode(mode === "login" ? "signup" : "login")}
                  className="font-semibold text-foreground hover:text-[hsl(51_100%_40%)] transition-colors underline-offset-4 hover:underline"
                >
                  {mode === "login" ? "Create account" : "Sign in"}
                </button>
              </>
            )}
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center px-6 pb-10">
          <div className="w-full max-w-sm">
            {showReset ? (
              <ForgotPasswordForm onBack={() => setShowReset(false)} />
            ) : mode === "login" ? (
              <LoginForm onForgot={() => setShowReset(true)} onSwitch={() => setMode("signup")} />
            ) : (
              <SignupForm onSwitch={() => setMode("login")} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function FormHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-8 space-y-2">
      <h2 className="font-display text-3xl tracking-tight">{title}</h2>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function PrimaryButton({ loading, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      className={cn(
        "group relative w-full h-11 rounded-md bg-foreground text-background font-medium text-sm",
        "hover:bg-[hsl(51_100%_50%)] hover:text-foreground transition-colors",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        "flex items-center justify-center gap-2",
      )}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

function LoginForm({ onForgot, onSwitch }: { onForgot: () => void; onSwitch: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      const msg = error.message && error.message !== "{}" ? error.message : "Something went wrong. Please check your connection and try again.";
      toast({ title: "Sign in failed", description: msg, variant: "destructive" });
    }
  };

  return (
    <>
      <FormHeader title="Welcome back" subtitle="Sign in to manage your store and orders." />
      <form onSubmit={handleLogin} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="login-email">Email</Label>
          <Input id="login-email" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-11" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="login-password">Password</Label>
            <button type="button" onClick={onForgot} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Forgot password?
            </button>
          </div>
          <PasswordInput id="login-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-11" />
        </div>
        <PrimaryButton loading={loading} type="submit">Sign in</PrimaryButton>
      </form>
      <p className="mt-6 text-center text-xs text-muted-foreground lg:hidden">
        New here?{" "}
        <button onClick={onSwitch} className="font-semibold text-foreground underline underline-offset-4">
          Create an account
        </button>
      </p>
    </>
  );
}

function SignupForm({ onSwitch }: { onSwitch: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [storeName, setStoreName] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState<string | null>(null);
  const [inviteOnly, setInviteOnly] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);
  const [inviteError, setInviteError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("invite");
      const { data: settings } = await (supabase as any)
        .from("platform_settings")
        .select("invite_only_enabled")
        .eq("id", true)
        .maybeSingle();
      const enabled = !!settings?.invite_only_enabled;
      setInviteOnly(enabled);

      if (token) {
        const { data: invite } = await (supabase as any)
          .rpc("get_invite_by_token", { p_token: token })
          .maybeSingle();
        if (!invite) setInviteError("This invite link is invalid.");
        else if (invite.used_at) setInviteError("This invite has already been used.");
        else if (new Date(invite.expires_at) < new Date()) setInviteError("This invite has expired.");
        else {
          setInviteToken(token);
          setInviteEmail(invite.email);
          setEmail(invite.email);
        }
      }
      setChecking(false);
    })();
  }, []);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { store_name: storeName, invite_token: inviteToken },
      },
    });
    setLoading(false);
    if (error) {
      toast({ title: "Sign up failed", description: error.message, variant: "destructive" });
    } else {
      setSent(true);
    }
  };

  if (sent) {
    return (
      <div className="text-center py-6 space-y-4">
        <div className="mx-auto h-14 w-14 rounded-full bg-[hsl(51_100%_50%)]/15 flex items-center justify-center">
          <Mail className="h-7 w-7 text-foreground" />
        </div>
        <h3 className="font-display text-2xl">Check your inbox</h3>
        <p className="text-sm text-muted-foreground">
          We sent a confirmation link to <strong className="text-foreground">{email}</strong>. Click it to activate your account.
        </p>
      </div>
    );
  }

  if (checking) {
    return (
      <div className="py-16 text-center">
        <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
      </div>
    );
  }

  if (inviteOnly && !inviteToken) {
    return (
      <div className="text-center py-8 space-y-4">
        <div className="mx-auto h-14 w-14 rounded-full bg-muted flex items-center justify-center">
          <Mail className="h-7 w-7 text-muted-foreground" />
        </div>
        <h3 className="font-display text-2xl">Invite-only access</h3>
        <p className="text-sm text-muted-foreground">
          {inviteError ?? "You need an invite link to create an account. Contact the team to request access."}
        </p>
      </div>
    );
  }

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordLong = password.length >= 6;

  return (
    <>
      <FormHeader title="Create your account" subtitle="Start selling custom print products in minutes." />
      {inviteEmail && (
        <div className="mb-5 rounded-md border border-[hsl(51_100%_50%)]/40 bg-[hsl(51_100%_50%)]/10 px-3 py-2 text-xs">
          You were invited as <strong>{inviteEmail}</strong>.
        </div>
      )}
      <form onSubmit={handleSignup} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="signup-store">Store name</Label>
          <Input id="signup-store" placeholder="Acme Prints" value={storeName} onChange={(e) => setStoreName(e.target.value)} className="h-11" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="signup-email">Email</Label>
          <Input id="signup-email" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required readOnly={!!inviteEmail} className="h-11" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="signup-password">Password</Label>
          <PasswordInput id="signup-password" placeholder="At least 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="h-11" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="signup-confirm">Confirm password</Label>
          <PasswordInput id="signup-confirm" placeholder="Repeat password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} className="h-11" />
          {(password || confirmPassword) && (
            <div className="flex gap-4 text-xs pt-1">
              <span className={cn("flex items-center gap-1", passwordLong ? "text-foreground" : "text-muted-foreground")}>
                <Check className={cn("h-3 w-3", passwordLong ? "opacity-100" : "opacity-30")} />
                6+ characters
              </span>
              <span className={cn("flex items-center gap-1", passwordsMatch ? "text-foreground" : "text-muted-foreground")}>
                <Check className={cn("h-3 w-3", passwordsMatch ? "opacity-100" : "opacity-30")} />
                Passwords match
              </span>
            </div>
          )}
        </div>
        <PrimaryButton loading={loading} type="submit">Create account</PrimaryButton>
        <p className="text-[11px] text-muted-foreground text-center leading-relaxed pt-1">
          By signing up, you agree to our Terms of Service and Privacy Policy.
        </p>
      </form>
      <p className="mt-6 text-center text-xs text-muted-foreground lg:hidden">
        Already have an account?{" "}
        <button onClick={onSwitch} className="font-semibold text-foreground underline underline-offset-4">
          Sign in
        </button>
      </p>
    </>
  );
}

function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast({ title: "Reset failed", description: error.message, variant: "destructive" });
    } else {
      setSent(true);
    }
  };

  if (sent) {
    return (
      <div className="text-center py-6 space-y-4">
        <div className="mx-auto h-14 w-14 rounded-full bg-[hsl(51_100%_50%)]/15 flex items-center justify-center">
          <Mail className="h-7 w-7 text-foreground" />
        </div>
        <h3 className="font-display text-2xl">Check your email</h3>
        <p className="text-sm text-muted-foreground">
          If an account exists for <strong className="text-foreground">{email}</strong>, we sent a password reset link.
        </p>
        <Button variant="outline" onClick={onBack} className="mt-2">
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={onBack}
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <FormHeader title="Reset your password" subtitle="Enter your email and we'll send you a reset link." />
      <form onSubmit={handleReset} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="reset-email">Email</Label>
          <Input id="reset-email" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-11" />
        </div>
        <PrimaryButton loading={loading} type="submit">Send reset link</PrimaryButton>
      </form>
    </>
  );
}
