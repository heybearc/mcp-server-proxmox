#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  CallToolRequest,
} from '@modelcontextprotocol/sdk/types.js';
import { ProxmoxClient } from './proxmox-client';

class ProxmoxMCPServer {
  private server: Server;
  private proxmoxClient: ProxmoxClient;

  constructor() {
    this.server = new Server(
      {
        name: 'mcp-server-proxmox',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.proxmoxClient = new ProxmoxClient();
    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'list_nodes',
            description: 'List all Proxmox nodes in the cluster',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'list_vms',
            description: 'List virtual machines on a specific node or all nodes',
            inputSchema: {
              type: 'object',
              properties: {
                node: {
                  type: 'string',
                  description: 'Node name (optional, lists VMs from all nodes if not specified)',
                },
              },
            },
          },
          {
            name: 'list_containers',
            description: 'List LXC containers on a specific node or all nodes',
            inputSchema: {
              type: 'object',
              properties: {
                node: {
                  type: 'string',
                  description: 'Node name (optional, lists containers from all nodes if not specified)',
                },
              },
            },
          },
          {
            name: 'get_vm_status',
            description: 'Get detailed status information for a specific VM',
            inputSchema: {
              type: 'object',
              properties: {
                node: {
                  type: 'string',
                  description: 'Node name where the VM is located',
                },
                vmid: {
                  type: 'string',
                  description: 'VM ID',
                },
              },
              required: ['node', 'vmid'],
            },
          },
          {
            name: 'start_vm',
            description: 'Start a virtual machine',
            inputSchema: {
              type: 'object',
              properties: {
                node: {
                  type: 'string',
                  description: 'Node name where the VM is located',
                },
                vmid: {
                  type: 'string',
                  description: 'VM ID',
                },
              },
              required: ['node', 'vmid'],
            },
          },
          {
            name: 'stop_vm',
            description: 'Stop a virtual machine',
            inputSchema: {
              type: 'object',
              properties: {
                node: {
                  type: 'string',
                  description: 'Node name where the VM is located',
                },
                vmid: {
                  type: 'string',
                  description: 'VM ID',
                },
              },
              required: ['node', 'vmid'],
            },
          },
          {
            name: 'get_node_status',
            description: 'Get detailed status information for a Proxmox node',
            inputSchema: {
              type: 'object',
              properties: {
                node: {
                  type: 'string',
                  description: 'Node name',
                },
              },
              required: ['node'],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
      const { name, arguments: args } = request.params;
      const typedArgs = args as Record<string, unknown> | undefined;

      try {
        switch (name) {
          case 'list_nodes':
            return await this.handleListNodes();
          
          case 'list_vms':
            return await this.handleListVMs(typedArgs?.node as string | undefined);
          
          case 'list_containers':
            return await this.handleListContainers(typedArgs?.node as string | undefined);
          
          case 'get_vm_status':
            return await this.handleGetVMStatus(typedArgs?.node as string, typedArgs?.vmid as string);
          
          case 'start_vm':
            return await this.handleStartVM(typedArgs?.node as string, typedArgs?.vmid as string);
          
          case 'stop_vm':
            return await this.handleStopVM(typedArgs?.node as string, typedArgs?.vmid as string);
          
          case 'get_node_status':
            return await this.handleGetNodeStatus(typedArgs?.node as string);
          
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          `Error executing tool ${name}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  private async handleListNodes() {
    const nodes = await this.proxmoxClient.listNodes();
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(nodes, null, 2),
        },
      ],
    };
  }

  private async handleListVMs(node?: string) {
    const vms = await this.proxmoxClient.listVMs(node);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(vms, null, 2),
        },
      ],
    };
  }

  private async handleListContainers(node?: string) {
    const containers = await this.proxmoxClient.listContainers(node);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(containers, null, 2),
        },
      ],
    };
  }

  private async handleGetVMStatus(node: string, vmid: string) {
    if (!node || !vmid) {
      throw new Error('Node and VMID are required');
    }
    const status = await this.proxmoxClient.getVMStatus(node, vmid);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(status, null, 2),
        },
      ],
    };
  }

  private async handleStartVM(node: string, vmid: string) {
    if (!node || !vmid) {
      throw new Error('Node and VMID are required');
    }
    const result = await this.proxmoxClient.startVM(node, vmid);
    return {
      content: [
        {
          type: 'text',
          text: `VM ${vmid} start command sent. Task ID: ${result.data}`,
        },
      ],
    };
  }

  private async handleStopVM(node: string, vmid: string) {
    if (!node || !vmid) {
      throw new Error('Node and VMID are required');
    }
    const result = await this.proxmoxClient.stopVM(node, vmid);
    return {
      content: [
        {
          type: 'text',
          text: `VM ${vmid} stop command sent. Task ID: ${result.data}`,
        },
      ],
    };
  }

  private async handleGetNodeStatus(node: string) {
    if (!node) {
      throw new Error('Node name is required');
    }
    const status = await this.proxmoxClient.getNodeStatus(node);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(status, null, 2),
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Proxmox MCP server running on stdio');
  }
}

const server = new ProxmoxMCPServer();
server.run().catch(console.error);
