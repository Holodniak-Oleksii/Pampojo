import Image from 'next/image';
import { HeroPhone } from '@/features/landing/HeroPhone';
import { getI18n } from '@/i18n/server';

export async function AuthBrandPanel() {
  const { t } = await getI18n();
  return (
    <aside className="hidden min-h-0 flex-col gap-8 overflow-hidden rounded-[32px] bg-gradient-to-br from-accent-soft to-background p-10 pb-0 lg:flex">
      <Image
        src="/brand/pampojo-wordmark.svg"
        alt=""
        width={185}
        height={40}
        className="h-10 w-auto shrink-0 self-start"
      />
      <h2 className="shrink-0 text-4xl leading-tight font-extrabold text-balance xl:text-5xl">
        {t('Your workouts. Even offline.')}
      </h2>
      {/* On short screens the mockup runs past the panel's bottom edge and is clipped there. */}
      <div className="min-h-0 flex-1">
        <HeroPhone />
      </div>
    </aside>
  );
}
