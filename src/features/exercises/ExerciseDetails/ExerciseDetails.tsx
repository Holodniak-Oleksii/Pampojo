'use client';

import { ArrowLeft, Copy, Pencil } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Exercise } from '@/shared/schemas/exercise';
import { useIsOnline } from '@/hooks/useIsOnline';
import { DeleteExerciseDialog } from '../DeleteExerciseDialog';
import { ExerciseFrames } from '../ExerciseFrames';
import { OnlineLinkButton } from '../OnlineLinkButton';
import { useCatalogBackHref } from '../hooks/useCatalogBackHref';
import { useExerciseLabels } from '../hooks/useExerciseLabels';

export interface ExerciseDetailsProps {
  exercise: Exercise;
}

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-muted-foreground">{term}</dt>
      <dd className="text-right font-semibold">{children}</dd>
    </div>
  );
}

export function ExerciseDetails({ exercise }: ExerciseDetailsProps) {
  const { t } = useTranslation();
  const labels = useExerciseLabels();
  const backHref = useCatalogBackHref();
  const online = useIsOnline();
  const join = <T extends string>(values: T[], map: Record<T, string>) =>
    values.map((value) => map[value]).join(', ');

  return (
    <article className="flex flex-col gap-6">
      <Link
        href={backHref}
        className="-ml-2 flex min-h-11 items-center gap-2 self-start rounded-full px-2 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft aria-hidden="true" className="size-5" />
        {t('Exercises')}
      </Link>
      <h1 className="text-3xl font-extrabold md:text-4xl">{exercise.name}</h1>
      <div className="flex flex-wrap items-start gap-3">
        {exercise.isOwn ? (
          <>
            <OnlineLinkButton href={`/library/exercises/${exercise.id}/edit`} variant="secondary">
              <Pencil aria-hidden="true" />
              {t('Edit')}
            </OnlineLinkButton>
            <DeleteExerciseDialog exerciseId={exercise.id} disabled={!online} />
          </>
        ) : (
          <OnlineLinkButton href={`/library/exercises/new?from=${exercise.id}`} variant="secondary">
            <Copy aria-hidden="true" />
            {t('Duplicate as my own')}
          </OnlineLinkButton>
        )}
      </div>
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-8">
        <div className="lg:sticky lg:top-20">
          <ExerciseFrames name={exercise.name} frames={exercise.frames} />
        </div>
        <div className="flex flex-col gap-6">
          {exercise.description ? <p className="text-lg">{exercise.description}</p> : null}
          {exercise.instructions.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h2 className="text-xl font-extrabold">{t('How to do it')}</h2>
              <ol className="flex list-decimal flex-col gap-2 pl-6">
                {exercise.instructions.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </section>
          ) : null}
          {exercise.commonMistakes.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h2 className="text-xl font-extrabold">{t('Common mistakes')}</h2>
              <ul className="flex list-disc flex-col gap-2 pl-6">
                {exercise.commonMistakes.map((mistake) => (
                  <li key={mistake}>{mistake}</li>
                ))}
              </ul>
            </section>
          ) : null}
          <section className="flex flex-col gap-1 rounded-[20px] bg-card px-5 py-3 shadow-soft">
            <h2 className="pt-1 text-lg font-extrabold">{t('Muscles')}</h2>
            <dl className="divide-y divide-border">
              <Row term={t('Primary')}>{join(exercise.primaryMuscles, labels.muscle)}</Row>
              {exercise.secondaryMuscles.length > 0 ? (
                <Row term={t('Secondary')}>{join(exercise.secondaryMuscles, labels.muscle)}</Row>
              ) : null}
            </dl>
          </section>
          <section className="rounded-[20px] bg-card px-5 py-3 shadow-soft">
            <dl className="divide-y divide-border">
              <Row term={t('Equipment')}>{join(exercise.equipment, labels.equipment)}</Row>
              {exercise.movementPattern ? (
                <Row term={t('Movement')}>{labels.pattern[exercise.movementPattern]}</Row>
              ) : null}
              {exercise.mechanic ? (
                <Row term={t('Type', { context: 'mechanic' })}>
                  {labels.mechanic[exercise.mechanic]}
                </Row>
              ) : null}
              {exercise.laterality ? (
                <Row term={t('Sides')}>{labels.laterality[exercise.laterality]}</Row>
              ) : null}
              <Row term={t('Tracking')}>{labels.tracking[exercise.trackingType]}</Row>
              {exercise.difficulty ? (
                <Row term={t('Level')}>{labels.level[exercise.difficulty]}</Row>
              ) : null}
            </dl>
          </section>
        </div>
      </div>
    </article>
  );
}
