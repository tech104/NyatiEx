import { useState } from "react";
import { LandingLayout } from "@/components/layout/LandingLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import type { Transaction, TransactionStatus as TxStatus } from "@/types/exchange";
import { Search, Phone, ArrowRight, Clock, Check, AlertTriangle, RotateCcw } from "lucide-react";
import { Link } from "react-router-dom";

const STATUS_BADGE: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
  pending: { variant: "outline", label: "Pending" },
  processing: { variant: "secondary", label: "Processing" },
  validated: { variant: "default", label: "Success" },
  settled: { variant: "default", label: "Complete" },
  expired: { variant: "destructive", label: "Expired" },
  refunded: { variant: "secondary", label: "Refunded" },
};

const Transactions = () => {
  const [phone, setPhone] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!phone) return;
    setLoading(true);
    setSearched(true);

    const cleanPhone = phone.replace(/\s/g, "");
    const { data } = await supabase
      .from("transactions")
      .select("*")
      .eq("phone_number", cleanPhone)
      .order("created_at", { ascending: false })
      .limit(20);

    setTransactions((data as Transaction[]) || []);
    setLoading(false);
  };

  return (
    <LandingLayout>
      <div className="container mx-auto px-4 py-8 md:py-16 max-w-2xl animate-fade-in">
        <h1 className="font-display text-3xl font-bold mb-2">Transaction History</h1>
        <p className="text-muted-foreground mb-8">Look up your past exchanges by phone number</p>

        {/* Search */}
        <Card className="mb-8">
          <CardContent className="p-4">
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  type="tel"
                  placeholder="+254 7XX XXX XXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-12"
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <Button onClick={handleSearch} disabled={loading} className="h-12 px-6">
                <Search className="w-4 h-4 mr-2" />
                Search
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4 animate-pulse">
                  <div className="h-4 bg-muted rounded w-1/2 mb-2" />
                  <div className="h-3 bg-muted rounded w-3/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : searched && transactions.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">No transactions found for this phone number.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {transactions.map((tx) => {
              const badge = STATUS_BADGE[tx.status] || STATUS_BADGE.pending;
              return (
                <Link key={tx.id} to={`/transaction/${tx.reference}`}>
                  <Card className="hover:border-primary/30 transition-colors cursor-pointer">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-medium">{tx.amount_usdt} USDT</span>
                          <ArrowRight className="w-3 h-3 text-muted-foreground" />
                          <span className="font-mono text-sm font-medium">{tx.amount_kes?.toLocaleString()} KES</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {new Date(tx.created_at).toLocaleDateString()}
                          <span className="font-mono">{tx.reference}</span>
                        </div>
                      </div>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </LandingLayout>
  );
};

export default Transactions;
