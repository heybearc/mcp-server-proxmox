import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class WMACSGuardian {
  async guardedExecute(command: string, options?: any): Promise<any> {
    const { stdout, stderr } = await execAsync(command);
    return { stdout, stderr, success: true };
  }

  async startApplication(container: string, port?: number): Promise<any> {
    const actualPort = port || 3001;
    const command = `ssh root@10.92.0.5 "pct exec ${container} -- pm2 start /app/ecosystem.config.js"`;
    return this.guardedExecute(command);
  }

  async executeSSH(host: string, command: string): Promise<any> {
    const sshCommand = `ssh root@${host} "${command}"`;
    return this.guardedExecute(sshCommand);
  }

  async restartContainer(containerId: string): Promise<any> {
    const command = `ssh root@10.92.0.5 "pct restart ${containerId}"`;
    return this.guardedExecute(command);
  }
}
