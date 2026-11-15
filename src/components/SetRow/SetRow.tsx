'use client';

import { Check } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export interface SetRowField {
  key: string;
  ariaLabel: string;
  value: number | null;
  /** Shows a decimal keyboard. */
  decimal: boolean;
  /** Highlight an empty value the row needs before it can be checked. */
  required?: boolean;
  format: (value: number) => string;
  /** `null` for blank; `undefined` when the text is not a number yet. */
  parse: (text: string) => number | null | undefined;
}

export interface SetRowProps {
  /** 1-based number shown in the first column. */
  number: number;
  fields: SetRowField[];
  logged: boolean;
  current: boolean;
  canLog: boolean;
  checkLabel: string;
  onChange: (key: string, value: number | null) => void;
  onToggle: () => void;
}

function Cell({
  field,
  logged,
  onChange,
}: {
  field: SetRowField;
  logged: boolean;
  onChange: (value: number | null) => void;
}) {
  // Local text while typing keeps "77," or "1." visible until it parses.
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? (field.value === null ? '' : field.format(field.value));
  const missing = field.required && field.value === null;
  return (
    <td className="px-1 py-1">
      <input
        aria-label={field.ariaLabel}
        inputMode={field.decimal ? 'decimal' : 'numeric'}
        placeholder="—"
        value={shown}
        onFocus={() => setText(shown)}
        onBlur={() => setText(null)}
        onChange={(event) => {
          setText(event.target.value);
          const parsed = field.parse(event.target.value);
          if (parsed !== undefined) onChange(parsed);
        }}
        className={cn(
          'h-14 w-full min-w-0 rounded-md text-center text-[28px] font-extrabold tabular-nums text-foreground outline-none placeholder:text-placeholder focus-visible:ring-2 focus-visible:ring-ring',
          logged ? 'border border-border bg-transparent' : 'bg-input-surface',
          missing && 'border border-planned',
        )}
      />
    </td>
  );
}

/** One set of the session table: value inputs and the diamond check. */
export function SetRow({
  number,
  fields,
  logged,
  current,
  canLog,
  checkLabel,
  onChange,
  onToggle,
}: SetRowProps) {
  // The click plays when the user checks the set, not for sets restored from storage.
  const [wasLogged, setWasLogged] = useState(logged);
  const [animate, setAnimate] = useState(false);
  if (logged !== wasLogged) {
    setWasLogged(logged);
    setAnimate(logged);
  }

  return (
    <tr>
      <th
        scope="row"
        className={cn(
          'h-16 w-10 text-[15px] tabular-nums',
          current ? 'font-extrabold text-foreground' : 'font-semibold text-muted-foreground',
        )}
      >
        {number}
      </th>
      {fields.map((field) => (
        <Cell
          key={field.key}
          field={field}
          logged={logged}
          onChange={(value) => onChange(field.key, value)}
        />
      ))}
      <td className="w-[60px] py-1 pl-1">
        <button
          type="button"
          aria-label={checkLabel}
          aria-pressed={logged}
          disabled={!logged && !canLog}
          onClick={onToggle}
          className="flex size-14 items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span
            className={cn(
              'flex size-[30px] rotate-45 items-center justify-center rounded-[4px] box-border',
              logged && 'bg-accent',
              animate && 'set-done',
              !logged &&
                canLog &&
                (current ? 'border-2 border-foreground' : 'border-2 border-planned'),
              !logged && !canLog && 'border-2 border-dashed border-disabled-outline',
            )}
          >
            {logged ? (
              <Check
                aria-hidden="true"
                strokeWidth={3}
                className="size-[18px] -rotate-45 text-accent-foreground"
              />
            ) : null}
          </span>
        </button>
      </td>
    </tr>
  );
}
