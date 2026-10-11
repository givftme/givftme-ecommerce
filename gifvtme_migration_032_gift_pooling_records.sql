-- Gift pooling records for spec 0004.
--
-- This is the additive record layer only. It does not alter orders,
-- wishlist claims, checkout functions, or existing access policies. The
-- pool order association and shared item exclusion must be added only
-- after the deployed order and claim schema has been inspected.
BEGIN;

CREATE TABLE public.gift_pools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  wishlist_id uuid NOT NULL REFERENCES public.wishlists(id) ON DELETE RESTRICT,
  wishlist_item_id uuid REFERENCES public.wishlist_items(id) ON DELETE RESTRICT,
  fulfillment_mode text NOT NULL CHECK (
    fulfillment_mode IN ('catalog', 'confirmed_sourced', 'manual_cash')
  ),
  source_quote_id uuid REFERENCES public.gift_price_quotes(id) ON DELETE SET NULL,
  public_slug text NOT NULL UNIQUE CHECK (
    public_slug ~ '^[A-Za-z0-9_-]{32,128}$'
  ),
  recipient_label_snapshot text CHECK (
    recipient_label_snapshot IS NULL OR length(btrim(recipient_label_snapshot)) BETWEEN 1 AND 120
  ),
  customer_gift_snapshot jsonb,
  delivery_contract_snapshot jsonb,
  recipient_destination_snapshot jsonb,
  variant_snapshot jsonb,
  quantity smallint NOT NULL DEFAULT 1 CHECK (quantity = 1),
  target_ngn bigint NOT NULL CHECK (target_ngn > 0),
  fee_rate_bps integer,
  fee_policy_key text CHECK (fee_policy_key IS NULL OR fee_policy_key = 'physical_pool'),
  fee_policy_version integer,
  delivery_window_start date,
  delivery_window_end date,
  owner_deadline_local timestamp without time zone NOT NULL,
  owner_deadline_at timestamptz NOT NULL,
  deadline_timezone text NOT NULL DEFAULT 'Africa/Lagos'
    CHECK (deadline_timezone = 'Africa/Lagos'),
  effective_close_at timestamptz NOT NULL,
  first_payment_attempt_at timestamptz,
  first_reconciled_at timestamptz,
  status text NOT NULL DEFAULT 'open' CHECK (
    status IN (
      'open', 'funded', 'fulfillment_pending', 'fulfilled',
      'cash_payout_pending', 'cash_paid', 'owner_top_up_pending',
      'owner_price_reduction_pending', 'refund_pending', 'refunded'
    )
  ),
  resolution text CHECK (
    resolution IS NULL OR resolution IN (
      'fulfilled', 'recipient_paid', 'refunded', 'undeliverable',
      'underfunded', 'late_settlement'
    )
  ),
  verified_principal_ngn bigint NOT NULL DEFAULT 0 CHECK (verified_principal_ngn >= 0),
  reserved_principal_ngn bigint NOT NULL DEFAULT 0 CHECK (reserved_principal_ngn >= 0),
  final_contract_revision integer CHECK (final_contract_revision IS NULL OR final_contract_revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (effective_close_at <= owner_deadline_at),
  CHECK (
    (first_reconciled_at IS NULL AND effective_close_at = owner_deadline_at)
    OR first_reconciled_at IS NOT NULL
  ),
  CHECK (verified_principal_ngn <= target_ngn),
  CHECK (reserved_principal_ngn <= target_ngn - verified_principal_ngn),
  CHECK (
    (fulfillment_mode = 'manual_cash'
      AND wishlist_item_id IS NULL
      AND source_quote_id IS NULL
      AND customer_gift_snapshot IS NULL
      AND delivery_contract_snapshot IS NULL
      AND recipient_destination_snapshot IS NOT NULL
      AND jsonb_typeof(recipient_destination_snapshot) = 'object'
      AND fee_rate_bps IS NULL
      AND fee_policy_key IS NULL
      AND fee_policy_version IS NULL)
    OR
    (fulfillment_mode = 'catalog'
      AND wishlist_item_id IS NOT NULL
      AND source_quote_id IS NULL
      AND customer_gift_snapshot IS NOT NULL
      AND jsonb_typeof(customer_gift_snapshot) = 'object'
      AND delivery_contract_snapshot IS NOT NULL
      AND jsonb_typeof(delivery_contract_snapshot) = 'object'
      AND recipient_destination_snapshot IS NOT NULL
      AND jsonb_typeof(recipient_destination_snapshot) = 'object'
      AND variant_snapshot IS NOT NULL
      AND jsonb_typeof(variant_snapshot) = 'object'
      AND fee_rate_bps IS NOT NULL
      AND fee_rate_bps BETWEEN 0 AND 50000
      AND fee_policy_key = 'physical_pool'
      AND fee_policy_version IS NOT NULL
      AND fee_policy_version > 0)
    OR
    (fulfillment_mode = 'confirmed_sourced'
      AND wishlist_item_id IS NOT NULL
      AND source_quote_id IS NOT NULL
      AND customer_gift_snapshot IS NOT NULL
      AND jsonb_typeof(customer_gift_snapshot) = 'object'
      AND delivery_contract_snapshot IS NOT NULL
      AND jsonb_typeof(delivery_contract_snapshot) = 'object'
      AND recipient_destination_snapshot IS NOT NULL
      AND jsonb_typeof(recipient_destination_snapshot) = 'object'
      AND variant_snapshot IS NOT NULL
      AND jsonb_typeof(variant_snapshot) = 'object'
      AND fee_rate_bps IS NOT NULL
      AND fee_rate_bps BETWEEN 0 AND 50000
      AND fee_policy_key = 'physical_pool'
      AND fee_policy_version IS NOT NULL
      AND fee_policy_version > 0)
  ),
  CHECK (
    delivery_window_start IS NULL
    OR delivery_window_end IS NULL
    OR delivery_window_end >= delivery_window_start
  )
);

CREATE INDEX gift_pools_owner_created_idx
  ON public.gift_pools(owner_user_id, created_at DESC);
CREATE INDEX gift_pools_wishlist_created_idx
  ON public.gift_pools(wishlist_id, created_at DESC);
CREATE INDEX gift_pools_item_idx
  ON public.gift_pools(wishlist_item_id)
  WHERE wishlist_item_id IS NOT NULL;
CREATE INDEX gift_pools_due_close_idx
  ON public.gift_pools(effective_close_at)
  WHERE status = 'open';
CREATE UNIQUE INDEX gift_pools_one_active_physical_item_idx
  ON public.gift_pools(wishlist_item_id)
  WHERE wishlist_item_id IS NOT NULL
    AND status NOT IN ('fulfilled', 'cash_paid', 'refunded');

CREATE TABLE public.gift_pool_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid NOT NULL REFERENCES public.gift_pools(id) ON DELETE RESTRICT,
  contributor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  private_email text NOT NULL CHECK (length(btrim(private_email)) BETWEEN 3 AND 320),
  display_name text CHECK (display_name IS NULL OR length(btrim(display_name)) <= 120),
  private_message text CHECK (private_message IS NULL OR length(private_message) <= 2000),
  principal_ngn bigint NOT NULL CHECK (principal_ngn > 0),
  fee_rate_bps integer NOT NULL DEFAULT 0 CHECK (fee_rate_bps BETWEEN 0 AND 50000),
  pool_fee_ngn bigint NOT NULL DEFAULT 0 CHECK (pool_fee_ngn >= 0),
  captured_total_ngn bigint NOT NULL CHECK (captured_total_ngn > 0),
  anonymous boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending_provider' CHECK (
    status IN (
      'pending_provider', 'provider_verified_waiting_bank', 'verified',
      'partially_refunded', 'refunded', 'reversed', 'failed', 'late'
    )
  ),
  provider_verified_at timestamptz,
  bank_reconciled_at timestamptz,
  receipt_capability_hash text NOT NULL UNIQUE CHECK (
    receipt_capability_hash ~ '^[a-f0-9]{64}$'
  ),
  receipt_revoked_at timestamptz,
  request_key text NOT NULL CHECK (length(request_key) BETWEEN 8 AND 128),
  request_hash text NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pool_id, id),
  UNIQUE (pool_id, request_key),
  CHECK (captured_total_ngn = principal_ngn + pool_fee_ngn),
  CHECK (
    status NOT IN ('verified', 'partially_refunded', 'refunded', 'reversed')
    OR (provider_verified_at IS NOT NULL AND bank_reconciled_at IS NOT NULL)
  ),
  CHECK (
    status <> 'provider_verified_waiting_bank'
    OR (provider_verified_at IS NOT NULL AND bank_reconciled_at IS NULL)
  )
);

CREATE INDEX gift_pool_contributions_pool_reconciled_idx
  ON public.gift_pool_contributions(pool_id, bank_reconciled_at DESC, id DESC)
  WHERE bank_reconciled_at IS NOT NULL;
CREATE INDEX gift_pool_contributions_status_idx
  ON public.gift_pool_contributions(pool_id, status, created_at);
CREATE INDEX gift_pool_contributions_contributor_idx
  ON public.gift_pool_contributions(contributor_user_id, created_at DESC)
  WHERE contributor_user_id IS NOT NULL;

CREATE TABLE public.gift_pool_payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid NOT NULL REFERENCES public.gift_pools(id) ON DELETE RESTRICT,
  contribution_id uuid,
  operation_type text NOT NULL CHECK (
    operation_type IN ('contribution', 'refund', 'owner_shortfall', 'surplus_refund', 'late_refund')
  ),
  provider text NOT NULL DEFAULT 'flutterwave' CHECK (provider = 'flutterwave'),
  payment_method text CHECK (payment_method IS NULL OR payment_method IN ('card', 'bank_transfer', 'ussd')),
  operation_key text NOT NULL CHECK (length(operation_key) BETWEEN 8 AND 128),
  contract_revision integer CHECK (contract_revision IS NULL OR contract_revision > 0),
  provider_reference text,
  provider_transaction_id text,
  refund_reference text,
  refund_of_transaction_id uuid,
  gross_amount_kobo bigint NOT NULL CHECK (gross_amount_kobo > 0),
  provider_cost_kobo bigint NOT NULL DEFAULT 0 CHECK (provider_cost_kobo >= 0),
  internal_status text NOT NULL CHECK (
    internal_status IN (
      'initiated', 'processing', 'provider_verified_waiting_bank', 'succeeded', 'failed',
      'refund_requested', 'refund_submitted', 'refund_processing',
      'refund_disbursement_pending', 'refund_rail_completed', 'reversed', 'chargeback'
    )
  ),
  provider_status text CHECK (provider_status IS NULL OR length(provider_status) <= 80),
  error_code text CHECK (error_code IS NULL OR length(error_code) <= 120),
  initiated_at timestamptz NOT NULL DEFAULT now(),
  provider_verified_at timestamptz,
  bank_reconciled_at timestamptz,
  terminal_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (pool_id, contribution_id)
    REFERENCES public.gift_pool_contributions(pool_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (pool_id, refund_of_transaction_id)
    REFERENCES public.gift_pool_payment_transactions(pool_id, id) ON DELETE RESTRICT,
  UNIQUE (pool_id, operation_key),
  UNIQUE (pool_id, id),
  CHECK (
    (operation_type = 'owner_shortfall' AND contribution_id IS NULL)
    OR (operation_type <> 'owner_shortfall' AND contribution_id IS NOT NULL)
  ),
  CHECK (
    operation_type NOT IN ('refund', 'late_refund', 'surplus_refund')
    OR refund_of_transaction_id IS NOT NULL
  ),
  CHECK (
    operation_type NOT IN ('owner_shortfall', 'surplus_refund')
    OR contract_revision IS NOT NULL
  )
);

CREATE UNIQUE INDEX gift_pool_payment_provider_reference_idx
  ON public.gift_pool_payment_transactions(provider, provider_reference)
  WHERE provider_reference IS NOT NULL;
CREATE UNIQUE INDEX gift_pool_payment_transaction_id_idx
  ON public.gift_pool_payment_transactions(provider, provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;
CREATE UNIQUE INDEX gift_pool_payment_refund_reference_idx
  ON public.gift_pool_payment_transactions(provider, refund_reference)
  WHERE refund_reference IS NOT NULL;
CREATE INDEX gift_pool_payment_pool_created_idx
  ON public.gift_pool_payment_transactions(pool_id, created_at DESC);
CREATE INDEX gift_pool_payment_contribution_idx
  ON public.gift_pool_payment_transactions(contribution_id, created_at DESC)
  WHERE contribution_id IS NOT NULL;

CREATE TABLE public.gift_pool_bank_statement_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imported_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  imported_by_audit_id text NOT NULL CHECK (length(btrim(imported_by_audit_id)) BETWEEN 1 AND 160),
  account_alias text NOT NULL CHECK (length(btrim(account_alias)) BETWEEN 1 AND 120),
  statement_type text NOT NULL CHECK (statement_type IN ('standard', 'extended')),
  file_format text NOT NULL CHECK (file_format IN ('excel', 'pdf')),
  private_object_key text NOT NULL UNIQUE CHECK (length(btrim(private_object_key)) BETWEEN 1 AND 1024),
  file_sha256 text NOT NULL CHECK (file_sha256 ~ '^[a-f0-9]{64}$'),
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'received' CHECK (
    status IN ('received', 'parsing', 'parsed', 'parse_error', 'reviewed')
  ),
  parse_summary jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (
    jsonb_typeof(parse_summary) = 'object'
  ),
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 128),
  imported_at timestamptz NOT NULL DEFAULT now(),
  parsed_at timestamptz,
  UNIQUE (account_alias, file_sha256),
  UNIQUE (account_alias, idempotency_key),
  CHECK (period_end >= period_start)
);

CREATE INDEX gift_pool_statement_import_actor_idx
  ON public.gift_pool_bank_statement_imports(imported_by, imported_at DESC)
  WHERE imported_by IS NOT NULL;
CREATE INDEX gift_pool_statement_import_period_idx
  ON public.gift_pool_bank_statement_imports(account_alias, period_start, period_end);

CREATE TABLE public.gift_pool_bank_statement_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid NOT NULL REFERENCES public.gift_pool_bank_statement_imports(id) ON DELETE RESTRICT,
  source_row_ref text NOT NULL CHECK (length(btrim(source_row_ref)) BETWEEN 1 AND 160),
  fingerprint_sha256 text NOT NULL CHECK (fingerprint_sha256 ~ '^[a-f0-9]{64}$'),
  transaction_reference text CHECK (
    transaction_reference IS NULL OR length(btrim(transaction_reference)) <= 240
  ),
  direction text NOT NULL CHECK (direction IN ('credit', 'debit')),
  value_date date NOT NULL,
  transaction_at timestamptz,
  amount_kobo bigint NOT NULL CHECK (amount_kobo > 0),
  currency text NOT NULL DEFAULT 'NGN' CHECK (currency = 'NGN'),
  private_description text CHECK (private_description IS NULL OR length(private_description) <= 2000),
  allocation_state text NOT NULL DEFAULT 'unresolved' CHECK (
    allocation_state IN ('unresolved', 'ambiguous', 'duplicate', 'partially_allocated', 'allocated')
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (import_id, source_row_ref)
);

CREATE INDEX gift_pool_statement_entries_fingerprint_idx
  ON public.gift_pool_bank_statement_entries(fingerprint_sha256);
CREATE INDEX gift_pool_statement_entries_reference_idx
  ON public.gift_pool_bank_statement_entries(transaction_reference)
  WHERE transaction_reference IS NOT NULL;
CREATE INDEX gift_pool_statement_entries_match_idx
  ON public.gift_pool_bank_statement_entries(direction, value_date, amount_kobo)
  WHERE allocation_state IN ('unresolved', 'ambiguous', 'partially_allocated');

CREATE TABLE public.gift_pool_settlement_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'flutterwave' CHECK (provider = 'flutterwave'),
  provider_settlement_reference text NOT NULL CHECK (
    length(btrim(provider_settlement_reference)) BETWEEN 1 AND 240
  ),
  gross_kobo bigint NOT NULL CHECK (gross_kobo >= 0),
  provider_fees_kobo bigint NOT NULL CHECK (provider_fees_kobo >= 0),
  adjustments_kobo bigint NOT NULL DEFAULT 0,
  net_kobo bigint NOT NULL CHECK (net_kobo >= 0),
  value_date date NOT NULL,
  status text NOT NULL DEFAULT 'unresolved' CHECK (
    status IN ('unresolved', 'partially_allocated', 'reconciled', 'exception')
  ),
  reconciliation_revision bigint NOT NULL DEFAULT 0 CHECK (reconciliation_revision >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  reconciled_at timestamptz,
  UNIQUE (provider, provider_settlement_reference),
  CHECK (net_kobo = gross_kobo - provider_fees_kobo + adjustments_kobo)
);

CREATE INDEX gift_pool_settlement_batches_status_idx
  ON public.gift_pool_settlement_batches(status, value_date);

CREATE TABLE public.gift_pool_settlement_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_batch_id uuid NOT NULL REFERENCES public.gift_pool_settlement_batches(id) ON DELETE RESTRICT,
  payment_transaction_id uuid NOT NULL UNIQUE
    REFERENCES public.gift_pool_payment_transactions(id) ON DELETE RESTRICT,
  gross_kobo bigint NOT NULL CHECK (gross_kobo > 0),
  provider_fees_kobo bigint NOT NULL CHECK (provider_fees_kobo >= 0),
  adjustments_kobo bigint NOT NULL DEFAULT 0,
  net_kobo bigint NOT NULL CHECK (net_kobo >= 0),
  operation_key text NOT NULL UNIQUE CHECK (length(operation_key) BETWEEN 8 AND 128),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (net_kobo = gross_kobo - provider_fees_kobo + adjustments_kobo)
);

CREATE INDEX gift_pool_settlement_allocations_batch_idx
  ON public.gift_pool_settlement_allocations(settlement_batch_id);

CREATE TABLE public.gift_pool_settlement_bank_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_batch_id uuid NOT NULL REFERENCES public.gift_pool_settlement_batches(id) ON DELETE RESTRICT,
  statement_entry_id uuid NOT NULL REFERENCES public.gift_pool_bank_statement_entries(id) ON DELETE RESTRICT,
  amount_kobo bigint NOT NULL CHECK (amount_kobo > 0),
  operation_key text NOT NULL UNIQUE CHECK (length(operation_key) BETWEEN 8 AND 128),
  allocated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  allocated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (settlement_batch_id, statement_entry_id)
);

CREATE INDEX gift_pool_settlement_bank_entry_idx
  ON public.gift_pool_settlement_bank_allocations(statement_entry_id);

CREATE TABLE public.gift_pool_provider_reserve_fundings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount_kobo bigint NOT NULL CHECK (amount_kobo > 0),
  operation_key text NOT NULL UNIQUE CHECK (length(operation_key) BETWEEN 8 AND 128),
  initiated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  initiated_by_audit_id text NOT NULL CHECK (length(btrim(initiated_by_audit_id)) BETWEEN 1 AND 160),
  moniepoint_transfer_reference text NOT NULL UNIQUE CHECK (
    length(btrim(moniepoint_transfer_reference)) BETWEEN 1 AND 240
  ),
  initiated_at timestamptz NOT NULL,
  flutterwave_balance_reference text,
  balance_credit_evidence_ref text,
  balance_credited_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'reconciled', 'outcome_unknown', 'rejected')
  ),
  ledger_revision bigint NOT NULL DEFAULT 0 CHECK (ledger_revision >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    status <> 'reconciled'
    OR (balance_credit_evidence_ref IS NOT NULL AND balance_credited_at IS NOT NULL)
  )
);

CREATE INDEX gift_pool_reserve_fundings_status_idx
  ON public.gift_pool_provider_reserve_fundings(status, initiated_at);

CREATE TABLE public.gift_pool_final_cost_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid NOT NULL REFERENCES public.gift_pools(id) ON DELETE RESTRICT,
  revision integer NOT NULL CHECK (revision > 0),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_audit_id text NOT NULL CHECK (length(btrim(actor_audit_id)) BETWEEN 1 AND 160),
  item_snapshot jsonb NOT NULL CHECK (jsonb_typeof(item_snapshot) = 'object'),
  variant_snapshot jsonb NOT NULL CHECK (jsonb_typeof(variant_snapshot) = 'object'),
  quantity smallint NOT NULL DEFAULT 1 CHECK (quantity = 1),
  available boolean NOT NULL,
  delivery_charge_ngn bigint NOT NULL CHECK (delivery_charge_ngn >= 0),
  supplier_identity_snapshot jsonb NOT NULL CHECK (
    jsonb_typeof(supplier_identity_snapshot) = 'object'
  ),
  supplier_payment_destination_ref text NOT NULL CHECK (
    length(btrim(supplier_payment_destination_ref)) BETWEEN 1 AND 240
  ),
  procurement_expense_ngn bigint NOT NULL CHECK (procurement_expense_ngn >= 0),
  saved_customer_total_ngn bigint NOT NULL CHECK (saved_customer_total_ngn > 0),
  proposed_customer_total_ngn bigint NOT NULL CHECK (proposed_customer_total_ngn > 0),
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (
    jsonb_typeof(evidence_refs) = 'array' AND octet_length(evidence_refs::text) <= 16384
  ),
  confirmed_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL CHECK (expires_at > confirmed_at),
  owner_decision text NOT NULL DEFAULT 'pending' CHECK (
    owner_decision IN ('pending', 'accepted', 'declined', 'not_required', 'superseded', 'expired')
  ),
  owner_decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  owner_decided_at timestamptz,
  owner_decision_audit_id text,
  is_current boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pool_id, revision),
  UNIQUE (pool_id, id),
  CHECK (
    (proposed_customer_total_ngn = saved_customer_total_ngn AND owner_decision = 'not_required')
    OR (proposed_customer_total_ngn < saved_customer_total_ngn AND owner_decision <> 'not_required')
    OR (proposed_customer_total_ngn > saved_customer_total_ngn AND owner_decision <> 'not_required')
    OR owner_decision IN ('superseded', 'expired')
  ),
  CHECK (
    (owner_decision IN ('pending', 'not_required') AND owner_decided_at IS NULL)
    OR (owner_decision IN ('accepted', 'declined') AND owner_decided_at IS NOT NULL)
    OR owner_decision IN ('superseded', 'expired')
  ),
  CHECK (
    owner_decision NOT IN ('accepted', 'declined')
    OR owner_decision_audit_id IS NOT NULL
  )
);

CREATE UNIQUE INDEX gift_pool_final_cost_one_current_idx
  ON public.gift_pool_final_cost_confirmations(pool_id)
  WHERE is_current;
CREATE INDEX gift_pool_final_cost_actor_idx
  ON public.gift_pool_final_cost_confirmations(actor_user_id, confirmed_at DESC)
  WHERE actor_user_id IS NOT NULL;

CREATE TABLE public.gift_pool_ledger_postings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('pool', 'company')),
  pool_id uuid REFERENCES public.gift_pools(id) ON DELETE RESTRICT,
  operation_reference text NOT NULL CHECK (length(btrim(operation_reference)) BETWEEN 1 AND 240),
  posting_key text NOT NULL CHECK (length(btrim(posting_key)) BETWEEN 1 AND 120),
  account_category text NOT NULL CHECK (
    account_category IN (
      'pool_principal_liability', 'pool_fee_revenue', 'cash_fee_revenue',
      'partial_cash_payout_fee', 'provider_processing_expense', 'supplier_cost',
      'recipient_payout', 'contributor_refund', 'provider_refund_fee', 'payment_reversal',
      'chargeback_principal', 'dispute_fee', 'operating_reserve',
      'flutterwave_refund_balance', 'bank_cash'
    )
  ),
  amount_kobo bigint NOT NULL CHECK (amount_kobo <> 0),
  currency text NOT NULL DEFAULT 'NGN' CHECK (currency = 'NGN'),
  source_revision bigint NOT NULL CHECK (source_revision >= 0),
  actor_audit_id text NOT NULL CHECK (length(btrim(actor_audit_id)) BETWEEN 1 AND 160),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope, operation_reference, posting_key),
  CHECK ((scope = 'pool' AND pool_id IS NOT NULL) OR (scope = 'company' AND pool_id IS NULL))
);

CREATE INDEX gift_pool_ledger_pool_created_idx
  ON public.gift_pool_ledger_postings(pool_id, created_at, id)
  WHERE pool_id IS NOT NULL;
CREATE INDEX gift_pool_ledger_company_created_idx
  ON public.gift_pool_ledger_postings(created_at, id)
  WHERE scope = 'company';
CREATE INDEX gift_pool_ledger_operation_idx
  ON public.gift_pool_ledger_postings(operation_reference);

CREATE TABLE public.gift_pool_payout_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid NOT NULL REFERENCES public.gift_pools(id) ON DELETE RESTRICT,
  task_type text NOT NULL CHECK (
    task_type IN ('recipient_physical', 'recipient_cash', 'supplier_payment')
  ),
  operation_key text NOT NULL UNIQUE CHECK (length(operation_key) BETWEEN 8 AND 128),
  amount_ngn bigint NOT NULL CHECK (amount_ngn > 0),
  beneficiary_snapshot jsonb NOT NULL CHECK (
    jsonb_typeof(beneficiary_snapshot) = 'object'
  ),
  ledger_revision bigint NOT NULL CHECK (ledger_revision >= 0),
  final_cost_revision integer,
  run_after timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN (
      'pending', 'initiated', 'outcome_unknown', 'review_no_debit',
      'review_transfer_found', 'review_unresolved', 'bank_confirmed', 'failed', 'cancelled'
    )
  ),
  transfer_initiated_at timestamptz,
  matched_at timestamptz,
  resolution_evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (
    jsonb_typeof(resolution_evidence_refs) = 'array'
  ),
  safe_error_code text CHECK (safe_error_code IS NULL OR length(safe_error_code) <= 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pool_id, task_type, operation_key),
  CHECK (
    (status IN ('initiated', 'outcome_unknown', 'review_no_debit', 'review_transfer_found', 'review_unresolved', 'bank_confirmed')
      AND transfer_initiated_at IS NOT NULL)
    OR status IN ('pending', 'failed', 'cancelled')
  )
);

CREATE INDEX gift_pool_payout_tasks_due_idx
  ON public.gift_pool_payout_tasks(run_after, created_at)
  WHERE status IN ('pending', 'review_no_debit');
CREATE INDEX gift_pool_payout_tasks_pool_idx
  ON public.gift_pool_payout_tasks(pool_id, created_at DESC);

CREATE TABLE public.gift_pool_payout_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.gift_pool_payout_tasks(id) ON DELETE RESTRICT,
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  operator_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  operator_audit_id text NOT NULL CHECK (length(btrim(operator_audit_id)) BETWEEN 1 AND 160),
  transfer_reference text NOT NULL UNIQUE CHECK (
    length(btrim(transfer_reference)) BETWEEN 1 AND 240
  ),
  initiated_at timestamptz NOT NULL,
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (
    jsonb_typeof(evidence_refs) = 'array' AND octet_length(evidence_refs::text) <= 16384
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, attempt_number)
);

CREATE INDEX gift_pool_payout_attempts_operator_idx
  ON public.gift_pool_payout_attempts(operator_user_id, initiated_at DESC)
  WHERE operator_user_id IS NOT NULL;

CREATE TABLE public.gift_pool_bank_debit_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_entry_id uuid NOT NULL UNIQUE
    REFERENCES public.gift_pool_bank_statement_entries(id) ON DELETE RESTRICT,
  payout_attempt_id uuid UNIQUE REFERENCES public.gift_pool_payout_attempts(id) ON DELETE RESTRICT,
  reserve_funding_id uuid UNIQUE REFERENCES public.gift_pool_provider_reserve_fundings(id) ON DELETE RESTRICT,
  amount_kobo bigint NOT NULL CHECK (amount_kobo > 0),
  allocated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  allocated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (((payout_attempt_id IS NOT NULL)::integer + (reserve_funding_id IS NOT NULL)::integer) = 1)
);

CREATE TABLE public.gift_pool_payout_attempt_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES public.gift_pool_payout_attempts(id) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK (
    event_type IN ('outcome_unknown', 'review_no_debit', 'review_transfer_found', 'review_unresolved', 'bank_confirmed', 'failed')
  ),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_audit_id text NOT NULL CHECK (length(btrim(actor_audit_id)) BETWEEN 1 AND 160),
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (
    jsonb_typeof(evidence_refs) = 'array' AND octet_length(evidence_refs::text) <= 16384
  ),
  operation_key text NOT NULL UNIQUE CHECK (length(operation_key) BETWEEN 8 AND 128),
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX gift_pool_payout_attempt_events_history_idx
  ON public.gift_pool_payout_attempt_events(attempt_id, occurred_at, id);

CREATE TABLE public.gift_pool_refund_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid NOT NULL REFERENCES public.gift_pools(id) ON DELETE RESTRICT,
  contract_revision integer NOT NULL CHECK (contract_revision > 0),
  contribution_id uuid NOT NULL,
  principal_refund_ngn bigint NOT NULL DEFAULT 0 CHECK (principal_refund_ngn >= 0),
  pool_fee_refund_ngn bigint NOT NULL DEFAULT 0 CHECK (pool_fee_refund_ngn >= 0),
  total_refund_ngn bigint NOT NULL CHECK (total_refund_ngn > 0),
  operation_key text NOT NULL UNIQUE CHECK (length(operation_key) BETWEEN 8 AND 128),
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'submitted', 'disbursement_pending', 'completed', 'failed')
  ),
  payment_transaction_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pool_id, contract_revision, contribution_id),
  FOREIGN KEY (pool_id, contract_revision)
    REFERENCES public.gift_pool_final_cost_confirmations(pool_id, revision) ON DELETE RESTRICT,
  FOREIGN KEY (pool_id, contribution_id)
    REFERENCES public.gift_pool_contributions(pool_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (pool_id, payment_transaction_id)
    REFERENCES public.gift_pool_payment_transactions(pool_id, id) ON DELETE RESTRICT,
  CHECK (total_refund_ngn = principal_refund_ngn + pool_fee_refund_ngn)
);

CREATE INDEX gift_pool_refund_allocations_pool_idx
  ON public.gift_pool_refund_allocations(pool_id, created_at);
CREATE INDEX gift_pool_refund_allocations_contribution_idx
  ON public.gift_pool_refund_allocations(contribution_id, created_at);

CREATE TABLE public.gift_pool_due_work (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid REFERENCES public.gift_pools(id) ON DELETE RESTRICT,
  work_type text NOT NULL CHECK (
    work_type IN (
      'close_pool', 'verify_settlement', 'submit_refund', 'poll_refund',
      'create_payout_task', 'send_notification', 'remind_operator', 'remind_dispute_response'
    )
  ),
  operation_key text NOT NULL UNIQUE CHECK (length(operation_key) BETWEEN 8 AND 128),
  run_after timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'leased', 'completed', 'retryable_error', 'terminal_error', 'cancelled')
  ),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  lease_token uuid,
  lease_expires_at timestamptz,
  completed_at timestamptz,
  safe_error_code text CHECK (safe_error_code IS NULL OR length(safe_error_code) <= 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (status = 'leased' AND lease_token IS NOT NULL AND lease_expires_at IS NOT NULL)
    OR status <> 'leased'
  ),
  CHECK (
    status = 'leased'
    OR (lease_token IS NULL AND lease_expires_at IS NULL)
  ),
  CHECK (
    (status = 'completed' AND completed_at IS NOT NULL)
    OR (status <> 'completed' AND completed_at IS NULL)
  )
);

CREATE INDEX gift_pool_due_work_claim_idx
  ON public.gift_pool_due_work(run_after, created_at)
  WHERE status IN ('pending', 'retryable_error');
CREATE INDEX gift_pool_due_work_pool_idx
  ON public.gift_pool_due_work(pool_id, created_at DESC)
  WHERE pool_id IS NOT NULL;

CREATE TABLE public.gift_pool_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid NOT NULL REFERENCES public.gift_pools(id) ON DELETE RESTRICT,
  recipient_type text NOT NULL CHECK (recipient_type IN ('owner', 'contributor')),
  recipient_id uuid NOT NULL,
  recipient_email text NOT NULL CHECK (length(btrim(recipient_email)) BETWEEN 3 AND 320),
  event_type text NOT NULL CHECK (
    event_type IN ('pool_funded', 'fulfillment_ready', 'payout_complete', 'payment_receipt', 'refund_status')
  ),
  idempotency_key text NOT NULL UNIQUE CHECK (length(idempotency_key) BETWEEN 8 AND 128),
  safe_template_data jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (
    jsonb_typeof(safe_template_data) = 'object' AND octet_length(safe_template_data::text) <= 8192
  ),
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'sending', 'sent', 'retryable_error', 'terminal_error')
  ),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  provider_message_reference text,
  safe_error_code text CHECK (safe_error_code IS NULL OR length(safe_error_code) <= 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  UNIQUE (pool_id, recipient_type, recipient_id, event_type, idempotency_key)
);

CREATE INDEX gift_pool_notifications_pending_idx
  ON public.gift_pool_notifications(created_at)
  WHERE status IN ('pending', 'retryable_error');
CREATE INDEX gift_pool_notifications_pool_idx
  ON public.gift_pool_notifications(pool_id, created_at DESC);

CREATE TABLE public.gift_pool_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid NOT NULL REFERENCES public.gift_pools(id) ON DELETE RESTRICT,
  payment_transaction_id uuid NOT NULL,
  provider_case_reference text NOT NULL UNIQUE CHECK (
    length(btrim(provider_case_reference)) BETWEEN 1 AND 240
  ),
  opened_at timestamptz NOT NULL,
  response_deadline timestamptz NOT NULL,
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (
    jsonb_typeof(evidence_refs) = 'array' AND octet_length(evidence_refs::text) <= 32768
  ),
  response_actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  response_submitted_at timestamptz,
  provider_submission_reference text,
  outcome text CHECK (outcome IS NULL OR outcome IN ('won', 'lost', 'withdrawn')),
  debit_kobo bigint CHECK (debit_kobo IS NULL OR debit_kobo >= 0),
  dispute_fee_kobo bigint CHECK (dispute_fee_kobo IS NULL OR dispute_fee_kobo >= 0),
  provider_reconciliation_reference text,
  reserve_exposure_open boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'opened' CHECK (
    status IN ('opened', 'response_due', 'response_submitted', 'won', 'lost', 'withdrawn', 'closed')
  ),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (response_deadline >= opened_at),
  FOREIGN KEY (pool_id, payment_transaction_id)
    REFERENCES public.gift_pool_payment_transactions(pool_id, id) ON DELETE RESTRICT,
  CHECK (
    status <> 'closed'
    OR (reserve_exposure_open = false AND outcome IS NOT NULL AND resolved_at IS NOT NULL)
  )
);

CREATE INDEX gift_pool_disputes_deadline_idx
  ON public.gift_pool_disputes(response_deadline)
  WHERE status IN ('opened', 'response_due');
CREATE INDEX gift_pool_disputes_pool_idx
  ON public.gift_pool_disputes(pool_id, opened_at DESC);
CREATE INDEX gift_pool_disputes_transaction_idx
  ON public.gift_pool_disputes(payment_transaction_id);

CREATE TABLE public.gift_pool_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid REFERENCES public.gift_pools(id) ON DELETE RESTRICT,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_audit_id text NOT NULL CHECK (length(btrim(actor_audit_id)) BETWEEN 1 AND 160),
  actor_kind text NOT NULL CHECK (actor_kind IN ('owner', 'admin', 'system', 'provider')),
  subject_type text NOT NULL CHECK (length(btrim(subject_type)) BETWEEN 1 AND 80),
  subject_id uuid,
  event_type text NOT NULL CHECK (length(btrim(event_type)) BETWEEN 1 AND 120),
  operation_key text NOT NULL CHECK (length(operation_key) BETWEEN 8 AND 128),
  request_hash text CHECK (request_hash IS NULL OR request_hash ~ '^[a-f0-9]{64}$'),
  reason text CHECK (reason IS NULL OR length(reason) <= 1000),
  event_data jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (
    jsonb_typeof(event_data) = 'object' AND octet_length(event_data::text) <= 16384
  ),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (actor_audit_id, event_type, operation_key)
);

CREATE INDEX gift_pool_audit_events_pool_history_idx
  ON public.gift_pool_audit_events(pool_id, occurred_at DESC, id)
  WHERE pool_id IS NOT NULL;
CREATE INDEX gift_pool_audit_events_subject_idx
  ON public.gift_pool_audit_events(subject_type, subject_id, occurred_at DESC);

-- Every pool record stays server only. Public, authenticated, and generic
-- PUBLIC roles have no direct table access; future pages use narrow server
-- projections after the required authorization and privacy checks.
ALTER TABLE public.gift_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_pool_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_pool_payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_pool_bank_statement_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_pool_bank_statement_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_pool_settlement_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_pool_settlement_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_pool_settlement_bank_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_pool_provider_reserve_fundings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_pool_final_cost_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_pool_ledger_postings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_pool_payout_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_pool_payout_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_pool_bank_debit_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_pool_payout_attempt_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_pool_refund_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_pool_due_work ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_pool_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_pool_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_pool_audit_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.gift_pools,
  public.gift_pool_contributions,
  public.gift_pool_payment_transactions,
  public.gift_pool_bank_statement_imports,
  public.gift_pool_bank_statement_entries,
  public.gift_pool_settlement_batches,
  public.gift_pool_settlement_allocations,
  public.gift_pool_settlement_bank_allocations,
  public.gift_pool_provider_reserve_fundings,
  public.gift_pool_final_cost_confirmations,
  public.gift_pool_ledger_postings,
  public.gift_pool_payout_tasks,
  public.gift_pool_payout_attempts,
  public.gift_pool_bank_debit_allocations,
  public.gift_pool_payout_attempt_events,
  public.gift_pool_refund_allocations,
  public.gift_pool_due_work,
  public.gift_pool_notifications,
  public.gift_pool_disputes,
  public.gift_pool_audit_events
FROM PUBLIC, anon, authenticated;

-- Remove any project default grants inherited by service_role before
-- granting only the operations each server boundary needs.
REVOKE ALL ON TABLE
  public.gift_pools,
  public.gift_pool_contributions,
  public.gift_pool_payment_transactions,
  public.gift_pool_bank_statement_imports,
  public.gift_pool_bank_statement_entries,
  public.gift_pool_settlement_batches,
  public.gift_pool_settlement_allocations,
  public.gift_pool_settlement_bank_allocations,
  public.gift_pool_provider_reserve_fundings,
  public.gift_pool_final_cost_confirmations,
  public.gift_pool_ledger_postings,
  public.gift_pool_payout_tasks,
  public.gift_pool_payout_attempts,
  public.gift_pool_bank_debit_allocations,
  public.gift_pool_payout_attempt_events,
  public.gift_pool_refund_allocations,
  public.gift_pool_due_work,
  public.gift_pool_notifications,
  public.gift_pool_disputes,
  public.gift_pool_audit_events
FROM service_role;

GRANT SELECT, INSERT, UPDATE ON TABLE
  public.gift_pools,
  public.gift_pool_contributions,
  public.gift_pool_payment_transactions,
  public.gift_pool_bank_statement_imports,
  public.gift_pool_bank_statement_entries,
  public.gift_pool_bank_statement_entries,
  public.gift_pool_settlement_batches,
  public.gift_pool_provider_reserve_fundings,
  public.gift_pool_final_cost_confirmations,
  public.gift_pool_payout_tasks,
  public.gift_pool_refund_allocations,
  public.gift_pool_due_work,
  public.gift_pool_notifications,
  public.gift_pool_disputes
TO service_role;

GRANT SELECT, INSERT ON TABLE
  public.gift_pool_settlement_allocations,
  public.gift_pool_settlement_bank_allocations,
  public.gift_pool_ledger_postings,
  public.gift_pool_payout_attempts,
  public.gift_pool_bank_debit_allocations,
  public.gift_pool_payout_attempt_events,
  public.gift_pool_audit_events
TO service_role;

COMMIT;
