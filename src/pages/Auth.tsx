import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import logo from "@/assets/printonet-logo.svg";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Loader2, Mail } from "lucide-react";
import { PasswordInput } from "@/components/PasswordInput";
import { useAuth } from "@/contexts/AuthContext";

export default function Auth() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md flex flex-col items-center">
        <img src={logo} alt="Printonet" className="h-10 mb-6" />
      <Card className="w-full">
        <Tabs defaultValue="login">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl">Welcome</CardTitle>
            <CardDescription>Sign in to manage your products</CardDescription>
            <TabsList className="mt-3 w-full">
              <TabsTrigger value="login" className="flex-1">Sign In</TabsTrigger>
              <TabsTrigger value="signup" className="flex-1">Sign Up</TabsTrigger>
            </TabsList>
          </CardHeader>
          <CardContent>
            <TabsContent value="login" className="mt-0">
              <LoginForm />
            </TabsContent>
            <TabsContent value="signup" className="mt-0">
              <SignupForm />
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
      </div>
    </div>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);

  if (showReset) return <ForgotPasswordForm onBack={() => setShowReset(false)} />;

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
    <form onSubmit={handleLogin} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="login-email">Email</Label>
        <Input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="login-password">Password</Label>
        <PasswordInput id="login-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Sign In
      </Button>
      <button type="button" onClick={() => setShowReset(true)} className="text-sm text-muted-foreground hover:text-primary transition-colors w-full text-center">
        Forgot your password?
      </button>
    </form>
  );
}

function SignupForm() {
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
          .from("invites")
          .select("email, used_at, expires_at")
          .eq("token", token)
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
      <div className="text-center py-6 space-y-3">
        <Mail className="h-10 w-10 mx-auto text-primary" />
        <h3 className="font-semibold text-lg">Check your email</h3>
        <p className="text-sm text-muted-foreground">We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.</p>
      </div>
    );
  }

  if (checking) {
    return <div className="py-10 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>;
  }

  if (inviteOnly && !inviteToken) {
    return (
      <div className="text-center py-6 space-y-3">
        <Mail className="h-10 w-10 mx-auto text-muted-foreground" />
        <h3 className="font-semibold text-lg">Signups are invite-only</h3>
        <p className="text-sm text-muted-foreground">
          {inviteError ?? "You need an invite link to create an account. Please contact the team to request access."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSignup} className="space-y-4">
      {inviteEmail && (
        <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-foreground/80">
          You were invited as <strong>{inviteEmail}</strong>.
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="signup-store">Store Name</Label>
        <Input id="signup-store" value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="My Awesome Store" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-email">Email</Label>
        <Input id="signup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required readOnly={!!inviteEmail} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-confirm">Confirm Password</Label>
        <PasswordInput id="signup-confirm" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-password">Password</Label>
        <PasswordInput id="signup-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Create Account
      </Button>
    </form>
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
      <div className="text-center py-6 space-y-3">
        <Mail className="h-10 w-10 mx-auto text-primary" />
        <h3 className="font-semibold text-lg">Check your email</h3>
        <p className="text-sm text-muted-foreground">If an account exists for <strong>{email}</strong>, we sent a password reset link.</p>
        <Button variant="outline" onClick={onBack}>Back to sign in</Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleReset} className="space-y-4">
      <p className="text-sm text-muted-foreground">Enter your email and we'll send a reset link.</p>
      <div className="space-y-2">
        <Label htmlFor="reset-email">Email</Label>
        <Input id="reset-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Send Reset Link
      </Button>
      <Button variant="outline" className="w-full" onClick={onBack}>Back</Button>
    </form>
  );
}
