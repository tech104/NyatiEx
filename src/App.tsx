import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WalletSessionProvider } from "@/components/providers/WalletSessionProvider";
import Index from "./pages/Index";
import Exchange from "./pages/Exchange";
import TransactionStatus from "./pages/TransactionStatus";
import Transactions from "./pages/Transactions";
import KYC from "./pages/KYC";
import Account from "./pages/Account";
import Auth from "./pages/Auth";
import AdminWebhooks from "./pages/AdminWebhooks";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <WalletSessionProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/exchange" element={<Exchange />} />
            <Route path="/transaction/:id" element={<TransactionStatus />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/kyc" element={<KYC />} />
            <Route path="/account" element={<Account />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/signup" element={<Auth />} />
            <Route path="/admin/webhooks" element={<AdminWebhooks />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </WalletSessionProvider>
  </QueryClientProvider>
);

export default App;
