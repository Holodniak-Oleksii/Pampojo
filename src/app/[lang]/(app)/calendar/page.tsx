import type { Metadata } from 'next';
import { PlanCalendar } from '@/features/calendar/PlanCalendar';
import { getI18n } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: { absolute: t('Calendar | Pampojo') } };
}

export default function CalendarPage() {
  return <PlanCalendar />;
}
