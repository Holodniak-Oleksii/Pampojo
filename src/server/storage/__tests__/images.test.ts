import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { toWebpFrames } from '../images';

async function png(width: number, height: number) {
  return sharp({ create: { width, height, channels: 3, background: { r: 245, g: 154, b: 98 } } })
    .png()
    .toBuffer();
}

describe('toWebpFrames', () => {
  it('returns WebP at 160px and 800px wide', async () => {
    const { thumb, full } = await toWebpFrames(await png(1600, 1200), 'image/png');

    const [t, f] = await Promise.all([sharp(thumb).metadata(), sharp(full).metadata()]);
    expect([t.format, t.width]).toEqual(['webp', 160]);
    expect([f.format, f.width]).toEqual(['webp', 800]);
  });

  it('does not upscale small photos', async () => {
    const { full } = await toWebpFrames(await png(300, 200), 'image/png');
    expect((await sharp(full).metadata()).width).toBe(300);
  });

  it('rejects other types and bytes that are not an image', async () => {
    await expect(toWebpFrames(await png(10, 10), 'image/gif')).rejects.toMatchObject({
      code: 'IMAGE_INVALID',
    });
    await expect(
      toWebpFrames(new TextEncoder().encode('hello'), 'image/jpeg'),
    ).rejects.toMatchObject({
      code: 'IMAGE_INVALID',
    });
  });
});
