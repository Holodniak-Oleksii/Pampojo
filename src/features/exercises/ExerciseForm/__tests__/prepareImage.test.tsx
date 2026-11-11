import { describe, expect, it } from 'vitest';
import { prepareImage } from '../prepareImage';

async function pngFile(width: number, height: number): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (context) {
    context.fillStyle = 'rgb(200, 100, 50)';
    context.fillRect(0, 0, width, height);
  }
  const blob = await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b ?? new Blob()), 'image/png'),
  );
  return new File([blob], 'photo.png', { type: 'image/png' });
}

describe('prepareImage', () => {
  it('rejects other types and files over 5 MB', async () => {
    await expect(
      prepareImage(new File(['hi'], 'a.txt', { type: 'text/plain' })),
    ).rejects.toMatchObject({
      reason: 'type',
    });
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.jpg', { type: 'image/jpeg' });
    await expect(prepareImage(big)).rejects.toMatchObject({ reason: 'size' });
  });

  it('scales a large photo to 1600px on the long side as JPEG', async () => {
    const blob = await prepareImage(await pngFile(3000, 2000));
    const bitmap = await createImageBitmap(blob);

    expect(blob.type).toBe('image/jpeg');
    expect([bitmap.width, bitmap.height]).toEqual([1600, 1067]);
  });
});
