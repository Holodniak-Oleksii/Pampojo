'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProfileQuery } from '@/api/profile';
import { EmojiAvatar } from '@/components/EmojiAvatar';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { UNIT_SYSTEM } from '@/constants/profile';
import { LogOutButton } from '@/features/auth/LogOutButton';
import { GymNudgeCard } from '@/features/gym/GymNudgeCard';
import { GymProfileRow } from '@/features/gym/GymProfileRow';
import { LanguageSwitcher } from '@/features/i18n/LanguageSwitcher';
import { useFormat } from '@/i18n/client';
import { feetInchesFromCm, formatFeetInches, lbFromKg } from '@/lib/units';
import type { Gym } from '@/shared/schemas/gym';
import type { Profile } from '@/shared/schemas/profile';
import { EditProfileSheet } from '../EditProfileSheet';

export interface ProfileViewProps {
  initialProfile: Profile;
  initialGym: Gym | null;
}

export function ProfileView({ initialProfile, initialGym }: ProfileViewProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const { data } = useProfileQuery({ initialData: initialProfile });
  const profile = data ?? initialProfile;
  const [editing, setEditing] = useState(false);
  const metric = profile.unitSystem === UNIT_SYSTEM.METRIC;

  const height = metric
    ? `${format.number(Math.round(profile.heightCm))} ${t('cm')}`
    : formatFeetInches(feetInchesFromCm(profile.heightCm));
  const weight =
    profile.latestWeightKg === null
      ? '—'
      : `${format.number(metric ? profile.latestWeightKg : lbFromKg(profile.latestWeightKg), {
          maximumFractionDigits: 1,
        })} ${metric ? t('kg') : t('lb')}`;

  const rows = [
    { label: t('Age'), value: t('{{count}} years', { count: profile.age }) },
    { label: t('Height'), value: height },
    { label: t('Weight'), value: weight },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader sectionTitle title={t('Profile')} />
      <div className="flex items-center gap-4">
        <EmojiAvatar emoji={profile.avatarEmoji} color={profile.avatarColor} size="lg" />
        <p className="min-w-0 text-2xl font-extrabold break-words">{profile.displayName}</p>
      </div>
      <GymNudgeCard initialGym={initialGym} />
      {/* One column on mobile; from lg the rows and the language row share a two-column grid. */}
      <div className="grid gap-3 lg:grid-cols-2">
        <dl className="flex flex-col gap-3 lg:contents">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-4 rounded-lg bg-card px-5 py-4"
            >
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="text-lg font-semibold tabular-nums">{row.value}</dd>
            </div>
          ))}
        </dl>
        <GymProfileRow initialGym={initialGym} />
        <div className="flex items-center justify-between gap-4 rounded-lg bg-card px-5 py-3">
          <span className="text-muted-foreground">{t('Language')}</span>
          <LanguageSwitcher />
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row lg:max-w-[600px]">
        <Button size="lg" className="sm:flex-1" onClick={() => setEditing(true)}>
          {t('Edit profile')}
        </Button>
        <LogOutButton size="lg" className="sm:flex-1" />
      </div>
      <EditProfileSheet profile={profile} open={editing} onOpenChange={setEditing} />
    </div>
  );
}
