import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, User, Building2, Hash } from "lucide-react";
import { CASHOUT_OPTIONS, type CashoutMethod } from "@/types/exchange";

interface CashoutMethodSelectorProps {
  cashoutMethod: CashoutMethod;
  onCashoutMethodChange: (method: CashoutMethod) => void;
  phoneNumber: string;
  onPhoneNumberChange: (value: string) => void;
  recipientName: string;
  onRecipientNameChange: (value: string) => void;
  tillNumber: string;
  onTillNumberChange: (value: string) => void;
  paybillNumber: string;
  onPaybillNumberChange: (value: string) => void;
  accountNumber: string;
  onAccountNumberChange: (value: string) => void;
  bankCode: string;
  onBankCodeChange: (value: string) => void;
}

export function CashoutMethodSelector({
  cashoutMethod,
  onCashoutMethodChange,
  phoneNumber,
  onPhoneNumberChange,
  recipientName,
  onRecipientNameChange,
  tillNumber,
  onTillNumberChange,
  paybillNumber,
  onPaybillNumberChange,
  accountNumber,
  onAccountNumberChange,
  bankCode,
  onBankCodeChange,
}: CashoutMethodSelectorProps) {
  return (
    <div className="space-y-4">
      {/* Method selector */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Payout Method</Label>
        <div className="grid grid-cols-2 gap-2">
          {CASHOUT_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onCashoutMethodChange(option.id)}
              className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-all text-sm ${
                cashoutMethod === option.id
                  ? "border-primary bg-accent text-accent-foreground shadow-sm"
                  : "border-border bg-muted/30 text-muted-foreground hover:border-primary/40"
              }`}
            >
              <span className="text-lg">{option.icon}</span>
              <div>
                <div className="font-medium text-foreground">{option.label}</div>
                <div className="text-xs text-muted-foreground">{option.description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Dynamic fields based on method */}
      {cashoutMethod === "PHONE" && (
        <>
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm">
              <Phone className="w-4 h-4 text-muted-foreground" />
              M-Pesa Number
            </Label>
            <Input
              type="tel"
              placeholder="+254 7XX XXX XXX"
              value={phoneNumber}
              onChange={(e) => onPhoneNumberChange(e.target.value)}
              className="h-12 bg-muted/30"
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-muted-foreground" />
              Recipient Name (as registered on M-Pesa)
            </Label>
            <Input
              type="text"
              placeholder="John Doe"
              value={recipientName}
              onChange={(e) => onRecipientNameChange(e.target.value)}
              className="h-12 bg-muted/30"
            />
          </div>
        </>
      )}

      {cashoutMethod === "TILL" && (
        <>
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm">
              <Hash className="w-4 h-4 text-muted-foreground" />
              Till Number
            </Label>
            <Input
              type="text"
              placeholder="Enter till number"
              value={tillNumber}
              onChange={(e) => onTillNumberChange(e.target.value)}
              className="h-12 bg-muted/30"
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-muted-foreground" />
              Business Name
            </Label>
            <Input
              type="text"
              placeholder="Business name"
              value={recipientName}
              onChange={(e) => onRecipientNameChange(e.target.value)}
              className="h-12 bg-muted/30"
            />
          </div>
        </>
      )}

      {cashoutMethod === "PAYBILL" && (
        <>
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm">
              <Hash className="w-4 h-4 text-muted-foreground" />
              PayBill Number
            </Label>
            <Input
              type="text"
              placeholder="Enter paybill number"
              value={paybillNumber}
              onChange={(e) => onPaybillNumberChange(e.target.value)}
              className="h-12 bg-muted/30"
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm">
              <Hash className="w-4 h-4 text-muted-foreground" />
              Account Number
            </Label>
            <Input
              type="text"
              placeholder="Enter account number"
              value={accountNumber}
              onChange={(e) => onAccountNumberChange(e.target.value)}
              className="h-12 bg-muted/30"
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-muted-foreground" />
              Account Name
            </Label>
            <Input
              type="text"
              placeholder="Account holder name"
              value={recipientName}
              onChange={(e) => onRecipientNameChange(e.target.value)}
              className="h-12 bg-muted/30"
            />
          </div>
        </>
      )}

      {cashoutMethod === "BANK" && (
        <>
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              Bank
            </Label>
            <Select value={bankCode} onValueChange={onBankCodeChange}>
              <SelectTrigger className="h-12 bg-muted/30">
                <SelectValue placeholder="Select bank" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="KCB">KCB Bank</SelectItem>
                <SelectItem value="EQUITY">Equity Bank</SelectItem>
                <SelectItem value="COOP">Co-operative Bank</SelectItem>
                <SelectItem value="ABSA">ABSA Bank</SelectItem>
                <SelectItem value="STANBIC">Stanbic Bank</SelectItem>
                <SelectItem value="DTB">DTB Bank</SelectItem>
                <SelectItem value="NCBA">NCBA Bank</SelectItem>
                <SelectItem value="FAMILY">Family Bank</SelectItem>
                <SelectItem value="IM">I&M Bank</SelectItem>
                <SelectItem value="STANDARD">Standard Chartered</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm">
              <Hash className="w-4 h-4 text-muted-foreground" />
              Account Number
            </Label>
            <Input
              type="text"
              placeholder="Enter account number"
              value={accountNumber}
              onChange={(e) => onAccountNumberChange(e.target.value)}
              className="h-12 bg-muted/30"
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-muted-foreground" />
              Account Holder Name
            </Label>
            <Input
              type="text"
              placeholder="Account holder name"
              value={recipientName}
              onChange={(e) => onRecipientNameChange(e.target.value)}
              className="h-12 bg-muted/30"
            />
          </div>
        </>
      )}
    </div>
  );
}
