# Nyati Database Migration

Run this SQL in your Supabase SQL Editor (https://supabase.com/dashboard/project/kirvvmriqraufhzvdjdd/sql/new):

```sql
-- ============================================
-- Nyati Exchange: Phase 1 MVP Database Schema
-- ============================================

-- 1. Transactions table - tracks every off-ramp order
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reference TEXT UNIQUE NOT NULL,
  paycrest_order_id TEXT,
  phone_number TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  institution TEXT NOT NULL DEFAULT 'MPESA',
  amount_usdt NUMERIC(18, 6) NOT NULL,
  amount_kes NUMERIC(18, 2),
  rate_used NUMERIC(18, 4),
  nyati_fee_percent NUMERIC(5, 2),
  network TEXT NOT NULL,
  receive_address TEXT,
  sender_fee NUMERIC(18, 6) DEFAULT 0,
  transaction_fee NUMERIC(18, 6) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for lookups by phone number
CREATE INDEX idx_transactions_phone ON public.transactions(phone_number);
-- Index for lookups by reference
CREATE INDEX idx_transactions_reference ON public.transactions(reference);
-- Index for lookups by paycrest order id
CREATE INDEX idx_transactions_paycrest_id ON public.transactions(paycrest_order_id);
-- Index for status filtering
CREATE INDEX idx_transactions_status ON public.transactions(status);

-- 2. Exchange rates cache
CREATE TABLE IF NOT EXISTS public.exchange_rates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT NOT NULL DEFAULT 'USDT',
  currency TEXT NOT NULL DEFAULT 'KES',
  network TEXT NOT NULL,
  rate NUMERIC(18, 4) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(token, currency, network)
);

-- 3. App configuration
CREATE TABLE IF NOT EXISTS public.app_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default config
INSERT INTO public.app_config (key, value) VALUES
  ('nyati_fee_percent', '1.5'),
  ('default_network', 'base'),
  ('min_amount_usd', '0.5')
ON CONFLICT (key) DO NOTHING;

-- 4. Enable RLS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies

-- Transactions: allow anon to insert (creating orders) and select their own by reference
CREATE POLICY "Allow anon insert transactions"
  ON public.transactions FOR INSERT
  TO anon WITH CHECK (true);

CREATE POLICY "Allow anon select transactions by reference"
  ON public.transactions FOR SELECT
  TO anon USING (true);

-- Allow service_role full access (for edge functions)
CREATE POLICY "Allow service_role full access to transactions"
  ON public.transactions FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- Exchange rates: readable by everyone
CREATE POLICY "Allow anon read exchange_rates"
  ON public.exchange_rates FOR SELECT
  TO anon USING (true);

CREATE POLICY "Allow service_role full access to exchange_rates"
  ON public.exchange_rates FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- App config: readable by everyone
CREATE POLICY "Allow anon read app_config"
  ON public.app_config FOR SELECT
  TO anon USING (true);

CREATE POLICY "Allow service_role full access to app_config"
  ON public.app_config FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- 6. Updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_exchange_rates_updated_at
  BEFORE UPDATE ON public.exchange_rates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_app_config_updated_at
  BEFORE UPDATE ON public.app_config
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
```

## Phase 2: Element Pay Integration Columns

Run this SQL after Phase 1:

```sql
-- Add provider tracking
ALTER TABLE public.transactions 
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'paycrest',
  ADD COLUMN IF NOT EXISTS order_type TEXT NOT NULL DEFAULT 'offramp',
  ADD COLUMN IF NOT EXISTS cashout_type TEXT NOT NULL DEFAULT 'PHONE',
  ADD COLUMN IF NOT EXISTS bank_code TEXT,
  ADD COLUMN IF NOT EXISTS till_number TEXT,
  ADD COLUMN IF NOT EXISTS paybill_number TEXT,
  ADD COLUMN IF NOT EXISTS account_number TEXT;

-- Index for provider filtering
CREATE INDEX IF NOT EXISTS idx_transactions_provider ON public.transactions(provider);
CREATE INDEX IF NOT EXISTS idx_transactions_order_type ON public.transactions(order_type);
```

## Phase 3: Sell-Flow Approval Authorization (REQUIRED)

Each off-ramp now requires the wallet owner to sign a fresh ERC-20 approval.
The edge function verifies that approval on-chain and stores its hash so the
same approval can never authorize two payouts.

```sql
-- Bind every off-ramp to the on-chain approval that authorized it
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS approval_tx_hash TEXT;

-- One approval -> one payout (replay protection)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_transactions_approval_tx_hash
  ON public.transactions(approval_tx_hash)
  WHERE approval_tx_hash IS NOT NULL;
```

## After running the SQL above, add these Supabase Secrets

Go to Project Settings > Edge Functions > Secrets and add:

| Secret Name | Value | Description |
|---|---|---|
| `PAYCREST_API_KEY` | Your API key from app.paycrest.io | Used for creating orders |
| `PAYCREST_API_SECRET` | Your API secret | Used for webhook signature verification |
| `PAYCREST_RETURN_ADDRESS` | Your wallet address for refunds | Where failed txs get refunded |

## Edge Functions

Deploy the 3 edge functions from `supabase/functions/` using the Supabase CLI:

```bash
supabase functions deploy paycrest-rates
supabase functions deploy paycrest-offramp
supabase functions deploy paycrest-webhook
```

Or copy-paste the code into the Supabase Dashboard > Edge Functions.

---

## Auth: user profiles (newsletter + KYC status)

Run this in the Supabase SQL Editor to enable email/password signup preferences.

```sql
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  newsletter_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
  kyc_status TEXT NOT NULL DEFAULT 'not_started',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Auto-create a profile row on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

## Contact messages (Contact Us popup)

```sql
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  subject text,
  message text NOT NULL,
  recipient text NOT NULL DEFAULT 'info@nyatiex.com',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_messages TO service_role;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated grants: messages are written only by the
-- contact-message edge function using the service role.
```

### Email delivery for contact messages (Resend)

The `contact-message` function emails each message via the Resend API. To enable it:

1. Get an API key at https://resend.com/api-keys
2. Add it as a Supabase secret: Project Settings > Edge Functions > Secrets > `RESEND_API_KEY`
3. Redeploy the `contact-message` function (`supabase functions deploy contact-message` or paste `supabase/functions/contact-message/index.ts` into the dashboard editor)

Until `nyatiex.com` is verified as a sending domain in Resend, emails are delivered to the Resend account owner's address (`tech@nyatiex.com`) from `onboarding@resend.dev`. After verifying the domain at https://resend.com/domains, set the `from` address to an address on your domain (e.g. `noreply@nyatiex.com` via the `RESEND_FROM_EMAIL` secret) and switch `CONTACT_EMAIL` back to `info@nyatiex.com`.
