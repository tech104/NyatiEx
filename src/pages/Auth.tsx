import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { LandingLayout } from "@/components/layout/LandingLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Mail, Lock, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/useAuthSession";
import { toast } from "sonner";

const emailSchema = z.string().trim().email({ message: "Enter a valid email address" }).max(255);
const passwordSchema = z
  .string()
  .min(8, { message: "Password must be at least 8 characters" })
  .max(72, { message: "Password must be less than 72 characters" });

const Auth = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useAuthSession();

  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  useEffect(() => {
    if (!loading && isAuthenticated) navigate("/account", { replace: true });
  }, [loading, isAuthenticated, navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = emailSchema.safeParse(signUpEmail);
    if (!email.success) return toast.error(email.error.issues[0].message);
    const password = passwordSchema.safeParse(signUpPassword);
    if (!password.success) return toast.error(password.error.issues[0].message);
    if (signUpPassword !== confirmPassword) return toast.error("Passwords do not match");

    setSubmitting(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.data,
      password: signUpPassword,
      options: { emailRedirectTo: `${window.location.origin}/account` },
    });
    setSubmitting(false);

    if (error) return toast.error(error.message);
    if (!data.session) {
      setCheckEmail(true);
      toast.success("Account created. Check your email to confirm it.");
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = emailSchema.safeParse(signInEmail);
    if (!email.success) return toast.error(email.error.issues[0].message);
    if (!signInPassword) return toast.error("Enter your password");

    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.data,
      password: signInPassword,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Signed in");
  };

  return (
    <LandingLayout>
      <div className="container mx-auto px-4 py-12 md:py-20 animate-fade-in">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <h1 className="font-display text-3xl md:text-4xl font-bold mb-3">
              Join <span className="text-primary">Nyati</span>
            </h1>
            <p className="text-muted-foreground text-sm">
              Create an account to manage newsletters and submit KYC documents when needed.
            </p>
          </div>

          {checkEmail ? (
            <Card className="border border-border card-shadow">
              <CardContent className="p-8 text-center space-y-3">
                <CheckCircle2 className="w-10 h-10 text-primary mx-auto" />
                <h2 className="font-display text-xl font-semibold">Confirm your email</h2>
                <p className="text-sm text-muted-foreground">
                  We sent a confirmation link to <span className="text-foreground">{signUpEmail}</span>.
                  Click it to activate your account, then sign in.
                </p>
                <Button variant="outline" onClick={() => setCheckEmail(false)}>
                  Back to sign in
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="border border-border card-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-lg">Account access</CardTitle>
                <CardDescription>Sign up or sign in with your email</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="signup" className="space-y-6">
                  <TabsList className="grid grid-cols-2 w-full bg-muted p-1 rounded-xl">
                    <TabsTrigger value="signup" className="rounded-lg data-[state=active]:bg-card">
                      Sign Up
                    </TabsTrigger>
                    <TabsTrigger value="signin" className="rounded-lg data-[state=active]:bg-card">
                      Sign In
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="signup">
                    <form className="space-y-4" onSubmit={handleSignUp}>
                      <div className="space-y-2">
                        <Label htmlFor="signup-email">Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id="signup-email"
                            type="email"
                            autoComplete="email"
                            value={signUpEmail}
                            onChange={(e) => setSignUpEmail(e.target.value)}
                            className="bg-muted/50 pl-10"
                            placeholder="you@email.com"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-password">Password</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id="signup-password"
                            type="password"
                            autoComplete="new-password"
                            value={signUpPassword}
                            onChange={(e) => setSignUpPassword(e.target.value)}
                            className="bg-muted/50 pl-10"
                            placeholder="At least 8 characters"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-confirm">Confirm password</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id="signup-confirm"
                            type="password"
                            autoComplete="new-password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="bg-muted/50 pl-10"
                            placeholder="Re-enter your password"
                          />
                        </div>
                      </div>
                      <Button type="submit" className="w-full glow-primary" disabled={submitting}>
                        {submitting ? "Creating account…" : "Create account"}
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="signin">
                    <form className="space-y-4" onSubmit={handleSignIn}>
                      <div className="space-y-2">
                        <Label htmlFor="signin-email">Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id="signin-email"
                            type="email"
                            autoComplete="email"
                            value={signInEmail}
                            onChange={(e) => setSignInEmail(e.target.value)}
                            className="bg-muted/50 pl-10"
                            placeholder="you@email.com"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signin-password">Password</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id="signin-password"
                            type="password"
                            autoComplete="current-password"
                            value={signInPassword}
                            onChange={(e) => setSignInPassword(e.target.value)}
                            className="bg-muted/50 pl-10"
                            placeholder="Your password"
                          />
                        </div>
                      </div>
                      <Button type="submit" className="w-full glow-primary" disabled={submitting}>
                        {submitting ? "Signing in…" : "Sign in"}
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </LandingLayout>
  );
};

export default Auth;
