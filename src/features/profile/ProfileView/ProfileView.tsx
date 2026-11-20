'use client';

import { WifiOff } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProfileQuery } from '@/api/profile';
import { EmojiAvatar } from '@/components/EmojiAvatar';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { UNIT_SYSTEM } from '@/constants/profile';
import { LogOutButton } from '@/features/auth/LogOutButton';
import { OnlineOnly } from '@/features/offline/OnlineOnly';
import { useRequiresOnline } from '@/features/offline/hooks/useRequiresOnline';
import { GymNudgeCard } from '@/features/gym/GymNudgeCard';
import { GymProfileRow } from '@/features/gym/GymProfileRow';
import { useProfileMeasurements } from '@/features/measurements';
import { LanguageSwitcher } from '@/features/i18n/LanguageSwitcher';
import { InstallRow } from '@/features/pwa';
import { ThemeSwitch } from '@/features/theme/ThemeSwitch';
import { useFormat } from '@/i18n/client';
import { feetInchesFromCm, formatFeetInches } from '@/lib/units';
import type { Gym } from '@/shared/schemas/gym';
import type { Profile } from '@/shared/schemas/profile';
import { EditProfileSheet } from '../EditProfileSheet';

export interface ProfileViewProps {
  initialProfile: Profile;
  initialGym: Gym | null;
}

export function ProfileView({ initialProfile, initialGym }: ProfileViewProps) {
  const { t } = useTranslation();
  const { blocked } = useRequiresOnline();
  const format = useFormat();
  const { data } = useProfileQuery({ initialData: initialProfile });
  const profile = data ?? initialProfile;
  const [editing, setEditing] = useState(false);
  const metric = profile.unitSystem === UNIT_SYSTEM.METRIC;

  const height = metric
    ? `${format.number(Math.round(profile.heightCm))} ${t('cm')}`
    : formatFeetInches(feetInchesFromCm(profile.heightCm));
  const rows = [
    { label: t('Age'), value: t('{{count}} years', { count: profile.age }) },
    { label: t('Height'), value: height },
  ];
  const { bmi, measurements } = useProfileMeasurements(profile);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader sectionTitle title={t('Profile')} />
      {/* Mobile stacks the parts; from lg the measurements take a 420px right column, and the settings stay one column wide so the rows do not wrap. */}
      <div className="flex flex-col gap-6 lg:grid lg:max-w-[1040px] lg:grid-cols-[minmax(0,1fr)_420px] lg:grid-rows-[auto_1fr] lg:items-start lg:gap-x-10">
        <div className="flex flex-col gap-6 lg:col-start-1 lg:row-start-1">
          <div className="flex items-center gap-4">
            <EmojiAvatar emoji={profile.avatarEmoji} color={profile.avatarColor} size="lg" />
            <p className="min-w-0 text-2xl font-extrabold break-words">{profile.displayName}</p>
          </div>
          <GymNudgeCard initialGym={initialGym} />
          {bmi}
        </div>
        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">{measurements}</div>
        <div className="flex flex-col gap-6 lg:col-start-1 lg:row-start-2">
          <div className="grid gap-3">
            <dl className="flex flex-col gap-3">
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
            <fieldset className="flex min-w-0 flex-col gap-2.5 rounded-lg bg-card px-2 pt-3.5 pb-2">
              <legend className="float-left px-3 text-muted-foreground">{t('Theme')}</legend>
              <ThemeSwitch variant="labels" className="clear-both" />
            </fieldset>
            <InstallRow />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <OnlineOnly label={t('Edit profile')} kind="label">
              <Button size="lg" className="sm:flex-1" onClick={() => setEditing(true)}>
                {blocked ? <WifiOff aria-hidden="true" /> : null}
                {t('Edit profile')}
              </Button>
            </OnlineOnly>
            <LogOutButton size="lg" className="sm:flex-1" />
          </div>
        </div>
      </div>
      <EditProfileSheet profile={profile} open={editing} onOpenChange={setEditing} />
    </div>
  );
}
