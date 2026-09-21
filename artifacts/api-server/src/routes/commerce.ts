import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  activityTable,
  fulfillmentExceptionsTable,
  inventoryNodesTable,
  orderLinesTable,
  ordersTable,
  settlementBatchesTable,
  timelineEventsTable,
  vendorSubOrdersTable,
  vendorsTable,
} from "@workspace/db";
import {
  ApplyOrderActionBody,
  ApplyOrderActionParams,
  ApplyOrderActionResponse,
  GetActivityQueryParams,
  GetActivityResponse,
  GetDashboardSummaryResponse,
  GetInventoryOverviewResponse,
  GetOrderParams,
  GetOrderResponse,
  GetSettlementSummaryResponse,
  ListFulfillmentExceptionsQueryParams,
  ListFulfillmentExceptionsResponse,
  ListOrdersQueryParams,
  ListOrdersResponse,
  ListVendorsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const [orders, exceptions, nodes, vendors] = await Promise.all([
    db.select().from(ordersTable),
    db.select().from(fulfillmentExceptionsTable),
    db.select().from(inventoryNodesTable),
    db.select().from(vendorsTable),
  ]);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const ordersToday = orders.filter((order) => order.createdAt >= todayStart).length;
  const activeExceptions = exceptions.filter((exception) => exception.status !== "resolved").length;
  const grossMerchandiseValue = orders.reduce((sum, order) => sum + order.total, 0);
  const settlementReady = vendors.reduce((sum, vendor) => sum + vendor.payable, 0);
  const availableUnits = nodes.reduce((sum, node) => sum + node.available, 0);
  const reservedUnits = nodes.reduce((sum, node) => sum + node.reserved, 0);
  const totalUnits = availableUnits + reservedUnits;

  const data = {
    grossMerchandiseValue,
    ordersToday,
    activeExceptions,
    settlementReady,
    reservationRate: totalUnits === 0 ? 0 : reservedUnits / totalUnits,
    pipeline: [
      {
        label: "Payment pending",
        value: orders.filter((order) => order.paymentStatus !== "captured").reduce((sum, order) => sum + order.total, 0),
        count: orders.filter((order) => order.paymentStatus !== "captured").length,
        tone: "amber",
      },
      {
        label: "In fulfillment",
        value: orders.filter((order) => order.fulfillmentStatus !== "delivered").reduce((sum, order) => sum + order.total, 0),
        count: orders.filter((order) => order.fulfillmentStatus !== "delivered").length,
        tone: "blue",
      },
      {
        label: "Settlement ready",
        value: settlementReady,
        count: orders.filter((order) => order.status === "settlement_ready").length,
        tone: "green",
      },
    ],
  };

  res.json(GetDashboardSummaryResponse.parse(data));
});

router.get("/activity", async (req, res): Promise<void> => {
  const parsed = GetActivityQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const rows = await db
    .select()
    .from(activityTable)
    .orderBy(desc(activityTable.occurredAt))
    .limit(parsed.data.limit);
  res.json(GetActivityResponse.parse(rows));
});

router.get("/orders", async (req, res): Promise<void> => {
  const parsed = ListOrdersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const filters = [];
  if (parsed.data.status) filters.push(eq(ordersTable.status, parsed.data.status));
  if (parsed.data.search) {
    filters.push(or(ilike(ordersTable.id, `%${parsed.data.search}%`), ilike(ordersTable.customerName, `%${parsed.data.search}%`)));
  }

  const rows = await db
    .select()
    .from(ordersTable)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(ordersTable.createdAt))
    .limit(parsed.data.limit);
  res.json(ListOrdersResponse.parse(rows));
});

router.get("/orders/:orderId", async (req, res): Promise<void> => {
  const params = GetOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.orderId));
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  const [subOrders, lines, timeline] = await Promise.all([
    db.select().from(vendorSubOrdersTable).where(eq(vendorSubOrdersTable.orderId, order.id)),
    db.select().from(orderLinesTable).where(eq(orderLinesTable.orderId, order.id)),
    db.select().from(timelineEventsTable).where(eq(timelineEventsTable.orderId, order.id)).orderBy(desc(timelineEventsTable.occurredAt)),
  ]);

  res.json(GetOrderResponse.parse({ ...order, subOrders, lines, timeline }));
});

router.post("/orders/:orderId", async (req, res): Promise<void> => {
  const params = ApplyOrderActionParams.safeParse(req.params);
  const body = ApplyOrderActionBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [existing] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.orderId));
  if (!existing) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  const action = body.data.action;
  const update =
    action === "resolve_exception"
      ? { exception: null, status: "in_fulfillment" }
      : action === "place_on_hold"
        ? { status: "on_hold" }
        : { status: "in_fulfillment" };

  const [updated] = await db
    .update(ordersTable)
    .set(update)
    .where(eq(ordersTable.id, existing.id))
    .returning();

  if (action === "resolve_exception") {
    await db
      .update(fulfillmentExceptionsTable)
      .set({ status: "resolved" })
      .where(eq(fulfillmentExceptionsTable.orderId, existing.id));
  }

  await db.insert(activityTable).values({
    id: `ACT-${randomUUID()}`,
    type: "order",
    title: action === "resolve_exception" ? "Exception resolved" : action === "place_on_hold" ? "Order placed on hold" : "Order released",
    detail: `${existing.id} was updated by Operations`,
    occurredAt: new Date(),
    tone: action === "resolve_exception" ? "success" : "info",
    orderId: existing.id,
  });

  res.json(ApplyOrderActionResponse.parse(updated));
});

router.get("/inventory/overview", async (_req, res): Promise<void> => {
  const [nodes, pendingPaymentOrders] = await Promise.all([
    db.select().from(inventoryNodesTable),
    db.select().from(ordersTable).where(eq(ordersTable.paymentStatus, "requires_action")),
  ]);
  const availableUnits = nodes.reduce((sum, node) => sum + node.available, 0);
  const reservedUnits = nodes.reduce((sum, node) => sum + node.reserved, 0);
  const totalUnits = availableUnits + reservedUnits;
  const expiringReservations = pendingPaymentOrders.reduce((sum, order) => sum + order.itemCount, 0);
  res.json(
    GetInventoryOverviewResponse.parse({
      availableUnits,
      reservedUnits,
      reservationRate: totalUnits === 0 ? 0 : reservedUnits / totalUnits,
      expiringReservations,
      nodes,
    }),
  );
});

router.get("/fulfillment/exceptions", async (req, res): Promise<void> => {
  const parsed = ListFulfillmentExceptionsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const rows = await db
    .select()
    .from(fulfillmentExceptionsTable)
    .where(parsed.data.status ? eq(fulfillmentExceptionsTable.status, parsed.data.status) : undefined);
  res.json(ListFulfillmentExceptionsResponse.parse(rows));
});

router.get("/vendors", async (_req, res): Promise<void> => {
  const rows = await db.select().from(vendorsTable).orderBy(desc(vendorsTable.payable));
  res.json(ListVendorsResponse.parse(rows));
});

router.get("/settlements/summary", async (_req, res): Promise<void> => {
  const [batches, vendors] = await Promise.all([
    db.select().from(settlementBatchesTable).orderBy(desc(settlementBatchesTable.date)),
    db.select().from(vendorsTable),
  ]);
  const eligibleAmount = batches.filter((batch) => batch.status === "ready_for_review").reduce((sum, batch) => sum + batch.amount, 0);
  const pendingAmount = vendors.reduce((sum, vendor) => sum + vendor.payable, 0);

  const latestBatchDate = batches.length > 0 ? batches[0].date : null;
  let nextRun = "Pending schedule";
  if (latestBatchDate) {
    const parsed = new Date(latestBatchDate);
    if (!Number.isNaN(parsed.getTime())) {
      parsed.setDate(parsed.getDate() + 3);
      nextRun = parsed.toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" }) + " · 09:00 PKT";
    }
  }

  res.json(
    GetSettlementSummaryResponse.parse({
      eligibleAmount,
      pendingAmount,
      nextRun,
      batches,
      vendorCount: vendors.length,
    }),
  );
});

export default router;