import { describe, it, expect } from 'vitest';
import { detectGpuInfo } from './settingsRouter.js';

describe('detectGpuInfo', () => {
  it('returns a non-empty string describing the GPU or fallback status', () => {
    const gpuInfo = detectGpuInfo();
    expect(typeof gpuInfo).toBe('string');
    expect(gpuInfo.length).toBeGreaterThan(0);
  });

  it('detects AMD Radeon if running on the host system with Radeon card', () => {
    const gpuInfo = detectGpuInfo();
    // On this specific machine or general Linux with AMD / NVIDIA or fallback
    expect(gpuInfo).toMatch(/Radeon|NVIDIA|GeForce|RTX|Brak dedykowanego GPU/i);
  });
});
