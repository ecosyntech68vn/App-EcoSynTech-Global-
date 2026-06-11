#!/bin/bash
# test-api-contract.sh — verify WLC endpoints mobile cần đều OK
# Usage: bash scripts/test-api-contract.sh http://192.168.1.100:3000
set -u
BASE="${1:-http://localhost:3000}"
PASS=0; FAIL=0

check() {
  local name="$1"; local path="$2"; local method="${3:-GET}"
  local code
  code=$(curl -s -o /tmp/_resp -w "%{http_code}" -X "$method" "$BASE$path" --max-time 5 2>/dev/null || echo "000")
  if [[ "$code" =~ ^(2|4)0[0-9]$ ]] && [[ "$code" != "404" ]]; then
    echo "[✓] $name → $code"
    PASS=$((PASS+1))
  else
    echo "[✗] $name → $code"
    FAIL=$((FAIL+1))
  fi
}

echo "Testing $BASE …"
check "/api/health"                 /api/health
check "/api/sensors/latest"         /api/sensors/latest
check "/api/sensors"                /api/sensors
check "/api/alerts?status=open"     "/api/alerts?status=open"
check "/api/alerts/X/acknowledge"   "/api/alerts/test/acknowledge"  POST
check "/api/tasks"                  /api/tasks
check "/api/tasks/X"                /api/tasks/test PATCH
check "/api/journal/manual"         /api/journal/manual POST
check "/api/farmer/auth/verify-otp" /api/farmer/auth/verify-otp POST
check "/api/auth/login"             /api/auth/login POST
check "/api/auth/refresh"           /api/auth/refresh POST

echo "---"
echo "PASS: $PASS · FAIL: $FAIL"
if [[ $FAIL -eq 0 ]]; then
  echo "✅ All endpoints reachable — mobile contract OK"
  exit 0
else
  echo "❌ $FAIL endpoint(s) failed — check WLC mount + run again"
  exit 1
fi
