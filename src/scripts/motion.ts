/**
 * Pohybová vrstva webu Meshi.
 *
 * Postaveno podle oficiálních GSAP skillů (greensock/gsap-skills):
 *   SplitText            dělení nadpisů na řádky, včetně masky a přesplitování
 *                        po načtení fontů
 *   gsap.matchMedia()    podmínky pro breakpointy i pro omezený pohyb
 *   ScrollTrigger        pinnutí, scrub, paralaxa
 *
 * Jedna myšlenka drží celek: sál se divákovi otevírá. Fotky se neobjevují
 * prolnutím, ale odkrývají se zdola nahoru jako posuvná stěna.
 *
 * Pravidla: animují se jen `transform`, `opacity` a `clip-path`; žádný
 * posluchač na `scroll`; při omezeném pohybu se nespustí vůbec nic.
 *
 * Poučení, které stálo nejvíc času: jednu vizuální vlastnost smí řídit jen
 * jeden systém. Když výchozí polohu nastaví CSS transformem a GSAP pak animuje
 * `yPercent`, přečte si GSAP hodnotu z CSS do pixelového kanálu a obě se
 * sečtou. Proto CSS nikdy nesahá na transform prvků, které animujeme.
 *
 * Druhé poučení: scrub tween si zapamatuje výchozí hodnotu v okamžiku vzniku.
 * Když vzniká během úvodní animace, sebere si její rozpracovaný stav. Proto
 * mají tyhle tweeny výchozí hodnotu napsanou ručně a `immediateRender: false`.
 */

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger, SplitText);

const SILK = "power3.out";
const BASE_SCALE = 1;
const HIDDEN = "inset(0 0 100% 0)";
const SHOWN = "inset(0 0 0% 0)";

/* -------------------------------------------------------------------------
   Plynulý scroll
   ScrollSmoother od GSAP by tohle uměl taky, ale vyžaduje vlastní obalové
   elementy kolem celého dokumentu. Lenis je menší a do Astro layoutu sedne
   bez zásahu do struktury stránky.
------------------------------------------------------------------------- */

function initSmoothScroll() {
  const lenis = new Lenis({
    duration: 1.15,
    easing: (x) => Math.min(1, 1.001 - Math.pow(2, -10 * x)),
    smoothWheel: true,
    syncTouch: false,
  });

  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (!id || id === "#") return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target as HTMLElement, { offset: -80 });
    });
  });
}

/* -------------------------------------------------------------------------
   Text

   SplitText dělá dělení na řádky sám, včetně obalu s ořezem (`mask: "lines"`).
   `autoSplit` navíc rozdělí text znovu, jakmile doběhne načítání fontů nebo se
   změní šířka. Bez toho by se řádky spočítaly ze záložního fontu a po výměně
   by seděly jinde. Animace proto musí vznikat uvnitř `onSplit`, a když ji
   vrátíme, GSAP si ji při přesplitování sám uklidí a dorovná čas.
------------------------------------------------------------------------- */

function initTextReveals() {
  document.querySelectorAll<HTMLElement>("[data-split]").forEach((el) => {
    const mode = (el.dataset.split || "lines") as "lines" | "words" | "chars";

    SplitText.create(el, {
      type: mode === "chars" ? "chars,words" : mode === "words" ? "words" : "lines",
      mask: mode === "lines" ? "lines" : undefined,
      autoSplit: mode === "lines",
      // Screen reader dostane původní text, rozsekané kusy zůstanou skryté.
      aria: "auto",
      // Bez tohohle by se při dělení na znaky rozpadlo vyrovnání párů.
      smartWrap: mode === "chars",
      onSplit(self) {
        el.setAttribute("data-ready", "");

        /*
          Znaky: každý se doostří z rozmazání a přijede zdola. Písmeno po
          písmenu, takže nápis vystupuje z papíru, místo aby tam prostě byl.
        */
        if (mode === "chars") {
          return gsap.from(self.chars, {
            opacity: 0,
            yPercent: 45,
            filter: "blur(14px)",
            duration: 1,
            ease: SILK,
            stagger: 0.035,
            scrollTrigger: { trigger: el, start: "top 92%", once: true },
            onComplete: () => gsap.set(self.chars, { clearProps: "filter,transform" }),
          });
        }

        if (mode === "words") {
          return gsap.from(self.words, {
            y: 12,
            opacity: 0,
            filter: "blur(8px)",
            duration: 0.8,
            ease: SILK,
            stagger: 0.014,
            scrollTrigger: { trigger: el, start: "top 90%", once: true },
            onComplete: () => gsap.set(self.words, { clearProps: "filter" }),
          });
        }

        return gsap.from(self.lines, {
          yPercent: 110,
          duration: 1.25,
          ease: SILK,
          stagger: 0.06,
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
        });
      },
    });
  });
}

/* -------------------------------------------------------------------------
   Psací stroj

   Slogan se píše znak po znaku, na konci se na chvíli zastaví a začne znovu.
   Kurzor jede s posledním napsaným znakem, ne že by stál na konci řádku.

   Text si čtečka obrazovky přečte celý naráz: SplitText nechá na prvku
   `aria-label` a rozsekané znaky schová.
------------------------------------------------------------------------- */

function initTypewriter() {
  document.querySelectorAll<HTMLElement>("[data-typewriter]").forEach((el) => {
    const caret = el.parentElement?.querySelector<HTMLElement>("[data-caret]") ?? null;

    SplitText.create(el, {
      type: "chars",
      // Bez tohohle by se slova mohla zalomit uprostřed.
      smartWrap: true,
      aria: "auto",
      onSplit(self) {
        el.setAttribute("data-ready", "");
        const chars = self.chars as HTMLElement[];
        if (!chars.length) return;

        const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.6 });

        tl.set(chars, { autoAlpha: 0 });
        if (caret) tl.set(caret, { autoAlpha: 1, x: 0 }, 0);

        /*
          Nádech na prázdném řádku. Bez něj by první znak naskočil ve stejný
          okamžik jako skrytí zbytku a působilo by to, jako by tam pořád byl.
        */
        tl.to({}, { duration: 0.45 });

        tl.to(chars, {
          autoAlpha: 1,
          duration: 0.01,
          ease: "none",
          stagger: {
            each: 0.075,
            onStart() {
              // Kurzor doskočí za právě napsaný znak.
              const c = this.targets()[0] as HTMLElement;
              if (caret) gsap.set(caret, { x: c.offsetLeft + c.offsetWidth });
            },
          },
        });

        // Krátká pauza s blikajícím kurzorem, pak zase od začátku.
        tl.to({}, { duration: 0.9 });

        return tl;
      },
    });
  });
}

/*
  Skupiny, které mají naskakovat po sobě. Rodič dostane `data-stagger`,
  potomci se rozjedou jeden za druhým, jak k nim scroll dojede.
*/
function initStaggers() {
  document.querySelectorAll<HTMLElement>("[data-stagger]").forEach((group) => {
    const items = group.children;
    if (!items.length) return;
    gsap.set(items, { opacity: 0, y: 34 });
    group.setAttribute("data-ready", "");
    gsap.to(items, {
      opacity: 1,
      y: 0,
      duration: 0.95,
      ease: SILK,
      stagger: 0.11,
      scrollTrigger: { trigger: group, start: "top 85%", once: true },
    });
  });
}

/* -------------------------------------------------------------------------
   Fotky: odkryv zdola a dvojitá paralaxa
------------------------------------------------------------------------- */

function initFrames() {
  /*
    Fotky se neposouvají, odkrývají se. Rám vyjede zdola nahoru jako opona
    a snímek uvnitř přitom stojí na místě.

    Posun tu dřív byl dvakrát, z `data-stagger` na mřížce i z paralaxy uvnitř
    rámu. Obojí působilo při scrollu jako klouzající obdélníky, proto je fotka
    teď v klidu a pohyb obstará jen opona.
  */
  const reveal = (frames: HTMLElement[], trigger: Element) => {
    frames.forEach((f) => f.setAttribute("data-ready", ""));

    gsap.fromTo(
      frames,
      { clipPath: HIDDEN },
      {
        clipPath: SHOWN,
        duration: 1.15,
        ease: "power3.inOut",
        stagger: 0.14,
        scrollTrigger: { trigger, start: "top 84%", once: true },
      },
    );

    frames.forEach((f) => {
      const img = f.querySelector<HTMLElement>("[data-frame-img]");
      if (!img) return;

      /*
        Měřítko drží GSAP, ne třída v HTML. Kdyby ho nastavovalo CSS, psaly by
        do jedné vlastnosti `transform` dva systémy a hodnoty by se sečetly.

        Paralaxa uvnitř rámu tu byla, ale při scrollu vypadala jako klouzající
        obdélník. Fotka teď stojí a pouze se odkrývá.
      */
      gsap.set(img, { scale: BASE_SCALE });

      /*
        Hover. Fotky leží v papírovém světě pod jemným závojem; pod kurzorem
        se závoj rozpustí a snímek se nadechne.
      */
      // quickTo neumí souhrnné `scale`, proto obě osy zvlášť.
      const zone = f.closest("figure") ?? f;
      const opts = { duration: 0.75, ease: "power3.out" };
      const sx = gsap.quickTo(img, "scaleX", opts);
      const sy = gsap.quickTo(img, "scaleY", opts);
      const zoom = (v: number) => {
        sx(v);
        sy(v);
      };
      zone.addEventListener("pointerenter", () => {
        zoom(BASE_SCALE + 0.06);
        f.classList.add("is-hovered");
      });
      zone.addEventListener("pointerleave", () => {
        zoom(BASE_SCALE);
        f.classList.remove("is-hovered");
      });
    });
  };

  // Skupiny fotek se odkrývají jedna po druhé, ne všechny naráz.
  const grouped = new Set<HTMLElement>();
  document.querySelectorAll<HTMLElement>("[data-frame-group]").forEach((group) => {
    const frames = Array.from(group.querySelectorAll<HTMLElement>("[data-frame]"));
    frames.forEach((f) => grouped.add(f));
    if (frames.length) reveal(frames, group);
  });

  // Osamocené rámy mimo skupinu.
  document.querySelectorAll<HTMLElement>("[data-frame]").forEach((frame) => {
    if (!grouped.has(frame)) reveal([frame], frame);
  });
}

/* -------------------------------------------------------------------------
   Obecné odhalení
------------------------------------------------------------------------- */

function initReveals() {
  document.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => {
    const delay = Number(el.dataset.revealDelay ?? 0);
    gsap.set(el, { opacity: 0, y: 24 });
    el.setAttribute("data-ready", "");

    /*
      Prvky, které jsou vidět hned po načtení, nesmí čekat na scroll. Trigger
      "top 90%" se u nich totiž nikdy nespustí: leží pod tou hranicí a dokud
      návštěvník neposune stránku, zůstanou neviditelné. Týkalo se to spodní
      lišty v hero, která byla na 845 px při hranici 810 px.
    */
    // Stačí, že prvek na první obrazovce vůbec je. Přísnější hranice by
    // znovu vynechala právě tu lištu u spodního okraje.
    const inView = el.getBoundingClientRect().top < window.innerHeight;

    gsap.to(el, {
      opacity: 1,
      y: 0,
      duration: 1,
      delay,
      ease: SILK,
      ...(inView ? {} : { scrollTrigger: { trigger: el, start: "top 90%", once: true } }),
    });
  });

  // Zlaté vlasové linky se kreslí zleva doprava. Drží rytmus sekcí.
  document.querySelectorAll<HTMLElement>("[data-rule]").forEach((el) => {
    gsap.fromTo(
      el,
      { scaleX: 0, transformOrigin: "left center" },
      {
        scaleX: 1,
        duration: 1.5,
        ease: "power2.inOut",
        scrollTrigger: { trigger: el, start: "top 92%", once: true },
      },
    );
  });
}

/* -------------------------------------------------------------------------
   Paralaxa dekorativních prvků
------------------------------------------------------------------------- */

function initParallax() {
  document.querySelectorAll<HTMLElement>("[data-parallax]").forEach((el) => {
    const amount = Number(el.dataset.parallax ?? 14);
    gsap.fromTo(
      el,
      { yPercent: -amount / 2 },
      {
        yPercent: amount / 2,
        ease: "none",
        scrollTrigger: {
          trigger: el.parentElement ?? el,
          start: "top bottom",
          end: "bottom top",
          scrub: true,
        },
      },
    );
  });
}

/* -------------------------------------------------------------------------
   Vodorovný pan pokrmů
------------------------------------------------------------------------- */

function initHorizontalPan() {
  const wrap = document.querySelector<HTMLElement>("[data-pan]");
  const track = document.querySelector<HTMLElement>("[data-pan-track]");
  if (!wrap || !track) return;

  const distance = () => track.scrollWidth - window.innerWidth + 120;

  gsap.to(track, {
    x: () => -distance(),
    ease: "none",
    scrollTrigger: {
      trigger: wrap,
      start: "top top",
      end: () => "+=" + distance(),
      pin: true,
      scrub: 1,
      invalidateOnRefresh: true,
      anticipatePin: 1,
    },
  });

  // Obraz v každé kartě jede proti směru jízdy. Karty tím získají objem.
  gsap.utils.toArray<HTMLElement>("[data-pan-img]").forEach((img) => {
    gsap.fromTo(
      img,
      { xPercent: -7 },
      {
        xPercent: 7,
        ease: "none",
        scrollTrigger: {
          trigger: wrap,
          start: "top top",
          end: () => "+=" + distance(),
          scrub: 1,
        },
      },
    );
  });
}

/* -------------------------------------------------------------------------
   Magnetické CTA
------------------------------------------------------------------------- */

function initMagnetic() {
  document.querySelectorAll<HTMLElement>("[data-magnetic]").forEach((el) => {
    const xTo = gsap.quickTo(el, "x", { duration: 0.6, ease: "power3.out" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.6, ease: "power3.out" });

    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * 0.3);
      yTo((e.clientY - (r.top + r.height / 2)) * 0.3);
    });
    el.addEventListener("pointerleave", () => {
      xTo(0);
      yTo(0);
    });
  });
}

/* -------------------------------------------------------------------------
   Navigace
------------------------------------------------------------------------- */

function initNav() {
  const nav = document.querySelector<HTMLElement>("[data-nav]");
  if (!nav) return;

  ScrollTrigger.create({
    start: "top -80",
    end: 99999,
    onToggle: (self) => nav.classList.toggle("is-solid", self.isActive),
  });
}

/* ------------------------------------------------------------------------- */

/** Pojistka: co zůstalo skryté, se ukáže i bez animace. */
function releaseHiddenElements() {
  document
    .querySelectorAll<HTMLElement>("[data-split], [data-typewriter], [data-reveal], [data-frame], [data-frame-group], [data-stagger]")
    .forEach((el) => {
      el.setAttribute("data-ready", "");
      // Prvky bez potomků, třeba psací stroj, by GSAPu podstrčily prázdný seznam.
      if (el.children.length) gsap.set(el.children, { clearProps: "opacity,transform" });
    });
}

function boot() {
  /*
    matchMedia řeší breakpointy i omezený pohyb jedním nástrojem. Všechno, co
    uvnitř vznikne, GSAP sám uklidí, jakmile podmínka přestane platit. Ruční
    kontrola `prefers-reduced-motion` v každé funkci tím padá.
  */
  const mm = gsap.matchMedia();

  mm.add("(prefers-reduced-motion: reduce)", () => {
    // Žádný pohyb. Text stojí celý, kurzor nebliká.
    releaseHiddenElements();
    document
      .querySelectorAll<HTMLElement>("[data-caret]")
      .forEach((c) => c.remove());
  });

  mm.add("(prefers-reduced-motion: no-preference)", () => {
    try {
      initSmoothScroll();
      initTextReveals();
      initTypewriter();
      initStaggers();
      initFrames();
      initReveals();
      initParallax();
      initMagnetic();
      initNav();
    } catch (err) {
      console.error("[meshi] motion selhalo, obsah se zobrazí bez animace", err);
      releaseHiddenElements();
      return;
    }
    // Kdyby něco uvázlo, obsah se stejně ukáže.
    window.setTimeout(releaseHiddenElements, 2500);
  });

  // Vodorovný pan jen tam, kde je na něj místo. Na užších displejích zůstává
  // nativní scroll se snapem, gesto se uživateli nepřebírá.
  mm.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", () => {
    initHorizontalPan();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
