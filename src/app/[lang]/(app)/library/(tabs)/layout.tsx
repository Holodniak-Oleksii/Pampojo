import { PageHeader } from '@/components/PageHeader';
import { LibraryTabs } from '@/features/library/LibraryTabs';
import { getI18n } from '@/i18n/server';

export default async function LibraryLayout({ children }: LayoutProps<'/[lang]/library'>) {
  const { t } = await getI18n();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('Library')} />
      <LibraryTabs />
      {children}
    </div>
  );
}
