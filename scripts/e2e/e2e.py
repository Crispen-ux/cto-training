"""Browser test of the AI tutor and defence against a FAKE provider (scripts/e2e/fake_anthropic.js).
It checks the UI flow and the request contract. It does not test any real model.
Usage: see docs/AI.md.
"""
import json, sys, re
from playwright.sync_api import sync_playwright, expect
BASE = "http://127.0.0.1:3108"
import os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
lesson = json.load(open(os.path.join(ROOT, "content/lessons/adr-c4.json")))
SHOT = os.environ.get("E2E_SHOTS", "/tmp/academy-e2e-") 
ANS1 = ("I recorded the decision as an ADR with context, the options I rejected, the decision and its consequences, and I labelled every figure I invented as an ASSUMPTION so nobody mistakes it for data. " * 2).strip()
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1100, "height": 900})
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    pg.goto(BASE + "/lessons/adr-c4")
    # 1. tutor
    expect(pg.get_by_role("heading", name="AI tutor")).to_be_visible()
    pg.get_by_label("Your message").fill("What is an ADR and why keep one?")
    pg.get_by_role("button", name="Send", exact=True).click()
    expect(pg.get_by_text("Tutor reply: an ADR records one decision")).to_be_visible(timeout=15000)
    pg.screenshot(path=SHOT + "s1_tutor.png", full_page=False)
    # 2. knowledge check
    for q in lesson["knowledgeCheck"]:
        box = pg.locator("div.q", has_text=q["question"])
        box.locator("label.opt").nth(q["answer"]).click()
    pg.get_by_role("button", name="Submit answers").click()
    expect(pg.get_by_text("Move on to")).to_be_visible(timeout=15000)
    # 3. build + feedback
    pg.locator(".tabs a", has_text="Build").click()
    pg.get_by_label("Your write-up").fill("I wrote an ADR and C4 diagrams for the checkout service, with the options considered and the consequences. " * 2)
    pg.get_by_role("button", name="Get feedback").click()
    expect(pg.get_by_text("I cannot see your artifact")).to_be_visible(timeout=15000)
    pg.get_by_label("Artifact reference (repo URL, path or document link)").fill("docs/adr-0001.md")
    pg.get_by_label("Data used").select_option("SIMULATED")
    pg.locator("form textarea#content").fill("Built the ADR and diagrams, each criterion addressed, known gap: no second reviewer yet. " * 2)
    pg.get_by_role("button", name="Submit for review").click()
    expect(pg.get_by_text("Submitted for review")).to_be_visible(timeout=15000)
    # 4. defence with AI
    pg.locator(".tabs a", has_text="Defend").click()
    expect(pg.get_by_role("heading", name=re.compile("Defend with the AI assessor"))).to_be_visible()
    pg.locator("#ai-def").fill(ANS1)
    pg.get_by_role("button", name="Start defence").click()
    expect(pg.get_by_text("Where did your figures come from")).to_be_visible(timeout=15000)
    pg.locator("#ai-def").fill("The figures were all invented for the exercise and labelled ASSUMPTION; the decision would change if the second option cost under half as much. " * 2)
    pg.get_by_role("button", name="Send reply").click()
    expect(pg.locator("#ai-def")).to_be_visible(timeout=15000)
    pg.wait_for_timeout(800)
    pg.locator("#ai-def").fill("Nothing further to add beyond the cost threshold I already gave, which is the main thing that would flip it. " * 2)
    pg.get_by_role("button", name="Send reply").click()
    expect(pg.get_by_role("button", name="Finish and score")).to_be_visible()
    pg.wait_for_timeout(800)
    pg.screenshot(path=SHOT + "s2_defence_transcript.png", full_page=True)
    pg.get_by_role("button", name="Finish and score").click()
    expect(pg.get_by_text("Recorded as evidence, assessed by AI")).to_be_visible(timeout=30000)
    pg.screenshot(path=SHOT + "s3_result.png", full_page=True)
    print("RESULT HEADING:", pg.locator("h3", has_text="Result:").inner_text())
    # 5. other pages
    pg.goto(BASE + "/evidence"); body = pg.inner_text("body"); print("evidence has defence/ai:", "defence" in body.lower() and "ai" in body.lower())
    pg.goto(BASE + "/ai-log"); log = pg.inner_text("body"); print("ai-log counted:", "counted as evidence" in log, "| shows quote:", "I recorded the decision as an ADR" in log)
    pg.screenshot(path=SHOT + "s4_log.png", full_page=True)
    pg.goto(BASE + "/settings"); print("settings:", re.search(r"Calls today: \d+ of \d+", pg.inner_text("body")).group(0))
    print("browser errors:", [e for e in errors if "favicon" not in e])
    b.close()
