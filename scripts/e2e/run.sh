#!/bin/bash
# Needs: a production build (npm run build), python3 with playwright and a Chromium it can launch.
# Starts a fake Anthropic-compatible server and the app on a temporary data directory, drives the lesson pages, then stops both.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$HERE/../.."; D=$(mktemp -d); LOG="$D/fake.log"
node "$HERE/fake_anthropic.js" 4599 "$LOG" & FAKE=$!
(cd "$ROOT" && ANTHROPIC_API_KEY=sk-e2e ACADEMY_AI_BASE_URL=http://127.0.0.1:4599 ACADEMY_DATA_DIR="$D" exec node node_modules/next/dist/bin/next start -p 3108 > "$D/next.log" 2>&1) & NEXT=$!
sleep 6
python3 "$HERE/e2e.py"; CODE=$?
kill $FAKE $NEXT 2>/dev/null
echo "fake provider saw:"; sort "$LOG" | uniq -c
exit $CODE
