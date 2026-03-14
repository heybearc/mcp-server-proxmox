#!/bin/bash
#
# DNS Record Addition Script
# Adds A record to AdGuard Home DNS
#

set -euo pipefail

DOMAIN="$1"
IP_ADDRESS="$2"

ADGUARD_URL="${ADGUARD_URL:-http://10.92.3.10}"
ADGUARD_USER="${ADGUARD_USER:-admin}"
ADGUARD_PASSWORD="${ADGUARD_PASSWORD:-}"

if [[ -z "$ADGUARD_PASSWORD" ]]; then
    echo "ERROR: ADGUARD_PASSWORD not set"
    exit 1
fi

echo "Adding DNS record: $DOMAIN → $IP_ADDRESS"

# AdGuard Home uses rewrite rules for custom DNS entries
REWRITE_DATA=$(cat <<EOF
{
    "domain": "$DOMAIN",
    "answer": "$IP_ADDRESS"
}
EOF
)

RESPONSE=$(curl -s -X POST \
    -u "$ADGUARD_USER:$ADGUARD_PASSWORD" \
    -H "Content-Type: application/json" \
    -d "$REWRITE_DATA" \
    "$ADGUARD_URL/control/rewrite/add")

if echo "$RESPONSE" | grep -q "error"; then
    echo "ERROR: Failed to add DNS record"
    echo "$RESPONSE"
    exit 1
fi

echo "✓ DNS record added: $DOMAIN → $IP_ADDRESS"
