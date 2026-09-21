/*
# Create Commerce Operating System tables

Creates the core commerce schema for the marketplace operations dashboard.
This is a single-tenant operations console with no sign-in screen, so all
tables use anon+authenticated RLS policies (data is intentionally shared).

## Tables created:
- commerce_vendors — vendor accounts with category, health, payable
- commerce_orders — customer orders with lifecycle, payment, fulfillment status
- commerce_vendor_sub_orders — per-vendor split of a customer order
- commerce_order_lines — individual line items within an order
- commerce_timeline_events — chronological events for an order
- commerce_activity — operations activity feed items
- commerce_inventory_nodes — fulfillment node inventory levels
- commerce_fulfillment_exceptions — exceptions requiring operator attention
- commerce_settlement_batches — settlement batch records

## Security:
- RLS enabled on all tables
- CRUD policies for anon+authenticated (single-tenant operations console)
*/

-- Vendors
CREATE TABLE IF NOT EXISTS commerce_vendors (
  id text PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL,
  status text NOT NULL,
  orders integer NOT NULL DEFAULT 0,
  payable integer NOT NULL DEFAULT 0,
  health integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE commerce_vendors ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_commerce_vendors_payable ON commerce_vendors(payable DESC);

-- Orders
CREATE TABLE IF NOT EXISTS commerce_orders (
  id text PRIMARY KEY,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  status text NOT NULL,
  payment_status text NOT NULL,
  fulfillment_status text NOT NULL,
  total integer NOT NULL,
  currency text NOT NULL DEFAULT 'PKR',
  vendor_count integer NOT NULL,
  item_count integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  return_window text NOT NULL,
  exception text
);
ALTER TABLE commerce_orders ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_commerce_orders_created_at ON commerce_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_commerce_orders_status ON commerce_orders(status);
CREATE INDEX IF NOT EXISTS idx_commerce_orders_payment_status ON commerce_orders(payment_status);

-- Vendor sub-orders
CREATE TABLE IF NOT EXISTS commerce_vendor_sub_orders (
  id text PRIMARY KEY,
  order_id text NOT NULL REFERENCES commerce_orders(id) ON DELETE CASCADE,
  vendor_name text NOT NULL,
  status text NOT NULL,
  item_count integer NOT NULL,
  fulfillment_node text NOT NULL,
  shipment_status text NOT NULL
);
ALTER TABLE commerce_vendor_sub_orders ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_commerce_vendor_sub_orders_order_id ON commerce_vendor_sub_orders(order_id);

-- Order lines
CREATE TABLE IF NOT EXISTS commerce_order_lines (
  id text PRIMARY KEY,
  order_id text NOT NULL REFERENCES commerce_orders(id) ON DELETE CASCADE,
  sku text NOT NULL,
  title text NOT NULL,
  vendor_name text NOT NULL,
  quantity integer NOT NULL,
  unit_price integer NOT NULL,
  status text NOT NULL
);
ALTER TABLE commerce_order_lines ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_commerce_order_lines_order_id ON commerce_order_lines(order_id);

-- Timeline events
CREATE TABLE IF NOT EXISTS commerce_timeline_events (
  id text PRIMARY KEY,
  order_id text NOT NULL REFERENCES commerce_orders(id) ON DELETE CASCADE,
  label text NOT NULL,
  detail text NOT NULL,
  occurred_at timestamptz NOT NULL,
  tone text NOT NULL
);
ALTER TABLE commerce_timeline_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_commerce_timeline_events_order_id ON commerce_timeline_events(order_id);
CREATE INDEX IF NOT EXISTS idx_commerce_timeline_events_occurred_at ON commerce_timeline_events(occurred_at DESC);

-- Activity
CREATE TABLE IF NOT EXISTS commerce_activity (
  id text PRIMARY KEY,
  type text NOT NULL,
  title text NOT NULL,
  detail text NOT NULL,
  occurred_at timestamptz NOT NULL,
  tone text NOT NULL,
  order_id text REFERENCES commerce_orders(id) ON DELETE SET NULL
);
ALTER TABLE commerce_activity ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_commerce_activity_occurred_at ON commerce_activity(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_commerce_activity_order_id ON commerce_activity(order_id);

-- Inventory nodes
CREATE TABLE IF NOT EXISTS commerce_inventory_nodes (
  id text PRIMARY KEY,
  name text NOT NULL,
  region text NOT NULL,
  available integer NOT NULL,
  reserved integer NOT NULL,
  health text NOT NULL
);
ALTER TABLE commerce_inventory_nodes ENABLE ROW LEVEL SECURITY;

-- Fulfillment exceptions
CREATE TABLE IF NOT EXISTS commerce_fulfillment_exceptions (
  id text PRIMARY KEY,
  order_id text NOT NULL REFERENCES commerce_orders(id) ON DELETE CASCADE,
  title text NOT NULL,
  detail text NOT NULL,
  severity text NOT NULL,
  age text NOT NULL,
  owner text NOT NULL,
  status text NOT NULL
);
ALTER TABLE commerce_fulfillment_exceptions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_commerce_fulfillment_exceptions_order_id ON commerce_fulfillment_exceptions(order_id);
CREATE INDEX IF NOT EXISTS idx_commerce_fulfillment_exceptions_status ON commerce_fulfillment_exceptions(status);

-- Settlement batches
CREATE TABLE IF NOT EXISTS commerce_settlement_batches (
  id text PRIMARY KEY,
  label text NOT NULL,
  amount integer NOT NULL,
  vendor_count integer NOT NULL,
  status text NOT NULL,
  date text NOT NULL
);
ALTER TABLE commerce_settlement_batches ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_commerce_settlement_batches_date ON commerce_settlement_batches(date DESC);
CREATE INDEX IF NOT EXISTS idx_commerce_settlement_batches_status ON commerce_settlement_batches(status);

-- RLS policies for all tables (single-tenant operations console, anon+authenticated)
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'commerce_vendors', 'commerce_orders', 'commerce_vendor_sub_orders',
      'commerce_order_lines', 'commerce_timeline_events', 'commerce_activity',
      'commerce_inventory_nodes', 'commerce_fulfillment_exceptions', 'commerce_settlement_batches'
    ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "anon_select_%s" ON %s;', tbl, tbl);
    EXECUTE format('CREATE POLICY "anon_select_%s" ON %s FOR SELECT TO anon, authenticated USING (true);', tbl, tbl);

    EXECUTE format('DROP POLICY IF EXISTS "anon_insert_%s" ON %s;', tbl, tbl);
    EXECUTE format('CREATE POLICY "anon_insert_%s" ON %s FOR INSERT TO anon, authenticated WITH CHECK (true);', tbl, tbl);

    EXECUTE format('DROP POLICY IF EXISTS "anon_update_%s" ON %s;', tbl, tbl);
    EXECUTE format('CREATE POLICY "anon_update_%s" ON %s FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);', tbl, tbl);

    EXECUTE format('DROP POLICY IF EXISTS "anon_delete_%s" ON %s;', tbl, tbl);
    EXECUTE format('CREATE POLICY "anon_delete_%s" ON %s FOR DELETE TO anon, authenticated USING (true);', tbl, tbl);
  END LOOP;
END $$;
