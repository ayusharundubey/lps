-- LPS STORE - PDF Blueprint Audit Enhancements
-- Adds immutable supplier cost snapshots & generated net_profit_inr to order_items.

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS unit_supplier_cost_inr NUMERIC(12, 2) NOT NULL DEFAULT 0
    CHECK (unit_supplier_cost_inr >= 0);

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS net_profit_inr NUMERIC(12, 2)
    GENERATED ALWAYS AS (total_price_inr - (unit_supplier_cost_inr * quantity)) STORED;

UPDATE public.order_items oi
SET unit_supplier_cost_inr = COALESCE(p.supplier_cost_inr, 0)
FROM public.packages p
WHERE oi.package_id = p.id
  AND oi.unit_supplier_cost_inr = 0
  AND COALESCE(p.supplier_cost_inr, 0) > 0;
