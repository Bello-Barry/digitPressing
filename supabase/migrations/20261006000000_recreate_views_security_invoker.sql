-- =============================================================================
-- MIGRATION: Recreate view order_payment_summary with security_invoker = true
-- Multi-tenant security hardening: Ensures that queries on order_payment_summary
-- enforce Row-Level Security (RLS) policies for the calling/invoking user.
-- =============================================================================

CREATE OR REPLACE VIEW public.order_payment_summary
WITH (security_invoker = true)
AS
SELECT
  o.id                                                          AS order_id,
  o.organization_id,
  o.total_amount,
  COALESCE(SUM(p.amount), 0)                                    AS paid_amount,
  o.total_amount - COALESCE(SUM(p.amount), 0)                  AS balance_due,
  COUNT(p.id)                                                   AS payment_count
FROM public.orders o
LEFT JOIN public.payments p ON p.order_id = o.id
GROUP BY o.id, o.organization_id, o.total_amount;

GRANT SELECT ON public.order_payment_summary TO authenticated;
