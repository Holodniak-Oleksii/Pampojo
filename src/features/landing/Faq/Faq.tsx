'use client';

import { useTranslation } from 'react-i18next';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export function Faq() {
  const { t } = useTranslation();
  const items = [
    { question: t('Is Pampojo free?'), answer: t('Yes. Pampojo is free to use.') },
    {
      question: t('Does it work without internet?'),
      answer: t(
        "Yes. After the first visit you can run workouts and log sets offline. Changes sync when you're back online.",
      ),
    },
    {
      question: t('Can I use it on iPhone?'),
      answer: t(
        'Yes. Open Pampojo in Safari and add it to your Home Screen. It also works on Android and laptops.',
      ),
    },
    {
      question: t('How do I share a workout?'),
      answer: t(
        'Share a link or a file from the workout. Your friend imports their own copy; your history stays private.',
      ),
    },
  ];

  return (
    <section
      id="faq"
      data-section="faq"
      aria-labelledby="faq-heading"
      className="flex scroll-mt-24 flex-col gap-6"
    >
      <h2 id="faq-heading" className="text-3xl font-extrabold">
        {t('FAQ')}
      </h2>
      {/* One root keeps a single item open across both desktop columns. */}
      <Accordion
        type="single"
        collapsible
        className="grid border-t-2 border-foreground lg:grid-cols-2 lg:items-start lg:gap-x-8"
      >
        {items.map((item, index) => (
          <AccordionItem
            key={item.question}
            value={`item-${index}`}
            className="border-b border-border-strong"
          >
            <AccordionTrigger className="min-h-16 items-center py-4 text-[17px] font-bold hover:no-underline">
              {item.question}
            </AccordionTrigger>
            <AccordionContent className="pb-4 text-base text-muted-foreground">
              {item.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
