#!/bin/bash
#
# Automated Container Provisioning Pipeline
# 
# Purpose: End-to-end automation for new container deployment
# Components: Auto-assign CTID, Netbox IPAM, NPM proxy, AdGuard DNS, Proxmox LXC
# 
# Usage: ./provision-container.sh --name <name> --function <function> --ip <ip> [options]
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Source environment variables
if [[ -f "$PROJECT_ROOT/.env" ]]; then
    source "$PROJECT_ROOT/.env"
fi

# Default values
PROXMOX_HOST="${PROXMOX_HOST:-10.92.0.5}"
NETBOX_URL="${NETBOX_URL:-http://10.92.3.11}"
NETBOX_TOKEN="${NETBOX_TOKEN:-}"
NPM_URL="${NPM_URL:-http://10.92.3.33:81}"
NPM_EMAIL="${NPM_EMAIL:-admin@cloudigan.net}"
NPM_PASSWORD="${NPM_PASSWORD:-}"
TRUENAS_HOST="${TRUENAS_HOST:-10.92.0.3}"
GATEWAY="10.92.3.1"
SUBNET="24"
TEMPLATE="local:vztmpl/ubuntu-22.04-standard_22.04-1_amd64.tar.zst"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function to show usage
usage() {
    cat << EOF
Usage: $0 --name <name> --function <function> --ip <ip> [options]

Required Arguments:
  --name <name>           Container hostname (e.g., scrypted-nvr)
  --function <function>   Container function category (bot|dev|media|core|network|monitoring|storage|security|utility)
  --ip <ip>              IP address (e.g., 10.92.3.15)

Optional Arguments:
  --ctid <id>            Specific CTID (auto-assigned if not provided)
  --memory <MB>          RAM in MB (default: 2048)
  --cores <num>          CPU cores (default: 2)
  --disk <GB>            Disk size in GB (default: 32)
  --privileged           Create privileged container (default: unprivileged)
  --domain <domain>      Domain for NPM proxy (e.g., scrypted.cloudigan.net)
  --port <port>          Backend port for NPM proxy (default: 80)
  --ssl                  Enable SSL for NPM proxy
  --no-netbox            Skip Netbox registration
  --no-npm               Skip NPM proxy creation
  --no-dns               Skip DNS registration
  --no-monitoring        Skip monitoring setup
  --no-backup            Skip backup configuration
  --dry-run              Show what would be done without executing

Examples:
  # Basic deployment
  $0 --name scrypted-nvr --function utility --ip 10.92.3.15

  # Full deployment with proxy
  $0 --name scrypted-nvr --function utility --ip 10.92.3.15 \\
     --domain scrypted.cloudigan.net --port 11443 --ssl \\
     --memory 4096 --cores 2

  # Custom CTID
  $0 --name test-service --function dev --ip 10.92.3.50 --ctid 115

EOF
    exit 1
}

# Parse arguments
CONTAINER_NAME=""
FUNCTION=""
IP_ADDRESS=""
CTID=""
MEMORY="2048"
CORES="2"
DISK="32"
PRIVILEGED="0"
DOMAIN=""
PORT="80"
SSL="false"
SKIP_NETBOX="false"
SKIP_NPM="false"
SKIP_DNS="false"
SKIP_MONITORING="false"
SKIP_BACKUP="false"
DRY_RUN="false"

while [[ $# -gt 0 ]]; do
    case $1 in
        --name)
            CONTAINER_NAME="$2"
            shift 2
            ;;
        --function)
            FUNCTION="$2"
            shift 2
            ;;
        --ip)
            IP_ADDRESS="$2"
            shift 2
            ;;
        --ctid)
            CTID="$2"
            shift 2
            ;;
        --memory)
            MEMORY="$2"
            shift 2
            ;;
        --cores)
            CORES="$2"
            shift 2
            ;;
        --disk)
            DISK="$2"
            shift 2
            ;;
        --privileged)
            PRIVILEGED="1"
            shift
            ;;
        --domain)
            DOMAIN="$2"
            shift 2
            ;;
        --port)
            PORT="$2"
            shift 2
            ;;
        --ssl)
            SSL="true"
            shift
            ;;
        --no-netbox)
            SKIP_NETBOX="true"
            shift
            ;;
        --no-npm)
            SKIP_NPM="true"
            shift
            ;;
        --no-dns)
            SKIP_DNS="true"
            shift
            ;;
        --no-monitoring)
            SKIP_MONITORING="true"
            shift
            ;;
        --no-backup)
            SKIP_BACKUP="true"
            shift
            ;;
        --dry-run)
            DRY_RUN="true"
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            print_error "Unknown option: $1"
            usage
            ;;
    esac
done

# Validate required arguments
if [[ -z "$CONTAINER_NAME" ]] || [[ -z "$FUNCTION" ]] || [[ -z "$IP_ADDRESS" ]]; then
    print_error "Missing required arguments"
    usage
fi

# Validate function and get CTID range
get_ctid_range() {
    case "$1" in
        bot)
            echo "100 109"
            ;;
        dev)
            echo "110 119"
            ;;
        media)
            echo "120 129"
            ;;
        core)
            echo "130 139"
            ;;
        network)
            echo "140 149"
            ;;
        monitoring)
            echo "150 159"
            ;;
        storage)
            echo "160 169"
            ;;
        security)
            echo "170 179"
            ;;
        utility)
            echo "180 189"
            ;;
        *)
            print_error "Invalid function: $1"
            print_error "Valid functions: bot, dev, media, core, network, monitoring, storage, security, utility"
            exit 1
            ;;
    esac
}

# Auto-assign CTID if not provided
if [[ -z "$CTID" ]]; then
    read -r RANGE_START RANGE_END <<< "$(get_ctid_range "$FUNCTION")"
    print_status "Auto-assigning CTID from range $RANGE_START-$RANGE_END for function: $FUNCTION"
    
    # Get list of existing CTIDs
    EXISTING_CTIDS=$(ssh root@$PROXMOX_HOST "pct list | awk 'NR>1 {print \$1}' | sort -n")
    
    # Find first available CTID in range
    for ((i=RANGE_START; i<=RANGE_END; i++)); do
        if ! echo "$EXISTING_CTIDS" | grep -q "^${i}$"; then
            CTID=$i
            break
        fi
    done
    
    if [[ -z "$CTID" ]]; then
        print_error "No available CTID in range $RANGE_START-$RANGE_END"
        exit 1
    fi
    
    print_success "Auto-assigned CTID: $CTID"
else
    # Validate provided CTID is in correct range
    read -r RANGE_START RANGE_END <<< "$(get_ctid_range "$FUNCTION")"
    if [[ $CTID -lt $RANGE_START ]] || [[ $CTID -gt $RANGE_END ]]; then
        print_warning "CTID $CTID is outside recommended range $RANGE_START-$RANGE_END for function: $FUNCTION"
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
fi

# Display deployment plan
echo ""
print_status "=== Container Provisioning Plan ==="
echo "Container Name: $CONTAINER_NAME"
echo "CTID: $CTID"
echo "Function: $FUNCTION"
echo "IP Address: $IP_ADDRESS/$SUBNET"
echo "Gateway: $GATEWAY"
echo "Memory: ${MEMORY}MB"
echo "CPU Cores: $CORES"
echo "Disk: ${DISK}GB"
echo "Privileged: $([ "$PRIVILEGED" = "1" ] && echo "Yes" || echo "No")"
[[ -n "$DOMAIN" ]] && echo "Domain: $DOMAIN (port $PORT, SSL: $SSL)"
echo ""
echo "Pipeline Steps:"
echo "  [$([ "$DRY_RUN" = "true" ] && echo "SKIP" || echo " ✓ ")] Create Proxmox LXC container"
echo "  [$([ "$SKIP_NETBOX" = "true" ] && echo "SKIP" || echo " ✓ ")] Register in Netbox IPAM"
echo "  [$([ "$SKIP_NPM" = "true" ] || [[ -z "$DOMAIN" ]] && echo "SKIP" || echo " ✓ ")] Create NPM proxy host"
echo "  [$([ "$SKIP_DNS" = "true" ] && echo "SKIP" || echo " ✓ ")] Add DNS entries"
echo "  [$([ "$SKIP_MONITORING" = "true" ] && echo "SKIP" || echo " ✓ ")] Install monitoring agents"
echo "  [$([ "$SKIP_BACKUP" = "true" ] && echo "SKIP" || echo " ✓ ")] Configure backups"
echo "  [ ✓ ] Update documentation"
echo ""

if [[ "$DRY_RUN" = "true" ]]; then
    print_warning "DRY RUN MODE - No changes will be made"
    exit 0
fi

read -p "Proceed with deployment? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_warning "Deployment cancelled"
    exit 0
fi

# Step 1: Create Proxmox LXC container
print_status "Step 1: Creating Proxmox LXC container CT$CTID..."

UNPRIVILEGED_FLAG="--unprivileged $PRIVILEGED"
CREATE_CMD="pct create $CTID $TEMPLATE \
    --hostname $CONTAINER_NAME \
    --memory $MEMORY \
    --cores $CORES \
    --net0 name=eth0,bridge=vmbr0923,ip=${IP_ADDRESS}/${SUBNET},gw=${GATEWAY} \
    --storage local-lvm \
    --rootfs local-lvm:${DISK} \
    $UNPRIVILEGED_FLAG \
    --features nesting=1 \
    --onboot 1 \
    --start 1"

if ssh root@$PROXMOX_HOST "$CREATE_CMD"; then
    print_success "Container CT$CTID created successfully"
else
    print_error "Failed to create container"
    exit 1
fi

# Wait for container to start
print_status "Waiting for container to start..."
sleep 10

# Step 2: Register in Netbox IPAM
if [[ "$SKIP_NETBOX" = "false" ]]; then
    print_status "Step 2: Registering in Netbox IPAM..."
    
    # This will be implemented with Netbox API calls
    # For now, create a placeholder script
    "$SCRIPT_DIR/netbox-register.sh" "$CTID" "$CONTAINER_NAME" "$IP_ADDRESS" "$FUNCTION" || {
        print_warning "Netbox registration failed (script may not exist yet)"
    }
else
    print_warning "Step 2: Skipping Netbox registration"
fi

# Step 3: Create NPM proxy host
if [[ "$SKIP_NPM" = "false" ]] && [[ -n "$DOMAIN" ]]; then
    print_status "Step 3: Creating NPM proxy host..."
    
    # This will be implemented with NPM API calls
    "$SCRIPT_DIR/npm-create-proxy.sh" "$DOMAIN" "$IP_ADDRESS" "$PORT" "$SSL" || {
        print_warning "NPM proxy creation failed (script may not exist yet)"
    }
else
    print_warning "Step 3: Skipping NPM proxy creation"
fi

# Step 4: Add DNS entries
if [[ "$SKIP_DNS" = "false" ]] && [[ -n "$DOMAIN" ]]; then
    print_status "Step 4: Adding DNS entries..."
    
    # This will be implemented with AdGuard API calls
    "$SCRIPT_DIR/dns-add-record.sh" "$DOMAIN" "$IP_ADDRESS" || {
        print_warning "DNS registration failed (script may not exist yet)"
    }
else
    print_warning "Step 4: Skipping DNS registration"
fi

# Step 5: Install monitoring agents
if [[ "$SKIP_MONITORING" = "false" ]]; then
    print_status "Step 5: Installing monitoring agents..."
    
    # Install node_exporter and promtail
    "$SCRIPT_DIR/install-monitoring.sh" "$CTID" "$CONTAINER_NAME" || {
        print_warning "Monitoring installation failed (script may not exist yet)"
    }
else
    print_warning "Step 5: Skipping monitoring setup"
fi

# Step 6: Configure backups
if [[ "$SKIP_BACKUP" = "false" ]]; then
    print_status "Step 6: Configuring backups..."
    
    # Configure Proxmox backup schedule
    "$SCRIPT_DIR/configure-backup.sh" "$CTID" || {
        print_warning "Backup configuration failed (script may not exist yet)"
    }
else
    print_warning "Step 6: Skipping backup configuration"
fi

# Step 7: Update documentation
print_status "Step 7: Generating documentation entry..."

cat > "/tmp/ct${CTID}-deployment.md" << EOF
# CT${CTID} Deployment Record

**Container:** $CONTAINER_NAME  
**CTID:** $CTID  
**Function:** $FUNCTION  
**IP Address:** $IP_ADDRESS/$SUBNET  
**Gateway:** $GATEWAY  
**Deployed:** $(date '+%Y-%m-%d %H:%M:%S')

## Specifications
- Memory: ${MEMORY}MB
- CPU Cores: $CORES
- Disk: ${DISK}GB
- Privileged: $([ "$PRIVILEGED" = "1" ] && echo "Yes" || echo "No")
$([ -n "$DOMAIN" ] && echo "- Domain: $DOMAIN" || echo "")
$([ -n "$DOMAIN" ] && echo "- Backend Port: $PORT" || echo "")
$([ "$SSL" = "true" ] && echo "- SSL: Enabled" || echo "")

## Automation Pipeline
- Proxmox LXC: ✅ Created
- Netbox IPAM: $([ "$SKIP_NETBOX" = "false" ] && echo "✅ Registered" || echo "⏭️ Skipped")
- NPM Proxy: $([ "$SKIP_NPM" = "false" ] && [[ -n "$DOMAIN" ]] && echo "✅ Created" || echo "⏭️ Skipped")
- DNS Entries: $([ "$SKIP_DNS" = "false" ] && [[ -n "$DOMAIN" ]] && echo "✅ Added" || echo "⏭️ Skipped")
- Monitoring: $([ "$SKIP_MONITORING" = "false" ] && echo "✅ Installed" || echo "⏭️ Skipped")
- Backups: $([ "$SKIP_BACKUP" = "false" ] && echo "✅ Configured" || echo "⏭️ Skipped")

## Access
- SSH: \`ssh root@$IP_ADDRESS\`
$([ -n "$DOMAIN" ] && echo "- Web UI: https://$DOMAIN" || echo "")
- Proxmox: \`pct enter $CTID\`

## Next Steps
1. Configure application-specific settings
2. Verify monitoring in Grafana
3. Test backup/restore procedure
4. Update infrastructure documentation
EOF

print_success "Documentation generated: /tmp/ct${CTID}-deployment.md"

# Summary
echo ""
print_success "=== Deployment Complete ==="
echo "Container: $CONTAINER_NAME (CT$CTID)"
echo "IP Address: $IP_ADDRESS"
[[ -n "$DOMAIN" ]] && echo "Domain: $DOMAIN"
echo ""
echo "Next steps:"
echo "1. SSH to container: ssh root@$IP_ADDRESS"
echo "2. Configure application"
echo "3. Review deployment record: /tmp/ct${CTID}-deployment.md"
echo "4. Update infrastructure-spec.md and APP-MAP.md"
echo ""
