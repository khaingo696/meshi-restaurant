// @ts-check
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { defineConfig } from 'astro/config';

/*
  Dveře meshi-door stahují three.js dynamickým importem, aby neblokovaly
  první vykreslení. Vedlejší efekt je ale řetěz, který se dá rozpojit:

      HTML → chunk komponenty (31 kB) → spustí se → loadGL() → three.js (472 kB)

  Těch 472 kB se tedy začne stahovat až poté, co menší chunk dorazí a
  proběhne. Na localhostu to dělá pár desítek ms, na skutečné lince je to
  celé jedno kolečko navíc na kritické cestě k tomu, kdy dveře přejdou
  z Canvas 2D na 3D — a právě než přejdou, vykreslují se procesorem.

  Tenhle hook po buildu dopíše do HTML <link rel="modulepreload">, takže
  prohlížeč začne chunk stahovat (a kompilovat) už při čtení hlavičky,
  souběžně se vším ostatním.

  Není to statický import, který INTEGRATION.md zakazuje — modulepreload
  je jen nápověda, nic nespouští a první vykreslení neblokuje. Jméno
  souboru se čte z výstupu, takže hash zůstává a cache se dál invaliduje.
*/
function preloadDoorWebgl() {
  return {
    name: 'meshi-door-modulepreload',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const outDir = fileURLToPath(dir);
        const astroDir = path.join(outDir, '_astro');

        let chunk;
        try {
          chunk = (await readdir(astroDir)).find((f) => /^webgl-view\..*\.js$/.test(f));
        } catch {
          /* žádné _astro/ — nic k napojení */
        }
        if (!chunk) {
          logger.warn('chunk webgl-view nenalezen, modulepreload se nepřidává');
          return;
        }

        const tag = `<link rel="modulepreload" href="/_astro/${chunk}">`;
        // Kotví se za preload obrázku dveří: ten má dorazit první, je menší
        // a je z něj hned vidět zavřené dveře.
        const anchor = '<link rel="preload" as="image" href="/meshi-door/meshi-door.webp"';

        let touched = 0;
        for (const page of await readdir(outDir, { recursive: true })) {
          if (!page.endsWith('.html')) continue;
          const file = path.join(outDir, page);
          const html = await readFile(file, 'utf8');
          // jen stránky, které dveře opravdu vykreslují
          if (!html.includes('id="meshi-door"') || html.includes(tag)) continue;
          const at = html.indexOf(anchor);
          if (at < 0) continue;
          const end = html.indexOf('>', at) + 1;
          await writeFile(file, html.slice(0, end) + tag + html.slice(end));
          touched++;
        }
        logger.info(`modulepreload ${chunk} → ${touched} stránka/y`);
      },
    },
  };
}

export default defineConfig({
  site: 'https://meshi-restaurant.eu',
  // Static output: každá stránka je HTML na Cloudflare CDN, nula Workers requestů.
  output: 'static',
  integrations: [preloadDoorWebgl()],
});
