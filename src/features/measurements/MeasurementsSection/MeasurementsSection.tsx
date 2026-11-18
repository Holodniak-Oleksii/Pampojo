'use client';

import { Plus, WifiOff } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useMeasurementsQuery } from '@/api/measurements';
import { OfflineNotice } from '@/components/OfflineNotice';
import { Button } from '@/components/ui/button';
import { GIRTH_TYPES, MEASUREMENT_TYPE, type MeasurementType } from '@/constants/measurement';
import { CalendarError } from '@/features/calendar/CalendarStates';
import { useIsOnline } from '@/hooks/useIsOnline';
import { todayIn } from '@/lib/dates';
import type { Measurement } from '@/shared/schemas/measurement';
import type { Profile } from '@/shared/schemas/profile';
import { AddMeasurementSheet } from '../AddMeasurementSheet/AddMeasurementSheet';
import { BmiCard } from '../BmiCard/BmiCard';
import { BodyDiagram } from '../BodyDiagram/BodyDiagram';
import { MeasurementRows } from '../MeasurementRows/MeasurementRows';
import {
  BmiSkeleton,
  MeasurementsEmpty,
  MeasurementsSkeleton,
} from '../MeasurementStates/MeasurementStates';
import { byType } from '../utils';

export function latestOf(
  grouped: ReadonlyMap<MeasurementType, readonly Measurement[]>,
): Map<MeasurementType, Measurement | undefined> {
  return new Map([...grouped].map(([type, list]) => [type, list[0]]));
}

/** Add button with the offline line under it. */
export function AddMeasurementButton({
  online,
  onClick,
}: {
  online: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" disabled={!online} onClick={onClick}>
        <Plus aria-hidden="true" className="size-[18px]" />
        {t('Add measurement')}
      </Button>
      {online ? null : (
        <span role="status" className="flex items-center gap-1 text-[13px] text-muted-foreground">
          <WifiOff aria-hidden="true" className="size-3.5" />
          {t('Needs internet')}
        </span>
      )}
    </div>
  );
}

/**
 * The Profile parts of spec 14. The BMI card and the measurements sit in different columns on
 * desktop, so the hook returns them as separate nodes for `ProfileView` to place.
 */
export function useProfileMeasurements(profile: Profile): {
  bmi: ReactNode;
  measurements: ReactNode;
} {
  const { t } = useTranslation();
  const online = useIsOnline();
  const query = useMeasurementsQuery({ enabled: online });
  const [adding, setAdding] = useState<{ focus?: MeasurementType } | null>(null);
  const today = todayIn(profile.timeZone);
  const grouped = useMemo(() => byType(query.data ?? []), [query.data]);
  const latest = useMemo(() => latestOf(grouped), [grouped]);

  const sheet = (
    <AddMeasurementSheet
      open={adding !== null}
      onOpenChange={(open) => setAdding(open ? {} : null)}
      profile={profile}
      today={today}
      latest={latest}
      focusType={adding?.focus}
    />
  );

  if (!query.data) {
    let state: ReactNode;
    if (query.isError) {
      state = (
        <CalendarError
          message={t("Couldn't load measurements.")}
          onRetry={() => void query.refetch()}
        />
      );
    } else if (!online) {
      state = <OfflineNotice>{t('Needs internet')}</OfflineNotice>;
    } else {
      state = <MeasurementsSkeleton />;
    }
    return { bmi: query.isError || !online ? null : <BmiSkeleton />, measurements: state };
  }

  const hasGirths = GIRTH_TYPES.some((type) => latest.get(type));

  return {
    bmi: (
      <BmiCard
        profile={profile}
        weights={grouped.get(MEASUREMENT_TYPE.WEIGHT) ?? []}
        today={today}
        online={online}
        onAddWeight={() => setAdding({ focus: MEASUREMENT_TYPE.WEIGHT })}
      />
    ),
    measurements: (
      <section aria-labelledby="measurements-title" className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <h2 id="measurements-title" className="pt-2 text-xl font-extrabold">
            {t('Measurements')}
          </h2>
          <AddMeasurementButton online={online} onClick={() => setAdding({})} />
        </div>
        {hasGirths ? (
          <BodyDiagram sex={profile.sex} latest={latest} units={profile.unitSystem} />
        ) : (
          <MeasurementsEmpty sex={profile.sex} online={online} onAdd={() => setAdding({})} />
        )}
        <MeasurementRows grouped={grouped} units={profile.unitSystem} />
        {sheet}
      </section>
    ),
  };
}
