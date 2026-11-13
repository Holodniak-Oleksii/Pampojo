'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useSaveGymMutation } from '@/api/gym';
import { GYM_AUTOSAVE_DEBOUNCE_MS, type GymEquipment } from '@/constants/gym';
import { sameEquipment } from '../utils';

export type AutosaveStatus = 'idle' | 'saving' | 'saved';

/**
 * Debounced PUT of the whole list, one request in flight at a time. A failure restores the last
 * state the server confirmed and drops anything still pending.
 */
export function useGymAutosave(initial: readonly GymEquipment[]) {
  const { t } = useTranslation();
  const { mutateAsync } = useSaveGymMutation();
  const [selected, setSelected] = useState<readonly GymEquipment[]>(initial);
  const [status, setStatus] = useState<AutosaveStatus>('idle');

  const confirmed = useRef(initial);
  const latest = useRef(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const pending = useRef(false);
  const mutateRef = useRef(mutateAsync);
  const errorText = t("Couldn't save your gym. Try again.");
  const errorRef = useRef(errorText);

  useEffect(() => {
    mutateRef.current = mutateAsync;
    errorRef.current = errorText;
  });

  const send = useCallback(async (): Promise<void> => {
    if (inFlight.current) {
      pending.current = true;
      return;
    }
    inFlight.current = true;
    try {
      // Changes that land during a flight are sent right after it, never in parallel.
      for (;;) {
        const sent = latest.current;
        pending.current = false;
        const gym = await mutateRef.current({ equipment: [...sent] });
        confirmed.current = gym.equipment;
        if (!pending.current || sameEquipment(latest.current, sent)) break;
      }
      inFlight.current = false;
      pending.current = false;
      if (timer.current === null) setStatus('saved');
    } catch {
      inFlight.current = false;
      pending.current = false;
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = null;
      latest.current = confirmed.current;
      setSelected(confirmed.current);
      setStatus('idle');
      toast.error(errorRef.current);
    }
  }, []);

  const change = useCallback(
    (next: readonly GymEquipment[]) => {
      latest.current = next;
      setSelected(next);
      setStatus('saving');
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        void send();
      }, GYM_AUTOSAVE_DEBOUNCE_MS);
    },
    [send],
  );

  // Leaving the page within the debounce window still saves the last change.
  useEffect(
    () => () => {
      if (timer.current === null) return;
      clearTimeout(timer.current);
      timer.current = null;
      void send();
    },
    [send],
  );

  return { selected, status, change };
}
