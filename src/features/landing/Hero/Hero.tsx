import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import googleG from '@/assets/google-g.svg';
import { getI18n } from '@/i18n/server';
import { HeroPhone } from '../HeroPhone';

export async function Hero() {
  const { t } = await getI18n();
  return (
    <section
      id="top"
      data-section="hero"
      className="grid items-center gap-10 pt-6 md:pt-12 lg:grid-cols-2"
    >
      <div className="flex min-w-0 flex-col gap-6">
        <h1 className="text-4xl leading-[1.05] font-extrabold text-balance break-words sm:text-5xl lg:text-6xl xl:text-7xl">
          {t('Your workouts. Even offline.')}
        </h1>
        <p className="max-w-[34ch] text-lg text-muted-foreground">
          {t(
            'Build workouts, plan them in a calendar and track every set right in the gym, no signal needed.',
          )}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/signup">{t('Get started')}</Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link href="/signup">
              <Image src={googleG} alt="" width={20} height={20} />
              {t('Continue with Google')}
            </Link>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {t('Free • Works on iPhone, Android and laptop')}
        </p>
      </div>
      <HeroPhone />
    </section>
  );
}
