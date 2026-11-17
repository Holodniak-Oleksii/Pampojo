import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CalendarSkeleton } from '@/features/calendar/CalendarStates';
import { PlanCalendar } from '@/features/calendar/PlanCalendar';
import { getI18n } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: { absolute: t('Calendar | Pampojo') } };
}

export default function CalendarPage() {
  // The calendar reads ?date= and ?view= with useSearchParams, which needs a boundary.
  return (
    <Suspense fallback={<CalendarSkeleton />}>
      <PlanCalendar />
    </Suspense>
  );
}
