import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { detectRunCommand, prepareAppRunScript } from './appRunnerService.js';

describe('appRunnerService', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'runner-test-'));
  });

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('detects npm run dev when package.json contains scripts.dev', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ scripts: { dev: 'vite', start: 'vite preview' } })
    );

    const result = detectRunCommand(tmpDir);
    expect(result.command).toBe('npm');
    expect(result.args).toEqual(['run', 'dev']);
    expect(result.type).toBe('npm-dev');
  });

  it('detects npm start when package.json only has start script', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ scripts: { start: 'node index.js' } })
    );

    const result = detectRunCommand(tmpDir);
    expect(result.command).toBe('npm');
    expect(result.args).toEqual(['start']);
    expect(result.type).toBe('npm-start');
  });

  it('detects python when main.py is present', () => {
    fs.writeFileSync(path.join(tmpDir, 'main.py'), 'print("hello")');

    const result = detectRunCommand(tmpDir);
    expect(result.command).toBe('python3');
    expect(result.args).toEqual(['main.py']);
    expect(result.type).toBe('python');
  });

  it('detects cargo when Cargo.toml is present', () => {
    fs.writeFileSync(path.join(tmpDir, 'Cargo.toml'), '[package]\nname = "test"');

    const result = detectRunCommand(tmpDir);
    expect(result.command).toBe('cargo');
    expect(result.args).toEqual(['run']);
    expect(result.type).toBe('cargo');
  });

  it('generates an executable bash script via prepareAppRunScript', () => {
    const scriptPath = prepareAppRunScript(tmpDir, 'npm run dev');
    expect(fs.existsSync(scriptPath)).toBe(true);

    const content = fs.readFileSync(scriptPath, 'utf8');
    expect(content).toContain(`cd "${tmpDir}"`);
    expect(content).toContain('exec npm run dev');

    // Clean up
    fs.unlinkSync(scriptPath);
  });
});
