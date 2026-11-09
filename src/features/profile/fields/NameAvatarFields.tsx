'use client';

import { Controller, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { EmojiAvatar } from '@/components/EmojiAvatar';
import { useAvatarEmojiNames } from '@/components/EmojiAvatar/useAvatarEmojiNames';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { AVATAR_COLORS, AVATAR_EMOJI_IDS } from '@/constants/avatar';
import { cn } from '@/lib/utils';
import type { FieldsProps } from './FieldsProps';
import { useAvatarColorNames } from './useAvatarColorNames';
import { useProfileFieldError } from './useProfileFieldError';

const COLOR_CLASS = {
  1: 'bg-avatar-1',
  2: 'bg-avatar-2',
  3: 'bg-avatar-3',
  4: 'bg-avatar-4',
  5: 'bg-avatar-5',
  6: 'bg-avatar-6',
  7: 'bg-avatar-7',
  8: 'bg-avatar-8',
} as const;

const OPTION_CLASS =
  'relative flex cursor-pointer items-center justify-center rounded-full ring-offset-background transition-shadow has-checked:ring-3 has-checked:ring-foreground has-focus-visible:ring-3 has-focus-visible:ring-ring';

export function NameAvatarFields({ form, idPrefix }: FieldsProps) {
  const { t } = useTranslation();
  const emojiNames = useAvatarEmojiNames();
  const colorNames = useAvatarColorNames();
  const fieldError = useProfileFieldError();
  const [emoji, color, unitSystem] = useWatch({
    control: form.control,
    name: ['avatarEmoji', 'avatarColor', 'unitSystem'],
  });
  const nameError = fieldError(form.formState.errors.displayName?.message, unitSystem);
  const nameId = `${idPrefix}-name`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-center">
        <EmojiAvatar emoji={emoji} color={color} size="lg" className="size-24 text-[52px]" />
      </div>

      <Field data-invalid={Boolean(nameError)}>
        <FieldLabel htmlFor={nameId}>{t('Name')}</FieldLabel>
        <Input
          id={nameId}
          autoComplete="nickname"
          placeholder={t('Your name')}
          aria-invalid={Boolean(nameError)}
          aria-describedby={nameError ? `${nameId}-error` : undefined}
          {...form.register('displayName')}
        />
        {nameError ? <FieldError id={`${nameId}-error`}>{nameError}</FieldError> : null}
      </Field>

      <Controller
        control={form.control}
        name="avatarEmoji"
        render={({ field }) => (
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-3 text-sm font-semibold">{t('Avatar')}</legend>
            <div className="grid grid-cols-6 gap-2">
              {AVATAR_EMOJI_IDS.map((id) => (
                <label
                  key={id}
                  className={cn(OPTION_CLASS, 'size-12 justify-self-center ring-offset-2')}
                >
                  <input
                    type="radio"
                    name={`${idPrefix}-avatar-emoji`}
                    value={id}
                    checked={field.value === id}
                    onChange={() => field.onChange(id)}
                    aria-label={emojiNames[id]}
                    className="sr-only"
                  />
                  <span aria-hidden="true" className="pointer-events-none">
                    <EmojiAvatar emoji={id} color={color} />
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
      />

      <Controller
        control={form.control}
        name="avatarColor"
        render={({ field }) => (
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-3 text-sm font-semibold">{t('Background color')}</legend>
            {/* Eight 44px targets do not fit a 358px phone column, so phones get two rows of four. */}
            <div className="grid grid-cols-4 gap-y-3 sm:grid-cols-8">
              {AVATAR_COLORS.map((value) => (
                <label
                  key={value}
                  className={cn(
                    OPTION_CLASS,
                    'size-11 justify-self-center ring-offset-1',
                    COLOR_CLASS[value],
                  )}
                >
                  <input
                    type="radio"
                    name={`${idPrefix}-avatar-color`}
                    value={value}
                    checked={field.value === value}
                    onChange={() => field.onChange(value)}
                    aria-label={colorNames[value]}
                    className="sr-only"
                  />
                </label>
              ))}
            </div>
          </fieldset>
        )}
      />
    </div>
  );
}
