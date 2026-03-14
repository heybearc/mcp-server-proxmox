#!/bin/bash
#
# Netbox IPAM Registration Script
# Registers a new container in Netbox with all required metadata
#

set -euo pipefail

CTID="$1"
CONTAINER_NAME="$2"
IP_ADDRESS="$3"
FUNCTION="$4"

NETBOX_URL="${NETBOX_URL:-http://10.92.3.11}"
NETBOX_TOKEN="${NETBOX_TOKEN:-}"

if [[ -z "$NETBOX_TOKEN" ]]; then
    echo "ERROR: NETBOX_TOKEN not set"
    exit 1
fi

# Netbox cluster ID (pve cluster)
CLUSTER_ID=1
SITE_ID=2

echo "Registering CT$CTID in Netbox..."

# Create virtual machine entry
VM_DATA=$(cat <<EOF
{
    "name": "$CONTAINER_NAME",
    "status": "active",
    "cluster": $CLUSTER_ID,
    "site": $SITE_ID,
    "vcpus": 2,
    "memory": 2048,
    "disk": 32,
    "comments": "Deployed via automated provisioning pipeline",
    "tags": [
        {"name": "lxc"},
        {"name": "$FUNCTION"}
    ],
    "custom_fields": {
        "ctid": "$CTID"
    }
}
EOF
)

VM_RESPONSE=$(curl -s -X POST \
    -H "Authorization: Token $NETBOX_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$VM_DATA" \
    "$NETBOX_URL/api/virtualization/virtual-machines/")

VM_ID=$(echo "$VM_RESPONSE" | jq -r '.id')

if [[ "$VM_ID" == "null" ]] || [[ -z "$VM_ID" ]]; then
    echo "ERROR: Failed to create VM in Netbox"
    echo "$VM_RESPONSE" | jq .
    exit 1
fi

echo "Created VM in Netbox (ID: $VM_ID)"

# Create network interface
INTERFACE_DATA=$(cat <<EOF
{
    "virtual_machine": $VM_ID,
    "name": "eth0",
    "type": "virtual",
    "enabled": true
}
EOF
)

INTERFACE_RESPONSE=$(curl -s -X POST \
    -H "Authorization: Token $NETBOX_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$INTERFACE_DATA" \
    "$NETBOX_URL/api/virtualization/interfaces/")

INTERFACE_ID=$(echo "$INTERFACE_RESPONSE" | jq -r '.id')

echo "Created interface (ID: $INTERFACE_ID)"

# Assign IP address
IP_DATA=$(cat <<EOF
{
    "address": "$IP_ADDRESS/24",
    "status": "active",
    "assigned_object_type": "virtualization.vminterface",
    "assigned_object_id": $INTERFACE_ID,
    "dns_name": "$CONTAINER_NAME.cloudigan.net"
}
EOF
)

IP_RESPONSE=$(curl -s -X POST \
    -H "Authorization: Token $NETBOX_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$IP_DATA" \
    "$NETBOX_URL/api/ipam/ip-addresses/")

IP_ID=$(echo "$IP_RESPONSE" | jq -r '.id')

echo "Assigned IP address (ID: $IP_ID)"

# Set as primary IP
curl -s -X PATCH \
    -H "Authorization: Token $NETBOX_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"primary_ip4\": $IP_ID}" \
    "$NETBOX_URL/api/virtualization/virtual-machines/$VM_ID/" > /dev/null

echo "✓ Netbox registration complete"
echo "  VM ID: $VM_ID"
echo "  IP: $IP_ADDRESS/24"
echo "  DNS: $CONTAINER_NAME.cloudigan.net"
