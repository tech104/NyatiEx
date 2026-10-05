import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { LandingLayout } from "@/components/layout/LandingLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OrderStatus } from "@/components/exchange/OrderStatus";
import { supabase } from "@/integrations/supabase/client";
import type { Transaction, TransactionStatus as TxStatus } from "@/types/exchange";
import { ArrowLeft, Phone, Hash, Clock, DollarSign } from "lucide-react";
import { SUPPORTED_NETWORKS } from "@/types/exchange";

const TransactionStatus = () => {
  const { id } = useParams<{ id: string }>();
  const [tx, setTx] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchTx = async () => {
      const { data, error: err } = await supabase
        .from("transactions")
        .select("*")
        .or(`id.eq.${id},reference.eq.${id}`)
        .maybeSingle();

      if (err) setError("Transaction not found");
      else if (!data) setError("Transaction not found");
      else setTx(data as Transaction);
      setLoading(false);
    };

    fetchTx();

    // Poll for updates
    const interval = setInterval(fetchTx, 10000);
    return () => clearInterval(interval);
  }, [id]);

  const networkInfo = tx ? SUPPORTED_NETWORKS.find((n) => n.id === tx.network) : null;

  return (
    <LandingLayout>
      <div className="container mx-auto px-4 py-8 md:py-16 max-w-lg animate-fade-in">
        <Link to="/exchange" className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to Exchange
        </Link>

        <h1 className="font-display text-2xl font-bold mb-6">Transaction Status</h1>

        {loading ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="animate-pulse space-y-4">
                <div className="h-6 bg-muted rounded w-1/2 mx-auto" />
                <div className="h-4 bg-muted rounded w-3/4 mx-auto" />
              </div>
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">{error}</p>
              <Link to="/exchange">
                <Button className="mt-4">Go to Exchange</Button>
              </Link>
            </CardContent>
          </Card>
        ) : tx ? (
          <Card className="border border-border card-shadow">
            <CardContent className="p-6 space-y-6">
              <OrderStatus status={tx.status as TxStatus} />

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Hash className="w-3 h-3" /> Reference
                  </span>
                  <span className="font-mono text-xs">{tx.reference}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <DollarSign className="w-3 h-3" /> Amount
                  </span>
                  <span className="font-mono">{tx.amount_usdt} USDT → {tx.amount_kes?.toLocaleString()} KES</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Phone className="w-3 h-3" /> M-Pesa
                  </span>
                  <span className="font-mono">{tx.phone_number}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl text-sm">
                  <span className="text-muted-foreground">Network</span>
                  <span className="flex items-center gap-1">{networkInfo && <img src={networkInfo.logo} alt={networkInfo.name} className="w-4 h-4 rounded-full" />} {networkInfo?.name}</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Created
                  </span>
                  <span className="text-xs">{new Date(tx.created_at).toLocaleString()}</span>
                </div>

                {tx.rate_used && (
                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl text-sm">
                    <span className="text-muted-foreground">Rate</span>
                    <span className="font-mono">1 USDT = {tx.rate_used} KES</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </LandingLayout>
  );
};

export default TransactionStatus;
