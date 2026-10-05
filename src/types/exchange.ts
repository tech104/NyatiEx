import baseLogo from "@/assets/networks/base.png";
import celoLogo from "@/assets/networks/celo.png";
import tronLogo from "@/assets/networks/tron.png";
import bnbLogo from "@/assets/networks/bnb.png";
import polygonLogo from "@/assets/networks/polygon.png";
import arbitrumLogo from "@/assets/networks/arbitrum.png";
import ethereumLogo from "@/assets/networks/ethereum.png";
import liskLogo from "@/assets/networks/lisk.png";
import scrollLogo from "@/assets/networks/scroll.png";

export type TransactionStatus = 
  | "pending" 
  | "processing" 
  | "validated" 
  | "settled" 
  | "expired" 
  | "refunded";

export type OrderType = "onramp" | "offramp";

export type CashoutMethod = "PHONE" | "TILL" | "PAYBILL" | "BANK";

export type Provider = "paycrest" | "elementpay";

export interface Transaction {
  id: string;
  reference: string;
  paycrest_order_id: string | null;
  phone_number: string;
  recipient_name: string;
  institution: string;
  amount_usdt: number;
  amount_kes: number | null;
  rate_used: number | null;
  nyati_fee_percent: number | null;
  network: string;
  receive_address: string | null;
  sender_fee: number;
  transaction_fee: number;
  status: TransactionStatus;
  valid_until: string | null;
  created_at: string;
  updated_at: string;
  provider: Provider;
  order_type: OrderType;
  cashout_type: CashoutMethod;
  bank_code: string | null;
  till_number: string | null;
  paybill_number: string | null;
  account_number: string | null;
}

export interface ExchangeRate {
  id: string;
  token: string;
  currency: string;
  network: string;
  rate: number;
  updated_at: string;
}

export interface AppConfig {
  id: string;
  key: string;
  value: string;
  updated_at: string;
}

export type NetworkId = 
  | "base" 
  | "celo" 
  | "tron" 
  | "bnb-smart-chain" 
  | "polygon" 
  | "arbitrum-one"
  | "ethereum"
  | "lisk"
  | "scroll"
  | "asset-chain";

export interface NetworkInfo {
  id: NetworkId;
  name: string;
  logo: string;
}

export const SUPPORTED_NETWORKS: NetworkInfo[] = [
  { id: "base", name: "Base", logo: baseLogo },
  { id: "celo", name: "Celo", logo: celoLogo },
  { id: "tron", name: "Tron", logo: tronLogo },
  { id: "bnb-smart-chain", name: "BNB Chain", logo: bnbLogo },
  { id: "polygon", name: "Polygon", logo: polygonLogo },
  { id: "arbitrum-one", name: "Arbitrum", logo: arbitrumLogo },
  { id: "ethereum", name: "Ethereum", logo: ethereumLogo },
  { id: "lisk", name: "Lisk", logo: liskLogo },
  { id: "scroll", name: "Scroll", logo: scrollLogo },
];

export interface OfframpOrderResponse {
  id: string;
  reference: string;
  receiveAddress?: string;
  amount?: number;
  senderFee?: number;
  transactionFee?: number;
  totalToSend?: number;
  amountKes?: number;
  rate?: number;
  network?: string;
  validUntil?: string;
  status: string;
  txHash?: string;
  rateUsed?: number;
  amountSent?: number;
  fiatPaid?: number;
  quoteId?: string;
  /**
   * Element Pay settles an off-ramp only after the exact token amount is SENT
   * to this per-order deposit wallet. There is no allowance pull.
   */
  deposit?: {
    address: string;
    amount: number;
    token: string;
    network: string;
  } | null;
}


export interface CashoutOption {
  id: CashoutMethod;
  label: string;
  description: string;
  icon: string;
}

export const CASHOUT_OPTIONS: CashoutOption[] = [
  { id: "PHONE", label: "M-Pesa", description: "Send to M-Pesa number", icon: "📱" },
  { id: "TILL", label: "Till Number", description: "Pay to a till number", icon: "🏪" },
  { id: "PAYBILL", label: "PayBill", description: "Pay to a paybill number", icon: "📄" },
  { id: "BANK", label: "Bank Transfer", description: "Send to bank account", icon: "🏦" },
];
