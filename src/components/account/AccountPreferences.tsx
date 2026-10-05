import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FileText, LogOut, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/useAuthSession";
import { toast } from "sonner";

export function AccountPreferences() {
  const { user, loading } = useAuthSession();
  const [newsletter, setNewsletter] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("newsletter_opt_in")
        .eq("id", user.id)
        .maybeSingle();
      if (!cancelled && data) setNewsletter(!!data.newsletter_opt_in);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const updateNewsletter = async (value: boolean) => {
    if (!user) return;
    setNewsletter(value);
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: user.id, email: user.email, newsletter_opt_in: value }, { onConflict: "id" });
    setSaving(false);
    if (error) {
      setNewsletter(!value);
      toast.error("Could not save your preference");
      return;
    }
    toast.success(value ? "Subscribed to the newsletter" : "Unsubscribed from the newsletter");
  };

  if (loading) return null;

  if (!user) {
    return (
      <Card className="border border-border card-shadow mb-8">
        <CardContent className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="font-medium">You are not signed in</p>
            <p className="text-sm text-muted-foreground">
              Sign up to manage newsletters and submit KYC documents.
            </p>
          </div>
          <Link to="/auth">
            <Button className="glow-primary">Sign Up</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-border card-shadow mb-8">
      <CardHeader>
        <CardTitle className="font-display">Signed in as {user.email}</CardTitle>
        <CardDescription>Manage your communication and verification preferences</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Mail className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium">Newsletter</p>
              <p className="text-sm text-muted-foreground">
                Receive product updates, rate insights and announcements by email.
              </p>
            </div>
          </div>
          <Switch checked={newsletter} disabled={saving} onCheckedChange={updateNewsletter} />
        </div>

        <Separator />

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium">KYC documents</p>
              <p className="text-sm text-muted-foreground">
                Submit your identity documents when higher limits are required.
              </p>
            </div>
          </div>
          <Link to="/kyc">
            <Button variant="outline">Go to KYC</Button>
          </Link>
        </div>

        <Separator />

        <Button
          variant="ghost"
          className="gap-2 text-muted-foreground"
          onClick={async () => {
            await supabase.auth.signOut();
            toast.success("Signed out");
          }}
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </Button>
      </CardContent>
    </Card>
  );
}
