'use client';

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useLocale } from '@/i18n/client';
import { dayMonth, makeUpTitle } from '../formatPlanDate';

export type MakeUpChoice = 'make_up' | 'plain' | 'cancel';

export interface MakeUpRequest {
  workoutName: string;
  /** The missed date, `YYYY-MM-DD`. */
  date: string;
}

type Ask = (request: MakeUpRequest) => Promise<MakeUpChoice>;

// Without the provider (component tests, screens outside the shell) a start is a plain start.
const MakeUpPromptContext = createContext<Ask>(() => Promise.resolve('plain'));

export function useMakeUpPrompt(): Ask {
  return useContext(MakeUpPromptContext);
}

/** Asks whether a start makes up a missed workout; one dialog for every start path. */
export function MakeUpPromptProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const [request, setRequest] = useState<MakeUpRequest | null>(null);
  const resolver = useRef<((choice: MakeUpChoice) => void) | null>(null);

  const ask = useCallback<Ask>(
    (next) =>
      new Promise((resolve) => {
        resolver.current?.('cancel');
        resolver.current = resolve;
        setRequest(next);
      }),
    [],
  );

  const answer = (choice: MakeUpChoice) => {
    resolver.current?.(choice);
    resolver.current = null;
    setRequest(null);
  };

  return (
    <MakeUpPromptContext.Provider value={ask}>
      {children}
      <ConfirmDialog
        open={request !== null}
        onOpenChange={(open) => {
          if (!open) answer('cancel');
        }}
        stacked
        cancelVariant="ghost"
        title={request ? makeUpTitle(t, request.date, request.workoutName) : ''}
        description={
          request
            ? t(
                '{{name}} was planned for {{date}}. If you make it up now, the calendar shows it as done late.',
                { name: request.workoutName, date: dayMonth(locale, request.date) },
              )
            : ''
        }
        confirmLabel={t('Yes, make it up')}
        cancelLabel={t('No, just a workout')}
        onConfirm={() => answer('make_up')}
        onCancel={() => answer('plain')}
      />
    </MakeUpPromptContext.Provider>
  );
}
