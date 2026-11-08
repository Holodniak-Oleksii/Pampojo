import { CtaBanner } from '../CtaBanner';
import { Faq } from '../Faq';
import { Features } from '../Features';
import { Hero } from '../Hero';
import { HowItWorks } from '../HowItWorks';
import { ProgressShowcase } from '../ProgressShowcase';

export function LandingPage() {
  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-12 px-4 pb-16 md:gap-20 md:px-6">
      <Hero />
      <Features />
      <HowItWorks />
      <div className="grid gap-6 lg:grid-cols-2">
        <ProgressShowcase />
      </div>
      <Faq />
      <CtaBanner />
    </div>
  );
}
