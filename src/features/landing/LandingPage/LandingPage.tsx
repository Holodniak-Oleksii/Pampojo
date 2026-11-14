import { CtaBanner } from '../CtaBanner';
import { Faq } from '../Faq';
import { Features } from '../Features';
import { Hero } from '../Hero';
import { HowItWorks } from '../HowItWorks';
import { OfflineBanner } from '../OfflineBanner';
import { ProgressShowcase } from '../ProgressShowcase';

const CONTAINER = 'mx-auto flex w-full max-w-[1200px] flex-col gap-12 px-4 md:gap-20 md:px-6';

export function LandingPage() {
  return (
    <div className="flex flex-col gap-12 pb-16 md:gap-20">
      <div className={CONTAINER}>
        <Hero />
        <Features />
        <HowItWorks />
        <ProgressShowcase />
      </div>
      {/* The offline band runs edge to edge, so it sits between two containers. */}
      <OfflineBanner />
      <div className={CONTAINER}>
        <Faq />
        <CtaBanner />
      </div>
    </div>
  );
}
