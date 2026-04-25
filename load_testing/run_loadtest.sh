#!/bin/bash
# Jalankan 3 skenario load test otomatis (5, 7, 10 user, masing-masing 5 menit)
# Usage: bash run_loadtest.sh

set -e

if [ -z "$NIRSISA_TOKEN" ]; then
  echo "ERROR: Set token dulu → export NIRSISA_TOKEN='eyJ...'"
  exit 1
fi

for USERS in 5 7 10; do
  echo ""
  echo "========================================="
  echo "  Skenario: $USERS concurrent users, 5 menit"
  echo "========================================="

  python3 -m locust -f locust_loadtest.py \
    --headless \
    --users "$USERS" \
    --spawn-rate 1 \
    --run-time 5m \
    --csv="results_${USERS}u" \
    --html="report_${USERS}u.html"

  echo "  → Hasil disimpan: results_${USERS}u_*.csv & report_${USERS}u.html"
  sleep 5
done

echo ""
echo "Semua skenario selesai!"
echo "File yang dihasilkan:"
ls results_*.csv report_*.html 2>/dev/null
