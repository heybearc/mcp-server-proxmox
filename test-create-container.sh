#!/bin/bash
#
# Test script for MCP create_container tool
#

cd /Users/cory/Projects/mcp-server-proxmox

# Send create_container request via MCP protocol
echo '{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "create_container",
    "arguments": {
      "name": "scrypted-nvr",
      "function": "utility",
      "ip": "10.92.3.15",
      "memory": 4096,
      "cores": 2,
      "disk": 32,
      "privileged": true
    }
  }
}' | node dist/index.js
