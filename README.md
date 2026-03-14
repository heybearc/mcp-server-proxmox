# MCP Server for Proxmox VE

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-blue)](https://modelcontextprotocol.io/)

A **Model Context Protocol (MCP) server** for **Proxmox Virtual Environment** that enables AI assistants to manage virtual machines, containers, nodes, and resources through natural language interactions.

## 🚀 Features

### Core Proxmox Management
- **Node Management**: List and monitor Proxmox cluster nodes
- **VM Operations**: Start, stop, and monitor virtual machines
- **Container Management**: Manage LXC containers
- **Status Monitoring**: Real-time status information for nodes, VMs, and containers

### 🆕 Full Container Provisioning (v0.2.0)
- **Automated Provisioning**: Create containers with full infrastructure automation
- **Netbox IPAM Integration**: Automatic IP and VM registration
- **NPM Reverse Proxy**: Automatic proxy host creation with SSL
- **DNS Registration**: Automatic AdGuard Home DNS entries
- **Monitoring Setup**: Automatic node_exporter and promtail installation
- **Backup Configuration**: Automatic Proxmox backup scheduling
- **Template Stacks**: Pre-configured templates (media, dev, monitoring)
- **CTID Auto-Assignment**: Intelligent CTID assignment by function

### Infrastructure
- **Secure Authentication**: Support for both password and API token authentication
- **Multi-Node Support**: Works with single nodes or full Proxmox clusters
- **Natural Language**: Deploy infrastructure by talking to AI

## 📋 Prerequisites

- Node.js 18.0.0 or higher
- Proxmox VE 7.0+ with API access
- Valid Proxmox credentials (username/password or API token)

## 🛠️ Installation

### From Source

```bash
git clone https://github.com/heybearc/mcp-server-proxmox.git
cd mcp-server-proxmox
npm install
npm run build
```

### From NPM (Coming Soon)

```bash
npm install -g mcp-server-proxmox
```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file or set the following environment variables:

```bash
# Proxmox Server Configuration
PROXMOX_HOST=your-proxmox-host.com
PROXMOX_PORT=8006
PROXMOX_USERNAME=root
PROXMOX_REALM=pam

# Authentication Method 1: Password
PROXMOX_PASSWORD=your-password

# Authentication Method 2: API Token (Recommended)
PROXMOX_TOKEN=your-api-token
PROXMOX_TOKEN_NAME=your-token-name

# SSL Configuration
PROXMOX_VERIFY_SSL=true
```

### MCP Client Configuration

#### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "proxmox": {
      "command": "node",
      "args": ["/path/to/mcp-server-proxmox/dist/index.js"],
      "env": {
        "PROXMOX_HOST": "your-proxmox-host.com",
        "PROXMOX_USERNAME": "root",
        "PROXMOX_TOKEN": "your-api-token",
        "PROXMOX_TOKEN_NAME": "your-token-name"
      }
    }
  }
}
```

#### Other MCP Clients

Refer to your MCP client's documentation for server configuration.

## 🔧 Available Tools

### Basic Operations
| Tool | Description | Parameters |
|------|-------------|------------|
| `list_nodes` | List all Proxmox nodes | None |
| `list_vms` | List virtual machines | `node` (optional) |
| `list_containers` | List LXC containers | `node` (optional) |
| `get_vm_status` | Get VM status details | `node`, `vmid` |
| `start_vm` | Start a virtual machine | `node`, `vmid` |
| `stop_vm` | Stop a virtual machine | `node`, `vmid` |
| `get_node_status` | Get node status details | `node` |

### 🆕 Provisioning Tools (v0.2.0)
| Tool | Description | Parameters |
|------|-------------|------------|
| `create_container` | Create and fully provision a new LXC container | `name`, `function`, `ip`, `memory`, `cores`, `disk`, `domain`, `port`, `ssl` |
| `provision_stack` | Deploy pre-configured container stack | `stackType`, `name`, `ip`, `domain` |
| `get_available_ctid` | Get next available CTID in function range | `function` |

## 💡 Usage Examples

### With AI Assistant

**Basic Operations:**
```
"Show me all VMs on my Proxmox cluster"
"Start VM 100 on node pve1"
"What's the status of my Proxmox nodes?"
"List all containers on node pve2"
```

**🆕 Provisioning (v0.2.0):**
```
"Create a new media server container with 4GB RAM at 10.92.3.15"
"Deploy a Scrypted NVR container with domain scrypted.cloudigan.net"
"Provision a development environment at 10.92.3.50"
"What's the next available CTID for utility containers?"
```

**Natural Language Examples:**
- "I need a new container for Plex with 8GB RAM and SSL enabled"
- "Create a monitoring stack at 10.92.3.60 with Grafana access"
- "Deploy a dev environment with 2 cores and 32GB disk"

### Direct API Usage

```bash
# Start the server
npm start

# The server communicates via stdio using MCP protocol
```

## 🔐 Security

### API Token Setup (Recommended)

1. Log into Proxmox web interface
2. Go to **Datacenter** → **Permissions** → **API Tokens**
3. Create a new token with appropriate permissions
4. Use the token in your configuration

### Required Permissions

- `VM.Audit` - View VM information
- `VM.PowerMgmt` - Start/stop VMs
- `Sys.Audit` - View node information
- `Datastore.Audit` - View storage information

## 🧪 Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Related Projects

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Proxmox VE API Documentation](https://pve.proxmox.com/pve-docs/api-viewer/)

## 📞 Support

- 🐛 [Report Issues](https://github.com/heybearc/mcp-server-proxmox/issues)
- 💬 [Discussions](https://github.com/heybearc/mcp-server-proxmox/discussions)
- 📧 [Contact](mailto:your-email@example.com)
