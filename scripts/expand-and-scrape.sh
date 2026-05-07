#!/usr/bin/env bash
# Run one round of corpus expansion: discover unknown refs, insert placeholders,
# scrape new ids, and merge. Re-run until convergence or MAX_ROUNDS.
#
# Usage:  scripts/expand-and-scrape.sh [round_label] [max_new_per_round]
# Env:    SCRAPE_TIMEOUT (default 45000), MAX_ROUNDS (default 4)

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ROUND_LABEL="${1:-round}"
MAX_NEW="${2:-200}"
MAX_ROUNDS="${MAX_ROUNDS:-4}"
export SCRAPE_TIMEOUT="${SCRAPE_TIMEOUT:-45000}"

for round in $(seq 1 "$MAX_ROUNDS"); do
  label="${ROUND_LABEL}-${round}"
  echo ""
  echo "===== ROUND $round ($label) ====="
  node scripts/expand-corpus.js --max-new "$MAX_NEW" --label "$label"
  out_file="/tmp/expansion-${label}.json"
  if [ ! -f "$out_file" ]; then
    echo "no expansion file at $out_file — stopping."
    break
  fi
  ids=$(node -e "const j=require('$out_file'); console.log((j.entries||[]).map(e=>e.id).join(','));")
  if [ -z "$ids" ]; then
    echo "no new ids this round — corpus closed."
    break
  fi
  echo "scraping $(echo $ids | tr ',' '\n' | wc -l | tr -d ' ') new docs..."
  node scripts/scrape-ids.js "$ids"
  echo "merging..."
  node scripts/merge.js | tail -3
done

echo ""
echo "===== FINAL ====="
node -e "
const fs=require('fs'); const sandbox={window:{}};
new Function('window', fs.readFileSync('data/documents.js','utf8'))(sandbox.window);
const db=sandbox.window.LEGAL_DB;
let total=0;
for (const d of Object.values(db)) total += (d.chapters||[]).reduce((s,c)=>s+c.articles.length, 0);
console.log('total docs:', Object.keys(db).length, '— total articles:', total);
"
