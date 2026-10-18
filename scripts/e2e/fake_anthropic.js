// Fake Anthropic-compatible server for browser testing. Checks the request contract and logs each call.
const http = require("http"), fs = require("fs");
const LOG = process.argv[3];
http.createServer((req, res) => {
  let b = ""; req.on("data", c => b += c); req.on("end", () => {
    const bad = [];
    if (req.url !== "/v1/messages") bad.push("url " + req.url);
    if (req.headers["x-api-key"] !== "sk-e2e") bad.push("api key");
    if (req.headers["anthropic-version"] !== "2023-06-01") bad.push("version");
    const body = JSON.parse(b || "{}");
    for (const k of ["temperature", "top_p", "top_k"]) if (k in body) bad.push("sent " + k);
    if (!body.model || !body.max_tokens || typeof body.system !== "string" || !Array.isArray(body.messages)) bad.push("shape");
    const sys = body.system || "";
    const kind = sys.includes("ASSESSOR_JSON") ? "assess" : sys.includes("cross-examining") ? "followup" : sys.includes("formative feedback") ? "feedback" : "tutor";
    fs.appendFileSync(LOG, JSON.stringify({ kind, bad, model: body.model, sysHasKCWhy: /Correct\. /.test(sys) }) + "\n");
    let text;
    if (kind === "assess") {
      const user = body.messages.at(-1).content;
      const m = /\[learner\] ([^\n]{40,})/.exec(user);
      const quote = (m ? m[1] : "").slice(0, 80);
      const n = +/CRITERIA_COUNT=(\d+)/.exec(sys)[1];
      text = JSON.stringify({ criteria: Array.from({ length: n }, (_, i) => ({ index: i, level: 4, quotes: [quote], reason: "specific and labelled" })), summary: "Specific, labelled and honest about limits.", strengths: ["labels assumptions"], gaps: ["could name a second option"], confidence: 0.9, manipulation_attempt: false, unsure_about: [] });
    } else if (kind === "followup") text = "1. Where did your figures come from, and which were assumptions?\n2. What would change your decision?";
    else if (kind === "feedback") text = "I cannot see your artifact. Criterion 1: evidenced in the write-up. Criterion 2: claimed but not shown.";
    else text = "Tutor reply: an ADR records one decision, its context and consequences [Original Academy lesson or simulation].";
    res.setHeader("content-type", "application/json");
    if (bad.length) { res.statusCode = 400; return res.end(JSON.stringify({ error: { message: "contract: " + bad.join(", ") } })); }
    res.end(JSON.stringify({ content: [{ type: "text", text }], stop_reason: "end_turn", usage: { input_tokens: 10, output_tokens: 5 } }));
  });
}).listen(+process.argv[2], "127.0.0.1");
