import { useRef, type ComponentProps } from 'react';

/** Format date-only strings without timezone conversion. */
export function formatDate(value: string) {
  return value.replace(/^(\d{4})-(\d{2})-(\d{2})(?=$|T)/, '$3/$2/$1').replace('T', ' ');
}

export function parseDate(value: string, withTime = false) {
  const match = value.match(
    withTime ? /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/ : /^(\d{2})\/(\d{2})\/(\d{4})$/,
  );
  if (!match) return null;
  const [, day, month, year, hour, minute] = match;
  const iso = `${year}-${month}-${day}`;
  const date = new Date(`${iso}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== iso) return null;
  if (withTime && (Number(hour) > 23 || Number(minute) > 59)) return null;
  return withTime ? `${iso}T${hour}:${minute}` : iso;
}

type Props = Omit<ComponentProps<'input'>, 'type' | 'value' | 'onChange'> & {
  value: string;
  onValueChange: (value: string) => void;
  withTime?: boolean;
};

/** Explicit display format with ISO values for APIs and the browser calendar. */
export function DateInput({ value, onValueChange, withTime = false, style, ...props }: Props) {
  const picker = useRef<HTMLInputElement>(null);
  const text = useRef<HTMLInputElement>(null);
  const displayed = formatDate(value);
  const valid = !value || parseDate(displayed, withTime) !== null;
  return (
    <span
      style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, position: 'relative' }}
    >
      <input
        {...props}
        type="text"
        ref={(input) => {
          text.current = input;
          input?.setCustomValidity(valid ? '' : 'Use a valid date in dd/mm/yyyy format.');
        }}
        dir="ltr"
        value={displayed}
        placeholder={withTime ? 'dd/mm/yyyy hh:mm' : 'dd/mm/yyyy'}
        maxLength={withTime ? 16 : 10}
        aria-invalid={props['aria-invalid'] || !valid}
        style={{ ...style, minWidth: 0, flex: 1 }}
        onChange={(event) => {
          const raw = event.target.value;
          event.target.setCustomValidity(
            raw && !parseDate(raw, withTime) ? 'Use a valid date in dd/mm/yyyy format.' : '',
          );
          onValueChange(parseDate(raw, withTime) ?? raw);
        }}
      />
      <button
        type="button"
        aria-label="Choose date"
        disabled={props.disabled || props.readOnly}
        style={{ flexShrink: 0, padding: 6, cursor: 'pointer' }}
        onClick={() => {
          try {
            if (picker.current?.showPicker) picker.current.showPicker();
            else text.current?.focus();
          } catch {
            // Embedded browsers can disallow native pickers; typed input remains available.
            text.current?.focus();
          }
        }}
      >
        <span aria-hidden="true">▦</span>
      </button>
      <input
        ref={picker}
        type={withTime ? 'datetime-local' : 'date'}
        aria-hidden="true"
        tabIndex={-1}
        disabled={props.disabled || props.readOnly}
        value={valid ? value : ''}
        style={{
          position: 'absolute',
          insetInlineEnd: 0,
          bottom: 0,
          opacity: 0,
          width: 1,
          height: 1,
          pointerEvents: 'none',
        }}
        onChange={(event) => onValueChange(event.target.value)}
      />
    </span>
  );
}
