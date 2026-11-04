import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FormField } from '../components/FormField';

describe('FormField Component', () => {
  it('renderuje etykietę oraz pole potomne', () => {
    render(
      <FormField label="Nazwa użytkownika" htmlFor="username">
        <input id="username" placeholder="Wprowadź nazwę" />
      </FormField>
    );

    expect(screen.getByLabelText('Nazwa użytkownika')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Wprowadź nazwę')).toBeInTheDocument();
  });

  it('renderuje znacznik wymaganego pola przy required=true', () => {
    render(
      <FormField label="Hasło" htmlFor="password" required>
        <input id="password" type="password" />
      </FormField>
    );

    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('renderuje komunikat błędu z rolą alert', () => {
    render(
      <FormField label="Email" htmlFor="email" error="Nieprawidłowy adres email">
        <input id="email" />
      </FormField>
    );

    const alertEl = screen.getByRole('alert');
    expect(alertEl).toBeInTheDocument();
    expect(alertEl).toHaveTextContent('Nieprawidłowy adres email');
  });

  it('renderuje podpowiedź (hint) gdy brak błędu', () => {
    render(
      <FormField label="Klucz API" hint="Wprowadź klucz zaczynający się od sk_live">
        <input />
      </FormField>
    );

    expect(screen.getByText('Wprowadź klucz zaczynający się od sk_live')).toBeInTheDocument();
  });

  it('ukrywa podpowiedź (hint) gdy występuje błąd', () => {
    render(
      <FormField
        label="Klucz API"
        hint="Podpowiedź pomocnicza"
        error="Klucz wygasł"
      >
        <input />
      </FormField>
    );

    expect(screen.queryByText('Podpowiedź pomocnicza')).not.toBeInTheDocument();
    expect(screen.getByText('Klucz wygasł')).toBeInTheDocument();
  });
});
