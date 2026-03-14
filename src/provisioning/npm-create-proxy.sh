#!/bin/bash
#
# NPM Proxy Host Creation Script
# Creates a reverse proxy entry in Nginx Proxy Manager
#

set -euo pipefail

DOMAIN="$1"
IP_ADDRESS="$2"
PORT="$3"
SSL="${4:-false}"

NPM_URL="${NPM_URL:-http://10.92.3.33:81}"
NPM_EMAIL="${NPM_EMAIL:-admin@cloudigan.net}"
NPM_PASSWORD="${NPM_PASSWORD:-}"

if [[ -z "$NPM_PASSWORD" ]]; then
    echo "ERROR: NPM_PASSWORD not set"
    exit 1
fi

echo "Creating NPM proxy host for $DOMAIN..."

# Login to NPM and get token
LOGIN_RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "{\"identity\": \"$NPM_EMAIL\", \"secret\": \"$NPM_PASSWORD\"}" \
    "$NPM_URL/api/tokens")

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token')

if [[ "$TOKEN" == "null" ]] || [[ -z "$TOKEN" ]]; then
    echo "ERROR: Failed to login to NPM"
    exit 1
fi

# Create proxy host
PROXY_DATA=$(cat <<EOF
{
    "domain_names": ["$DOMAIN"],
    "forward_scheme": "http",
    "forward_host": "$IP_ADDRESS",
    "forward_port": $PORT,
    "access_list_id": 0,
    "certificate_id": 0,
    "ssl_forced": false,
    "caching_enabled": false,
    "block_exploits": true,
    "advanced_config": "",
    "meta": {
        "letsencrypt_agree": false,
        "dns_challenge": false
    },
    "allow_websocket_upgrade": true,
    "http2_support": true,
    "hsts_enabled": false,
    "hsts_subdomains": false
}
EOF
)

PROXY_RESPONSE=$(curl -s -X POST \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$PROXY_DATA" \
    "$NPM_URL/api/nginx/proxy-hosts")

PROXY_ID=$(echo "$PROXY_RESPONSE" | jq -r '.id')

if [[ "$PROXY_ID" == "null" ]] || [[ -z "$PROXY_ID" ]]; then
    echo "ERROR: Failed to create proxy host"
    echo "$PROXY_RESPONSE" | jq .
    exit 1
fi

echo "✓ NPM proxy host created (ID: $PROXY_ID)"

# Request SSL certificate if enabled
if [[ "$SSL" == "true" ]]; then
    echo "Requesting SSL certificate..."
    
    SSL_DATA=$(cat <<EOF
{
    "domain_names": ["$DOMAIN"],
    "meta": {
        "letsencrypt_email": "$NPM_EMAIL",
        "letsencrypt_agree": true,
        "dns_challenge": false
    }
}
EOF
)
    
    SSL_RESPONSE=$(curl -s -X POST \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "$SSL_DATA" \
        "$NPM_URL/api/nginx/certificates")
    
    CERT_ID=$(echo "$SSL_RESPONSE" | jq -r '.id')
    
    if [[ "$CERT_ID" != "null" ]] && [[ -n "$CERT_ID" ]]; then
        # Update proxy host with certificate
        curl -s -X PUT \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json" \
            -d "{\"certificate_id\": $CERT_ID, \"ssl_forced\": true}" \
            "$NPM_URL/api/nginx/proxy-hosts/$PROXY_ID" > /dev/null
        
        echo "✓ SSL certificate installed (ID: $CERT_ID)"
    else
        echo "WARNING: SSL certificate request failed"
    fi
fi

echo "✓ Proxy configured: $DOMAIN → $IP_ADDRESS:$PORT"
