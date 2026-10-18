import json

# Maps existing CTO Framework lessons to the competencies they can produce
# evidence for. Every id here is verified to exist in content/lessons/*.json and
# data/capability-competencies.json by tests/capability-evidence.test.ts.
# Nothing is invented: if a competency has no lesson that genuinely produces
# evidence for it, it is left unmapped and therefore honestly "unassessed".
M = {
  # --- Delivery, metrics and reliability ---
  "dora-metrics":        ["cto-delivery", "reliability", "sa-scalability", "cicd"],
  "sla-slo-sli":         ["reliability", "sa-scalability", "cto-delivery"],
  "rto-rpo":             ["sa-dr", "reliability", "cto-incidents"],
  "error-budgets-chaos": ["reliability", "sa-scalability"],
  "rca-post-mortems":    ["cto-incidents", "reliability"],
  "pre-mortems-pareto":  ["arch-tradeoffs", "cto-incidents"],

  # --- Architecture reasoning and documentation ---
  "adr-c4":              ["arch-docs", "sa-c4", "sa-adr"],
  "architecture-tradeoffs": ["arch-tradeoffs", "sa-options", "tech-comm"],
  "technical-debt":      ["tech-debt", "cto-governance"],
  "well-architected-framework": ["sa-governance", "cto-governance", "arch-tradeoffs"],

  # --- Cloud, infrastructure, delivery ---
  "iac-golden-path":     ["cicd", "cloud-security", "cto-teams"],
  "cloud-providers-lockin": ["sa-azure", "sa-aws", "sa-oci", "cto-buildbuy"],

  # --- Security ---
  "threat-modelling-shift-left": ["cloud-security", "cto-security"],
  "least-privilege-access-control": ["sa-identity", "cloud-security", "cto-security"],
  "sbom-supply-chain":   ["cloud-security", "cicd"],

  # --- Data and APIs ---
  "sql-vs-nosql":        ["data-arch", "sa-integration"],
  "medallion-file-formats": ["data-arch"],
  "rest-apis":           ["apis-networking", "sa-integration"],

  # --- Economics, portfolio, investment ---
  "tco-cloud-costs":     ["cto-finops", "sa-cost"],
  "build-buy-outsourcing": ["cto-buildbuy", "cto-portfolio"],
  "tech-budgets":        ["cto-finops", "cto-portfolio"],
  "roi-business-cases":  ["cto-portfolio", "cto-finops"],
  "investment-rounds-stages": ["cto-portfolio"],
  "tech-due-diligence":  ["cto-governance"],

  # --- Product and commercial ---
  "business-models-lean-canvas": ["cto-product"],
  "moats-five-forces":   ["cto-product"],
  "saas-metrics-unit-economics": ["cto-finops", "cto-product"],
  "experimentation-mvp": ["cto-product"],

  # --- Leadership, communication, organisation ---
  "storytelling-star-method": ["tech-comm", "cto-exec"],
  "assertive-c-suite-communication": ["cto-exec", "tech-comm"],
  "first-90-days-cto":   ["cto-strategy", "cto-teams"],
  "leadership-styles-situational": ["cto-teams"],
  "disagree-commit-decisions": ["arch-tradeoffs", "cto-exec"],
  "feedback-systems-one-on-ones-360": ["cto-talent"],
  "team-topologies-conway": ["cto-teams", "cto-enterprise"],
  "org-scale-matrix":    ["cto-teams"],
  "devex-blameless-culture": ["cto-teams", "cto-incidents"],
  "interviews-succession": ["cto-talent"],
  "talent-nine-box-ladders": ["cto-talent"],

  # --- Requirements and reporting ---
  "four-square-rag":     ["cto-exec"],
  "raid-roam":           ["cto-governance"],
  "three-lines-swiss-cheese": ["cto-governance", "cloud-security"],
  "scrum-monte-carlo":   ["cto-delivery"],
  "wsjf-moscow":         ["cto-portfolio"],
  "raci-brooks-law":     ["cto-teams", "cto-governance"],
  "nfr-availability":    ["sa-nfr", "sa-requirements"],
  "pii-data-protection": ["data-arch", "cloud-security"],
  "iso-continuity-ai-management": ["cto-governance", "ai-governance"],

  # --- Software engineering fundamentals ---
  "solid-design-patterns": ["sw-fundamentals"],
  "big-o-complexity":     ["sw-fundamentals"],
  "test-pyramid-boy-scout": ["sw-fundamentals", "cicd"],

  # --- AI (AI Solutions Architect track) ---
  "ai-sdlc-agents-md":   ["ai-agents", "ai-fundamentals"],
  "ai-model-selection":  ["ai-fundamentals", "ai-rag", "ai-evaluation"],
  "ai-risk-regulation-collapse": ["ai-governance", "ai-responsible", "ai-injection"],
}

# Cloud design lessons live in the Architecture Studio, not the lesson folder.
# They are recorded here separately so the provenance is explicit rather than
# implied by a lesson id that does not exist.
STUDIO_SOURCES = {
  "sa-azure": "Architecture Studio: cloud design exercise (architecture project artifacts)",
  "sa-aws":   "Architecture Studio: cloud design exercise (architecture project artifacts)",
  "sa-oci":   "Architecture Studio: cloud design exercise (architecture project artifacts)",
}

json.dump({"lessonToCompetencies": M, "studioSources": STUDIO_SOURCES},
          open(r"C:\Users\admin\Documents\Clients\cto\academy\data\lesson-competency-map.json","w",encoding="utf-8"),
          indent=2)

