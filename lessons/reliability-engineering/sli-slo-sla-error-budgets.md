# SLI, SLO, SLA and Error Budgets

> **Purpose:** Learn to define, measure and govern service reliability using evidence—not assumptions.
>
> **Case study:** Cretek Managed Website Hosting. All example targets are proposed learning values, not measured production performance or approved customer commitments.

## Learning objectives

By the end of this lesson, you should be able to:

- Distinguish an SLI, SLO, SLA and error budget.
- Select indicators that represent the customer experience.
- Define a measurement window, eligibility rules and target.
- Calculate allowed unreliability and explain the result.
- Connect reliability signals to release decisions, incident response and business risk.
- Defend the design and its trade-offs in a senior Solutions Architect or CTO interview.

## 1. The four concepts

### Service Level Indicator (SLI)

An **SLI is a quantitative measure of a service aspect**. It describes what happened, based on defined observations.

Examples:
- **Availability:** successful eligible HTTPS requests divided by all eligible HTTPS requests.
- **Latency:** percentage of eligible requests completed within a stated threshold.
- **Correctness:** percentage of requests returning valid, expected results.
- **Durability:** percentage of acknowledged writes retained, where applicable.

An SLI needs a clear numerator, denominator, measurement source, eligibility rule and time window. “The site seems fast” is not an SLI.

### Service Level Objective (SLO)

An **SLO is the target for an SLI over a defined window**.

Example: “At least 99.5% of eligible external HTTPS checks succeed over each rolling 30-day window.”

An SLO is an internal reliability objective used to guide engineering and operational decisions. It should reflect customer expectations, business impact, architecture, cost and the team's ability to measure and improve the service.

### Service Level Agreement (SLA)

An **SLA is an external commitment**, often contractual, defining the service level and the consequences if the commitment is missed.

An SLA may define:
- The covered service and customers.
- Measurement method and reporting period.
- Exclusions and maintenance treatment.
- Remedies, service credits or other consequences.
- Notification, evidence and claim procedures.

An SLA is not just a percentage on a dashboard. Legal, commercial and operational owners should approve the commitment. Never promise a target simply because a monitoring tool can display it.

### Error budget

An **error budget is the unreliability permitted by an SLO** over the same measurement window.

For a success-rate SLO:

**Error budget = 1 − SLO target**

For a 99.5% success-rate target, the error budget is 0.5%. It is a decision-making mechanism, not permission to deliberately cause failures.

The budget can be expressed as a percentage, failed requests, failed checks, or time—provided the unit matches the SLI and measurement method.

## 2. How they fit together

1. Choose a customer-relevant SLI.
2. Set a realistic SLO and measurement window.
3. Define the corresponding error budget.
4. Instrument and validate the measurement.
5. Review reliability and budget burn over time.
6. Use an agreed policy to decide whether to continue releases, add safeguards or prioritize reliability work.
7. Set an external SLA only when evidence, operations and commercial terms support it.

**Memory aid:** SLI = measure; SLO = target; SLA = external promise; error budget = permitted unreliability under the SLO.

## 3. Why a ping test is insufficient

A ping checks whether a host responds to ICMP. It does not prove that:
- DNS resolves correctly for customers.
- TLS certificates are valid.
- The website responds over HTTPS.
- The application returns the expected page or content.
- A key user journey works.
- The service is fast enough.

A five-minute test describes a short observation period; it does not validate a monthly reliability commitment. A better approach combines external HTTPS synthetic checks, application or transaction checks where appropriate, and service-side telemetry. Each signal has limits and should be interpreted in context.

## 4. Worked example: Cretek Managed Website Hosting

The following targets are **illustrative proposals for the exercise only**. They are not claims about current Cretek performance.

| Indicator | Proposed SLO | Window | Error budget |
|---|---:|---|---:|
| External HTTPS availability | 99.5% successful eligible checks | Rolling 30 days | 0.5% |
| HTTP latency | 95% of eligible checks complete within 1 second | Rolling 30 days | 5% outside threshold |
| Synthetic transaction success | 99% successful eligible runs | Rolling 30 days | 1% failures |

Use only indicators that are relevant to the service and can be measured reliably. A synthetic transaction is appropriate only if there is a safe, repeatable journey to test. Avoid creating test orders, emails or payments that affect real customers.

### Availability calculation

For a 30-day window sampled once per minute:

- Minutes in 30 days: 30 × 24 × 60 = 43,200.
- Proposed availability target: 99.5%.
- Error budget: 100% − 99.5% = 0.5%.
- Equivalent failed one-minute checks: 43,200 × 0.005 = 216.

Under these assumptions, the budget is **216 failed one-minute checks** in that window.

This is a simplified example. It assumes exactly one eligible check per minute, equal weighting, no missing observations and a fixed 30-day window. A production calculation must implement the actual monitoring and eligibility rules. Failed checks are not automatically equivalent to customer-visible downtime, and this calculation should not be presented as a contractual downtime allowance unless the SLA defines it that way.

### Why a 90% SLO and 99.99% SLA are a poor pairing

In a 30-day month:
- 99.99% corresponds to approximately 4.32 minutes of unavailability.
- 99.9% corresponds to approximately 43.2 minutes.
- 99.5% corresponds to approximately 3 hours 36 minutes.
- 99% corresponds to approximately 7 hours 12 minutes.
- 90% corresponds to 72 hours.

These are simple time-equivalent calculations, not a statement that every service measures availability by minutes. A 99.99% external promise paired with a 90% internal objective creates serious risk: the organisation could meet its own objective while breaching its customer commitment. The internal objective should provide an appropriate safety margin relative to the external commitment, informed by the measurement model and operational evidence.

## 5. Monitoring design

For each SLI, document:

- **Customer outcome:** What experience or business capability does this represent?
- **Numerator and denominator:** Exactly what counts as success and total eligible observations?
- **Source:** External synthetic monitor, application telemetry, load balancer, or another justified source.
- **Eligibility:** Which requests or checks are included and excluded, and why?
- **Window:** For example, rolling 30 days.
- **Missing data:** Treat missing observations as unknown until investigated; do not silently count them as successful.
- **Aggregation:** Explain how retries, multiple locations and repeated observations are handled.
- **Owner and alert:** Who responds, and what signal triggers investigation?
- **Evidence:** Where are measurements and calculations retained?

An external HTTPS check might verify DNS/TLS connectivity, expected HTTP status and a stable content marker. A separate latency indicator can measure response duration. A synthetic journey can validate an important customer action. Avoid making one health check stand in for every aspect of reliability.

## 6. Error-budget policy

Define the response before the budget is depleted. Example policy to adapt after measuring the service:

- **Budget healthy:** Continue normal releases with standard testing and monitoring.
- **Budget burning quickly:** Investigate the cause, review recent changes and increase safeguards for risky releases.
- **Budget exhausted:** Consider pausing non-essential high-risk changes, prioritizing reliability work, and requiring explicit approval for exceptions.
- **After an incident:** Record customer impact, root causes or contributing factors, corrective actions and whether the SLI/SLO definitions need improvement.

Use burn rate—the speed at which the error budget is being consumed—alongside absolute failures. A short burst of failures can be more urgent than the same number spread across a month. Avoid rigid rules without context: security fixes, emergency remediation and business-critical changes may need an exception process.

## 7. Common mistakes

- Calling a ping result “website availability.”
- Choosing 99.99% because it sounds impressive without checking feasibility and cost.
- Setting an SLO lower than an external SLA without understanding the exposure.
- Confusing the error budget with the cloud spending budget.
- Counting missing monitoring data as success.
- Using an SLI with no denominator, time window or eligibility definition.
- Claiming a target is achieved before real measurements support it.
- Treating all errors equally when customer impact differs.
- Alerting on every individual failure rather than meaningful symptoms and budget burn.
- Using synthetic checks without protecting production data and side effects.

## 8. Practical lab

### Scenario

Design a reliability approach for Cretek Managed Website Hosting. Do not assume historical reliability data exists.

1. Define one availability SLI with numerator, denominator, source, eligibility rules and window.
2. Propose an SLO and explain why it is appropriate for the service.
3. Calculate the error budget for a 30-day window.
4. Define a latency SLI and a threshold suitable for discussion. Explain why the threshold needs measurement and customer context.
5. Describe what you would alert on and who owns the response.
6. Write an error-budget policy for healthy, rapidly burning and exhausted states.
7. Explain what evidence you need before offering a contractual SLA.
8. Identify two ways the design could mislead you, and how you would mitigate them.

### Evidence to save

- A short SLI/SLO specification.
- A calculation sheet or tested script.
- A monitoring/dashboard design or screenshot from a test environment.
- An error-budget policy.
- A brief architecture decision record documenting trade-offs and open questions.
- Assessment answers and a short spoken interview defence.

Clearly label simulated data as simulated. Do not describe it as production evidence.

## 9. Assessment

Answer these without looking at the definitions first.

1. In your own words, what is the difference between an SLI, SLO and SLA?
2. A service has a 99.5% success-rate SLO. What is its error budget, and what does that mean?
3. Why does a successful ping not prove that a website is available to a customer?
4. Why can a 99.99% SLA combined with a 90% SLO be dangerous?
5. What should happen when the error budget is exhausted?
6. Why must missing monitoring data not silently count as success?
7. What additional evidence is needed before turning a proposed SLO into a customer SLA?

**Suggested pass standard:** Explain the concepts accurately, show the calculation, state assumptions, identify at least two measurement limitations, and defend a practical response to budget burn. Revisit gaps before claiming mastery.

## 10. Senior interview defence

Use this reasoning sequence:

**Business outcome → indicator → target → monitoring → decision → governance.**

Example answer:

“I would start by identifying the customer-facing service outcome and defining an SLI that measures it directly. For website hosting, I would not rely on ping alone; I would use external HTTPS checks and, where appropriate, safe synthetic transactions, with clearly defined eligibility rules and a rolling measurement window. I would set an evidence-based SLO, calculate the associated error budget, and agree in advance how budget burn affects releases and remediation. I would only commit to an external SLA after validating our operational performance, measurement method, exclusions and commercial exposure. I would also track cost and customer impact so reliability decisions are made with explicit trade-offs.”

Do not memorize this as a script. Practise explaining why you chose each measure, what could make it inaccurate, and what you would change if the service's business criticality increased.

## 11. Sources and further reading

- Google SRE Book, **Service Level Objectives**: https://sre.google/sre-book/service-level-objectives/
- Google SRE Workbook, **Implementing SLOs**: https://sre.google/workbook/implementing-slos/
- Google SRE Workbook, **Error Budget Policy**: https://sre.google/workbook/error-budget-policy/
- Microsoft Azure Well-Architected Framework, **Reliability**: https://learn.microsoft.com/azure/well-architected/reliability/

Use these sources to deepen your understanding and verify the details. This lesson is a learning artifact, not a substitute for service-specific measurement, legal review or a production reliability design.
