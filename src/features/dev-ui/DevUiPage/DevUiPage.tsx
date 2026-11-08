'use client';

/* Developer-facing page: variant names, tab labels and sample text are intentionally untranslated. */

import { Plus } from 'lucide-react';
import { useId, useSyncExternalStore, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { EmojiAvatar } from '@/components/EmojiAvatar';
import { PageHeader } from '@/components/PageHeader';
import { SegmentedGauge } from '@/components/SegmentedGauge';
import { StatCard } from '@/components/StatCard';
import { StatusPill } from '@/components/StatusPill';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AVATAR_COLORS, AVATAR_EMOJI_IDS, type AvatarColor } from '@/constants/avatar';
import { useFormat } from '@/i18n/client';
import { LanguageSwitcher } from '@/features/i18n/LanguageSwitcher';
import { cn } from '@/lib/utils';

const COLOR_TOKENS = [
  '--background',
  '--card',
  '--foreground',
  '--muted-foreground',
  '--primary',
  '--primary-foreground',
  '--accent',
  '--accent-soft',
  '--success',
  '--destructive',
  '--border',
] as const;

const AVATAR_TOKEN_CLASS: Record<AvatarColor, string> = {
  1: 'bg-avatar-1',
  2: 'bg-avatar-2',
  3: 'bg-avatar-3',
  4: 'bg-avatar-4',
  5: 'bg-avatar-5',
  6: 'bg-avatar-6',
  7: 'bg-avatar-7',
  8: 'bg-avatar-8',
};

const BUTTON_VARIANTS = ['primary', 'accent', 'secondary', 'ghost'] as const;
const BUTTON_SIZES = ['sm', 'md', 'lg', 'xl'] as const;
const GAUGE_VALUES = [0, 50, 82, 100] as const;

function Section({
  title,
  wide,
  children,
}: {
  title: string;
  wide?: boolean;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className={cn(
        'flex min-w-0 flex-col gap-4 rounded-[24px] bg-card p-5 shadow-soft',
        wide && 'lg:col-span-2',
      )}
    >
      <h2 id={id} className="text-xl font-extrabold">
        {title}
      </h2>
      {children}
    </section>
  );
}

const subscribeToNothing = () => () => {};

function ColorSwatch({ token }: { token: string }) {
  // Values are read from the live CSS variables, so the page never repeats a hex literal.
  const value = useSyncExternalStore(
    subscribeToNothing,
    () => getComputedStyle(document.documentElement).getPropertyValue(token).trim(),
    () => '',
  );

  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className="size-10 shrink-0 rounded-2xl shadow-soft"
        style={{ background: `var(${token})` }}
      />
      <span className="min-w-0 text-sm">
        <span className="block font-semibold break-all">{token}</span>
        <span className="block text-muted-foreground tabular-nums">{value}</span>
      </span>
    </div>
  );
}

export function DevUiPage() {
  const { t } = useTranslation();
  const format = useFormat();

  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 py-6 md:px-6 md:py-10">
      <PageHeader title={t('Design system')} actions={<LanguageSwitcher />} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title={t('Colors')} wide>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {COLOR_TOKENS.map((token) => (
              <ColorSwatch key={token} token={token} />
            ))}
          </div>
        </Section>

        <Section title={t('Type')}>
          <p className="text-5xl font-extrabold">Display</p>
          <p className="text-4xl font-extrabold">Heading 1</p>
          <p className="text-2xl font-extrabold">Heading 2</p>
          <p className="text-xl font-semibold">Heading 3</p>
          <p className="text-base">Body text 16px</p>
          <p className="text-sm text-muted-foreground">Small text</p>
          <p className="text-3xl font-extrabold tabular-nums">0123456789</p>
          <p className="font-normal">Ґанок, їжак, єнот, ірис</p>
          <p className="font-semibold">Ґанок, їжак, єнот, ірис</p>
          <p className="font-extrabold">Ґанок, їжак, єнот, ірис</p>
        </Section>

        <Section title={t('Inputs')}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="dev-name">{t('Name')}</Label>
            <Input id="dev-name" placeholder="John Smith" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="dev-name-error">{t('Name')}</Label>
            <Input id="dev-name-error" aria-invalid="true" aria-describedby="dev-name-error-text" />
            <p id="dev-name-error-text" className="text-sm text-destructive">
              {t('This field is required')}
            </p>
          </div>
        </Section>

        <Section title={t('Buttons')} wide>
          {BUTTON_VARIANTS.map((variant) => (
            <div key={variant} className="flex flex-wrap items-center gap-3">
              {BUTTON_SIZES.map((size) => (
                <Button key={size} variant={variant} size={size}>
                  {variant} {size}
                </Button>
              ))}
              <Button variant={variant} size="icon" aria-label={`${t('Add')} (${variant})`}>
                <Plus aria-hidden="true" />
              </Button>
              <Button variant={variant} disabled>
                {variant} disabled
              </Button>
            </div>
          ))}
        </Section>

        <Section title={t('Cards')}>
          <Card>
            <CardHeader>
              <CardTitle>Card</CardTitle>
            </CardHeader>
            <CardContent>Plain card content on the card token.</CardContent>
          </Card>
          <StatCard
            label={t('BMI')}
            value={format.number(24.8)}
            trend={{ direction: 'down', text: format.number(-0.6) }}
          />
          <StatCard label={t('Workouts this month')} value={format.number(12)} />
        </Section>

        <Section title={t('Gauge')}>
          <div className="grid grid-cols-2 gap-4">
            {GAUGE_VALUES.map((value) => (
              <SegmentedGauge key={value} value={value} label={t('Plan adherence')} />
            ))}
          </div>
        </Section>

        <Section title={t('Avatars')} wide>
          <div className="grid grid-cols-6 gap-3 sm:grid-cols-8 lg:grid-cols-12">
            {AVATAR_EMOJI_IDS.map((emoji, index) => (
              <EmojiAvatar
                key={emoji}
                emoji={emoji}
                color={AVATAR_COLORS[index % AVATAR_COLORS.length] ?? 1}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            {AVATAR_COLORS.map((color) => (
              <span
                key={color}
                aria-hidden="true"
                className={cn('size-10 rounded-full', AVATAR_TOKEN_CLASS[color])}
              />
            ))}
          </div>
          <div className="flex items-end gap-3">
            <EmojiAvatar emoji="fox" color={1} size="sm" />
            <EmojiAvatar emoji="fox" color={1} size="md" />
            <EmojiAvatar emoji="fox" color={1} size="lg" />
          </div>
        </Section>

        <Section title={t('Status')}>
          <div className="flex flex-wrap gap-3">
            <StatusPill status="online" />
            <StatusPill status="offline" />
            <StatusPill status="offline" pendingCount={3} />
          </div>
        </Section>

        <Section title={t('Overlays')}>
          <div className="flex flex-wrap gap-3">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="secondary">{t('Open dialog')}</Button>
              </DialogTrigger>
              <DialogContent closeLabel={t('Close')}>
                <DialogHeader>
                  <DialogTitle>{t('Design system')}</DialogTitle>
                  <DialogDescription>{t('Saved')}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="secondary">{t('Close')}</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="secondary">{t('Open sheet')}</Button>
              </SheetTrigger>
              <SheetContent closeLabel={t('Close')}>
                <SheetHeader>
                  <SheetTitle>{t('Design system')}</SheetTitle>
                  <SheetDescription>{t('Saved')}</SheetDescription>
                </SheetHeader>
              </SheetContent>
            </Sheet>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary">{t('Open menu')}</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>{t('Online')}</DropdownMenuItem>
                <DropdownMenuItem>{t('Offline')}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="secondary" onClick={() => toast(t('Saved'))}>
              {t('Show toast')}
            </Button>
          </div>

          <Tabs defaultValue="one">
            <TabsList>
              <TabsTrigger value="one">Tab one</TabsTrigger>
              <TabsTrigger value="two">Tab two</TabsTrigger>
            </TabsList>
            <TabsContent value="one">First tab content.</TabsContent>
            <TabsContent value="two">Second tab content.</TabsContent>
          </Tabs>

          <Progress value={60} aria-label="Progress 60%" />

          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </Section>
      </div>
    </main>
  );
}
