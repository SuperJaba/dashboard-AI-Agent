import test from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

test('sys-info.js: exists and returns complete system metrics', () => {
  const scriptPath = path.resolve(process.cwd(), 'scripts/sys-info.js');
  assert.ok(fs.existsSync(scriptPath), 'sys-info.js should exist');

  const output = execSync(`node "${scriptPath}"`, { encoding: 'utf-8' });
  const data = JSON.parse(output);

  assert.strictEqual(typeof data.uptimeHours, 'number');
  assert.ok(data.cpu && typeof data.cpu.cores === 'number');
  assert.ok(data.memory && typeof data.memory.total === 'string');
  assert.ok(data.disk && typeof data.disk.usagePercent === 'string');
  assert.ok(Array.isArray(data.topProcesses));
});

test('sys-info.js: --compact flag outputs single-line JSON', () => {
  const scriptPath = path.resolve(process.cwd(), 'scripts/sys-info.js');
  const output = execSync(`node "${scriptPath}" --compact`, { encoding: 'utf-8' }).trim();
  assert.ok(!output.includes('\n'), 'Compact output should be single line');

  const data = JSON.parse(output);
  assert.ok(data.cpu);
  assert.ok(data.memory);
});

test('sys-info.js: --mem and --cpu flags return targeted metrics', () => {
  const scriptPath = path.resolve(process.cwd(), 'scripts/sys-info.js');

  const memOutput = execSync(`node "${scriptPath}" --mem`, { encoding: 'utf-8' });
  const memData = JSON.parse(memOutput);
  assert.ok(memData.total && memData.usagePercent);
  assert.strictEqual(memData.cpu, undefined);

  const cpuOutput = execSync(`node "${scriptPath}" --cpu`, { encoding: 'utf-8' });
  const cpuData = JSON.parse(cpuOutput);
  assert.ok(cpuData.cores && cpuData.loadAvg);
  assert.strictEqual(cpuData.memory, undefined);
});

test('ssh-ct8.js: contains CT8 host, key, and devil CLI integrations', () => {
  const scriptPath = path.resolve(process.cwd(), 'scripts/ssh-ct8.js');
  assert.ok(fs.existsSync(scriptPath), 'ssh-ct8.js should exist');

  const content = fs.readFileSync(scriptPath, 'utf-8');
  assert.ok(content.includes('jagger2@s1.ct8.pl') || content.includes('s1.ct8.pl'));
  assert.ok(content.includes('id_ed25519_antigravity'));
  assert.ok(content.includes('devil www list'));
});

test('sys-admin skill: defines on-demand tool documentation and rules', () => {
  const skillPath = path.resolve(process.cwd(), '.agents/skills/sys-admin/SKILL.md');
  assert.ok(fs.existsSync(skillPath), 'sys-admin SKILL.md should exist');

  const content = fs.readFileSync(skillPath, 'utf-8');
  assert.ok(content.includes('name: sys-admin'));
  assert.ok(content.includes('scripts/sys-info.js'));
  assert.ok(content.includes('scripts/ssh-ct8.js'));
});
