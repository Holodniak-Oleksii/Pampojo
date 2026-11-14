import type { Metadata } from 'next';
import { GymEditor } from '@/features/gym/GymEditor';
import { getI18n } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: { absolute: t('My gym | Pampojo') } };
}

export default function GymPage() {
  // The editor fetches on the client, so loading, error and offline states are its own.
  return (
    <div className="flex w-full flex-col gap-6">
      <GymEditor />
    </div>
  );
}
