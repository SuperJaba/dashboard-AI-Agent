import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge, type BadgeVariant, type BadgeSize } from '../components/Badge';

describe('Badge Component', () => {
  const variants: BadgeVariant[] = ['primary', 'success', 'warning', 'danger', 'neutral', 'info'];
  const sizes: BadgeSize[] = ['sm', 'md'];

  it('renderuje poprawnie tekst w badge', () => {
    render(<Badge>Aktywny</Badge>);
    expect(screen.getByText('Aktywny')).toBeInTheDocument();
  });

  it.each(variants)('renderuje poprawnie wariant %s', (variant) => {
    render(<Badge variant={variant}>Wariant {variant}</Badge>);
    expect(screen.getByText(`Wariant ${variant}`)).toBeInTheDocument();
  });

  it.each(sizes)('renderuje poprawnie rozmiar %s', (size) => {
    render(<Badge size={size}>Rozmiar {size}</Badge>);
    expect(screen.getByText(`Rozmiar ${size}`)).toBeInTheDocument();
  });

  it('renderuje opcjonalną ikonę', () => {
    render(
      <Badge icon={<span data-testid="badge-icon">●</span>}>
        Ze statusem
      </Badge>
    );
    expect(screen.getByTestId('badge-icon')).toBeInTheDocument();
    expect(screen.getByText('Ze statusem')).toBeInTheDocument();
  });

  it('dodaje niestandardową klasę CSS', () => {
    const { container } = render(<Badge className="custom-test-class">Test</Badge>);
    expect(container.firstChild).toHaveClass('custom-test-class');
  });
});
