import type { ArchitectureProject } from "./model";

export const WIZARD_STEPS = [
  { id: "project", label: "Project" },
  { id: "context", label: "System context" },
  { id: "containers", label: "Containers" },
  { id: "components", label: "Components" },
  { id: "deployment", label: "Deployment" },
  { id: "scenarios", label: "Scenarios" },
  { id: "decisions", label: "Decisions" },
  { id: "quality", label: "Requirements and risks" },
  { id: "review", label: "Review and generate" },
] as const;

export type WizardStepId = (typeof WIZARD_STEPS)[number]["id"];

/**
 * Original sample content, written for this project. It is deliberately not a
 * copy of the Internet Banking System example on c4model.com.
 */
export function sampleProject(): ArchitectureProject {
  const now = new Date().toISOString();
  return {
    schemaVersion: 2,
    id: "",
    name: "Sample: parts ordering service",
    purpose: "Take an order from a workshop, reserve stock, and tell the customer when it will arrive.",
    businessContext: "Small workshop network replacing phone and spreadsheet ordering.",
    stakeholders: ["Workshop owner", "Parts customer", "Warehouse team"],
    scope: "Ordering, stock reservation and dispatch notification. Payment and supplier purchasing are out of scope.",
    assumptions: ["Assumed single currency per order", "Assumed under 50 orders per minute at peak (estimate, not measured)"],
    constraints: ["Must run on a free tier", "No paid AI services required"],
    elements: [
      { id: "sys_orders", kind: "software-system", name: "Parts ordering", description: "Takes orders and manages reservations" },
      { id: "person_owner", kind: "person", name: "Workshop owner", description: "Raises and tracks orders" },
      { id: "person_cust", kind: "person", name: "Parts customer", description: "Places and checks an order" },
      { id: "sys_erp", kind: "external-system", name: "Stock system", description: "Existing system that owns stock levels" },
      { id: "con_web", kind: "container", name: "Web app", description: "Order entry and tracking screens", technology: "Next.js", parentId: "node_dev" },
      { id: "con_api", kind: "container", name: "Order API", description: "Order validation and reservation", technology: "Node.js", parentId: "node_prod" },
      { id: "con_worker", kind: "container", name: "Dispatch worker", description: "Sends notification when stock is allocated", technology: "Node.js", parentId: "node_prod" },
      { id: "con_db", kind: "data-store", name: "Order database", description: "Orders, lines and reservation state", technology: "PostgreSQL", parentId: "node_prod" },
      { id: "con_queue", kind: "container", name: "Event queue", description: "Decouples dispatch from order creation", technology: "SQS", parentId: "node_prod" },
      { id: "cmp_validate", kind: "component", name: "Order validator", description: "Checks lines and quantities", technology: "Node.js", parentId: "con_api" },
      { id: "cmp_reserve", kind: "component", name: "Reservation service", description: "Reserves stock and records the decision", technology: "Node.js", parentId: "con_api" },
      { id: "code_adapter", kind: "code", name: "StockSystemAdapter", description: "Adapter around the stock system client", technology: "src/orders/stockAdapter.ts", parentId: "cmp_reserve", attributes: ["+ client: StockClient", "- retries: number"], methods: ["+ reserve(lines: Line[]): Promise<Reservation>", "+ availability(sku: string): Promise<number>"] },
      { id: "code_reservation", kind: "code", name: "Reservation", description: "A held allocation of stock for one order line", technology: "src/orders/reservation.ts", parentId: "cmp_reserve", attributes: ["+ id: string", "+ sku: string", "+ quantity: number", "+ expiresAt: Date"], methods: ["+ isExpired(now: Date): boolean"] },
      { id: "node_prod", kind: "deployment-node", name: "Production", description: "Live environment" },
      { id: "node_dev", kind: "deployment-node", name: "Staging", description: "Pre-production environment for release checks" },
    ],
    relationships: [
      { id: "r1", sourceId: "person_owner", targetId: "sys_orders", label: "places orders", technology: "HTTPS" },
      { id: "r2", sourceId: "person_cust", targetId: "sys_orders", label: "tracks orders", technology: "HTTPS" },
      { id: "r3", sourceId: "sys_orders", targetId: "sys_erp", label: "checks and updates stock", technology: "HTTPS/JSON" },
      { id: "r4", sourceId: "con_web", targetId: "con_api", label: "calls", technology: "HTTPS/JSON" },
      { id: "r5", sourceId: "con_api", targetId: "con_db", label: "reads and writes", technology: "SQL" },
      { id: "r6", sourceId: "con_api", targetId: "con_queue", label: "publishes order events to", technology: "HTTPS" },
      { id: "r7", sourceId: "con_worker", targetId: "con_queue", label: "consumes events from", technology: "HTTPS" },
      { id: "r8", sourceId: "cmp_validate", targetId: "cmp_reserve", label: "calls", technology: "in-process" },
      { id: "r9", sourceId: "code_adapter", targetId: "code_reservation", label: "creates", multiplicity: "1..*" },
    ],
    requirements: [
      { id: "req_avail", title: "Orders accepted during stock outages", category: "availability", description: "The service keeps accepting orders when the stock system is unavailable.", linkedElementIds: ["con_queue"], adrIds: [] },
      { id: "req_trace", title: "Every order transition is auditable", category: "operability", description: "State changes are recorded with actor and time.", linkedElementIds: ["con_db"], adrIds: [] },
    ],
    risks: [
      { id: "risk_dup", title: "Duplicate dispatch notifications", category: "reliability", severity: "medium", likelihood: "low", mitigation: "Idempotency key on every order event and a dedupe check in the worker.", owner: "Platform" },
    ],
    adrs: [
      {
        id: "adr_0001",
        number: 1,
        title: "Use a queue between the order API and dispatch",
        status: "accepted",
        date: "2026-01-15",
        author: "Sample",
        context: "Dispatch used to run inside the request and made the order endpoint slow and fragile.",
        problemStatement: "Notification failures were slowing and failing customer orders.",
        decisionDrivers: ["Order endpoint latency", "Isolation of failures", "Operational simplicity"],
        options: [
          { id: "opt_a", title: "Call dispatch inline", pros: "No new component", cons: "Slow endpoint, failures cascade" },
          { id: "opt_b", title: "Publish to a queue", pros: "Isolates failures, keeps the endpoint fast", cons: "Adds a component and eventual consistency" },
        ],
        chosenOptionId: "opt_b",
        rationale: "Isolation of failure matters more than perfect ordering, and the queue is cheap on a free tier.",
        positiveConsequences: ["Order endpoint stays fast", "Dispatch retries do not affect orders"],
        negativeConsequences: ["Notifications can arrive late", "Two places to monitor"],
        risksAndMitigations: ["Duplicate events are handled with an idempotency key"],
        securityAndCompliance: "No personal data in queue messages beyond an order reference.",
        costAndOperations: "Queue costs negligible at this volume (estimate, not measured).",
        linkedElementIds: ["con_api", "con_queue", "con_worker"],
        linkedRequirementIds: ["req_avail"],
      },
    ],
    componentDiagramContainerIds: ["con_api"],
    codeDiagramComponentIds: ["cmp_reserve"],
    includeLandscape: true,
    includeDeployment: true,
    dynamicScenarioIds: ["scn_order"],
    scenarios: [
      {
        id: "scn_order",
        name: "Place an order when the stock system is down",
        description: "Shows the degraded path that requirement 'Orders accepted during stock outages' relies on.",
        steps: [
          { id: "s1", actorIds: ["person_owner", "con_web"], message: "submit order" },
          { id: "s2", actorIds: ["con_web", "con_api"], message: "POST /orders", note: "HTTPS/JSON" },
          { id: "s3", actorIds: ["con_api", "cmp_validate"], message: "validate lines", note: "in-process" },
          { id: "s4", actorIds: ["cmp_reserve", "sys_erp"], message: "reserve stock", note: "times out" },
          { id: "s5", actorIds: ["con_api", "con_queue"], message: "publish OrderAccepted" },
          { id: "s6", actorIds: ["con_worker", "con_queue"], message: "consume event", note: "retry later" },
        ],
      },
    ],
    securityNotes: "Customer accounts will use the existing identity provider. Not yet verified.",
    operationalNotes: "Restore target: four hours. Not yet tested.",
    costNotes: "All components are expected to fit a free tier; confirm with current pricing.",
    openQuestions: ["Do we need partial dispatch when only some lines are in stock?"],
    createdAt: now,
    updatedAt: now,
  };
}
