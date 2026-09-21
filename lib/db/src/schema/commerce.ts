import { createInsertSchema } from "drizzle-zod";
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const vendorsTable = pgTable("commerce_vendors", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  status: text("status").notNull(),
  orders: integer("orders").notNull().default(0),
  payable: integer("payable").notNull().default(0),
  health: integer("health").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ordersTable = pgTable("commerce_orders", {
  id: text("id").primaryKey(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  status: text("status").notNull(),
  paymentStatus: text("payment_status").notNull(),
  fulfillmentStatus: text("fulfillment_status").notNull(),
  total: integer("total").notNull(),
  currency: text("currency").notNull().default("PKR"),
  vendorCount: integer("vendor_count").notNull(),
  itemCount: integer("item_count").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  returnWindow: text("return_window").notNull(),
  exception: text("exception"),
});

export const vendorSubOrdersTable = pgTable("commerce_vendor_sub_orders", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  vendorName: text("vendor_name").notNull(),
  status: text("status").notNull(),
  itemCount: integer("item_count").notNull(),
  fulfillmentNode: text("fulfillment_node").notNull(),
  shipmentStatus: text("shipment_status").notNull(),
});

export const orderLinesTable = pgTable("commerce_order_lines", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  sku: text("sku").notNull(),
  title: text("title").notNull(),
  vendorName: text("vendor_name").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: integer("unit_price").notNull(),
  status: text("status").notNull(),
});

export const timelineEventsTable = pgTable("commerce_timeline_events", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  label: text("label").notNull(),
  detail: text("detail").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  tone: text("tone").notNull(),
});

export const activityTable = pgTable("commerce_activity", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  detail: text("detail").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  tone: text("tone").notNull(),
  orderId: text("order_id"),
});

export const inventoryNodesTable = pgTable("commerce_inventory_nodes", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  region: text("region").notNull(),
  available: integer("available").notNull(),
  reserved: integer("reserved").notNull(),
  health: text("health").notNull(),
});

export const fulfillmentExceptionsTable = pgTable("commerce_fulfillment_exceptions", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  title: text("title").notNull(),
  detail: text("detail").notNull(),
  severity: text("severity").notNull(),
  age: text("age").notNull(),
  owner: text("owner").notNull(),
  status: text("status").notNull(),
});

export const settlementBatchesTable = pgTable("commerce_settlement_batches", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  amount: integer("amount").notNull(),
  vendorCount: integer("vendor_count").notNull(),
  status: text("status").notNull(),
  date: text("date").notNull(),
});

export const insertVendorSchema = createInsertSchema(vendorsTable).omit({ createdAt: true });
export const insertOrderSchema = createInsertSchema(ordersTable).omit({ createdAt: true });
export const insertVendorSubOrderSchema = createInsertSchema(vendorSubOrdersTable);
export const insertOrderLineSchema = createInsertSchema(orderLinesTable);
export const insertTimelineEventSchema = createInsertSchema(timelineEventsTable);
export const insertActivitySchema = createInsertSchema(activityTable);
export const insertInventoryNodeSchema = createInsertSchema(inventoryNodesTable);
export const insertFulfillmentExceptionSchema = createInsertSchema(fulfillmentExceptionsTable);
export const insertSettlementBatchSchema = createInsertSchema(settlementBatchesTable);

export type InsertVendor = z.infer<typeof insertVendorSchema>;
export type Vendor = typeof vendorsTable.$inferSelect;
export type Order = typeof ordersTable.$inferSelect;
export type VendorSubOrder = typeof vendorSubOrdersTable.$inferSelect;
export type OrderLine = typeof orderLinesTable.$inferSelect;
export type TimelineEvent = typeof timelineEventsTable.$inferSelect;
export type ActivityItem = typeof activityTable.$inferSelect;
export type InventoryNode = typeof inventoryNodesTable.$inferSelect;
export type FulfillmentException = typeof fulfillmentExceptionsTable.$inferSelect;
export type SettlementBatch = typeof settlementBatchesTable.$inferSelect;