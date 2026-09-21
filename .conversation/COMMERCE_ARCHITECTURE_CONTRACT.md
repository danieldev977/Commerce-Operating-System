# Commerce Operating System

## Architecture Contract

**Status:** Draft for implementation  
**Scope:** Marketplace MVP, Pakistan-first  
**Primary architectural choice:** Modular monolith with PostgreSQL, background workers, an outbox, and explicit domain boundaries  
**Initial currency:** PKR  
**Initial operating model:** Multiple vendors selling through one platform, with platform commission and delayed settlement  

This document converts the commerce operating-system brief into constraints that an implementation agent can follow without inventing the business architecture.

---

## 1. Product Boundary

The product is not primarily an ecommerce storefront. It is a commerce operating system with several interfaces:

- Customer storefront and account
- Vendor portal
- Operations control tower
- Finance and settlement console
- AI-assisted customer, vendor, and operations workflows

The system of record is the deterministic commerce core. AI can query the core and request approved actions, but it cannot become the source of truth for money, inventory, permissions, order state, or policy decisions.

### Initial release boundary

The first release must support:

1. Customer, vendor, vendor staff, operations, finance, and admin identities
2. Vendor onboarding
3. Product catalog with vendor and fulfillment-node ownership
4. One customer order containing products from multiple vendors
5. Vendor sub-orders
6. Inventory reservations with concurrency protection
7. One payment flow
8. Double-entry ledger entries for captured payments, fees, commission, vendor payable, tax, and refunds
9. Basic shipment and carrier-event tracking
10. Return eligibility and return requests
11. Manual settlement review and payout recording
12. Read-only customer AI for order and shipment questions

The first release does not attempt to solve international tax, autonomous courier negotiation, dynamic global fulfillment optimization, or fully autonomous operations.

---

## 2. Non-Negotiable Architecture Principles

### 2.1 Modular monolith first

Deploy one application initially. Organize code by domain module, not by technical layer alone.

Each module owns:

- Its database tables
- Its domain rules
- Its application commands and queries
- Its emitted events
- Its permission checks

Modules may communicate through:

- Synchronous application-service calls for request/response work
- Domain events for asynchronous work
- Process managers for workflows crossing multiple domains

Do not introduce microservices until operational scale or team boundaries require them.

### 2.2 Database ownership is explicit

No module may update another module's tables directly. Cross-module writes happen through an application command or an event handler.

Read models may be denormalized for operations screens, but the owning domain remains responsible for the underlying facts.

### 2.3 Money is append-only

Financial corrections are new journal entries or reversals. Existing posted journal entries are never edited or deleted.

### 2.4 Every external mutation is idempotent

Payment callbacks, carrier webhooks, inventory reservations, refunds, return requests, and payout records must accept an idempotency key or an equivalent provider event identity.

### 2.5 Policy and execution are separate

A policy engine determines whether an action is allowed. An application service executes the action. AI may request an action but cannot bypass the policy engine.

### 2.6 Historical facts are snapshotted

Orders must preserve the product title, SKU, price, discount, tax treatment, commission rule, shipping terms, and return policy that applied at purchase time. Later catalog or policy changes must not rewrite history.

---

## 3. Runtime Shape

```text
Customer App       Vendor Portal       Operations Console
       \                 |                    /
                 API / BFF Layer
                         |
                 Application Services
                         |
  ---------------------------------------------------------
  | Identity | Catalog | Orders | Inventory | Fulfillment |
  | Payments | Ledger  | Returns | Settlement | AI Tools |
  ---------------------------------------------------------
                         |
                 PostgreSQL + Outbox
                         |
                 Background Workers
                         |
       Payment / Carrier / Messaging / Tax Adapters
```

The AI layer sits above application services through a constrained tool gateway:

```text
AI agent
  -> approved tool
  -> authorization and policy check
  -> application command or query
  -> domain rules
  -> database or external adapter
```

The AI layer must not use arbitrary SQL, direct ORM access, or unrestricted provider credentials.

---

## 4. Domain Modules

### Identity and Organizations

Owns:

- Users
- Organizations
- Vendor accounts
- Roles
- Permissions
- Staff memberships
- Sessions and authentication metadata

Must enforce tenant isolation on every vendor-scoped query.

### Catalog and Pricing

Owns:

- Products
- SKUs
- Brands
- Categories
- Product variants
- Prices
- Product status
- Catalog publication

Catalog data is editable. Order-line snapshots are not.

### Orders and Checkout

Owns:

- Carts
- Checkout attempts
- Customer orders
- Order lines
- Vendor sub-orders
- Addresses captured at checkout
- Order-level and line-level totals

Orders coordinate the customer transaction but do not directly own inventory, payment, shipment, or ledger implementation.

### Inventory

Owns:

- Inventory items
- Inventory nodes
- On-hand quantity
- Reserved quantity
- Available quantity
- Reservation records
- Reservation expiry and release
- Stock adjustments

Available inventory must be derived from controlled inventory movements and active reservations, not from an unprotected mutable number.

### Fulfillment

Owns:

- Fulfillment orders
- Allocation decisions
- Pick/pack status
- Shipments
- Tracking numbers
- Carrier events
- Delivery status

One vendor sub-order may produce multiple fulfillment orders and shipments.

### Payments

Owns:

- Payment intents
- Provider references
- Authorization state
- Capture state
- Refund requests
- Refund provider responses
- Chargebacks
- Payment webhooks

Payments emit facts. The ledger records the accounting consequence of those facts.

### Ledger and Finance

Owns:

- Chart of accounts
- Ledger accounts
- Journal entries
- Journal postings
- Reconciliation records
- Financial adjustments

The ledger is the financial source of truth. Operational balances are projections derived from posted journal entries.

### Commission and Settlement

Owns:

- Commission rules
- Rule versions
- Rule resolution
- Vendor payable calculations
- Settlement batches
- Settlement eligibility
- Payout records
- Payout reconciliation

Settlement must never rely on recalculating old orders against current commission rules.

### Returns

Owns:

- Return requests
- Return lines
- Eligibility decisions
- Return authorizations
- Pickup and receipt
- Inspection
- Approval or rejection
- Refund request
- Inventory disposition

Return eligibility is evaluated per line where necessary, not only per order.

### AI Tool Gateway

Owns:

- Tool definitions
- Agent identity
- Tool authorization
- Action audit records
- Approval requirements
- Tool rate limits
- Conversation-to-action correlation

It does not own commerce state.

---

## 5. Canonical Ownership Model

The system must not collapse every relationship into “vendor.”

```text
Party
 ├── Legal seller / merchant of record
 ├── Brand owner
 ├── Inventory owner
 ├── Fulfillment operator
 └── Platform vendor account
```

At minimum, each order line must be able to identify:

- Seller of record
- Vendor account
- Brand
- Inventory owner
- Fulfillment node
- Commission rule
- Tax rule
- Return policy

If the initial business model intentionally makes these roles identical, store that as an explicit configuration rather than encoding the assumption into table relationships.

---

## 6. Core Invariants

These are acceptance criteria for the implementation.

### Order invariants

- An order cannot be marked paid solely because a client says payment succeeded.
- An order line cannot change product, SKU, price, tax, commission, or return-policy snapshots after checkout.
- A customer order may contain multiple vendor sub-orders.
- A vendor sub-order may be partially fulfilled.
- A customer order may have multiple shipments and multiple refunds.
- Order totals must equal the sum of line amounts, shipping, discounts, taxes, and fees according to the captured calculation.

### Inventory invariants

- Available quantity cannot become negative.
- A reservation either expires, is released, or is consumed by fulfillment.
- Repeating the same reservation command cannot create duplicate reserved quantity.
- A failed payment releases reservations according to the configured timeout.
- Inventory adjustments require an actor, reason, and audit record.

### Payment invariants

- Every provider event is processed at most once logically, even if delivered repeatedly.
- A refund cannot exceed the refundable captured amount.
- A refund request cannot be marked complete without a provider result or an explicit manual resolution.
- Payment status and ledger status are related but not interchangeable.

### Ledger invariants

- Every posted journal entry is balanced: total debits equal total credits.
- Posted entries cannot be edited or deleted.
- Refunds and reversals create new entries.
- Every posting has a source event or source document.
- Every monetary value includes currency and uses fixed decimal or integer-minor-unit arithmetic.

### Settlement invariants

- A vendor is not settlement-eligible until delivery, return-window, refund, and chargeback checks pass.
- Settled amounts retain the rule version and calculation snapshot used.
- Payout retries cannot create duplicate payable transfers.
- A later refund or chargeback can create a vendor receivable or recovery obligation.

### AI invariants

- AI cannot directly mutate ledger entries.
- AI cannot bypass tenant, role, or resource ownership checks.
- Every AI mutation is attributable to an agent, user, tool, timestamp, and request ID.
- High-risk actions require explicit approval or a configured limit.

---

## 7. State Machines

State machines must be implemented as validated transitions, not free-form status strings.

### Customer order

```text
DRAFT
 -> PAYMENT_PENDING
 -> PAID
 -> PARTIALLY_FULFILLED
 -> FULFILLED
 -> PARTIALLY_RETURNED
 -> COMPLETED
```

Exceptional states:

```text
PAYMENT_FAILED
CANCELLED
PARTIALLY_CANCELLED
ON_HOLD
DISPUTED
```

### Vendor sub-order

```text
CREATED
 -> ACCEPTED
 -> ALLOCATING
 -> READY_TO_FULFILL
 -> PARTIALLY_SHIPPED
 -> SHIPPED
 -> DELIVERED
 -> RETURN_ACTIVITY
 -> CLOSED
```

### Inventory reservation

```text
REQUESTED
 -> RESERVED
 -> CONSUMED

REQUESTED -> REJECTED
RESERVED -> EXPIRED
RESERVED -> RELEASED
```

### Payment

```text
CREATED
 -> REQUIRES_ACTION
 -> AUTHORIZED
 -> CAPTURED
 -> PARTIALLY_REFUNDED
 -> REFUNDED
```

Exceptional states:

```text
FAILED
CANCELLED
CHARGEBACK
```

### Return

```text
REQUESTED
 -> ELIGIBILITY_CHECKED
 -> APPROVED
 -> PICKUP_PENDING
 -> RECEIVED
 -> INSPECTION_PENDING
 -> APPROVED_FOR_REFUND
 -> REFUNDED
 -> CLOSED
```

Exceptional states:

```text
REJECTED
CANCELLED
DISPUTED
```

---

## 8. Financial Model

The initial chart of accounts should include at least:

- Customer payment clearing
- Platform cash or settlement clearing
- Vendor payable
- Platform commission revenue
- Shipping revenue
- Shipping expense
- Payment fee expense
- Tax payable
- Refund reserve
- Customer refund payable
- Chargeback receivable
- Vendor recovery receivable

Example for a PKR 10,000 sale with PKR 1,500 commission:

```text
Capture:
  Debit  customer-payment-clearing     PKR 10,000
  Credit vendor-payable                PKR 8,500
  Credit platform-commission-revenue   PKR 1,500
```

Payment-provider fees, taxes, shipping, discounts, and reserves must be represented explicitly rather than hidden inside a single net amount.

Every order line should store:

- Gross amount
- Discount amount
- Net product amount
- Shipping allocation
- Tax amount
- Payment-fee allocation if applicable
- Commission amount
- Vendor payable amount
- Refundable amount
- Currency
- Calculation version

Rounding rules must be defined before implementation. The system should calculate in minor units where possible and document allocation of residual rounding units.

---

## 9. Commission Rules

Commission resolution must support:

- Vendor percentage
- Category percentage
- SKU-specific percentage
- Campaign override
- Creator attribution
- Fixed fees
- Effective start and end dates
- Minimum or maximum commission
- Refund reversal
- Tax treatment

The engine must define a deterministic precedence order. For example:

```text
SKU override
 -> active campaign rule
 -> category rule
 -> vendor default
 -> platform default
```

The resolved rule and resulting calculation are snapshotted on the order line at checkout or payment capture, according to the commercial decision.

---

## 10. Integration Reliability

Every external adapter must implement:

- Provider request ID
- Internal idempotency key
- Request and response audit metadata
- Timeout
- Retry policy
- Dead-letter or manual-review state
- Reconciliation path

External webhooks must be received into an inbox table before business processing:

```text
receive webhook
 -> authenticate and persist raw event metadata
 -> deduplicate by provider event ID
 -> acknowledge safely
 -> process asynchronously
 -> record processing result
```

The application must tolerate:

- Duplicate events
- Out-of-order events
- Delayed events
- Provider timeouts
- Partial provider failures
- Local transaction succeeding while the response is lost

---

## 11. Permissions and Data Isolation

Start with RBAC plus resource scoping.

| Role | Scope | Typical access |
|---|---|---|
| Customer | Own account | Own orders, shipments, returns |
| Vendor staff | Assigned vendor | Vendor catalog, inventory, sub-orders |
| Operations | Platform | Orders, fulfillment, exceptions |
| Finance | Platform | Ledger, commissions, settlements |
| Admin | Platform | Configuration and access control |
| Customer agent | Customer-owned data | Read status, request permitted actions |
| Vendor agent | Vendor-owned data | Vendor operational queries and tasks |
| Operations agent | Platform operations | Exceptions within configured limits |

Every query and command must derive scope from the authenticated principal. A vendor ID supplied by the client is not sufficient authorization.

Sensitive actions should require:

- Strong authentication
- Role permission
- Resource scope
- Idempotency key
- Audit record
- Optional approval

---

## 12. AI Tool Contract

The first customer agent should only expose:

```text
get_order_status(order_id)
get_shipment_status(order_id)
get_delivery_estimate(order_id)
check_return_eligibility(order_line_id)
create_return_request(order_line_id, reason)
```

Each tool must return structured results with:

- Result status
- Source records used
- Human-readable explanation
- Next permitted action
- Correlation ID

The tool gateway must reject:

- Cross-customer data access
- Cross-vendor data access
- Direct monetary adjustments
- Direct status changes
- Unsupported policy exceptions
- Missing idempotency keys on writes

Later operations-agent tools may include exception creation, carrier lookup, vendor notification, and customer notification. Autonomous use should be introduced only after these tools are safe when manually invoked.

---

## 13. Observability and Operations

The control tower must expose:

- Orders awaiting payment
- Reservations nearing expiry
- Payment-provider failures
- Stuck fulfillment
- Shipments with no movement
- Returns awaiting inspection
- Refunds awaiting provider completion
- Settlement batches awaiting review
- Reconciliation mismatches
- Dead-letter events

Every workflow should be traceable through:

- Correlation ID
- Order ID
- Vendor sub-order ID
- Payment ID
- Ledger journal ID
- Shipment ID
- Return ID
- Actor or agent ID

Add structured logs, metrics, and alert thresholds before enabling agentic automation.

---

## 14. Implementation Phases

### Phase 0 — Decisions and foundations

- Confirm merchant-of-record model
- Confirm fund custody and payout model
- Confirm tax and return-liability model
- Confirm payment provider capability
- Confirm initial country, currency, and delivery scope
- Establish module structure
- Establish migration and audit conventions

### Phase 1 — Deterministic commerce slice

- Identity and vendor isolation
- Catalog and product snapshots
- Cart and checkout
- Multi-vendor order split
- Inventory reservation
- Payment adapter
- Ledger postings
- Basic shipment records
- Operations views

### Phase 2 — Returns and settlement

- Return policy evaluation
- Return request lifecycle
- Partial refund
- Refund ledger adjustments
- Delivery and return-window checks
- Commission resolution
- Settlement eligibility
- Manual payout and reconciliation

### Phase 3 — Constrained AI

- Customer order-status agent
- Customer return-request agent
- Vendor operational assistant
- Operations exception assistant
- Tool audit and approval flows

### Phase 4 — Selective automation

- Stalled-shipment detection
- Carrier and vendor follow-up
- SLA escalation
- Configured compensation or escalation rules
- Human review for high-risk actions

---

## 15. Minimum Acceptance Scenarios

The build is not ready for production-oriented hardening until these scenarios pass:

1. A cart containing products from two vendors creates one customer order and two vendor sub-orders.
2. Two simultaneous checkouts cannot reserve the same final unit.
3. A repeated payment webhook does not duplicate capture or ledger postings.
4. A payment timeout releases its reservation exactly once.
5. A shipment can contain only the lines allocated to it.
6. One line can be cancelled or returned without corrupting the rest of the order.
7. A partial refund creates balanced ledger adjustments.
8. A commission-rule change does not alter historical orders.
9. A vendor cannot query another vendor's products, inventory, orders, or payouts.
10. A settlement cannot proceed while the configured return window is open.
11. A chargeback after settlement creates the configured recovery obligation.
12. An AI agent cannot issue an unauthorized refund or access another customer's order.
13. A provider timeout can be reconciled without creating a duplicate payment or payout.
14. Every financial adjustment can be traced to an actor, source event, and reason.

---

## 16. Decisions Required Before Production

These must be answered by the business before the corresponding workflows are finalized:

- Who is the legal seller for each transaction?
- Who is merchant of record?
- Who holds customer funds while the order is pending?
- Which provider supports the required marketplace payment and payout model?
- Who bears tax liability?
- Who bears failed-delivery and return liability?
- When does inventory ownership transfer?
- When does vendor liability begin and end?
- How are commissions reversed after partial refunds?
- How are chargebacks recovered after payout?
- Which customer data may vendors access?
- Which actions require human approval?

Until these decisions are made, the implementation should use explicit configuration and clearly marked unresolved policy branches, not hidden assumptions.

---

## Final Build Rule

Implement a deterministic, auditable commerce core first. Expose it through customer, vendor, operations, finance, and AI interfaces only after ownership, money, inventory, state transitions, and failure recovery are explicit.

The AI layer should make the operating system easier to use. It must never be the operating system's source of truth.