import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TaskSpeedometer } from './TaskSpeedometer';

describe('TaskSpeedometer component', () => {
  it('renders tokens per second and total tokens formatted', () => {
    render(
      <TaskSpeedometer
        tokensPerSec={45.2}
        totalTokens={12400}
        elapsedSec={30}
        model="claude-3-5-haiku"
      />
    );

    expect(screen.getByText(/45\.2 t\/s/i)).toBeInTheDocument();
    expect(screen.getByText(/12\.4k tok/i)).toBeInTheDocument();
  });

  it('displays free cost for local models', () => {
    render(
      <TaskSpeedometer
        tokensPerSec={62.0}
        totalTokens={8000}
        elapsedSec={15}
        model="unsloth/Qwen3.5-4B-MTP-GGUF"
      />
    );

    expect(screen.getByText(/0 zł \(Lokalny\)/i)).toBeInTheDocument();
  });

  it('displays estimated USD cost for commercial cloud models', () => {
    render(
      <TaskSpeedometer
        tokensPerSec={25.0}
        totalTokens={50000}
        elapsedSec={40}
        model="claude-3-7-sonnet"
        estimatedCostUsd={0.15}
      />
    );

    expect(screen.getByText(/\$0\.1500/i)).toBeInTheDocument();
  });

  it('shows warning alert when context exceeds 80% threshold', () => {
    render(
      <TaskSpeedometer
        tokensPerSec={30.0}
        totalTokens={6500}
        elapsedSec={20}
        model="qwen-8k"
        maxContextTokens={8000}
      />
    );

    expect(screen.getByText(/81% okna/i)).toBeInTheDocument();
    expect(screen.getByTitle(/wysokie zużycie kontekstu/i)).toBeInTheDocument();
  });
});
