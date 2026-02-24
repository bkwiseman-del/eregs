#!/bin/bash
# Sync all FMCSR regulations into the DB cache
# Usage: ./scripts/sync-all.sh

URL="https://eregs-hpvu.vercel.app"
SECRET="eregs-sync-2026"
PARTS="40 376 380 381 382 383 385 386 387 390 391 392 393 394 395 396 397 398 399"

echo "=== Syncing TOC structure ==="
curl -s -X POST "$URL/api/cron/sync-regs?step=structure" \
  -H "Authorization: Bearer $SECRET" | python3 -m json.tool

echo ""
for part in $PARTS; do
  echo "=== Syncing Part $part ==="
  curl -s -X POST "$URL/api/cron/sync-regs?step=part&part=$part" \
    -H "Authorization: Bearer $SECRET" | python3 -m json.tool
  echo ""
done

echo "=== Done ==="
