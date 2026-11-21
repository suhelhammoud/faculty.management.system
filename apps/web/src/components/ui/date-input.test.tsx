import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateInput, formatDate, parseDate } from './date-input';

describe('shared date controls', () => {
  it('formats ISO dates without shifting the day and rejects impossible dates', () => {
    expect(formatDate('2026-11-17')).toBe('17/11/2026');
    expect(parseDate('29/02/2024')).toBe('2024-02-29');
    expect(parseDate('29/02/2026')).toBeNull();
    expect(parseDate('31/04/2026')).toBeNull();
    expect(parseDate('12/31/2026')).toBeNull();
    expect(parseDate('17/11/2026 23:59', true)).toBe('2026-11-17T23:59');
    expect(parseDate('17/11/2026 24:00', true)).toBeNull();
  });

  it('keeps typed and calendar values in sync and clears validation after selection', () => {
    function Example() {
      const [value, setValue] = useState('2026-11-17');
      return (
        <>
          <DateInput aria-label="Birth date" value={value} onValueChange={setValue} />
          <output>{value}</output>
        </>
      );
    }
    const { container } = render(<Example />);
    const field = screen.getByRole('textbox', { name: 'Birth date' });
    expect(field).toHaveValue('17/11/2026');
    fireEvent.change(field, { target: { value: '01/12/2026' } });
    expect(container.querySelector('output')).toHaveTextContent('2026-12-01');
    fireEvent.change(field, { target: { value: '31/02/2026' } });
    expect(field).toBeInvalid();
    fireEvent.change(container.querySelector('input[type=date]')!, {
      target: { value: '2026-12-25' },
    });
    expect(field).toHaveValue('25/12/2026');
    expect(field).toBeValid();
    fireEvent.change(field, { target: { value: '' } });
    expect(container.querySelector('output')).toBeEmptyDOMElement();
  });
  it('opens the calendar from a keyboard-accessible button and falls back when blocked', async () => {
    const user = userEvent.setup();
    const { container } = render(<DateInput aria-label="Date" value="" onValueChange={() => {}} />);
    const native = container.querySelector<HTMLInputElement>('input[type=date]')!;
    const showPicker = vi.fn();
    native.showPicker = showPicker;
    const button = screen.getByRole('button', { name: 'Choose date' });
    expect(button).toHaveAttribute('type', 'button');
    await user.tab();
    expect(screen.getByRole('textbox', { name: 'Date' })).toHaveFocus();
    await user.tab();
    expect(button).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(showPicker).toHaveBeenCalledOnce();
    native.showPicker = () => {
      throw new DOMException('Blocked', 'SecurityError');
    };
    fireEvent.click(button);
    expect(screen.getByRole('textbox', { name: 'Date' })).toHaveFocus();
  });

  it('disables calendar selection for read-only fields and disabled fieldsets', () => {
    const { rerender } = render(<DateInput value="2026-11-17" readOnly onValueChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Choose date' })).toBeDisabled();
    rerender(
      <fieldset disabled>
        <DateInput value="2026-11-17" onValueChange={() => {}} />
      </fieldset>,
    );
    expect(screen.getByRole('button', { name: 'Choose date' })).toBeDisabled();
    expect(screen.getByRole('textbox')).toBeDisabled();
  });
});
