import { useEffect, useState } from "react";
import { LandingLayout } from "@/components/layout/LandingLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  RefreshCw,
  ChevronDown,
  CheckCircle2,
  XCircle,
  AlertCircle,
  HelpCircle,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Lock,
  LogOut,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface WebhookEvent {
  id: string;
  provider: string;
  event_type: string | null;
  status: string | null;
  signature_valid: boolean | null;
  tx_hash: string | null;
  client_ref: string | null;
  matched_transaction_id: string | null;
  payload: unknown;
  headers: Record<string, string> | null;
  error: string | null;
  received_at: string;
}

const TOKEN_KEY = "nyati_admin_token";
const FUNCTION_URL = `https://kirvvmriqraufhzvdjdd.supabase.co/functions/v1/admin-webhook-events`;

const AdminWebhooks = () => {
  const [token, setToken] = useState<string>(() => sessionStorage.getItem(TOKEN_KEY) ?? "");
  const [authed, setAuthed] = useState<boolean>(() => !!sessionStorage.getItem(TOKEN_KEY));
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = async (authToken: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(FUNCTION_URL, {
        headers: { "x-admin-token": authToken },
      });
      if (res.status === 401) {
        setError("Invalid admin token.");
        sessionStorage.removeItem(TOKEN_KEY);
        setAuthed(false);
        setEvents([]);
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to load events");
        setEvents([]);
      } else {
        setEvents(data.events ?? []);
      }
    } catch (e: any) {
      setError(e.message ?? "Network error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authed) return;
    fetchEvents(token);
    const interval = setInterval(() => fetchEvents(token), 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;
    sessionStorage.setItem(TOKEN_KEY, token.trim());
    setAuthed(true);
  };

  const handleLogout = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken("");
    setAuthed(false);
    setEvents([]);
  };

  if (!authed) {
    return (
      <LandingLayout>
        <div className="container mx-auto px-4 py-20 max-w-md">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-primary" />
                <CardTitle>Admin Access Required</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label htmlFor="token">Admin Token</Label>
                  <Input
                    id="token"
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Enter admin token"
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Configured via <code className="bg-muted px-1 rounded">ADMIN_DASHBOARD_TOKEN</code> secret.
                  </p>
                </div>
                <Button type="submit" className="w-full">
                  Unlock Dashboard
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </LandingLayout>
    );
  }

  return (
    <LandingLayout>
      <div className="container mx-auto px-4 py-10 max-w-5xl">
        <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-semibold mb-2">
              Webhook Event Log
            </h1>
            <p className="text-muted-foreground">
              Latest Element Pay webhook deliveries. Auto-refreshes every 15 seconds.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => fetchEvents(token)} variant="outline" size="sm" className="gap-2">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button onClick={handleLogout} variant="ghost" size="sm" className="gap-2">
              <LogOut className="w-4 h-4" />
              Lock
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="w-4 h-4" />
            <AlertTitle>Failed to load events</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!loading && events.length === 0 && !error && (
          <Card>
            <CardContent className="p-10 text-center text-muted-foreground">
              <Clock className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>No webhook events received yet.</p>
              <p className="text-sm mt-1">
                Trigger a transaction or send a test event from the Element Pay dashboard.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      </div>
    </LandingLayout>
  );
};

function EventCard({ event }: { event: WebhookEvent }) {
  const [open, setOpen] = useState(false);
  const isError = !!event.error;
  const isSuccess = !!event.status && !isError;

  let StatusIcon = HelpCircle;
  let statusVariant: "default" | "secondary" | "destructive" | "outline" = "secondary";
  if (isError) {
    StatusIcon = XCircle;
    statusVariant = "destructive";
  } else if (isSuccess) {
    StatusIcon = CheckCircle2;
    statusVariant = "default";
  }

  return (
    <Card className="overflow-hidden">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="py-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <StatusIcon
                className={`w-5 h-5 shrink-0 ${
                  isError
                    ? "text-destructive"
                    : isSuccess
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
              />
              <div className="min-w-0">
                <CardTitle className="text-base truncate">
                  {event.event_type ?? "unknown.event"}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(event.received_at).toLocaleString()} ·{" "}
                  {formatDistanceToNow(new Date(event.received_at), { addSuffix: true })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="capitalize">
                {event.provider}
              </Badge>
              {event.status && (
                <Badge variant={statusVariant} className="capitalize">
                  {event.status}
                </Badge>
              )}
              {event.signature_valid === true && (
                <Badge variant="outline" className="gap-1 text-primary border-primary/40">
                  <ShieldCheck className="w-3 h-3" />
                  signed
                </Badge>
              )}
              {event.signature_valid === false && (
                <Badge variant="destructive" className="gap-1">
                  <ShieldAlert className="w-3 h-3" />
                  invalid sig
                </Badge>
              )}
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1">
                  Details
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
                  />
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 text-xs">
            <Field label="tx_hash" value={event.tx_hash} mono />
            <Field label="client_ref" value={event.client_ref} mono />
            <Field
              label="matched tx"
              value={event.matched_transaction_id ?? (event.status ? "no match" : "—")}
              mono
            />
          </div>

          {event.error && (
            <p className="text-xs text-destructive mt-2 break-words">
              <span className="font-semibold">Error:</span> {event.error}
            </p>
          )}
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-3">
            <Section title="Payload">
              <pre className="bg-muted/60 text-xs rounded-md p-3 overflow-auto max-h-96">
                <code>{JSON.stringify(event.payload, null, 2)}</code>
              </pre>
            </Section>
            {event.headers && Object.keys(event.headers).length > 0 && (
              <Section title="Headers">
                <pre className="bg-muted/60 text-xs rounded-md p-3 overflow-auto max-h-60">
                  <code>{JSON.stringify(event.headers, null, 2)}</code>
                </pre>
              </Section>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function Field({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground text-[10px] uppercase tracking-wide">{label}</p>
      <p
        className={`truncate ${mono ? "font-mono" : ""} ${
          value ? "text-foreground" : "text-muted-foreground"
        }`}
        title={value ?? undefined}
      >
        {value ?? "—"}
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground mb-1.5">{title}</p>
      {children}
    </div>
  );
}

export default AdminWebhooks;
