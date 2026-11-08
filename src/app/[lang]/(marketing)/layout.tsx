import { MarketingFooter } from '@/features/landing/MarketingFooter';
import { MarketingHeader } from '@/features/landing/MarketingHeader';

export default function MarketingLayout({ children }: LayoutProps<'/[lang]'>) {
  return (
    <>
      <MarketingHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <MarketingFooter />
    </>
  );
}
