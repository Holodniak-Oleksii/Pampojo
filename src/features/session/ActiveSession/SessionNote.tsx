'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { SESSION_NOTE_MAX } from '@/constants/session';

function NoteField({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  id: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1.5">
      <textarea
        id={id}
        rows={5}
        maxLength={SESSION_NOTE_MAX}
        value={value}
        placeholder={t('How did it go, what to change next time')}
        onChange={(event) => onChange(event.target.value)}
        className="resize-none rounded-md bg-input-surface px-3.5 py-3 text-[15px] leading-relaxed text-foreground outline-none placeholder:text-placeholder focus-visible:ring-2 focus-visible:ring-ring"
      />
      <span className="self-end text-[13px] text-muted-foreground tabular-nums">
        {t('{{length}} / {{max}}', { length: value.length, max: SESSION_NOTE_MAX })}
      </span>
    </div>
  );
}

const normalize = (value: string) => (value.trim() === '' ? null : value);

/** Mobile: the note in a bottom sheet, saved when it closes. */
export function NoteSheet({
  open,
  onOpenChange,
  notes,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notes: string | null;
  onSave: (notes: string | null) => void;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState(notes ?? '');
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setValue(notes ?? '');
  }

  const close = () => {
    if (normalize(value) !== notes) onSave(normalize(value));
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <SheetContent
        side="bottom"
        closeLabel={t('Close')}
        aria-describedby={undefined}
        className="gap-3.5 rounded-t-xl bg-card px-4 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-foreground"
      >
        <SheetHeader className="p-0">
          <SheetTitle className="text-xl font-extrabold">
            <label htmlFor="session-note-sheet">{t('Note')}</label>
          </SheetTitle>
        </SheetHeader>
        <NoteField id="session-note-sheet" value={value} onChange={setValue} />
        <Button size="md" onClick={close}>
          {t('Done')}
        </Button>
      </SheetContent>
    </Sheet>
  );
}

/** Desktop: the note inline in the right column, saved on blur. */
export function NotePanel({
  notes,
  onSave,
}: {
  notes: string | null;
  onSave: (notes: string | null) => void;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState(notes ?? '');
  const [savedNotes, setSavedNotes] = useState(notes);
  if (notes !== savedNotes) {
    setSavedNotes(notes);
    setValue(notes ?? '');
  }
  return (
    <div
      className="flex flex-col gap-2"
      onBlur={() => {
        if (normalize(value) !== notes) onSave(normalize(value));
      }}
    >
      <label htmlFor="session-note-panel" className="text-base font-extrabold">
        {t('Note')}
      </label>
      <NoteField id="session-note-panel" value={value} onChange={setValue} />
    </div>
  );
}
