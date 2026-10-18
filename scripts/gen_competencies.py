import json

def comp(id, title, tracks, foundation=False, definition="", objectives=None, evidence=None, rubric=None, prereqs=None, importance=3):
    return {
        "id": id,
        "title": title,
        "tracks": tracks,
        "foundation": foundation,
        "definition": definition,
        "objectives": objectives or [],
        "evidenceRequirements": evidence or [],
        "rubric": rubric or [
            "Recognises the concept and terminology.",
            "Explains principles and completes guided exercises.",
            "Independently produces a sound, usable solution.",
            "Handles ambiguity, complex constraints, failure scenarios and trade-offs.",
            "Establishes standards, reviews others and defends decisions under rigorous challenge.",
        ],
        "prerequisites": prereqs or [],
        "importance": importance,
    }

shared = [
 comp("req-discovery","Requirements discovery and stakeholder management",["SA","AISA","CTO"],True,"Elicit, analyse and manage requirements and stakeholder expectations.",["Identify stakeholders","Capture functional and non-functional requirements","Validate assumptions"], ["Requirements document","Stakeholder map","Interview notes"], importance=4),
 comp("systems-thinking","Systems thinking and problem decomposition",["SA","AISA","CTO"],True,"Decompose complex problems into manageable components and relationships.",["Model system boundaries","Identify dependencies","Analyse feedback loops"], ["System context diagram","Decomposition notes"], importance=4),
 comp("sw-fundamentals","Software engineering fundamentals and design principles",["SA","AISA","CTO"],True,"Apply core design principles to produce maintainable software.",["Explain SOLID","Identify code smells","Refactor safely"], ["Code review notes","Refactored example"], importance=3),
 comp("arch-docs","Architecture documentation, C4 diagrams and ADRs",["SA","AISA","CTO"],True,"Document architecture decisions and views clearly.",["Produce C4 views","Write ADRs","Explain trade-offs"], ["C4 diagrams","ADR set"], importance=4),
 comp("apis-networking","APIs, networking, distributed systems and integration patterns",["SA","AISA","CTO"],True,"Design and reason about distributed systems and integrations.",["Explain consistency models","Design APIs","Identify failure modes"], ["Integration diagram","API contract"], importance=4),
 comp("cloud-security","Cloud platforms, identity, security and infrastructure as code",["SA","AISA","CTO"],True,"Design secure cloud infrastructure using automation.",["Configure identity","Apply IaC","Secure networks"], ["IaC template","Security review"], importance=5),
 comp("data-arch","Data architecture, databases and governance",["SA","AISA","CTO"],True,"Design data stores and govern data quality and lifecycle.",["Model data","Choose stores","Govern data"], ["Data model","Governance notes"], importance=4),
 comp("reliability","Reliability engineering, observability, DR and incident response",["SA","AISA","CTO"],True,"Build and operate reliable systems.",["Define SLOs","Design DR","Run incident reviews"], ["Runbook","SLO document"], importance=5),
 comp("cicd","CI/CD, testing, deployment and operational readiness",["SA","AISA","CTO"],True,"Deliver software safely and repeatably.",["Build pipelines","Test strategies","Deployment plans"], ["Pipeline config","Test report"], importance=4),
 comp("tech-debt","Technical debt, maintainability and modernisation",["SA","AISA","CTO"],True,"Manage and reduce technical debt.",["Classify debt","Fund repayment","Modernise safely"], ["Debt register","Modernisation plan"], importance=3),
 comp("arch-tradeoffs","Architecture trade-offs, risk and decision-making",["SA","AISA","CTO"],True,"Make and defend architecture decisions under uncertainty.",["Compare options","Quantify risk","Decide"], ["Decision matrix","ADR"], importance=5),
 comp("tech-comm","Technical communication and written design rationale",["SA","AISA","CTO"],True,"Communicate technical decisions to varied audiences.",["Write clearly","Present trade-offs","Defend decisions"], ["Design doc","Presentation"], importance=4),
]

sa = [
 comp("sa-requirements","Business requirements, constraints and quality attributes",["SA"],False,"Translate business needs into quality attributes.",["Identify constraints","Define quality attributes","Prioritise"], ["Requirements doc"], importance=4),
 comp("sa-nfr","Functional and non-functional requirements",["SA"],False,"Specify functional and non-functional requirements.",["Define NFRs","Measure nines","Validate"], ["NFR catalogue"], importance=4),
 comp("sa-options","Architecture options and trade-off analysis",["SA"],False,"Generate and compare architecture options.",["Brainstorm options","Score trade-offs","Recommend"], ["Options paper"], importance=5),
 comp("sa-c4","Context, container, component, code and deployment diagrams",["SA"],False,"Produce complete C4 views.",["Draw all levels","Keep current","Review"], ["C4 set"], importance=4),
 comp("sa-adr","ADR quality and architecture review",["SA"],False,"Write and review high-quality ADRs.",["Complete ADR sections","Review peers","Track decisions"], ["ADR"], importance=4),
 comp("sa-azure","Azure solution design",["SA"],False,"Design solutions on Azure.",["Choose services","Design identity/network","Estimate cost"], ["Azure design"], importance=4),
 comp("sa-aws","AWS solution design",["SA"],False,"Design solutions on AWS.",["Choose services","Design security","Estimate cost"], ["AWS design"], importance=4),
 comp("sa-oci","OCI solution design",["SA"],False,"Design solutions on OCI.",["Choose services","Design network","Estimate cost"], ["OCI design"], importance=3),
 comp("sa-identity","Identity, networking, connectivity and security boundaries",["SA"],False,"Design identity and network boundaries.",["Define trust zones","Configure identity","Secure connectivity"], ["Network diagram"], importance=5),
 comp("sa-integration","Integration, messaging, APIs and data flows",["SA"],False,"Design integration and messaging.",["Choose patterns","Design APIs","Handle failures"], ["Integration design"], importance=4),
 comp("sa-scalability","Availability, scalability, performance and resilience",["SA"],False,"Design for availability and scale.",["Define targets","Design HA","Test resilience"], ["Resilience plan"], importance=5),
 comp("sa-dr","Backup, disaster recovery, RTO and RPO",["SA"],False,"Design backup and recovery.",["Define RTO/RPO","Design backup","Test restore"], ["DR plan"], importance=5),
 comp("sa-migration","Migration planning and legacy modernisation",["SA"],False,"Plan migrations and modernisation.",["Assess legacy","Wave plan","Rollback"], ["Migration plan"], importance=4),
 comp("sa-governance","Governance, compliance and operational readiness",["SA"],False,"Ensure governance and compliance.",["Define controls","Audit readiness","Operate"], ["Governance plan"], importance=4),
 comp("sa-cost","Cost modelling, TCO and solution optimisation",["SA"],False,"Model and optimise costs.",["Estimate TCO","Optimise","Track"], ["Cost model"], importance=4),
 comp("sa-presentation","Architecture presentations, workshops and stakeholder defence",["SA"],False,"Present and defend architecture.",["Facilitate workshops","Present","Defend"], ["Presentation"], importance=4),
]

aisa = [
 comp("ai-fundamentals","AI/ML fundamentals and model selection",["AISA"],False,"Understand and select AI models.",["Explain model types","Compare models","Select"], ["Model selection doc"], importance=4),
 comp("ai-rag","RAG, retrieval quality, embeddings and knowledge sources",["AISA"],False,"Design retrieval-augmented systems.",["Design retrieval","Evaluate quality","Manage sources"], ["RAG design"], importance=5),
 comp("ai-agents","Agent design, tool calling and workflow orchestration",["AISA"],False,"Design AI agents and workflows.",["Design agents","Tool contracts","Orchestrate"], ["Agent design"], importance=5),
 comp("ai-permissions","Permissions, least privilege and human approval gates",["AISA"],False,"Control AI permissions and approvals.",["Define scopes","Approval gates","Audit"], ["Permission design"], importance=5),
 comp("ai-injection","Prompt injection, data leakage and adversarial testing",["AISA"],False,"Mitigate AI security risks.",["Threat model","Test injection","Prevent leakage"], ["Threat model"], importance=5),
 comp("ai-evaluation","Evaluation datasets, quality metrics and regression tests",["AISA"],False,"Evaluate AI quality.",["Build eval sets","Define metrics","Regression test"], ["Eval report"], importance=4),
 comp("ai-performance","Model latency, cost, throughput and fallback strategies",["AISA"],False,"Optimise AI performance and cost.",["Measure latency","Manage cost","Fallbacks"], ["Performance report"], importance=4),
 comp("ai-governance","Data governance, privacy and model lifecycle",["AISA"],False,"Govern AI data and lifecycle.",["Data rights","Privacy","Lifecycle"], ["Governance plan"], importance=4),
 comp("ai-observability","Observability, tracing, monitoring and production support",["AISA"],False,"Observe and support AI systems.",["Trace requests","Monitor quality","Support"], ["Observability plan"], importance=4),
 comp("ai-responsible","Responsible AI, risk controls and auditability",["AISA"],False,"Apply responsible AI practices.",["Risk controls","Audit","Transparency"], ["Risk register"], importance=5),
 comp("ai-business","Business-case validation and measurable AI outcomes",["AISA"],False,"Validate AI business value.",["Define outcomes","Measure","Iterate"], ["Business case"], importance=4),
]

cto = [
 comp("cto-enterprise","Enterprise architecture and business capability mapping",["CTO"],False,"Map technology to business capabilities.",["Capability map","Target state","Roadmap"], ["Capability map"], importance=4),
 comp("cto-strategy","Technology strategy, target-state architecture and roadmaps",["CTO"],False,"Set technology strategy and roadmaps.",["Define vision","Target state","Roadmap"], ["Strategy doc"], importance=5),
 comp("cto-portfolio","Portfolio prioritisation and investment decisions",["CTO"],False,"Prioritise technology investments.",["Score initiatives","Allocate","Review"], ["Portfolio plan"], importance=5),
 comp("cto-governance","Technology governance and enterprise risk",["CTO"],False,"Govern technology and risk.",["Governance model","Risk register","Audit"], ["Governance plan"], importance=5),
 comp("cto-security","Security leadership and accountability",["CTO"],False,"Lead security accountability.",["Accountability","Risk appetite","Oversight"], ["Security charter"], importance=5),
 comp("cto-finops","FinOps, unit economics, budgets and TCO",["CTO"],False,"Manage technology economics.",["Budgets","Unit economics","TCO"], ["Financial model"], importance=5),
 comp("cto-buildbuy","Build-versus-buy decisions and vendor management",["CTO"],False,"Make build/buy and vendor decisions.",["Evaluate options","Manage vendors","Exit"], ["Decision record"], importance=4),
 comp("cto-product","Product strategy, customer discovery and SaaS economics",["CTO"],False,"Align technology with product.",["Customer discovery","SaaS metrics","Roadmap"], ["Product tech plan"], importance=4),
 comp("cto-teams","Team design, engineering effectiveness and organisational structure",["CTO"],False,"Design engineering organisations.",["Team topologies","Effectiveness","Structure"], ["Org design"], importance=4),
 comp("cto-delivery","Delivery performance, DORA metrics and SLOs",["CTO"],False,"Measure and improve delivery.",["DORA metrics","SLOs","Improve"], ["Metrics dashboard"], importance=4),
 comp("cto-incidents","Incident leadership, resilience and business continuity",["CTO"],False,"Lead incidents and resilience.",["Incident command","BCP","Resilience"], ["BCP plan"], importance=5),
 comp("cto-exec","Executive communication, board reporting and investment cases",["CTO"],False,"Communicate to executives and board.",["Board report","Investment case","Narrative"], ["Board pack"], importance=5),
 comp("cto-talent","Talent development, succession planning and operating models",["CTO"],False,"Develop talent and succession.",["Career ladders","Succession","Operating model"], ["Talent plan"], importance=4),
 comp("cto-ai","AI governance and enterprise AI strategy",["CTO"],False,"Govern enterprise AI.",["AI policy","Risk","Strategy"], ["AI strategy"], importance=5),
]

allc = shared + sa + aisa + cto
with open(r"C:\Users\admin\Documents\Clients\cto\academy\data\capability-competencies.json","w",encoding="utf-8") as f:
    json.dump({"competencies": allc}, f, indent=2)
print("competencies", len(allc))
