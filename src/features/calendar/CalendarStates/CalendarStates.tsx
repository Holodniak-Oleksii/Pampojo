import { AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

export function CalendarSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-3.5 lg:flex-row lg:gap-6">
      <div className="flex flex-1 flex-col gap-3.5">
        <span className="h-7 w-44 rounded-md bg-card" />
        <div className="grid grid-cols-7 gap-0.5 lg:gap-1.5">
          {Array.from({ length: 35 }, (_, index) => (
            <span key={index} className="flex h-12 justify-center pt-2 lg:h-24 lg:rounded-sm lg:bg-card">
              <span className="h-3.5 w-5.5 rounded-[3px] bg-card lg:hidden" />
            </span>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2.5 border-t border-border-strong pt-4 lg:w-[340px] lg:border-t-0 lg:pt-2">
        <span className="h-5 w-56 rounded-md bg-card" />
        <span className="h-[68px] rounded-lg bg-card" />
      </div>
    </div>
  );
}

export function CalendarError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      className="mt-6 flex flex-col items-center gap-3.5 rounded-lg bg-card px-4 py-6 text-center"
    >
      <AlertCircle aria-hidden="true" className="size-7 text-destructive" />
      <p className="text-base font-bold">{t("Couldn't load the calendar.")}</p>
      <Button onClick={onRetry}>{t('Try again')}</Button>
    </div>
  );
}
