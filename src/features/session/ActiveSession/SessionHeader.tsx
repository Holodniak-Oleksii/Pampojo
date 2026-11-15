'use client';

import { ChevronDown, MoreHorizontal, PenLine, Trash2, Volume2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTimerSound } from '../hooks/useRestPrefs';
import { formatElapsed } from '../utils';

export interface SessionHeaderProps {
  name: string;
  elapsedSec: number;
  onMinimize: () => void;
  onNote: () => void;
  onDiscard: () => void;
  onFinish: () => void;
}

export function SessionHeader({
  name,
  elapsedSec,
  onMinimize,
  onNote,
  onDiscard,
  onFinish,
}: SessionHeaderProps) {
  const { t } = useTranslation();
  const [sound, setSound] = useTimerSound();
  return (
    <header className="flex h-16 items-center gap-1 pr-3 pl-1 lg:h-[76px] lg:gap-3 lg:border-b lg:border-border lg:pr-8 lg:pl-5">
      <button
        type="button"
        aria-label={t('Minimize')}
        onClick={onMinimize}
        className="flex h-12 w-11 shrink-0 items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronDown aria-hidden="true" className="size-[22px]" />
      </button>
      <div className="flex min-w-0 flex-1 flex-col lg:flex-row lg:items-baseline lg:gap-3">
        <span className="truncate text-[17px] font-extrabold lg:text-[22px]">{name}</span>
        <span className="text-sm text-muted-foreground tabular-nums lg:text-[15px]">
          <span className="sr-only">{t('Elapsed')} </span>
          {formatElapsed(elapsedSec)}
        </span>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t('More')}
            className="flex size-12 shrink-0 items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <MoreHorizontal aria-hidden="true" className="size-[22px]" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 bg-card text-foreground">
          <DropdownMenuItem className="min-h-12 gap-3 font-semibold" onSelect={onNote}>
            <PenLine aria-hidden="true" />
            {t('Note')}
          </DropdownMenuItem>
          <DropdownMenuCheckboxItem
            checked={sound}
            onCheckedChange={(value) => setSound(value === true)}
            onSelect={(event) => event.preventDefault()}
            className="min-h-12 gap-3 font-semibold"
          >
            <Volume2 aria-hidden="true" />
            {t('Timer sound')}
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="min-h-12 gap-3 font-semibold text-destructive-text focus:text-destructive-text"
            onSelect={onDiscard}
          >
            <Trash2 aria-hidden="true" />
            {t('Discard workout')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button size="sm" className="shrink-0 lg:h-12 lg:px-6" onClick={onFinish}>
        {t('Finish', { context: 'session' })}
      </Button>
    </header>
  );
}
