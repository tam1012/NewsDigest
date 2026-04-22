#!/bin/bash
# Extract all <id:xxx> from digest and check against articles table

# IDs extracted from the digest text for 2026-04-22:
IDS=(
  "c96623c6"
  "d6bb60aa"
  "cb7f8194"
  "4b8eb0ba"
  "df9f0e37"
  "b1a48339"
  "03f307b5"
  "1298e696"
  "f9586de0"
  "ba60d309"
  "6f6380a9"
  "d781511c"
  "739e06f3"
  "ed5bca67"
  "d3d03706"
  "d203cc45"
  "0dd63a90"
  "04cf9348"
  "bcdcbde1"
  "88922251"
  "2c728530"
  "6f7adcb2"
)

echo "=== Checking ${#IDS[@]} digest IDs against articles table ==="
echo ""

# Build a SQL query that checks each digest ID prefix against actual article IDs
LIKE_CONDITIONS=""
for id in "${IDS[@]}"; do
  if [ -n "$LIKE_CONDITIONS" ]; then
    LIKE_CONDITIONS="$LIKE_CONDITIONS OR "
  fi
  LIKE_CONDITIONS="${LIKE_CONDITIONS}id LIKE '${id}%'"
done

SQL="SELECT id, substr(title, 1, 80) as title_short, hot_score FROM articles WHERE ($LIKE_CONDITIONS) ORDER BY hot_score DESC"

echo "Running query..."
npx wrangler d1 execute newsdigest --remote --command "$SQL" 2>&1
