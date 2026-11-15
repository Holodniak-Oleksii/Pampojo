'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { MAIN_METRIC, SESSION_EXERCISES_MAX, type SetValueField } from '@/constants/session';
import { useCurrentUserId } from '@/features/auth/CurrentUser';
import { ExercisePicker } from '@/features/workouts/ExercisePicker';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import {
  prefetchLastPerformance,
  useLastPerformance,
  useLocalDb,
  useSessionRepository,
  type LocalSession,
  type LocalSetLog,
} from '@/services/local-db';
import { draftKey } from '@/services/local-db';
import type { SessionExercise, SetValues } from '@/shared/schemas/session';
import { ForgottenSessionDialog } from '../ForgottenSessionDialog';
import { useNow } from '../hooks/useNow';
import { primeAudio, useRestAlarm } from '../hooks/useRestAlarm';
import { rememberRestLength, restLengthFor } from '../hooks/useRestPrefs';
import { useWakeLock } from '../hooks/useWakeLock';
import {
  entryFromCatalog,
  firstOpenRow,
  forgottenFinishedAt,
  isEntryDone,
  isForgotten,
  loggedCount,
  nextEntryWithWork,
  onlyFields,
  restState,
} from '../utils';
import { ExerciseHeader } from './ExerciseHeader';
import { ExerciseStrip } from './ExerciseStrip';
import { NextUp } from './NextUp';
import { RestBar, RestPanel } from './RestTimer';
import { SessionExerciseList } from './SessionExerciseList';
import { SessionHeader } from './SessionHeader';
import { NotePanel, NoteSheet } from './SessionNote';
import { SetTable } from './SetTable';

const EDIT_DEBOUNCE_MS = 600;

function useTargetText() {
  const { t } = useTranslation();
  return (entry: SessionExercise) => {
    const sets = entry.plannedSets;
    if (entry.targetRepsMin !== null && entry.targetRepsMax !== null) {
      const reps =
        entry.targetRepsMin === entry.targetRepsMax
          ? String(entry.targetRepsMin)
          : `${entry.targetRepsMin}–${entry.targetRepsMax}`;
      return t('{{sets}} × {{reps}}', { sets, reps });
    }
    if (entry.targetDurationSec !== null) {
      return t('{{sets}} × {{reps}}', {
        sets,
        reps: t('{{value}} s', { value: entry.targetDurationSec }),
      });
    }
    return t('{{count}} sets', { count: sets });
  };
}

export function SessionView({
  session,
  setLogs,
}: {
  session: LocalSession;
  setLogs: LocalSetLog[];
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const desktop = useIsDesktop();
  const userId = useCurrentUserId();
  const db = useLocalDb(userId);
  const repository = useSessionRepository(userId);
  const now = useNow();
  const targetText = useTargetText();
  useWakeLock(true);

  const [listOpen, setListOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [dialog, setDialog] = useState<'finish' | 'empty' | 'abandon' | null>(null);
  const edits = useRef(
    new Map<string, { timer: ReturnType<typeof setTimeout>; fields: Partial<SetValues> }>(),
  );

  const exercises = session.exercises;
  const current =
    exercises.find((item) => item.id === session.currentEntryId) ?? exercises[0] ?? null;
  const lastByExercise = useLastPerformance(
    userId,
    session.id,
    exercises.map((item) => item.exerciseId),
  );

  const rest = session.restEndsAt
    ? restState(session.restEndsAt, session.restDurationSec, now)
    : null;
  useRestAlarm(session.restEndsAt, rest?.over ?? false);

  const next = current ? nextEntryWithWork(exercises, setLogs, current.id) : null;
  const nextRow = current ? firstOpenRow(current, setLogs) : null;
  const forgotten = isForgotten(session, now);

  // Once the last set of an exercise is done, the next one comes up when its rest ends.
  const advancedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!rest?.over || !current || !session.restEndsAt) return;
    if (advancedFor.current === session.restEndsAt) return;
    advancedFor.current = session.restEndsAt;
    if (isEntryDone(current, setLogs) && next) void repository.setCurrent(session.id, next.id);
  }, [rest?.over, current, next, setLogs, session.id, session.restEndsAt, repository]);

  // Edits of logged sets are sent once typing pauses; pending ones are sent on leave.
  useEffect(() => {
    const pending = edits.current;
    return () => {
      for (const [setId, edit] of pending) {
        clearTimeout(edit.timer);
        void repository.editSet(setId, edit.fields);
      }
      pending.clear();
    };
  }, [repository]);

  if (!current) return null;

  const restExerciseId =
    setLogs.find((log) => log.id === session.restSetId)?.exerciseId ?? current.exerciseId;

  function changeValue(
    setIndex: number,
    log: LocalSetLog | undefined,
    values: SetValues,
    field: SetValueField,
  ) {
    if (!current) return;
    if (!log) {
      void repository.setDraft(session.id, draftKey(current.id, setIndex), values);
      return;
    }
    // A logged set keeps its main value; clearing it would make the server reject the edit.
    if (field === MAIN_METRIC[current.exercise.trackingType] && values[field] === null) return;
    const pending = edits.current.get(log.id);
    if (pending) clearTimeout(pending.timer);
    const fields = { ...pending?.fields, [field]: values[field] };
    const timer = setTimeout(() => {
      edits.current.delete(log.id);
      void repository.editSet(log.id, fields);
    }, EDIT_DEBOUNCE_MS);
    edits.current.set(log.id, { timer, fields });
  }

  function toggle(setIndex: number, log: LocalSetLog | undefined, values: SetValues) {
    if (!current) return;
    if (log) {
      void repository.unlogSet(log.id);
      return;
    }
    primeAudio();
    void repository.logSet({
      sessionId: session.id,
      entryId: current.id,
      setIndex,
      values: onlyFields(current.exercise.trackingType, values),
      restSec: restLengthFor(current.exerciseId),
    });
  }

  function setPlannedSets(delta: number) {
    if (current) void repository.changePlannedSets(session.id, current.id, delta);
  }

  async function adjustRest(deltaSec: number) {
    const durationSec = await repository.adjustRest(session.id, deltaSec);
    if (durationSec !== null) rememberRestLength(restExerciseId, durationSec);
  }

  function skipRest() {
    void repository.clearRest(session.id);
    if (current && isEntryDone(current, setLogs) && next)
      void repository.setCurrent(session.id, next.id);
  }

  function select(entryId: string) {
    void repository.setCurrent(session.id, entryId);
    setListOpen(false);
  }

  function requestFinish() {
    if (setLogs.length === 0) return setDialog('empty');
    const unchecked = exercises.reduce(
      (sum, item) => sum + Math.max(0, item.plannedSets - loggedCount(item, setLogs)),
      0,
    );
    if (unchecked > 0) return setDialog('finish');
    void repository.finish(session.id, new Date().toISOString());
  }

  async function abandon() {
    setDialog(null);
    await repository.abandon(session.id);
    router.push('/today');
  }

  const unchecked = exercises.reduce(
    (sum, item) => sum + Math.max(0, item.plannedSets - loggedCount(item, setLogs)),
    0,
  );

  const list = (
    <SessionExerciseList
      exercises={exercises}
      setLogs={setLogs}
      currentId={current.id}
      showNow={!desktop}
      onSelect={select}
      onReorder={(items) => void repository.updatePlan(session.id, items)}
      onRemove={(entryId) =>
        void repository.updatePlan(
          session.id,
          exercises.filter((item) => item.id !== entryId),
        )
      }
      onAdd={() => setPickerOpen(true)}
    />
  );

  const timerProps = {
    rest,
    durationSec: rest ? session.restDurationSec : restLengthFor(current.exerciseId),
    nextSet: nextRow === null ? null : nextRow + 1,
    onAdjust: (deltaSec: number) => void adjustRest(deltaSec),
    onSkip: skipRest,
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <SessionHeader
        name={session.workoutSnapshot.name}
        elapsedSec={(now - new Date(session.startedAt).getTime()) / 1000}
        onMinimize={() => router.push('/today')}
        onNote={() => setNoteOpen(true)}
        onDiscard={() => setDialog('abandon')}
        onFinish={requestFinish}
      />
      <ExerciseStrip
        exercises={exercises}
        setLogs={setLogs}
        currentId={current.id}
        onOpen={() => setListOpen(true)}
      />

      <div className="flex-1 lg:grid lg:grid-cols-[340px_minmax(0,1fr)_360px]">
        <aside
          aria-label={t('Exercises')}
          className="hidden flex-col gap-2.5 border-r border-border px-3 py-5 lg:flex"
        >
          <h2 className="mx-2 text-base font-extrabold">{t('Exercises')}</h2>
          {desktop ? list : null}
        </aside>

        <main
          className={
            rest
              ? 'flex flex-col gap-[18px] px-4 pt-5 pb-36 lg:max-w-[680px] lg:gap-[22px] lg:px-12 lg:py-8'
              : 'flex flex-col gap-[18px] px-4 pt-5 pb-10 lg:max-w-[680px] lg:gap-[22px] lg:px-12 lg:py-8'
          }
        >
          <ExerciseHeader entry={current} last={lastByExercise?.[current.exerciseId]} />
          <SetTable
            key={current.id}
            entry={current}
            setLogs={setLogs}
            drafts={session.drafts}
            last={lastByExercise?.[current.exerciseId]}
            onChange={changeValue}
            onToggle={toggle}
            onAddSet={() => setPlannedSets(1)}
            onRemoveSet={() => setPlannedSets(-1)}
          />
          <NextUp
            next={next && next.id !== current.id ? next : null}
            target={next ? targetText(next) : ''}
            onSelect={() => next && select(next.id)}
          />
        </main>

        <aside className="hidden flex-col gap-7 border-l border-border px-7 py-8 lg:flex">
          {desktop ? (
            <>
              <RestPanel {...timerProps} />
              <NotePanel
                notes={session.notes}
                onSave={(notes) => void repository.setNote(session.id, notes)}
              />
            </>
          ) : null}
        </aside>
      </div>

      {desktop ? null : <RestBar {...timerProps} />}

      {desktop ? null : (
        <Sheet open={listOpen} onOpenChange={setListOpen}>
          <SheetContent
            side="bottom"
            closeLabel={t('Close')}
            aria-describedby={undefined}
            className="max-h-dvh gap-3.5 overflow-y-auto rounded-t-xl bg-card px-4 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-foreground"
          >
            <SheetHeader className="p-0">
              <SheetTitle className="text-xl font-extrabold">{t('Exercises')}</SheetTitle>
            </SheetHeader>
            {list}
          </SheetContent>
        </Sheet>
      )}

      <ExercisePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        room={SESSION_EXERCISES_MAX - exercises.length}
        className="text-foreground"
        onAdd={(items) => {
          const added = items.map((item) => entryFromCatalog(item));
          void repository.updatePlan(session.id, [...exercises, ...added]);
          void prefetchLastPerformance(
            db,
            added.map((item) => item.exerciseId),
          );
          setPickerOpen(false);
        }}
      />

      {desktop ? null : (
        <NoteSheet
          open={noteOpen}
          onOpenChange={setNoteOpen}
          notes={session.notes}
          onSave={(notes) => void repository.setNote(session.id, notes)}
        />
      )}

      <ConfirmDialog
        open={dialog === 'finish'}
        onOpenChange={(open) => !open && setDialog(null)}
        className="bg-card text-foreground"
        stacked
        title={t('Finish the workout?')}
        description={t("{{count}} sets are not checked. They won't be saved.", {
          count: unchecked,
        })}
        confirmLabel={t('Finish', { context: 'session' })}
        cancelLabel={t('Keep going')}
        onConfirm={() => {
          setDialog(null);
          void repository.finish(session.id, new Date().toISOString());
        }}
      />
      <ConfirmDialog
        open={dialog === 'empty'}
        onOpenChange={(open) => !open && setDialog(null)}
        className="bg-card text-foreground"
        stacked
        destructive
        title={t('No sets checked')}
        description={t('Nothing to finish. You can discard this workout or keep going.')}
        confirmLabel={t('Discard workout')}
        cancelLabel={t('Keep going')}
        onConfirm={() => void abandon()}
      />
      <ConfirmDialog
        open={dialog === 'abandon'}
        onOpenChange={(open) => !open && setDialog(null)}
        className="bg-card text-foreground"
        stacked
        destructive
        title={t('Discard this workout?')}
        description={t('Logged sets will be lost.')}
        confirmLabel={t('Delete')}
        cancelLabel={t('Cancel')}
        onConfirm={() => void abandon()}
      />
      <ForgottenSessionDialog
        open={forgotten}
        name={session.workoutSnapshot.name}
        startedAt={session.startedAt}
        sets={setLogs.length}
        onFinish={() =>
          void repository.finish(session.id, forgottenFinishedAt(session.startedAt, setLogs))
        }
        onDiscard={() => void abandon()}
      />
    </div>
  );
}
