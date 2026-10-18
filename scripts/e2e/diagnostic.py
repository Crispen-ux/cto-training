"""Browser test of the entry diagnostic. No AI provider needed."""
import glob, json, os, re
from playwright.sync_api import sync_playwright, expect
BASE = "http://127.0.0.1:3110"
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
whys = [q["why"] for f in glob.glob(os.path.join(ROOT, "content/lessons/*.json")) for q in json.load(open(f))["knowledgeCheck"]]
SHOT = os.environ.get("E2E_SHOTS", "/tmp/academy-e2e-")
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1100, "height": 900})
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    pg.goto(BASE + "/")
    expect(pg.get_by_text("No entry baseline yet")).to_be_visible()
    pg.get_by_role("link", name="Take the baseline").click()
    expect(pg.get_by_role("heading", name="Entry baseline")).to_be_visible()
    print("questions:", pg.locator("fieldset.q").count(), "| self-rating selects:", pg.locator("select").count())
    html = pg.content()
    print("quiz explanations leaked into page source:", sum(1 for w in whys if w in html))
    pg.screenshot(path=SHOT + "d1_form.png")
    # Submitting with nothing answered must be blocked by the browser (required radios).
    pg.get_by_role("button", name="Record my baseline").click()
    pg.wait_for_timeout(500)
    print("blocked while unanswered:", "/diagnostic" in pg.url and pg.locator("fieldset.q").count() == 30)
    # Self-rate Tech 5 and answer first option everywhere.
    pg.locator("#self-Tech").select_option("5")
    pg.locator("#self-People").select_option("1")
    for fs in pg.locator("fieldset.q").all():
        fs.locator("input[type=radio]").first.check()
    pg.get_by_role("button", name="Record my baseline").click()
    expect(pg.get_by_text("Baseline recorded")).to_be_visible(timeout=15000)
    rows = pg.locator("table tbody tr")
    print("result rows:", rows.count())
    print("first row:", re.sub(r"\s+", " ", rows.nth(0).inner_text()))
    body = pg.inner_text("body")
    print("shows interval + guess chance + not-evidence notice:", "95% interval" in body and "Chance by guessing alone" in body and "not an assessment of competence" in body)
    pg.screenshot(path=SHOT + "d2_results.png", full_page=True)
    pg.goto(BASE + "/diagnostic?retake=1")
    print("same-day retake blocked:", "already taken a diagnostic today" in pg.inner_text("body") or pg.locator("fieldset.q").count() == 0)
    pg.goto(BASE + "/")
    d = pg.inner_text("body")
    print("dashboard: no prompt now:", "No entry baseline yet" not in d, "| baseline sample shown:", "Baseline sample:" in d, "| XP still 0:", bool(re.search(r"\b0 XP\b", d)))
    pg.screenshot(path=SHOT + "d3_dashboard.png", full_page=True)
    pg.goto(BASE + "/evidence"); print("evidence page unaffected (baseline is not evidence):", "diagnostic" not in pg.inner_text("body").lower())
    print("browser errors:", [e for e in errors if "favicon" not in e])
    b.close()
