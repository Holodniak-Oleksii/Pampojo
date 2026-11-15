'use client';

import { useTranslation } from 'react-i18next';

const block = 'rounded-md bg-card';

export function SessionSkeleton() {
  const { t } = useTranslation();
  return (
    <div aria-busy="true" className="flex flex-col">
      <span className="sr-only">{t('Loading workout')}</span>
      <div className="flex h-16 items-center gap-3 pr-3 pl-4">
        <div className={`${block} size-[22px]`} />
        <div className="flex flex-1 flex-col gap-1.5">
          <div className={`${block} h-4 w-[120px]`} />
          <div className={`${block} h-3 w-16`} />
        </div>
        <div className={`${block} h-11 w-[104px]`} />
      </div>
      <div className={`${block} mx-4 h-12`} />
      <div className="flex flex-col gap-[18px] px-4 pt-5">
        <div className="flex gap-3.5">
          <div className="size-16 rounded-sm bg-card" />
          <div className="flex flex-1 flex-col gap-2">
            <div className={`${block} h-6 w-4/5`} />
            <div className={`${block} h-3.5 w-1/2`} />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className={`${block} h-14`} />
          <div className={`${block} h-14`} />
          <div className={`${block} h-14`} />
        </div>
      </div>
    </div>
  );
}
