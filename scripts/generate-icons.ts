import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

// One-off generator: run `pnpm icons:generate` after changing the brand icon, then commit the output.
const SOURCE = 'docs/brand/pampojo-icon.svg';
const svg = readFileSync(SOURCE, 'utf8');

async function renderPng(size: number): Promise<Buffer> {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  const encoded = Buffer.from(svg).toString('base64');
  await page.setContent(
    `<html><body style="margin:0;background:transparent"><img src="data:image/svg+xml;base64,${encoded}" width="${size}" height="${size}" style="display:block"></body></html>`,
  );
  await page.locator('img').evaluate((img: HTMLImageElement) => img.decode());
  const png = await page.screenshot({
    omitBackground: true,
    clip: { x: 0, y: 0, width: size, height: size },
  });
  await page.close();
  return png;
}

// ICO container with embedded PNGs: 6-byte header, one 16-byte entry per image, then the images.
function buildIco(images: { size: number; png: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + 16 * images.length;
  const entries = images.map(({ size, png }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...images.map(({ png }) => png)]);
}

const browser = await chromium.launch();
try {
  const sizes = [16, 32, 48];
  const icoImages = await Promise.all(
    sizes.map(async (size) => ({ size, png: await renderPng(size) })),
  );
  writeFileSync('src/app/favicon.ico', buildIco(icoImages));
  writeFileSync('src/app/apple-icon.png', await renderPng(180));
  writeFileSync('src/app/icon.svg', svg);
  console.log('Wrote src/app/favicon.ico, src/app/apple-icon.png, src/app/icon.svg');
} finally {
  await browser.close();
}
