'use client';

import { SlidersHorizontal } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import type { Equipment, MuscleGroup } from '@/constants/exercise';
import { EquipmentFilter } from '../EquipmentFilter';
import { MuscleChips } from '../MuscleChips';

export interface FilterSheetProps {
  muscles: readonly MuscleGroup[];
  equipment: readonly Equipment[];
  /** How many filters are on, shown on the trigger. */
  activeCount: number;
  /** The "Mine" and "Available in my gym" chips. */
  scopeChips: ReactNode;
  onToggleMuscle: (muscle: MuscleGroup) => void;
  onEquipmentChange: (equipment: Equipment[]) => void;
  onClear: () => void;
}

/** Mobile only: every catalog filter in one bottom sheet, applied as it is tapped. */
export function FilterSheet({
  muscles,
  equipment,
  activeCount,
  scopeChips,
  onToggleMuscle,
  onEquipmentChange,
  onClear,
}: FilterSheetProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const label = activeCount > 0 ? t('Filters ({{active}})', { active: activeCount }) : t('Filters');

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="secondary"
          size="icon"
          aria-label={label}
          // The same surface and border as the search input it sits beside.
          className="relative shrink-0 border-input ring-0"
        >
          <SlidersHorizontal aria-hidden="true" />
          {activeCount > 0 ? (
            <span
              aria-hidden="true"
              className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-sm bg-accent text-xs font-bold text-foreground"
            >
              {activeCount}
            </span>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        closeLabel={t('Close')}
        aria-describedby={undefined}
        className="max-h-[85dvh] gap-0 rounded-t-xl bg-background motion-reduce:animate-none"
      >
        <SheetHeader className="px-4 pt-6 pb-2">
          <SheetTitle className="text-2xl font-extrabold">{t('Filters')}</SheetTitle>
        </SheetHeader>
        <div className="flex min-h-0 flex-col gap-5 overflow-y-auto px-4 pb-4">
          <div className="flex flex-wrap gap-2">{scopeChips}</div>
          <section className="flex flex-col gap-2">
            <h3 className="font-semibold">{t('Muscles')}</h3>
            <MuscleChips wrap selected={muscles} onToggle={onToggleMuscle} />
          </section>
          <EquipmentFilter selected={equipment} onChange={onEquipmentChange} />
        </div>
        <SheetFooter className="flex-row gap-2 border-t border-border px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button
            variant="secondary"
            className="flex-1"
            disabled={activeCount === 0}
            onClick={onClear}
          >
            {t('Reset')}
          </Button>
          <Button className="flex-1" onClick={() => setOpen(false)}>
            {t('Show exercises')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
