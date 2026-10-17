// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import icon from 'astro-icon';

export default defineConfig({
  site: 'https://meshi-restaurant.eu',
  // Static output: každá stránka je HTML na Cloudflare CDN, nula Workers requestů.
  output: 'static',
  i18n: {
    locales: ['cs', 'en'],
    defaultLocale: 'cs',
    routing: { prefixDefaultLocale: false },
  },
  // Jen ikony, které web opravdu používá. Hvězdička by nabalila celou sadu.
  integrations: [
    icon({
      include: {
        ph: [
          'list', 'x', 'arrow-right', 'arrow-up-right', 'phone', 'envelope-simple',
          'map-pin', 'clock', 'instagram-logo', 'facebook-logo', 'sun', 'moon',
          'file-pdf',
        ],
      },
    }),
  ],
  vite: { plugins: [tailwindcss()] },
});
