// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://meshi-restaurant.eu',
  // Static output: každá stránka je HTML na Cloudflare CDN, nula Workers requestů.
  output: 'static',
});
