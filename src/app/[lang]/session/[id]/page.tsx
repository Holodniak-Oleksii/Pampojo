import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { z } from 'zod';
import { ActiveSession, SessionSkeleton } from '@/features/session/ActiveSession';
import { getI18n } from '@/i18n/server';

type Props = PageProps<'/[lang]/session/[id]'>;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: { absolute: t('Workout | Pampojo') } };
}

async function SessionContent({ params }: Pick<Props, 'params'>) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  // The session lives on the device first, so it is read on the client.
  return <ActiveSession sessionId={id} />;
}

export default function SessionPage({ params }: Props) {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh bg-background text-foreground">
          <SessionSkeleton />
        </div>
      }
    >
      <SessionContent params={params} />
    </Suspense>
  );
}
