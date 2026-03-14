import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ContainerSpec {
  name: string;
  function: 'bot' | 'dev' | 'media' | 'core' | 'network' | 'monitoring' | 'storage' | 'security' | 'utility';
  ip: string;
  ctid?: number;
  memory?: number;
  cores?: number;
  disk?: number;
  privileged?: boolean;
  domain?: string;
  port?: number;
  ssl?: boolean;
  skipNetbox?: boolean;
  skipNpm?: boolean;
  skipDns?: boolean;
  skipMonitoring?: boolean;
  skipBackup?: boolean;
}

export interface ProvisioningResult {
  success: boolean;
  ctid: number;
  name: string;
  ip: string;
  domain?: string;
  message: string;
  deploymentRecord?: string;
}

export class ProvisioningManager {
  private scriptsDir: string;

  constructor() {
    this.scriptsDir = path.join(__dirname, 'provisioning');
  }

  /**
   * Provision a new container with full automation
   */
  async provisionContainer(spec: ContainerSpec): Promise<ProvisioningResult> {
    const scriptPath = path.join(this.scriptsDir, 'provision-container.sh');
    
    // Build command arguments
    const args = [
      `--name ${spec.name}`,
      `--function ${spec.function}`,
      `--ip ${spec.ip}`,
      '--yes',
    ];

    if (spec.ctid) args.push(`--ctid ${spec.ctid}`);
    if (spec.memory) args.push(`--memory ${spec.memory}`);
    if (spec.cores) args.push(`--cores ${spec.cores}`);
    if (spec.disk) args.push(`--disk ${spec.disk}`);
    if (spec.privileged) args.push('--privileged');
    if (spec.domain) args.push(`--domain ${spec.domain}`);
    if (spec.port) args.push(`--port ${spec.port}`);
    if (spec.ssl) args.push('--ssl');
    if (spec.skipNetbox) args.push('--no-netbox');
    if (spec.skipNpm) args.push('--no-npm');
    if (spec.skipDns) args.push('--no-dns');
    if (spec.skipMonitoring) args.push('--no-monitoring');
    if (spec.skipBackup) args.push('--no-backup');

    const command = `${scriptPath} ${args.join(' ')}`;

    try {
      // Execute provisioning script
      const { stdout, stderr } = await execAsync(command, {
        env: {
          ...process.env,
          PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
        },
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      // Parse output to extract CTID
      const ctidMatch = stdout.match(/CTID:\s*(\d+)/);
      const ctid = ctidMatch ? parseInt(ctidMatch[1], 10) : spec.ctid || 0;

      // Check for deployment record
      const deploymentRecord = `/tmp/ct${ctid}-deployment.md`;

      return {
        success: true,
        ctid,
        name: spec.name,
        ip: spec.ip,
        domain: spec.domain,
        message: `Container ${spec.name} (CT${ctid}) provisioned successfully`,
        deploymentRecord,
      };
    } catch (error: any) {
      return {
        success: false,
        ctid: 0,
        name: spec.name,
        ip: spec.ip,
        message: `Provisioning failed: ${error.message}\n${error.stderr || ''}`,
      };
    }
  }

  /**
   * Provision a pre-configured stack (template)
   */
  async provisionStack(
    stackType: 'media' | 'dev' | 'monitoring' | 'custom',
    name: string,
    ip: string,
    options?: Partial<ContainerSpec>
  ): Promise<ProvisioningResult> {
    const templates: Record<string, Partial<ContainerSpec>> = {
      media: {
        function: 'media',
        memory: 4096,
        cores: 2,
        disk: 100,
        privileged: false,
      },
      dev: {
        function: 'dev',
        memory: 2048,
        cores: 2,
        disk: 32,
        privileged: false,
      },
      monitoring: {
        function: 'monitoring',
        memory: 4096,
        cores: 2,
        disk: 50,
        privileged: false,
      },
    };

    const template = stackType === 'custom' ? {} : templates[stackType];
    
    const spec: ContainerSpec = {
      name,
      ip,
      function: template.function || 'utility',
      ...template,
      ...options,
    };

    return this.provisionContainer(spec);
  }

  /**
   * Get available CTID in a specific range
   */
  async getAvailableCtid(functionType: ContainerSpec['function']): Promise<number> {
    const ranges: Record<ContainerSpec['function'], [number, number]> = {
      bot: [100, 109],
      dev: [110, 119],
      media: [120, 129],
      core: [130, 139],
      network: [140, 149],
      monitoring: [150, 159],
      storage: [160, 169],
      security: [170, 179],
      utility: [180, 189],
    };

    const [start, end] = ranges[functionType];

    try {
      const { stdout } = await execAsync('ssh root@10.92.0.5 "pct list | awk \'NR>1 {print $1}\' | sort -n"');
      const existingCtids = stdout.trim().split('\n').map(id => parseInt(id, 10));

      for (let ctid = start; ctid <= end; ctid++) {
        if (!existingCtids.includes(ctid)) {
          return ctid;
        }
      }

      throw new Error(`No available CTID in range ${start}-${end}`);
    } catch (error: any) {
      throw new Error(`Failed to get available CTID: ${error.message}`);
    }
  }

  /**
   * Validate container specification
   */
  validateSpec(spec: ContainerSpec): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate name
    if (!spec.name || !/^[a-z0-9-]+$/.test(spec.name)) {
      errors.push('Name must be lowercase alphanumeric with hyphens only');
    }

    // Validate IP
    if (!spec.ip || !/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(spec.ip)) {
      errors.push('Invalid IP address format');
    }

    // Validate function
    const validFunctions = ['bot', 'dev', 'media', 'core', 'network', 'monitoring', 'storage', 'security', 'utility'];
    if (!validFunctions.includes(spec.function)) {
      errors.push(`Function must be one of: ${validFunctions.join(', ')}`);
    }

    // Validate resources
    if (spec.memory && (spec.memory < 512 || spec.memory > 32768)) {
      errors.push('Memory must be between 512MB and 32GB');
    }

    if (spec.cores && (spec.cores < 1 || spec.cores > 16)) {
      errors.push('Cores must be between 1 and 16');
    }

    if (spec.disk && (spec.disk < 8 || spec.disk > 500)) {
      errors.push('Disk must be between 8GB and 500GB');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
