#!/usr/bin/env node

import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  CallToolRequest,
} from '@modelcontextprotocol/sdk/types.js';
import { ProxmoxClient } from './proxmox-client.js';
import { WMACSGuardian } from './wmacs-guardian.js';

class ProxmoxMCPServer {
  private server: Server;
  private proxmoxClient: ProxmoxClient;
  private guardian: WMACSGuardian;

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
    this.guardian = new WMACSGuardian();
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
          {
            name: 'guarded_execute',
            description: 'Execute commands with automatic deadlock detection and recovery using WMACS Guardian',
            inputSchema: {
              type: 'object',
              properties: {
                command: {
                  type: 'string',
                  description: 'Command to execute with guardian protection',
                },
                maxRetries: {
                  type: 'number',
                  description: 'Maximum retry attempts (default: 3)',
                },
                timeoutMs: {
                  type: 'number',
                  description: 'Timeout in milliseconds (default: 30000)',
                },
              },
              required: ['command'],
            },
          },
          {
            name: 'start_application',
            description: 'Start application on container with guardian protection',
            inputSchema: {
              type: 'object',
              properties: {
                container: {
                  type: 'string',
                  description: 'Container ID (e.g., "134")',
                },
                port: {
                  type: 'number',
                  description: 'Port number (default: 3001)',
                },
              },
              required: ['container'],
            },
          },
          {
            name: 'ssh_execute',
            description: 'Execute SSH command with guardian protection',
            inputSchema: {
              type: 'object',
              properties: {
                host: {
                  type: 'string',
                  description: 'Host IP address',
                },
                command: {
                  type: 'string',
                  description: 'Command to execute via SSH',
                },
              },
              required: ['host', 'command'],
            },
          },
          {
            name: 'restart_container',
            description: 'Restart Proxmox container with guardian protection',
            inputSchema: {
              type: 'object',
              properties: {
                containerId: {
                  type: 'string',
                  description: 'Container ID to restart',
                },
              },
              required: ['containerId'],
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
          
          case 'guarded_execute':
            return await this.handleGuardedExecute(
              typedArgs?.command as string,
              typedArgs?.maxRetries as number,
              typedArgs?.timeoutMs as number
            );
          
          case 'start_application':
            return await this.handleStartApplication(
              typedArgs?.container as string,
              typedArgs?.port as number
            );
          
          case 'ssh_execute':
            return await this.handleSSHExecute(
              typedArgs?.host as string,
              typedArgs?.command as string
            );
          
          case 'restart_container':
            return await this.handleRestartContainer(typedArgs?.containerId as string);
          
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

  private async handleGuardedExecute(command: string, maxRetries?: number, timeoutMs?: number) {
    if (!command) {
      throw new Error('Command is required');
    }
    
    const options: any = {};
    if (maxRetries !== undefined) options.maxRetries = maxRetries;
    if (timeoutMs !== undefined) options.timeoutMs = timeoutMs;
    
    const result = await this.guardian.guardedExecute(command, options);
    return {
      content: [
        {
          type: 'text',
          text: `Command executed successfully:\n${JSON.stringify(result, null, 2)}`,
        },
      ],
    };
  }

  private async handleStartApplication(container: string, port?: number) {
    if (!container) {
      throw new Error('Container ID is required');
    }
    
    const result = await this.guardian.startApplication(container, port);
    return {
      content: [
        {
          type: 'text',
          text: `Application started successfully on container ${container}`,
        },
      ],
    };
  }

  private async handleSSHExecute(host: string, command: string) {
    if (!host || !command) {
      throw new Error('Host and command are required');
    }
    
    const result = await this.guardian.executeSSH(host, command);
    return {
      content: [
        {
          type: 'text',
          text: `SSH command executed successfully:\n${JSON.stringify(result, null, 2)}`,
        },
      ],
    };
  }

  private async handleRestartContainer(containerId: string) {
    if (!containerId) {
      throw new Error('Container ID is required');
    }
    
    const result = await this.guardian.restartContainer(containerId);
    return {
      content: [
        {
          type: 'text',
          text: `Container ${containerId} restarted successfully`,
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
