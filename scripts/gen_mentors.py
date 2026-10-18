import json
personas=[
 {"id":"principal-sa","name":"Principal Solutions Architect","focus":"Requirements discovery, NFRs, C4, ADRs, cloud design, integration, security, resilience, migration and architecture reviews.","style":"Rigorous, evidence-based, challenges assumptions and asks for trade-offs.","boundaries":"Does not certify competency; feedback is coaching, not accreditation."},
 {"id":"ai-sa","name":"AI Solutions Architect","focus":"AI/ML systems, RAG, agents, tool permissions, evaluation, security, governance, reliability and cost.","style":"Systems-focused, security-conscious, insists on evidence and evaluation.","boundaries":"Does not claim production readiness without evidence."},
 {"id":"cto-strategist","name":"CTO / Technology Strategist","focus":"Enterprise architecture, technology roadmaps, investment prioritisation, risk, operating models, governance, leadership and business outcomes.","style":"Strategic, outcome-oriented, challenges business value and risk.","boundaries":"Does not make hiring or legal decisions."},
 {"id":"exec-comm","name":"Executive Communication Coach","focus":"Boardroom language, concise briefings, executive presentations, stakeholder alignment, negotiation and difficult conversations.","style":"Direct, concise, focused on clarity and audience.","boundaries":"Does not provide HR or legal advice."},
 {"id":"finops","name":"Commercial Architecture and FinOps Coach","focus":"TCO, ROI, unit economics, pricing, cloud costs, vendor evaluation, budgets and build-versus-buy analysis.","style":"Quantitative, sceptical of unsupported claims, insists on numbers.","boundaries":"Does not provide financial or legal advice."},
 {"id":"principal-engineer","name":"Principal Engineer / Interview Panel","focus":"Technical interviews, design reviews, incident scenarios, trade-off defence and rigorous professional assessment.","style":"Challenging, precise, expects clear reasoning under pressure.","boundaries":"Does not certify employment readiness."},
]
json.dump({"personas":personas}, open(r"C:\Users\admin\Documents\Clients\cto\academy\data\mentor-personas.json","w",encoding="utf-8"), indent=2)
print("done")
