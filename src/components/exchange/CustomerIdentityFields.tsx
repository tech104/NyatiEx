import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Element Pay's Kenya corridors require a COMPLETE retail identity block on the
 * quote (name, phone, email, address, dob, id_number, id_type). Collecting the
 * whole set up front avoids the one-error-at-a-time loop we hit when sending a
 * partial customer object.
 */
export interface CustomerIdentity {
  fullName: string;
  email: string;
  /** ISO yyyy-mm-dd from the date input. Converted to mm/dd/yyyy on send. */
  dob: string;
  idType: "national_id" | "passport";
  idNumber: string;
  /** Town / city — Element Pay `customer.address`. */
  city: string;
}

const STORAGE_KEY = "nyati.customer-identity.v1";

export const emptyIdentity: CustomerIdentity = {
  fullName: "",
  email: "",
  dob: "",
  idType: "national_id",
  idNumber: "",
  city: "Nairobi",
};

const isAdult = (iso: string) => {
  const dob = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(dob.getTime())) return false;
  const eighteen = new Date(dob.getTime());
  eighteen.setUTCFullYear(eighteen.getUTCFullYear() + 18);
  return eighteen.getTime() <= Date.now();
};

export const customerIdentitySchema = z.object({
  fullName: z.string().trim().min(3, "Enter your full name as it appears on your ID").max(100),
  email: z.string().trim().email("Enter a valid email address").max(255),
  dob: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter your date of birth")
    .refine(isAdult, "You must be at least 18 years old"),
  idType: z.enum(["national_id", "passport"]),
  idNumber: z
    .string()
    .trim()
    .min(5, "Enter your ID or passport number")
    .max(32)
    .regex(/^[A-Za-z0-9-]+$/, "ID number can only contain letters, numbers and dashes"),
  city: z.string().trim().min(2, "Enter your town or city").max(80),
});

/** ISO yyyy-mm-dd -> mm/dd/yyyy, the format Element Pay requires for `dob`. */
export const toElementPayDob = (iso: string): string => {
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
};

/** Build the request fields both edge functions expect. */
export const identityToRequest = (identity: CustomerIdentity) => ({
  customerName: identity.fullName.trim(),
  customerEmail: identity.email.trim(),
  customerDob: toElementPayDob(identity.dob),
  customerIdNumber: identity.idNumber.trim(),
  customerIdType: identity.idType,
  customerAddress: identity.city.trim(),
});

export function useCustomerIdentity() {
  const [identity, setIdentity] = useState<CustomerIdentity>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return { ...emptyIdentity, ...(JSON.parse(stored) as Partial<CustomerIdentity>) };
    } catch {
      // ignore malformed cache
    }
    return emptyIdentity;
  });
  const [errors, setErrors] = useState<Partial<Record<keyof CustomerIdentity, string>>>({});

  // Persist for repeat orders (convenience only — no secrets stored).
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
    } catch {
      // storage unavailable (private mode) — not fatal
    }
  }, [identity]);

  // Pre-fill from the signed-in profile when the fields are still blank.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user || cancelled) return;
      const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
      const metaName = typeof meta.full_name === "string" ? meta.full_name : "";
      setIdentity((prev) => ({
        ...prev,
        email: prev.email || user.email || "",
        fullName: prev.fullName || metaName,
      }));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback(<K extends keyof CustomerIdentity>(key: K, value: CustomerIdentity[K]) => {
    setIdentity((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }, []);

  const validate = useCallback((): CustomerIdentity | null => {
    const parsed = customerIdentitySchema.safeParse(identity);
    if (!parsed.success) {
      const fieldErrors: Partial<Record<keyof CustomerIdentity, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof CustomerIdentity;
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return null;
    }
    setErrors({});
    return parsed.data as CustomerIdentity;
  }, [identity]);

  const isComplete = customerIdentitySchema.safeParse(identity).success;

  return { identity, errors, update, validate, isComplete };
}

interface Props {
  identity: CustomerIdentity;
  errors: Partial<Record<keyof CustomerIdentity, string>>;
  onChange: <K extends keyof CustomerIdentity>(key: K, value: CustomerIdentity[K]) => void;
}

export function CustomerIdentityFields({ identity, errors, onChange }: Props) {
  return (
    <div className="space-y-3 rounded-xl border border-border/60 p-3">
      <div className="flex items-center gap-2">
        <UserRound className="w-4 h-4 text-muted-foreground" />
        <p className="text-sm font-medium">Your details</p>
      </div>
      <p className="text-xs text-muted-foreground -mt-1">
        Required by our licensed payout partner for every Kenyan transaction.
      </p>

      <div className="space-y-2">
        <Label className="text-sm" htmlFor="cust-name">Full name (as on your ID)</Label>
        <Input
          id="cust-name"
          value={identity.fullName}
          maxLength={100}
          onChange={(e) => onChange("fullName", e.target.value)}
          placeholder="Jane Wanjiku Doe"
          className="h-11 bg-muted/30"
        />
        {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-sm" htmlFor="cust-email">Email</Label>
          <Input
            id="cust-email"
            type="email"
            value={identity.email}
            maxLength={255}
            onChange={(e) => onChange("email", e.target.value)}
            placeholder="you@example.com"
            className="h-11 bg-muted/30"
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
        </div>

        <div className="space-y-2">
          <Label className="text-sm" htmlFor="cust-dob">Date of birth</Label>
          <Input
            id="cust-dob"
            type="date"
            value={identity.dob}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => onChange("dob", e.target.value)}
            className="h-11 bg-muted/30"
          />
          {errors.dob && <p className="text-xs text-destructive">{errors.dob}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-sm">ID type</Label>
          <Select value={identity.idType} onValueChange={(v) => onChange("idType", v as CustomerIdentity["idType"])}>
            <SelectTrigger className="h-11 bg-muted/30"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="national_id">National ID</SelectItem>
              <SelectItem value="passport">Passport</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-sm" htmlFor="cust-id">ID number</Label>
          <Input
            id="cust-id"
            value={identity.idNumber}
            maxLength={32}
            onChange={(e) => onChange("idNumber", e.target.value)}
            placeholder="12345678"
            className="h-11 bg-muted/30"
          />
          {errors.idNumber && <p className="text-xs text-destructive">{errors.idNumber}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm" htmlFor="cust-city">Town / city</Label>
        <Input
          id="cust-city"
          value={identity.city}
          maxLength={80}
          onChange={(e) => onChange("city", e.target.value)}
          placeholder="Nairobi"
          className="h-11 bg-muted/30"
        />
        {errors.city && <p className="text-xs text-destructive">{errors.city}</p>}
      </div>
    </div>
  );
}
