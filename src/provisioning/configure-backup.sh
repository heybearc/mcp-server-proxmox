#!/bin/bash
#
# Backup Configuration Script
# Configures Proxmox backup schedule for a container
#

set -euo pipefail

CTID="$1"

PROXMOX_HOST="${PROXMOX_HOST:-10.92.0.5}"
BACKUP_STORAGE="${BACKUP_STORAGE:-local}"
BACKUP_TIME="${BACKUP_TIME:-02:00}"
BACKUP_RETENTION="${BACKUP_RETENTION:-keep-last=7,keep-weekly=4,keep-monthly=3}"

echo "Configuring backup for CT$CTID..."

# Create backup job in Proxmox
ssh root@$PROXMOX_HOST "
    # Check if backup job already exists
    if ! pvesh get /cluster/backup | grep -q \"vmid.*$CTID\"; then
        # Create new backup job
        pvesh create /cluster/backup \
            --vmid $CTID \
            --storage $BACKUP_STORAGE \
            --schedule 'daily' \
            --starttime '$BACKUP_TIME' \
            --mode snapshot \
            --compress zstd \
            --prune-backups '$BACKUP_RETENTION' \
            --enabled 1
        
        echo \"✓ Backup job created\"
    else
        echo \"✓ Backup job already exists\"
    fi
"

echo "✓ Backup configured"
echo "  - Schedule: Daily at $BACKUP_TIME"
echo "  - Storage: $BACKUP_STORAGE"
echo "  - Retention: $BACKUP_RETENTION"
echo "  - Mode: Snapshot with zstd compression"
