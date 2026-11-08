import { describe, expect, it } from 'vitest';
import { render } from '@/test/render';
import { EmojiAvatar } from '../EmojiAvatar';

describe('EmojiAvatar', () => {
  it('uses the label as the accessible name', async () => {
    const screen = await render(<EmojiAvatar emoji="fox" color={1} label="John Smith" />);

    await expect.element(screen.getByRole('img', { name: 'John Smith' })).toBeVisible();
  });

  it('falls back to the emoji name in English', async () => {
    const screen = await render(<EmojiAvatar emoji="fox" color={2} />);

    await expect.element(screen.getByRole('img', { name: 'Fox' })).toBeVisible();
  });

  it('falls back to the emoji name in Ukrainian', async () => {
    const screen = await render(<EmojiAvatar emoji="fox" color={2} />, { locale: 'uk' });

    await expect.element(screen.getByRole('img', { name: 'Лисиця' })).toBeVisible();
  });
});
