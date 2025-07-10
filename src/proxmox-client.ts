import axios, { AxiosInstance } from 'axios';
import https from 'https';

export interface ProxmoxConfig {
  host: string;
  port?: number;
  username: string;
  password?: string;
  token?: string;
  tokenName?: string;
  realm?: string;
  verifySSL?: boolean;
}

export interface ProxmoxNode {
  node: string;
  status: string;
  cpu: number;
  maxcpu: number;
  mem: number;
  maxmem: number;
  disk: number;
  maxdisk: number;
  uptime: number;
}

export interface ProxmoxVM {
  vmid: number;
  name: string;
  status: string;
  node: string;
  cpu: number;
  cpus: number;
  mem: number;
  maxmem: number;
  disk: number;
  maxdisk: number;
  uptime?: number;
}

export interface ProxmoxContainer {
  vmid: number;
  name: string;
  status: string;
  node: string;
  cpu: number;
  cpus: number;
  mem: number;
  maxmem: number;
  disk: number;
  maxdisk: number;
  uptime?: number;
}

export class ProxmoxClient {
  private client: AxiosInstance;
  private config: ProxmoxConfig;
  private ticket?: string;
  private csrfToken?: string;

  constructor(config?: ProxmoxConfig) {
    // Default configuration - can be overridden by environment variables
    this.config = {
      host: process.env.PROXMOX_HOST || 'localhost',
      port: parseInt(process.env.PROXMOX_PORT || '8006'),
      username: process.env.PROXMOX_USERNAME || 'root',
      password: process.env.PROXMOX_PASSWORD,
      token: process.env.PROXMOX_TOKEN,
      tokenName: process.env.PROXMOX_TOKEN_NAME,
      realm: process.env.PROXMOX_REALM || 'pam',
      verifySSL: process.env.PROXMOX_VERIFY_SSL !== 'false',
      ...config,
    };

    this.client = axios.create({
      baseURL: `https://${this.config.host}:${this.config.port}/api2/json`,
      timeout: 30000,
      httpsAgent: new https.Agent({
        rejectUnauthorized: this.config.verifySSL,
      }),
    });

    // Add request interceptor to handle authentication
    this.client.interceptors.request.use(async (config) => {
      if (!this.ticket && !this.config.token) {
        await this.authenticate();
      }

      if (this.config.token && this.config.tokenName) {
        // Use API token authentication
        config.headers.Authorization = `PVEAPIToken=${this.config.username}@${this.config.realm}!${this.config.tokenName}=${this.config.token}`;
      } else if (this.ticket) {
        // Use ticket authentication
        config.headers.Cookie = `PVEAuthCookie=${this.ticket}`;
        if (this.csrfToken) {
          config.headers.CSRFPreventionToken = this.csrfToken;
        }
      }

      return config;
    });
  }

  private async authenticate(): Promise<void> {
    if (!this.config.password) {
      throw new Error('Password is required for authentication when not using API token');
    }

    try {
      const response = await axios.post(
        `https://${this.config.host}:${this.config.port}/api2/json/access/ticket`,
        {
          username: `${this.config.username}@${this.config.realm}`,
          password: this.config.password,
        },
        {
          httpsAgent: new https.Agent({
            rejectUnauthorized: this.config.verifySSL,
          }),
        }
      );

      this.ticket = response.data.data.ticket;
      this.csrfToken = response.data.data.CSRFPreventionToken;
    } catch (error) {
      throw new Error(`Authentication failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async listNodes(): Promise<ProxmoxNode[]> {
    try {
      const response = await this.client.get('/nodes');
      return response.data.data;
    } catch (error) {
      throw new Error(`Failed to list nodes: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async listVMs(node?: string): Promise<ProxmoxVM[]> {
    try {
      if (node) {
        const response = await this.client.get(`/nodes/${node}/qemu`);
        return response.data.data;
      } else {
        // List VMs from all nodes
        const nodes = await this.listNodes();
        const allVMs: ProxmoxVM[] = [];
        
        for (const nodeInfo of nodes) {
          try {
            const response = await this.client.get(`/nodes/${nodeInfo.node}/qemu`);
            const vms = response.data.data.map((vm: any) => ({
              ...vm,
              node: nodeInfo.node,
            }));
            allVMs.push(...vms);
          } catch (error) {
            console.error(`Failed to get VMs from node ${nodeInfo.node}:`, error);
          }
        }
        
        return allVMs;
      }
    } catch (error) {
      throw new Error(`Failed to list VMs: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async listContainers(node?: string): Promise<ProxmoxContainer[]> {
    try {
      if (node) {
        const response = await this.client.get(`/nodes/${node}/lxc`);
        return response.data.data;
      } else {
        // List containers from all nodes
        const nodes = await this.listNodes();
        const allContainers: ProxmoxContainer[] = [];
        
        for (const nodeInfo of nodes) {
          try {
            const response = await this.client.get(`/nodes/${nodeInfo.node}/lxc`);
            const containers = response.data.data.map((container: any) => ({
              ...container,
              node: nodeInfo.node,
            }));
            allContainers.push(...containers);
          } catch (error) {
            console.error(`Failed to get containers from node ${nodeInfo.node}:`, error);
          }
        }
        
        return allContainers;
      }
    } catch (error) {
      throw new Error(`Failed to list containers: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getVMStatus(node: string, vmid: string): Promise<any> {
    try {
      const response = await this.client.get(`/nodes/${node}/qemu/${vmid}/status/current`);
      return response.data.data;
    } catch (error) {
      throw new Error(`Failed to get VM status: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async startVM(node: string, vmid: string): Promise<any> {
    try {
      const response = await this.client.post(`/nodes/${node}/qemu/${vmid}/status/start`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to start VM: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async stopVM(node: string, vmid: string): Promise<any> {
    try {
      const response = await this.client.post(`/nodes/${node}/qemu/${vmid}/status/stop`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to stop VM: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getNodeStatus(node: string): Promise<any> {
    try {
      const response = await this.client.get(`/nodes/${node}/status`);
      return response.data.data;
    } catch (error) {
      throw new Error(`Failed to get node status: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getClusterStatus(): Promise<any> {
    try {
      const response = await this.client.get('/cluster/status');
      return response.data.data;
    } catch (error) {
      throw new Error(`Failed to get cluster status: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
