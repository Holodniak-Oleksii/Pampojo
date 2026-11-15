import type { MetadataRoute } from 'next';

// One file for both languages, so the description stays in English.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Pampojo',
    short_name: 'Pampojo',
    description:
      'Plan your workouts, log every set, and see your progress. Works offline in the gym.',
    start_url: '/today',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    // eslint-disable-next-line no-restricted-syntax -- the manifest needs a literal colour: the light background token.
    background_color: '#ECE9E4',
    // eslint-disable-next-line no-restricted-syntax -- same token; the page's theme-color meta follows the theme after load.
    theme_color: '#ECE9E4',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
