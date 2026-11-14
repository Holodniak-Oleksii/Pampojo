'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useGymQuery, useSaveGymMutation } from '@/api/gym';
import { MyGymIcon } from '@/components/BrandIcons';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import {
  GYM_EQUIPMENT_GROUPS,
  GYM_EQUIPMENT_KEYS,
  type GymEquipment,
  type GymEquipmentGroup,
} from '@/constants/gym';
import { useIsOnline } from '@/hooks/useIsOnline';
import { GymEditorSkeleton } from '../GymEditorSkeleton';
import { GymEquipmentPicker } from '../GymEquipmentPicker';
import { useGymAutosave, type AutosaveStatus } from '../hooks/useGymAutosave';
import { canonical } from '../utils';

function toggled(selected: readonly GymEquipment[], item: GymEquipment): GymEquipment[] {
  return canonical(
    selected.includes(item) ? selected.filter((key) => key !== item) : [...selected, item],
  );
}

function withGroup(
  selected: readonly GymEquipment[],
  group: GymEquipmentGroup,
  on: boolean,
): GymEquipment[] {
  const items = GYM_EQUIPMENT_GROUPS.find((entry) => entry.group === group)?.items ?? [];
  return canonical(on ? [...selected, ...items] : selected.filter((item) => !items.includes(item)));
}

function Layout({
  status,
  online,
  children,
  footer,
}: {
  status?: AutosaveStatus;
  online: boolean;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/profile"
        className="inline-flex min-h-11 items-center gap-2 self-start font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-5" />
        {t('Profile')}
      </Link>
      <PageHeader
        title={t('My gym')}
        icon={<MyGymIcon className="size-7" />}
        actions={
          <span role="status" aria-live="polite" className="text-sm text-muted-foreground">
            {status === 'saving' ? t('Saving…') : status === 'saved' ? t('Saved') : null}
          </span>
        }
      />
      <p className="text-muted-foreground">
        {t('Tick what your gym has. You can then hide exercises that need anything else.')}
      </p>
      {!online ? <p className="text-sm font-semibold">{t('Needs internet')}</p> : null}
      {children}
      <p className="text-sm text-muted-foreground">
        {t('Bodyweight exercises are always available.')}
      </p>
      {footer}
    </div>
  );
}

function FirstVisit() {
  const { t } = useTranslation();
  const online = useIsOnline();
  const save = useSaveGymMutation();
  const [selected, setSelected] = useState<readonly GymEquipment[]>(GYM_EQUIPMENT_KEYS);

  async function submit() {
    try {
      await save.mutateAsync({ equipment: [...selected] });
      toast.success(t('Gym saved'));
    } catch {
      toast.error(t("Couldn't save your gym. Try again."));
    }
  }

  return (
    <Layout
      online={online}
      footer={
        <div>
          <Button
            size="lg"
            className="w-full lg:w-auto"
            disabled={!online || save.isPending}
            onClick={() => void submit()}
          >
            {t('Save my gym')}
          </Button>
        </div>
      }
    >
      <GymEquipmentPicker
        selected={selected}
        disabled={!online}
        onToggle={(item) => setSelected((current) => toggled(current, item))}
        onSetGroup={(group, on) => setSelected((current) => withGroup(current, group, on))}
      />
    </Layout>
  );
}

function Autosave({ initial }: { initial: readonly GymEquipment[] }) {
  const online = useIsOnline();
  const { selected, status, change } = useGymAutosave(initial);
  return (
    <Layout online={online} status={status}>
      <GymEquipmentPicker
        selected={selected}
        disabled={!online}
        onToggle={(item) => change(toggled(selected, item))}
        onSetGroup={(group, on) => change(withGroup(selected, group, on))}
      />
    </Layout>
  );
}

export function GymEditor() {
  const { t } = useTranslation();
  const online = useIsOnline();
  const query = useGymQuery();

  if (query.data === undefined) {
    if (query.isError || query.fetchStatus === 'paused') {
      return (
        <Layout online={online}>
          <div className="flex flex-col items-start gap-3 rounded-lg bg-card p-5">
            <p>{t("Couldn't load your gym.")}</p>
            <Button
              variant="secondary"
              size="sm"
              disabled={!online}
              onClick={() => void query.refetch()}
            >
              {t('Retry')}
            </Button>
          </div>
        </Layout>
      );
    }
    return <GymEditorSkeleton />;
  }
  if (query.data === null) return <FirstVisit />;
  return <Autosave initial={query.data.equipment} />;
}
