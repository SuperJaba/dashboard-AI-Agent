import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal } from '../components/Modal';

describe('Modal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    title: 'Tytuł Modalu',
    children: <div>Przykładowa treść modalu</div>,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.style.overflow = '';
  });

  it('1. Renderuje treść i tytuł gdy isOpen=true', () => {
    render(<Modal {...defaultProps} />);

    expect(screen.getByText('Tytuł Modalu')).toBeInTheDocument();
    expect(screen.getByText('Przykładowa treść modalu')).toBeInTheDocument();
  });

  it('2. Nie renderuje nic gdy isOpen=false', () => {
    const { container } = render(
      <Modal {...defaultProps} isOpen={false} />
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText('Tytuł Modalu')).not.toBeInTheDocument();
    expect(screen.queryByText('Przykładowa treść modalu')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('3. Wywołuje onClose po kliknięciu przycisku zamknięcia (X)', () => {
    const onClose = vi.fn();
    render(<Modal {...defaultProps} onClose={onClose} />);

    const closeButton = screen.getByRole('button', { name: 'Zamknij' });
    expect(closeButton).toBeInTheDocument();

    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('4. Wywołuje onClose po naciśnięciu klawisza Escape', () => {
    const onClose = vi.fn();
    render(<Modal {...defaultProps} onClose={onClose} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('nie wywołuje onClose po naciśnięciu innego klawisza niż Escape', () => {
    const onClose = vi.fn();
    render(<Modal {...defaultProps} onClose={onClose} />);

    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('5. Posiada atrybuty role="dialog" i aria-modal="true"', () => {
    render(<Modal {...defaultProps} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    // aria-labelledby wskazuje na nagłówek
    const labelledById = dialog.getAttribute('aria-labelledby');
    expect(labelledById).toBeTruthy();

    const titleElement = screen.getByText('Tytuł Modalu');
    expect(titleElement).toHaveAttribute('id', labelledById);
  });

  it('wywołuje onClose po kliknięciu w tło (backdrop)', () => {
    const onClose = vi.fn();
    render(<Modal {...defaultProps} onClose={onClose} />);

    const backdrop = screen.getByTestId('modal-backdrop');
    fireEvent.click(backdrop);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('nie wywołuje onClose po kliknięciu wewnątrz zawartości modalu', () => {
    const onClose = vi.fn();
    render(<Modal {...defaultProps} onClose={onClose} />);

    const modalContent = screen.getByText('Przykładowa treść modalu');
    fireEvent.click(modalContent);

    expect(onClose).not.toHaveBeenCalled();
  });

  it('renderuje opcjonalną ikonę oraz stopkę (footer)', () => {
    render(
      <Modal
        {...defaultProps}
        icon={<span data-testid="modal-icon">★</span>}
        footer={<button type="button">Zapisz</button>}
      />
    );

    expect(screen.getByTestId('modal-icon')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zapisz' })).toBeInTheDocument();
  });

  it('zarządza blokowaniem scrollowania w document.body', () => {
    const { unmount } = render(<Modal {...defaultProps} isOpen={true} />);
    expect(document.body.style.overflow).toBe('hidden');

    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('obsługuje focus trap i zapętla nawigację klawiszem Tab', () => {
    render(
      <Modal
        {...defaultProps}
        footer={<button type="button">Zapisz</button>}
      >
        <input type="text" placeholder="Wpisz nazwę" />
      </Modal>
    );

    const closeBtn = screen.getByRole('button', { name: 'Zamknij' });
    const _input = screen.getByPlaceholderText('Wpisz nazwę');
    const saveBtn = screen.getByRole('button', { name: 'Zapisz' });

    // Focus na ostatnim elemencie i Tab -> powinien przeskoczyć na pierwszy
    saveBtn.focus();
    expect(document.activeElement).toBe(saveBtn);

    fireEvent.keyDown(window, { key: 'Tab', shiftKey: false });
    expect(document.activeElement).toBe(closeBtn);

    // Focus na pierwszym elemencie i Shift+Tab -> powinien przeskoczyć na ostatni
    closeBtn.focus();
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(saveBtn);
  });
});
