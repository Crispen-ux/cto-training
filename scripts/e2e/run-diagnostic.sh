#!/bin/bash
# Needs: a production build (npm run build), python3 with playwright and a Chromium it can launch.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$HERE/../.."; D=$(mktemp -d)
(cd "$ROOT" && ACADEMY_DATA_DIR="$D" exec node node_modules/next/dist/bin/next start -p 3110 > "$D/next.log" 2>&1) & NEXT=$!
sleep 6
python3 "$HERE/diagnostic.py"; CODE=$?
kill $NEXT 2>/dev/null
echo "state: $(python3 -c "import json;s=json.load(open('$D/state.json'));print('evidence',len(s['evidence']),'| diagnostics',len(s['diagnostics']))")"
exit $CODE
