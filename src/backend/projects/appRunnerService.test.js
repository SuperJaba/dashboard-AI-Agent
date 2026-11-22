import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { detectRunCommand, prepareAppRunScript, checkAppRunning, stopApp } from './appRunnerService.js';

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

  it('detects npm run dev when package.json contains scripts.dev without specific lockfile', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ scripts: { dev: 'vite', start: 'vite preview' } })
    );

    const result = detectRunCommand(tmpDir);
    expect(result.command).toBe('npm');
    expect(result.args).toEqual(['run', 'dev']);
    expect(result.type).toBe('npm-dev');
  });

  it('detects pnpm dev when pnpm-lock.yaml is present', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ scripts: { dev: 'vite', start: 'vite preview' } })
    );
    fs.writeFileSync(path.join(tmpDir, 'pnpm-lock.yaml'), '');

    const result = detectRunCommand(tmpDir);
    expect(result.command).toBe('pnpm');
    expect(result.args).toEqual(['dev']);
    expect(result.type).toBe('pnpm-dev');
  });

  it('detects bun dev when bun.lock is present', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ scripts: { dev: 'vite' } })
    );
    fs.writeFileSync(path.join(tmpDir, 'bun.lock'), '');

    const result = detectRunCommand(tmpDir);
    expect(result.command).toBe('bun');
    expect(result.args).toEqual(['run', 'dev']);
    expect(result.type).toBe('bun-dev');
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

  it('detects uvicorn for FastAPI apps in root or backend/app', () => {
    const backendAppDir = path.join(tmpDir, 'backend', 'app');
    fs.mkdirSync(backendAppDir, { recursive: true });
    fs.writeFileSync(path.join(backendAppDir, 'main.py'), 'from fastapi import FastAPI\napp = FastAPI()');

    const result = detectRunCommand(tmpDir);
    expect(result.command).toBe('uvicorn');
    expect(result.args).toEqual(['app.main:app', '--reload', '--port', '8000']);
    expect(result.type).toBe('python-fastapi');
  });

  it('detects streamlit run when streamlit is used', () => {
    fs.writeFileSync(path.join(tmpDir, 'streamlit_app.py'), 'import streamlit as st\nst.write("Dashboard")');

    const result = detectRunCommand(tmpDir);
    expect(result.command).toBe('streamlit');
    expect(result.args).toEqual(['run', 'streamlit_app.py']);
    expect(result.type).toBe('python-streamlit');
  });

  it('detects python entrypoint in ui/main.py (e.g. OBD2-AI)', () => {
    const uiDir = path.join(tmpDir, 'ui');
    fs.mkdirSync(uiDir, { recursive: true });
    fs.writeFileSync(path.join(uiDir, 'main.py'), '# UI runner');
    fs.writeFileSync(path.join(tmpDir, 'requirements.txt'), 'obd==0.7.3\npytest\n');

    const result = detectRunCommand(tmpDir);
    expect(result.command).toBe('python3');
    expect(result.args).toEqual(['ui/main.py']);
    expect(result.type).toBe('python');
  });

  it('detects cargo when Cargo.toml is present', () => {
    fs.writeFileSync(path.join(tmpDir, 'Cargo.toml'), '[package]\nname = "test"');

    const result = detectRunCommand(tmpDir);
    expect(result.command).toBe('cargo');
    expect(result.args).toEqual(['run']);
    expect(result.type).toBe('cargo');
  });

  it('detects docker-compose when docker-compose.yml is present and no app entrypoint exists', () => {
    fs.writeFileSync(path.join(tmpDir, 'docker-compose.yml'), 'version: "3.8"\nservices:\n  web:\n    image: nginx');

    const result = detectRunCommand(tmpDir);
    expect(result.command).toBe('docker');
    expect(result.args).toEqual(['compose', 'up']);
    expect(result.type).toBe('docker-compose');
  });

  it('does not let docker-compose hijack projects with package.json or python scripts', () => {
    fs.writeFileSync(path.join(tmpDir, 'docker-compose.yml'), 'version: "3.8"\nservices:\n  postgres:\n    image: postgres');
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ scripts: { dev: 'vite' } }));

    const result = detectRunCommand(tmpDir);
    expect(result.command).toBe('npm');
    expect(result.args).toEqual(['run', 'dev']);
  });

  it('detects shell script when start.sh is present', () => {
    fs.writeFileSync(path.join(tmpDir, 'start.sh'), '#!/bin/bash\necho "starting"');

    const result = detectRunCommand(tmpDir);
    expect(result.command).toBe('bash');
    expect(result.args).toEqual(['start.sh']);
    expect(result.type).toBe('shell-script');
  });

  it('detects Makefile with run target (e.g. Osintgram)', () => {
    fs.writeFileSync(path.join(tmpDir, 'Makefile'), 'run:\n\tuvicorn src.web.app:app\n');
    fs.writeFileSync(path.join(tmpDir, 'docker-compose.yml'), 'services:\n  test:\n    image: alpine');

    const result = detectRunCommand(tmpDir);
    expect(result.command).toBe('make');
    expect(result.args).toEqual(['run']);
    expect(result.type).toBe('make');
  });

  it('detects subdirectory package.json when present in backend or frontend', () => {
    const backendDir = path.join(tmpDir, 'backend');
    fs.mkdirSync(backendDir, { recursive: true });
    fs.writeFileSync(
      path.join(backendDir, 'package.json'),
      JSON.stringify({ scripts: { dev: 'nodemon server.js' } })
    );

    const result = detectRunCommand(tmpDir);
    expect(result.command).toBe('npm');
    expect(result.args).toEqual(['run', 'dev', '--prefix', 'backend']);
    expect(result.type).toBe('npm-dev-backend');
  });

  it('falls back to bash when no run command is detected', () => {
    const result = detectRunCommand(tmpDir);
    expect(result.command).toBe('bash');
    expect(result.args).toEqual([]);
    expect(result.type).toBe('shell');
  });

  it('generates an executable bash script with virtualenv and PATH exports', () => {
    const scriptPath = prepareAppRunScript(tmpDir, 'npm run dev');
    expect(fs.existsSync(scriptPath)).toBe(true);

    const content = fs.readFileSync(scriptPath, 'utf8');
    expect(content).toContain(`cd "${tmpDir}"`);
    expect(content).toContain('exec npm run dev');
    expect(content).toContain('.venv/bin');
    expect(content).toContain('$HOME/.local/bin');

    // Clean up
    fs.unlinkSync(scriptPath);
  });

  it('includes notice when falling back to bash in prepareAppRunScript', () => {
    const scriptPath = prepareAppRunScript(tmpDir, 'bash');
    expect(fs.existsSync(scriptPath)).toBe(true);

    const content = fs.readFileSync(scriptPath, 'utf8');
    expect(content).toContain('[Workspace Runner]');
    expect(content).toContain('Nie wykryto automatycznego polecenia');
    expect(content).toContain('exec bash');

    fs.unlinkSync(scriptPath);
  });

  it('checks if application is running in directory', () => {
    const emptyResult = checkAppRunning(tmpDir);
    expect(emptyResult.isRunning).toBe(false);
    expect(emptyResult.pids).toEqual([]);
    expect(emptyResult.ports).toEqual([]);

    const invalidResult = checkAppRunning('');
    expect(invalidResult.isRunning).toBe(false);
  });

  it('stops running application cleanly via stopApp', () => {
    const emptyStop = stopApp(tmpDir);
    expect(emptyStop.success).toBe(true);
    expect(emptyStop.killedPids).toEqual([]);

    const invalidStop = stopApp('');
    expect(invalidStop.success).toBe(false);
  });
});
