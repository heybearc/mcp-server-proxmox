#!/bin/bash
#
# Monitoring Installation Script
# Installs node_exporter and promtail on a container
#

set -euo pipefail

CTID="$1"
CONTAINER_NAME="$2"

PROXMOX_HOST="${PROXMOX_HOST:-10.92.0.5}"
LOKI_URL="${LOKI_URL:-http://10.92.3.2:3100}"

echo "Installing monitoring agents on CT$CTID..."

# Install node_exporter
ssh root@$PROXMOX_HOST "pct exec $CTID -- bash -c '
    apt-get update -qq
    apt-get install -y -qq wget tar > /dev/null 2>&1
    
    # Download and install node_exporter
    cd /tmp
    wget -q https://github.com/prometheus/node_exporter/releases/download/v1.7.0/node_exporter-1.7.0.linux-amd64.tar.gz
    tar xzf node_exporter-1.7.0.linux-amd64.tar.gz
    mv node_exporter-1.7.0.linux-amd64/node_exporter /usr/local/bin/
    rm -rf node_exporter-1.7.0.linux-amd64*
    
    # Create systemd service
    cat > /etc/systemd/system/node_exporter.service << EOF
[Unit]
Description=Node Exporter
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/node_exporter
Restart=always

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl daemon-reload
    systemctl enable node_exporter
    systemctl start node_exporter
    
    echo \"✓ node_exporter installed and running on port 9100\"
'"

# Install promtail
ssh root@$PROXMOX_HOST "pct exec $CTID -- bash -c '
    cd /tmp
    wget -q https://github.com/grafana/loki/releases/download/v2.9.3/promtail-linux-amd64.zip
    unzip -q promtail-linux-amd64.zip
    mv promtail-linux-amd64 /usr/local/bin/promtail
    chmod +x /usr/local/bin/promtail
    rm promtail-linux-amd64.zip
    
    # Create promtail config
    mkdir -p /etc/promtail
    cat > /etc/promtail/config.yml << EOF
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: $LOKI_URL/loki/api/v1/push

scrape_configs:
  - job_name: system
    static_configs:
      - targets:
          - localhost
        labels:
          job: varlogs
          host: $CONTAINER_NAME
          __path__: /var/log/*log
EOF
    
    # Create systemd service
    cat > /etc/systemd/system/promtail.service << EOF
[Unit]
Description=Promtail
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/promtail -config.file=/etc/promtail/config.yml
Restart=always

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl daemon-reload
    systemctl enable promtail
    systemctl start promtail
    
    echo \"✓ promtail installed and running\"
'"

echo "✓ Monitoring agents installed successfully"
echo "  - node_exporter: http://<container-ip>:9100/metrics"
echo "  - promtail: shipping logs to $LOKI_URL"
