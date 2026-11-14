import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { PreferencesProvider, usePreferences } from '../preferences/PreferencesContext';
import { i18n } from '../i18n';
import plCommon from '../locales/pl/common.json';
import enCommon from '../locales/en/common.json';
import hiCommon from '../locales/hi/common.json';
import plWidgets from '../locales/pl/widgets.json';
import enWidgets from '../locales/en/widgets.json';
import hiWidgets from '../locales/hi/widgets.json';

describe('Translations and i18n Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    act(() => {
      i18n.changeLanguage('pl');
    });
  });

  it('maintains key parity between all locale files', () => {
    const plCommonKeys = Object.keys(plCommon).sort();
    const enCommonKeys = Object.keys(enCommon).sort();
    const hiCommonKeys = Object.keys(hiCommon).sort();

    expect(enCommonKeys).toEqual(plCommonKeys);
    expect(hiCommonKeys).toEqual(plCommonKeys);

    const plWidgetKeys = Object.keys(plWidgets).sort();
    const enWidgetKeys = Object.keys(enWidgets).sort();
    const hiWidgetKeys = Object.keys(hiWidgets).sort();

    expect(enWidgetKeys).toEqual(plWidgetKeys);
    expect(hiWidgetKeys).toEqual(plWidgetKeys);
  });

  it('provides Polish translations by default', async () => {
    let hookResult: any;
    await act(async () => {
      const { result } = renderHook(() => usePreferences(), {
        wrapper: PreferencesProvider,
      });
      hookResult = result;
    });

    expect(hookResult.current.language).toBe('pl');
    expect(hookResult.current.t('sidebar.agents')).toBe('Agenci AI');
    expect(hookResult.current.t('sidebar.users')).toBe('Użytkownicy');
    expect(hookResult.current.t('button.save')).toBe('Zapisz Serwer');
    expect(hookResult.current.t('widget.add')).toBe('Dodaj widget');
    expect(hookResult.current.t('kpi.tasksToday')).toBe('Zadania dziś');
  });

  it('switches seamlessly to English and updates translated strings', async () => {
    const { result } = renderHook(() => usePreferences(), {
      wrapper: PreferencesProvider,
    });

    await act(async () => {
      result.current.setLanguage('en');
    });

    expect(result.current.language).toBe('en');
    expect(result.current.t('sidebar.agents')).toBe('AI Agents');
    expect(result.current.t('sidebar.users')).toBe('Users');
    expect(result.current.t('sidebar.socketTunnel')).toBe('Socket / PC Tunnel');
    expect(result.current.t('button.save')).toBe('Save Server');
    expect(result.current.t('widget.add')).toBe('Add widget');
    expect(result.current.t('widget.name')).toBe('Widget Name');
    expect(result.current.t('kpi.tasksToday')).toBe('Tasks today');
    expect(result.current.t('status.disconnected')).toBe('No connection to server — retrying...');
  });

  it('switches seamlessly to Hindi and updates translated strings', async () => {
    const { result } = renderHook(() => usePreferences(), {
      wrapper: PreferencesProvider,
    });

    await act(async () => {
      result.current.setLanguage('hi');
    });

    expect(result.current.language).toBe('hi');
    expect(result.current.t('sidebar.agents')).toBe('एआई एजेंट');
    expect(result.current.t('sidebar.users')).toBe('उपयोगकर्ता');
    expect(result.current.t('settings.title')).toBe('सेटिंग्स');
    expect(result.current.t('widget.add')).toBe('विजेट जोड़ें');
    expect(result.current.t('kpi.tasksToday')).toBe('आज के कार्य');
  });

  it('falls back gracefully to default value or key when translation is missing', async () => {
    let hookResult: any;
    await act(async () => {
      const { result } = renderHook(() => usePreferences(), {
        wrapper: PreferencesProvider,
      });
      hookResult = result;
    });

    expect(hookResult.current.t('non.existent.key', 'Fallback Label')).toBe('Fallback Label');
    expect(hookResult.current.t('non.existent.key')).toBe('non.existent.key');
  });
});
