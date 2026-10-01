import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { detectTechnology } from './techDetector.js';

describe('detectTechnology', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tech-detect-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns Unknown for non-existent path or empty string', () => {
    expect(detectTechnology('')).toBe('Unknown');
    expect(detectTechnology(path.join(tmpDir, 'non-existent'))).toBe('Unknown');
  });

  it('detects Next.js project', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      dependencies: { next: '^14.0.0', react: '^18.0.0' }
    }));
    expect(detectTechnology(tmpDir)).toBe('Next.js (Node.js)');
  });

  it('detects React / Vite project', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      dependencies: { react: '^18.0.0' },
      devDependencies: { vite: '^5.0.0' }
    }));
    expect(detectTechnology(tmpDir)).toBe('React / Vite');
  });

  it('detects Node.js Express project', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      dependencies: { express: '^4.18.0' }
    }));
    expect(detectTechnology(tmpDir)).toBe('Node.js Express');
  });

  it('detects generic Node.js / JS project', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      dependencies: { lodash: '^4.17.0' }
    }));
    expect(detectTechnology(tmpDir)).toBe('Node.js / JS');
  });

  it('detects Python project', () => {
    fs.writeFileSync(path.join(tmpDir, 'requirements.txt'), 'fastapi\nuvicorn\n');
    expect(detectTechnology(tmpDir)).toBe('Python');
  });

  it('detects Rust project', () => {
    fs.writeFileSync(path.join(tmpDir, 'Cargo.toml'), '[package]\nname = "test"\n');
    expect(detectTechnology(tmpDir)).toBe('Rust');
  });

  it('detects Go project', () => {
    fs.writeFileSync(path.join(tmpDir, 'go.mod'), 'module example.com/test\n');
    expect(detectTechnology(tmpDir)).toBe('Go');
  });
});
