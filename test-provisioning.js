#!/usr/bin/env node

import { ProvisioningManager } from './dist/provisioning-manager.js';

const manager = new ProvisioningManager();

const spec = {
  name: 'scrypted-nvr',
  function: 'utility',
  ip: '10.92.3.15',
  memory: 4096,
  cores: 2,
  disk: 32,
  privileged: true,
  skipNetbox: true,
  skipNpm: true,
  skipDns: true,
  skipMonitoring: true,
  skipBackup: true,
};

console.log('Testing container provisioning via MCP ProvisioningManager...\n');
console.log('Spec:', JSON.stringify(spec, null, 2));
console.log('\nValidating spec...');

const validation = manager.validateSpec(spec);
if (!validation.valid) {
  console.error('Validation failed:', validation.errors);
  process.exit(1);
}

console.log('✓ Spec valid\n');
console.log('Provisioning container...\n');

console.log('Note: Auto-confirming deployment prompt...\n');

manager.provisionContainer(spec)
  .then(result => {
    console.log('\n=== Result ===');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('\n✅ Container provisioned successfully via MCP!');
      console.log(`CTID: ${result.ctid}`);
      console.log(`IP: ${result.ip}`);
    }
    
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('Error:', error.message);
    process.exit(1);
  });
