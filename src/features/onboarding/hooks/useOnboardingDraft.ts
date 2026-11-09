import { useEffect, useState } from 'react';
import { z } from 'zod';
import {
  emptyFormValues,
  profileFormValuesSchema,
  type ProfileFormValues,
} from '@/features/profile';

export type OnboardingStep = 1 | 2 | 3;

export interface OnboardingDraft {
  version: 1;
  step: OnboardingStep;
  values: ProfileFormValues;
}

const draftSchema = z.object({
  version: z.literal(1),
  step: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  values: profileFormValuesSchema,
});

export const draftKey = (userId: string) => `pampojo:onboarding:${userId}`;

function readDraft(key: string): OnboardingDraft | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = draftSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function saveDraft(key: string, draft: OnboardingDraft) {
  try {
    localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // Full or blocked storage: the flow still works, it just will not survive a reload.
  }
}

export function clearDraft(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}

/** The stored draft or a fresh one; null until mounted, because storage and the random avatar exist only on the client. */
export function useOnboardingDraft(userId: string, prefillName: string): OnboardingDraft | null {
  const [draft, setDraft] = useState<OnboardingDraft | null>(null);
  useEffect(() => {
    const key = draftKey(userId);
    const stored = readDraft(key);
    const next: OnboardingDraft = stored ?? {
      version: 1,
      step: 1,
      values: emptyFormValues(prefillName),
    };
    if (!stored) saveDraft(key, next);
    // Reading storage must wait for mount, or the server and client renders would disagree.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(next);
  }, [userId, prefillName]);
  return draft;
}
