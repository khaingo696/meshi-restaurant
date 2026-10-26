/* ==========================================================================
   MESHi — chování a pohyb.

   Pohyb je převzatý z mockupu (mockup/app.js). Pravidlo zůstává: žádná
   animace nesmí bránit ve čtení ani v ovládání, a všechno se vypne při
   prefers-reduced-motion. Jeden preset fade-up na všechno se nepoužívá —
   nadpisy vyjíždějí zpod výřezu, fotky se otvírají výřezem, pozadí a
   vodoznaky plují podle rolování.

   Chování (jazyk, formuláře, jídelní lístek, lightbox, hodnocení z Google,
   stav otevření) je původní a mockup ho neřeší.

   Obsah
     1  Pomůcky, skloňování, hodnocení z Google
     2  Lenis a kotvy
     2b Dveře meshi-door
     3  Lišta, panel s navigací, zpět nahoru
     4  Lightbox
     5  Jídelní lístek
     6  Formuláře
     7  Máme teď otevřeno?
     7b Hero: tři slova, práh dveří, magnetické tlačítko
     8  Jazyk
     9  POHYB
   ========================================================================== */
(function () {
  'use strict';

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  var body = document.body;
  var lb = null;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasGsap = typeof window.gsap !== 'undefined';
  var hasST   = hasGsap && typeof window.ScrollTrigger !== 'undefined';

  if (hasST) gsap.registerPlugin(ScrollTrigger);
  if (reduced) document.documentElement.classList.add('no-anim');

  var LANG = 'cs';
  var ratingData = null;

  /* ======================================================================
     1 · POMŮCKY, SKLOŇOVÁNÍ, HODNOCENÍ Z GOOGLE
     ====================================================================== */
  function t(key) {
    var pack = window.MESHI_I18N || {};
    var dict = pack[LANG] || pack.cs || {};
    if (dict[key] != null) return dict[key];
    if (pack.cs && pack.cs[key] != null) return pack.cs[key];
    return '';
  }

  function reviewWord(n) {
    n = Math.abs(Math.round(n));
    if (LANG === 'en') return n === 1 ? 'review' : 'reviews';
    if (n === 1) return 'recenze';
    var mod10 = n % 10;
    var mod100 = n % 100;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'recenze';
    return 'recenzí';
  }

  function dishWord(n) {
    n = Math.abs(Math.round(n));
    if (LANG === 'en') return n === 1 ? '1 dish' : n + ' dishes';
    if (n === 1) return '1 jídlo';
    if (n >= 2 && n <= 4) return n + ' jídla';
    return n + ' jídel';
  }

  function formatScore(n, dec) {
    var d = dec == null ? 1 : dec;
    var s = Number(n).toFixed(d);
    return LANG === 'en' ? s : s.replace('.', ',');
  }

  /* Hodnocení Google: čte se snapshot /google-rating.json (aktualizuje ho
     job jednou za den nebo dva). Jediné místo, kde se číslo ukazuje, je
     odznak v hero — a stejné číslo jde do strukturovaných dat v <Base>. */
  function applyGoogleRating(data) {
    if (!data) return;
    ratingData = data;
    var rating = parseFloat(data.rating);
    var count = parseInt(data.count, 10);
    if (!isFinite(rating) || !isFinite(count) || count < 0) return;
    var word = reviewWord(count);
    var scoreTxt = formatScore(rating);
    var countTxt = count.toLocaleString(LANG === 'en' ? 'en-GB' : 'cs-CZ');

    var scoreEl = $('#gRatingScore');
    if (scoreEl) scoreEl.textContent = scoreTxt;
    var countLabel = $('#gRatingCountLabel');
    if (countLabel) countLabel.textContent = countTxt + ' ' + word;
    if (data.mapsUrl) {
      var link = $('#gRatingLink');
      if (link) link.href = data.mapsUrl;
    }
    paintRatingAria();
  }

  /* Tiráž hera ukazuje jen číslo a souhvězdí, slovy ho nese až popisek pro
     čtečky — a ten musí nést totéž číslo jako .rating-score, i po přepnutí
     jazyka. Proto se skládá tady, ne přes data-i18n-aria. */
  function paintRatingAria() {
    var link = $('#gRatingLink');
    if (!link) return;
    var tpl = t('hero.ratingAria');
    if (!tpl) return;
    var scoreEl = $('#gRatingScore');
    var score = ratingData ? formatScore(ratingData.rating) : (scoreEl ? scoreEl.textContent : '');
    link.setAttribute('aria-label', tpl.replace('{score}', score));
  }

  fetch('/google-rating.json', { cache: 'no-cache' })
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(applyGoogleRating)
    .catch(function () {});

  /* ======================================================================
     2 · LENIS A KOTVY
     ====================================================================== */
  var lenis = null;
  if (!reduced && window.Lenis) {
    lenis = new Lenis({
      duration: 1.6,
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      smoothWheel: true,
      wheelMultiplier: 0.78,     // kolečko ujíždělo, tohle ho přibrzdí
      touchMultiplier: 1.4
    });
    if (hasST) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      gsap.ticker.lagSmoothing(0);
    } else {
      requestAnimationFrame(function raf(t) { lenis.raf(t); requestAnimationFrame(raf); });
    }
    window.lenis = lenis;
  }

  // Skok na kotvu musí skončit na začátku obsahu sekce, ne pod lištou.
  function headerGap() {
    var bar = $('.nav__in');
    var h = bar ? bar.getBoundingClientRect().bottom : 70;
    return Math.round(h + 24);
  }

  function goTo(target) {
    var el = typeof target === 'string' ? $(target) : target;
    if (!el) return;
    var gap = headerGap();
    if (lenis) lenis.scrollTo(el, { offset: -gap, duration: 1.15 });
    else window.scrollTo({ top: el.getBoundingClientRect().top + window.pageYOffset - gap, behavior: 'smooth' });
  }

  /* ======================================================================
     2b · DVEŘE MESHI-DOOR

     Overlay se šódži dveřmi si kreslí a ovládá vlastní modul
     (src/components/meshi-door/, popis v meshi-hero/meshi-door/INTEGRATION.md).
     Tady se s ním jen domlouvá zbytek webu:

       · Lenis po dobu dveří stojí. Dveře drží <html> na overflow: hidden a
         kolečko si berou samy; Lenis by si mezitím nastřádal posun a po
         odemčení by stránka uskočila.
       · Hero se odhalí teprve ve chvíli, kdy se dveře začnou otvírat —
         jinak by si animace odjela neviditelně za nimi (viz 9b).

     window.meshiDoor vyrábí modul, a ten jde jako type="module", tedy
     odloženě — při spuštění app.js ještě není. Čte se proto vždycky až
     v obsluze události, nikdy při startu.
     ====================================================================== */
  var doorEl = $('#meshi-door');

  /* Video v heru se nepouští samo (viz Hero.astro). Rozjede se teprve tehdy,
     až dveře vědí, čím kreslí — jinak by dekódování 1080p30 zdrželo chunk
     three.js natolik, že by ho dveře při startu neměly a kreslily by se
     procesorem. Bez dveří se pouští hned. */
  function startHeroVideo() {
    var v = $('video.hero-bg');
    if (!v || v.dataset.started) return;
    v.dataset.started = '1';
    if (v.dataset.src) v.src = v.dataset.src;
    var go = v.play();
    if (go && go.catch) go.catch(function () {});
  }

  function unlockPage() {
    document.documentElement.classList.remove('md-lock');
    if (lenis && !body.classList.contains('menu-open') && !body.classList.contains('ov-open')) lenis.start();
  }

  if (doorEl) {
    if (lenis) lenis.stop();

    /* Jakmile dveře stojí a mají renderer, video už nikomu nepřekáží.
       Pojistka na 4 s je pro případ, že by modul vůbec nenaběhl — hero
       pod dveřmi nesmí zůstat bez videa. */
    doorEl.addEventListener('meshi-door:statechange', function once() {
      if (doorEl.dataset.state === 'loading') return;
      doorEl.removeEventListener('meshi-door:statechange', once);
      startHeroVideo();
    });
    setTimeout(startHeroVideo, 4000);

    // Zámek sundává modul sám; tohle je jen pro Lenis. Pod dveřmi nemůže nic
    // otevřeného být, ale zámek patří tomu, kdo ho nasadil — kdyby se to
    // někdy sešlo, lístek si ho drží dál.
    doorEl.addEventListener('meshi-door:opened', unlockPage, { once: true });

    /* Pojistka proti zamčené stránce. .md-lock nasazuje inline skript
       komponenty ještě před prvním vykreslením a sundat ho umí jen modul —
       kdyby se jeho chunk nestáhl, zůstane domovská stránka zamčená pod
       černým překryvem a nedá se nic. Deset sekund je dost dlouho na to,
       aby to nikdy nezaskočilo náhodou. Ticho je tu správná odpověď: dveře
       stojí a čekají na vstup klidně minutu, tady jde o to, že vůbec
       nenaběhly (window.meshiDoor nevznikl). */
    setTimeout(function () {
      if (window.meshiDoor) return;
      unlockPage();
      doorEl.remove();
    }, 10000);
  }

  if (!doorEl) startHeroVideo();

  /* Zavolá fn ve chvíli, kdy se dveře rozjedou. Bez dveří (druhá návštěva
     v téže kartě, vypnutý modul) hned. Když dveře stojí a čekají na vstup,
     čeká se s nimi — hero se stejně odhalí teprve s nimi. Pojistka se tedy
     váže na to, že modul nenaběhl, ne na čas sám. */
  function whenDoorOpens(fn) {
    if (!doorEl) { fn(); return; }
    var fired = false;
    var run = function () { if (fired) return; fired = true; fn(); };
    doorEl.addEventListener('meshi-door:open', run, { once: true });
    setTimeout(function () { if (!window.meshiDoor) run(); }, 10000);
  }

  /* ======================================================================
     3 · LIŠTA, PANEL S NAVIGACÍ, ZPĚT NAHORU
     ====================================================================== */
  var burger = $('#burger');

  // Popisek tlačítka se mění se stavem, a mění se přes data-i18n-aria —
  // přepnutí jazyka pak nevrátí „Otevřít nabídku“ na otevřeném panelu.
  function paintBurger(open) {
    if (!burger) return;
    var key = open ? 'nav.closeMenu' : 'nav.openMenu';
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    burger.setAttribute('data-i18n-aria', key);
    burger.setAttribute('aria-label', t(key) || burger.getAttribute('aria-label'));
    var lbl = $('.nav__burgerLabel', burger);
    if (lbl) {
      var lblKey = open ? 'nav.close' : 'nav.menu';
      lbl.setAttribute('data-i18n', lblKey);
      lbl.textContent = t(lblKey) || lbl.textContent;
    }
  }

  /* Panel přikrývá celou stránku, takže se s ním musí stěhovat i fokus.
     Zavřený panel schovává CSS přes visibility: hidden (global.css, sekce
     16), čímž odejde z pořadí tabulátoru; tady zbývá dovnitř fokus poslat
     a při zavření ho vrátit na tlačítko, odkud vyšel. Bez toho skončí fokus
     na <body> a další Tab začíná zase od začátku stránky. */
  var sheet = $('#sheet');

  function sheetFocusables() {
    if (!sheet) return [];
    return $$('a[href], button, input, select, textarea', sheet)
      .filter(function (el) { return el.offsetParent !== null && !el.disabled; });
  }

  function closeMenu() {
    if (!body.classList.contains('menu-open')) return;
    var inside = sheet && sheet.contains(document.activeElement);
    body.classList.remove('menu-open');
    paintBurger(false);
    if (lenis) lenis.start();
    // Jen když fokus opravdu byl uvnitř — jinak bychom ho uživateli sebrali
    // odjinud (zavření klávesou Escape při psaní ve formuláři).
    if (inside && burger) burger.focus();
  }

  if (burger) {
    burger.addEventListener('click', function () {
      var open = body.classList.toggle('menu-open');
      paintBurger(open);
      if (lenis) open ? lenis.stop() : lenis.start();
      if (open) {
        // Až po dojetí křídel: dřív je panel ještě visibility: hidden
        // a .focus() by na něm neudělal nic.
        setTimeout(function () {
          var f = sheetFocusables();
          if (f.length && body.classList.contains('menu-open')) f[0].focus();
        }, 180);
      }
    });
  }

  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (!id || id === '#' || !$(id)) return;
      e.preventDefault();
      var wasOpen = body.classList.contains('menu-open');
      closeMenu();
      // panel se musí stihnout zavřít, než začneme rolovat
      setTimeout(function () { goTo(id); }, wasOpen ? 260 : 0);
    });
  });

  // Scrollspy a ukazatel postupu. Odkazy jsou v panelu — lišta jich nese jen
  // dva, a ty nejsou navigace, ale akce.
  var navLinks = $$('#sheet .sheet-nav a').filter(function (a) {
    return (a.getAttribute('href') || '').charAt(0) === '#';
  });
  var sections = navLinks
    .map(function (a) { return $(a.getAttribute('href')); })
    .filter(Boolean);

  function onScroll() {
    var y = window.pageYOffset;

    var current = sections[0];
    for (var i = 0; i < sections.length; i++) {
      if (sections[i].getBoundingClientRect().top <= 140) current = sections[i];
    }
    navLinks.forEach(function (a) {
      a.classList.toggle('active', !!current && a.getAttribute('href') === '#' + current.id);
    });

    var p = $('#progress');
    if (p) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      p.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, y / max) : 0) + ')';
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  // Zpět nahoru
  var toTop = $('#toTop');
  if (toTop) {
    toTop.addEventListener('click', function () {
      if (lenis) lenis.scrollTo(0, { duration: 1.25 });
      else window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    });
  }

  /* ======================================================================
     4 · LIGHTBOX
     Zvětšení fotky v jídelním lístku. V galerii lightbox není: fotky
     drží celou plochu a jsou už v měřítku místnosti.
     ====================================================================== */
  lb = $('#lb');
  var lbImg = $('#lbImg');

  function openLb(src, alt) {
    if (!lb) return;
    lbImg.src = src; lbImg.alt = alt || '';
    lb.classList.add('on');
    if (lenis) lenis.stop();
    if (hasGsap && !reduced) {
      gsap.fromTo(lbImg, { scale: 0.92, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45, ease: 'power3.out' });
    }
    $('#lbClose').focus();
  }

  function closeLb() {
    if (!lb || !lb.classList.contains('on')) return;
    lb.classList.remove('on');
    // Pod lightboxem může zůstat otevřený překryv s lístkem — ten drží zámek dál.
    if (lenis && !body.classList.contains('ov-open')) lenis.start();
  }

  if (lb) {
    lb.addEventListener('click', function (e) { if (e.target !== lbImg) closeLb(); });
    $('#lbClose').addEventListener('click', closeLb);
  }

  /* ======================================================================
     5 · JÍDELNÍ LÍSTEK
     Překryv otevírá tlačítko v sekci Signatures; kategorii mu nastavuje
     ukázka jídel podle toho, které jídlo je právě uprostřed.
     Adresa se mění na #menu/<slug>, takže zpět v prohlížeči překryv zavře
     a odkaz na konkrétní kategorii jde poslat dál.
     ====================================================================== */
  var ov       = $('#menuOv');
  var ovPanel  = $('.menu-ov-panel', ov);
  var ovTitle  = $('#menuOvTitle');
  var ovNote   = $('#menuOvNote');
  var ovTabs   = $$('.menu-ov-tab');
  var ovPanes  = $$('.menu-pane');
  var menuBtn  = $('#showMenuBtn');
  var lastOpener = null;   // kam vrátit fokus po zavření
  var ovOpen   = false;

  // Popisky i počty bere překryv ze svých záložek, ať data žijí jen
  // v src/data/menu.ts. Počet se skloňuje, proto se text skládá tady.
  var catMeta = {};
  function refreshCatMeta() {
    ovTabs.forEach(function (tab) {
      catMeta[tab.dataset.go] = {
        label: tab.textContent.trim(),
        count: tab.dataset.n ? dishWord(+tab.dataset.n) : ''
      };
    });
    if (ovOpen && ov && ov.dataset.cat) paintCat(ov.dataset.cat);
  }

  function paintCat(slug) {
    var meta = catMeta[slug];
    if (!meta) return false;

    ovPanes.forEach(function (p) { p.hidden = p.dataset.pane !== slug; });
    ovTabs.forEach(function (tab) { tab.setAttribute('aria-pressed', String(tab.dataset.go === slug)); });

    ovTitle.textContent = meta.label;
    ovNote.textContent  = meta.count;

    var pane = $('.menu-pane[data-pane="' + slug + '"]', ov);
    if (pane && hasGsap && !reduced) {
      /* Vodorovně SMÍME jedině tady: mezi kategoriemi se jde do strany,
         takže posun do strany nese význam — vlevo zpět, vpravo dál. */
      var order = ovPanes.map(function (p) { return p.dataset.pane; });
      var dir = (order.indexOf(slug) >= order.indexOf(ov.dataset.cat || slug)) ? 1 : -1;
      gsap.fromTo(pane, { x: dir * 46, opacity: 0 },
        { x: 0, opacity: 1, duration: .45, ease: 'power3.out', overwrite: true });
      gsap.fromTo($$('.dish-card', pane),
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: .5, ease: 'power2.out', stagger: .035,
          delay: .08, overwrite: true });
    }
    if (ovOpen) ov.dataset.cat = slug;
    return true;
  }

  function openCat(slug, push) {
    if (!ov || !paintCat(slug)) return;

    lastOpener = menuBtn || document.activeElement;
    ov.hidden = false;
    ovOpen = true;
    ov.dataset.cat = slug;
    void ov.offsetWidth;              // vynutit přechod z hidden
    ov.classList.add('on');
    body.classList.add('ov-open');
    if (menuBtn) menuBtn.setAttribute('aria-expanded', 'true');
    if (lenis) lenis.stop();

    if (push && location.hash !== '#menu/' + slug) {
      history.pushState({ menu: slug }, '', '#menu/' + slug);
    }
    $('#menuOvClose').focus();
  }

  function closeCat(push) {
    if (!ov || !ovOpen) return;
    ovOpen = false;
    ov.classList.remove('on');
    body.classList.remove('ov-open');
    if (lenis) lenis.start();
    if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');

    var finish = function () { if (!ovOpen) ov.hidden = true; };
    if (reduced) finish(); else setTimeout(finish, 320);

    if (push && /^#menu\//.test(location.hash)) history.pushState(null, '', location.pathname);
    if (lastOpener && lastOpener.isConnected) lastOpener.focus();
    lastOpener = null;
  }

  // Fokus nesmí utéct za překryv, dokud je otevřený.
  /* Past na fokus. Platí pro překryv s lístkem i pro panel s navigací —
     obojí leží přes celou stránku, takže se z nich tabulátorem nemá
     odcházet dozadu na obsah, který není vidět. */
  function trapFocus(e) {
    if (e.key !== 'Tab') return;
    var f;
    if (ovOpen && ovPanel) {
      f = $$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', ovPanel)
        .filter(function (el) { return el.offsetParent !== null && !el.disabled; });
    } else if (body.classList.contains('menu-open')) {
      // Tlačítko Menu zůstává v kruhu: je to jediná cesta ven myší i klávesou.
      f = sheetFocusables();
      if (burger) f.unshift(burger);
    } else {
      return;
    }
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  if (ov) {
    refreshCatMeta();

    if (menuBtn) {
      menuBtn.addEventListener('click', function () {
        openCat(menuBtn.dataset.cat || ovTabs[0].dataset.go, true);
      });
    }

    ovTabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        if (ov.dataset.cat === tab.dataset.go) return;
        paintCat(tab.dataset.go);
        ov.dataset.cat = tab.dataset.go;
        history.replaceState({ menu: tab.dataset.go }, '', '#menu/' + tab.dataset.go);
      });
    });

    $('#menuOvClose').addEventListener('click', function () { closeCat(true); });
    $$('[data-close]', ov).forEach(function (el) {
      el.addEventListener('click', function () { closeCat(true); });
    });

    $$('.dish-zoom', ov).forEach(function (btn) {
      btn.addEventListener('click', function () {
        openLb(btn.dataset.full, btn.dataset.name || '');
      });
    });

    // Zpět/vpřed v prohlížeči i přímý odkaz na #menu/<slug>.
    var syncFromHash = function () {
      var m = /^#menu\/([a-z0-9-]+)$/.exec(location.hash);
      if (m && catMeta[m[1]]) {
        if (!ovOpen) openCat(m[1], false);
        else if (ov.dataset.cat !== m[1]) { paintCat(m[1]); ov.dataset.cat = m[1]; }
      } else if (ovOpen) {
        closeCat(false);
      }
    };
    window.addEventListener('popstate', syncFromHash);
    syncFromHash();
  }

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') { trapFocus(e); return; }
    if (lb && lb.classList.contains('on')) { closeLb(); return; }
    if (ovOpen) { e.preventDefault(); closeCat(true); return; }
    closeMenu();
  });

  /* ======================================================================
     6 · FORMULÁŘE
     POZOR — PŘEDÁVKA: tohle zatím NIC NEODESÍLÁ.
     Formulář se jen zvaliduje, ukáže hlášku o přijetí a vyresetuje se;
     rezervace ani objednávka poukazu se nikam nedoručí. Než web pustíte
     na hosty, doplňte odeslání (endpoint / mail na info@meshi-restaurant.cz)
     a teprve po úspěšné odpovědi ukazujte #resOk / #vOk. Platí pro
     #resForm i #vForm. Stejně nedodělaná je i #objednavka v panelu.
     ====================================================================== */
  function wire(formId, okId) {
    var f = $(formId), ok = $(okId);
    if (!f || !ok) return;
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!f.checkValidity()) { f.reportValidity(); return; }
      ok.classList.add('on');
      f.reset();
      setDefaultDate();
      if (hasGsap && !reduced) gsap.from(ok, { opacity: 0, y: 8, duration: .45, ease: 'power2.out' });
      ok.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
    });
  }
  wire('#resForm', '#resOk');
  wire('#vForm', '#vOk');

  /* Na telefonu spí formulář poukazu (CSS, sekce 18 — gate je html.js,
     takže bez JavaScriptu zůstane vidět). Rezervace spí schválně ne:
     kdo chce stůl, má mít pole rovnou před sebou. Tlačítko formulář
     probudí a spotlight se přesune — fotka poukazu ustoupí a zlato
     přejde z tlačítka na odeslání. Třída jde na sekci, ne na formulář. */
  function wakeForm(btnId, formId) {
    var btn = $(btnId), form = $(formId);
    if (!btn || !form) return;
    btn.addEventListener('click', function () {
      var sec = btn.closest('section');
      if (!sec || sec.classList.contains('is-open')) return;
      sec.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true');
      /* Panel má vlastní reveal (9e) a ten mu mohl nechat opacity: 0,
         protože se spustil, když byl formulář ještě display: none. */
      if (hasGsap && !reduced) {
        gsap.fromTo(form, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: .55, ease: 'power3.out' });
      } else if (hasGsap) {
        gsap.set(form, { opacity: 1, y: 0 });
      }
      /* Fokus na formulář, ne na první pole: na telefonu by vyskočila
         klávesnice dřív, než host uvidí, co se otevřelo. */
      form.focus({ preventScroll: true });
      if (window.ScrollTrigger) ScrollTrigger.refresh();
    });
  }
  wakeForm('#giftOpen', '#vForm');

  // Poznámka je nepovinná — ukážeme ji, až o ni někdo stojí.
  var noteToggle = $('#noteToggle'), noteField = $('#noteField');
  if (noteToggle && noteField) {
    noteToggle.addEventListener('click', function () {
      var open = noteField.hidden;
      noteField.hidden = !open;
      noteToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) {
        $('#r-note').focus();
        if (hasGsap && !reduced) gsap.from(noteField, { opacity: 0, y: -6, duration: .35, ease: 'power2.out' });
      }
    });
  }

  function setDefaultDate() {
    var el = $('#r-date');
    if (!el) return;
    var d = new Date(); d.setDate(d.getDate() + 1);
    el.min = new Date().toISOString().slice(0, 10);
    el.value = d.toISOString().slice(0, 10);
  }
  setDefaultDate();

  /* ======================================================================
     7 · MÁME TEĎ OTEVŘENO?
     Neděle = 0. Zavírací hodina platí pro týž den, po půlnoci nevaříme.
     ====================================================================== */
  var HOURS = [
    { o: 12, c: 22 }, { o: 11, c: 22 }, { o: 11, c: 22 }, { o: 11, c: 22 },
    { o: 11, c: 22 }, { o: 11, c: 23 }, { o: 11, c: 23 }
  ];

  // „ve“ před číslovkami, které se vyslovují se souhláskovým shlukem
  // (dvanáct, třináct, čtrnáct, dvacet…), jinak „v“.
  function prep(h) {
    return ([2, 4, 12, 13, 14].indexOf(h) > -1 || (h >= 20 && h <= 29)) ? 've' : 'v';
  }
  function hhmm(h) { return h + ':00'; }

  function renderOpenState() {
    var el = $('#openState');
    if (!el) return;
    // Hero tiráž má stav a čas každý ve svém <span> (lampionový uhlík je
    // nad nimi třetí) — stav je zlatý a polotučný, čas tišší.
    var stateEl = el.querySelector('.hours-state');
    var timeEl = el.querySelector('.hours-time');
    if (!stateEl || !timeEl) return;
    var now = new Date();
    var day = now.getDay();
    var mins = now.getHours() * 60 + now.getMinutes();
    var today = HOURS[day];
    var open = mins >= today.o * 60 && mins < today.c * 60;
    var en = LANG === 'en';

    if (open) {
      el.classList.remove('is-closed');
      stateEl.textContent = en ? 'Open' : 'Otevřeno';
      timeEl.textContent = en
        ? 'until ' + hhmm(today.c)
        : 'zavíráme ' + prep(today.c) + ' ' + hhmm(today.c);
      return;
    }

    el.classList.add('is-closed');
    stateEl.textContent = en ? 'Closed' : 'Zavřeno';
    if (mins < today.o * 60) {
      timeEl.textContent = en
        ? 'opens today at ' + hhmm(today.o)
        : 'otevíráme dnes ' + prep(today.o) + ' ' + hhmm(today.o);
    } else {
      var next = HOURS[(day + 1) % 7];
      timeEl.textContent = en
        ? 'opens tomorrow at ' + hhmm(next.o)
        : 'otevíráme zítra ' + prep(next.o) + ' ' + hhmm(next.o);
    }
  }

  /* ======================================================================
     7b · HERO: TŘI SLOVA, PRÁH DVEŘÍ, MAGNETICKÉ TLAČÍTKO

     Chování kickeru „Taste  Feel  Connect“ a tlačítka v heru. Hodnoty jsou
     z prototypu (meshi-hero/main.js, popis v INTEGRATION.md, část 2, bod 4).
     Leží to tady, ne v <script> u komponenty, protože zdejší web drží
     všechno chování v tomhle jednom souboru z public/ — viz hlavička.

     Co se smí hýbat samo (cyklus slov, glide ze spáry dveří, magnet
     tlačítka), se při prefers-reduced-motion nespustí. Přeostření pod
     kurzorem a ve fokusu zůstává vždycky: to je ovládání, ne ozdoba, a
     doostření slova je jediný ukazatel fokusu, který ta podoba má —
     obrys by byl přesně ta linka, které se celý kicker vyhýbá.
     ====================================================================== */
  var heroEl = $('.hero');
  var heroKicker = $('.hero-kicker');
  var kickerNodes = heroKicker ? $$('.kicker-node', heroKicker) : [];

  var activeWord = 0;
  var wordHeld = false;      // návštěvník si drží slovo sám, cyklus nechá být

  function setActiveWord(idx) {
    activeWord = Number(idx);
    if (heroEl) heroEl.dataset.activeWord = String(activeWord);
  }

  if (heroEl && heroKicker && kickerNodes.length) {
    if (!reduced) {
      setInterval(function () {
        if (!wordHeld) setActiveWord((activeWord + 1) % 3);
      }, 3200);
    }

    kickerNodes.forEach(function (node) {
      var idx = Number(node.dataset.word);
      var hold = function () {
        wordHeld = true;
        heroEl.classList.add('is-word-hovered');
        setActiveWord(idx);
      };
      node.addEventListener('pointerenter', hold);
      node.addEventListener('focus', hold);
      node.addEventListener('click', function () { setActiveWord(idx); });
    });

    heroKicker.addEventListener('pointerleave', function () {
      wordHeld = false;
      heroEl.classList.remove('is-word-hovered');
    });
    heroKicker.addEventListener('focusout', function (e) {
      if (!heroKicker.contains(e.relatedTarget)) {
        wordHeld = false;
        heroEl.classList.remove('is-word-hovered');
      }
    });
  }

  /* Tři slova vyjedou ze spáry mezi křídly šódži: --door-p jde od 0 do 1
     spolu s intro.progress, zbytek je v CSS (.hero-kicker.is-door-sync).
     Výchozí hodnota v CSS je 1, takže bez dveří i při omezeném pohybu
     stojí slova rovnou na svém místě a tenhle blok nemá co dělat. */
  if (doorEl && heroKicker && !reduced) {
    var doorSyncRaf = 0;

    var syncKickerWithDoor = function () {
      var intro = window.meshiDoor;
      if (!intro) return;
      var p = Math.min(1, Math.max(0, intro.progress == null ? 1 : intro.progress));
      heroKicker.style.setProperty('--door-p', p.toFixed(4));

      if (intro.state === 'opening' && p < 0.995) {
        heroKicker.classList.add('is-door-sync');
        doorSyncRaf = requestAnimationFrame(syncKickerWithDoor);
      } else {
        heroKicker.style.setProperty('--door-p', '1');
        heroKicker.classList.remove('is-door-sync');
      }
    };

    doorEl.addEventListener('meshi-door:statechange', function () {
      cancelAnimationFrame(doorSyncRaf);
      var intro = window.meshiDoor;
      if (!intro) return;
      if (intro.state === 'opening') {
        syncKickerWithDoor();
      } else {
        heroKicker.style.setProperty('--door-p', '1');
        heroKicker.classList.remove('is-door-sync');
      }
    });
  }

  /* Magnet na tlačítku do menu: posune se o kousek za kurzorem. */
  var heroCta = $('.hero-cta');
  if (heroCta && !reduced) {
    heroCta.addEventListener('pointermove', function (e) {
      var rect = heroCta.getBoundingClientRect();
      var dx = (e.clientX - (rect.left + rect.width / 2)) * 0.16;
      var dy = (e.clientY - (rect.top + rect.height / 2)) * 0.28;
      heroCta.style.setProperty('--mag-x', dx.toFixed(1) + 'px');
      heroCta.style.setProperty('--mag-y', dy.toFixed(1) + 'px');
    });
    heroCta.addEventListener('pointerleave', function () {
      heroCta.style.setProperty('--mag-x', '0px');
      heroCta.style.setProperty('--mag-y', '0px');
    });
  }

  /* ======================================================================
     8 · JAZYK
     ====================================================================== */
  function paintZoomLabels() {
    $$('.dish-zoom').forEach(function (btn) {
      var name = btn.dataset.name || '';
      btn.setAttribute('aria-label', t('menu.zoom') + (name ? ': ' + name : ''));
    });
  }

  function paintMapLang() {
    var iframe = $('.con__map iframe');
    if (!iframe) return;
    var src = iframe.getAttribute('src') || '';
    var next = src.replace(/!1s[a-z]{2}!2s[a-z]{2}/, LANG === 'en' ? '!1sen!2scz' : '!1scs!2scz');
    if (next !== iframe.src && next !== src) iframe.src = next;
  }

  /* Ukázka jídel a galerie: překlad popisků se přepíše tady. */
  var paintShowcase = function () {};
  var paintGallery = function () {};

  function applyLang(next, persist) {
    LANG = next === 'en' ? 'en' : 'cs';
    if (persist !== false) {
      try { localStorage.setItem('meshi-lang', LANG); } catch (e) {}
    }
    document.documentElement.lang = LANG;

    $$('[data-i18n]').forEach(function (el) {
      var val = t(el.getAttribute('data-i18n'));
      if (val) el.textContent = val;
    });
    $$('[data-i18n-html]').forEach(function (el) {
      var val = t(el.getAttribute('data-i18n-html'));
      if (val) el.innerHTML = val;
    });
    $$('[data-i18n-placeholder]').forEach(function (el) {
      var val = t(el.getAttribute('data-i18n-placeholder'));
      if (val) el.setAttribute('placeholder', val);
    });
    $$('[data-i18n-aria]').forEach(function (el) {
      var val = t(el.getAttribute('data-i18n-aria'));
      if (val) el.setAttribute('aria-label', val);
    });
    $$('[data-i18n-alt]').forEach(function (el) {
      var val = t(el.getAttribute('data-i18n-alt'));
      if (val) el.setAttribute('alt', val);
    });
    $$('[data-i18n-title]').forEach(function (el) {
      var val = t(el.getAttribute('data-i18n-title'));
      if (val) el.setAttribute('title', val);
    });

    var title = t('meta.title');
    if (title) document.title = title;
    var desc = $('meta[name="description"]');
    var descTxt = t('meta.desc');
    if (desc && descTxt) desc.setAttribute('content', descTxt);

    $$('.lang button').forEach(function (btn) {
      var on = btn.getAttribute('data-lang') === LANG;
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', String(on));
    });

    // Popisek hamburgeru nese stav, ne jen jméno — viz paintBurger.
    paintBurger(body.classList.contains('menu-open'));

    refreshCatMeta();
    paintZoomLabels();
    paintMapLang();
    paintShowcase();
    paintGallery();
    buildSplitWords();
    if (ratingData) applyGoogleRating(ratingData);
    else paintRatingAria();
    renderOpenState();
  }

  $$('.lang button').forEach(function (b) {
    b.addEventListener('click', function () {
      applyLang(b.getAttribute('data-lang'));
    });
  });

  /* ======================================================================
     9 · POHYB
     ====================================================================== */

  /* Odstavce v sekci O nás se rozsvěcují slovo po slovu podle rolování.
     Slova obaluje až JS, aby v HTML zůstal čistý text; obchází se přitom
     vnořené <strong>, které v odstavci je. Po přepnutí jazyka se obalení
     musí udělat znovu — i18n celý odstavec přepíše. */
  var splitTriggers = [];

  function unsplit(p) {
    $$('.w', p).forEach(function (s) {
      s.parentNode.replaceChild(document.createTextNode(s.textContent), s);
    });
    p.normalize();
  }

  function wrapWords(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
      if (!/\S/.test(node.nodeValue)) return;
      var frag = document.createDocumentFragment();
      node.nodeValue.split(/(\s+)/).forEach(function (part) {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
        var s = document.createElement('span');
        s.className = 'w';
        s.textContent = part;
        frag.appendChild(s);
      });
      node.parentNode.replaceChild(frag, node);
    });
  }

  function buildSplitWords() {
    splitTriggers.forEach(function (st) { st.kill(); });
    splitTriggers = [];
    $$('.splitwords').forEach(function (p) { unsplit(p); });
    if (!hasST || reduced) return;
    $$('.splitwords').forEach(function (p) {
      wrapWords(p);
      var tw = gsap.to($$('.w', p), {
        opacity: 1, ease: 'none', stagger: 1,
        scrollTrigger: { trigger: p, start: 'top 84%', end: 'bottom 58%', scrub: true }
      });
      if (tw.scrollTrigger) splitTriggers.push(tw.scrollTrigger);
    });
  }

  /* Ukázka jídel. Musí se postavit dřív, než applyLang poprvé zavolá
     paintShowcase(), proto je to tady a ne až na konci. */
  function initShowcase() {
    var stage = $('#showStage');
    if (!stage) return;

    var dishes = $$('.dish', stage);
    var nameEl = $('#showName');
    var kickEl = $('#showKicker');
    var priceEl = $('#showPrice');
    var markEl = $('#showMark');
    var barEl = $('#showBar');
    if (!dishes.length || !nameEl) return;

    var cur = 0;

    // Popisek kategorie se překládá, název jídla ne.
    function catLabel(d) {
      var slug = d.dataset.cat;
      return t('cat.' + slug) || d.dataset.kicker || '';
    }

    function writeMeta(i) {
      var d = dishes[i];
      kickEl.textContent = catLabel(d);
      nameEl.textContent = d.dataset.name;
      priceEl.textContent = d.dataset.price || '';
      if (menuBtn) menuBtn.dataset.cat = d.dataset.cat;
    }

    paintShowcase = function () { writeMeta(cur); };
    writeMeta(0);

    if (reduced || !hasST) {
      /* Bez pohybu se z připíchnuté scény stane obyčejný vodorovný pás,
         který se dá odrolovat prstem nebo klávesnicí. Jméno pak nese
         popisek u každého jídla, ne .show__meta uprostřed. */
      var pin = $('#showPin');
      if (pin) pin.classList.add('is-static');
      return;
    }

    function setMeta(i) {
      if (i === cur) return;
      cur = i;
      gsap.timeline()
        .to([kickEl, nameEl, priceEl], { opacity: 0, y: 12, duration: .2, ease: 'power1.in' })
        .add(function () { writeMeta(i); })
        .to([kickEl, nameEl, priceEl], { opacity: 1, y: 0, duration: .45, stagger: .04, ease: 'power3.out' });
    }

    // Posun, při kterém je střed i-tého jídla na středu obrazovky.
    var off = function (i) { return dishes[i].offsetLeft + dishes[i].offsetWidth / 2 - window.innerWidth / 2; };
    var span = function () { return off(dishes.length - 1) - off(0); };

    gsap.fromTo(stage, { x: function () { return -off(0); } }, {
      x: function () { return -off(dishes.length - 1); },
      ease: 'none',
      scrollTrigger: {
        trigger: '.show__pin', start: 'top top',
        end: function () { return '+=' + span() * 1.15; },
        pin: true, scrub: .55, invalidateOnRefresh: true,
        // zastavit se má na jídle, ne v mezeře mezi dvěma
        snap: { snapTo: 1 / (dishes.length - 1), duration: { min: .18, max: .42 }, delay: .06, ease: 'power2.inOut' },
        onUpdate: function (self) {
          setMeta(Math.round(self.progress * (dishes.length - 1)));
          gsap.set(barEl, { width: (12 + self.progress * 88) + '%' });
          var cx = window.innerWidth / 2;
          dishes.forEach(function (el) {
            var r = el.getBoundingClientRect();
            var d = (r.left + r.width / 2 - cx) / cx;        // -1 … 0 … 1
            var a = Math.abs(d);
            gsap.set(el, {
              scale: gsap.utils.clamp(.6, 1, 1 - a * .34),
              rotate: gsap.utils.clamp(-8, 8, d * 9),
              yPercent: a * 6,
              opacity: gsap.utils.clamp(.3, 1, 1 - a * .62)
            });
          });
          // velmi lehké „dýchání“ loga, ať scéna nestojí úplně na místě
          gsap.set(markEl, {
            scale: 1 + Math.sin(self.progress * Math.PI) * .07,
            opacity: .11 + Math.sin(self.progress * Math.PI) * .05
          });
        }
      }
    });
  }
  initShowcase();

  /* ======================================================================
     9g · GALERIE — „Prah“

     Signatures už jedou vodorovně; tady se jde do hloubky. Fotka drží
     celou plochu. První dva až tři vteřiny ukáže vrstva .gal__intro vchod
     a sál (leží NAD scénou, takže si s pinovanou osou nic nepřebíjí),
     pak zmizí. Rolování je chůze: každé další otevření má jiné gesto,
     protože každá místnost se jinak vchází.

     Časová osa pinu (0–1):
       0 – .16   stát ve dveřích, pomalý krok dopředu
       pak       šest prahů, každý = přechod + stání v místnosti
     ====================================================================== */
  function initGallery() {
    var pin = $('#galPin');
    if (!pin) return;

    var scenes = $$('.gal__scene', pin);
    var roomEl = $('#galRoom');
    var railEl = $('#galRail');
    var steps = $$('.gal__step', pin);
    var intro = $('#galIntro');
    var wmEl = $('.wm--gal', pin);
    var n = scenes.length;
    if (!n) return;

    var roomKeys = scenes.map(function (el) { return el.getAttribute('data-room'); });
    var cur = 0;
    var holds = [];
    var st = null;
    var introTl = null;

    function writeHud(i) {
      if (roomEl) roomEl.textContent = t(roomKeys[i]) || '';
      steps.forEach(function (b, k) {
        b.classList.toggle('on', k === i);
        if (k === i) b.setAttribute('aria-current', 'true');
        else b.removeAttribute('aria-current');
      });
    }

    paintGallery = function () { writeHud(cur); };
    writeHud(0);

    if (reduced || !hasST) {
      pin.classList.add('is-static');
      return;
    }

    function plan() {
      var first = 0.16;
      var segs = n - 1;
      var trans = 0.056;
      var hold = (1 - first - segs * trans) / segs;
      holds = [{ start: 0, end: first, mid: first * 0.6 }];
      var t0 = first;
      for (var i = 1; i < n; i++) {
        var t1 = t0 + trans;
        var t2 = i === n - 1 ? 1 : t1 + hold;
        holds.push({ start: t1, end: t2, mid: t1 + (t2 - t1) * 0.45, transStart: t0, transEnd: t1 });
        t0 = t2;
      }
      return { first: first, trans: trans };
    }

    function roomAt(p) {
      var i = 0;
      for (var k = 0; k < n; k++) {
        if (p >= (holds[k].transStart != null ? holds[k].transStart : holds[k].start)) i = k;
      }
      return i;
    }

    function paintCaption(p) {
      if (!roomEl) return;
      var h = holds[cur];
      var op = 1;
      if (h.transStart != null && p < h.start) {
        op = gsap.utils.clamp(0, 1, (p - h.transStart) / Math.max(0.001, h.start - h.transStart));
      } else if (cur < n - 1 && p > holds[cur + 1].transStart) {
        var nx = holds[cur + 1];
        op = 1 - gsap.utils.clamp(0, 1, (p - nx.transStart) / Math.max(0.001, nx.transEnd - nx.transStart));
      }
      roomEl.style.opacity = op.toFixed(3);
    }

    function near(i) {
      scenes.forEach(function (el, j) {
        el.style.visibility = Math.abs(j - i) <= 1 ? 'visible' : 'hidden';
      });
    }

    function killIntro() {
      if (introTl) { introTl.kill(); introTl = null; }
      if (intro) gsap.set(intro, { autoAlpha: 0 });
    }

    function playIntro() {
      if (!intro) return;
      var door = $('.gal__flash--door', intro);
      var hall = $('.gal__flash--hall', intro);
      killIntro();
      gsap.set(intro, { autoAlpha: 1 });
      gsap.set(door, { scale: 1.12, opacity: 1 });
      gsap.set(hall, { scale: 1.08, opacity: 0 });
      introTl = gsap.timeline({
        defaults: { ease: 'power2.inOut' },
        onComplete: function () {
          introTl = null;
          gsap.set(intro, { autoAlpha: 0 });
        }
      });
      introTl.to(door, { scale: 1, duration: 0.7 }, 0);
      introTl.to(hall, { opacity: 1, scale: 1, duration: 0.55 }, 0.8);
      introTl.to(door, { scale: 1.1, duration: 0.55 }, 0.8);
      introTl.to(intro, { autoAlpha: 0, duration: 0.55 }, 1.85);
    }

    function outVars(verb, dur) {
      var v = { opacity: 0, ease: 'none', duration: dur, force3D: true };
      if (verb === 'through') { v.scale = 1.36; }
      else if (verb === 'open') { v.yPercent = -14; v.scale = 1.08; }
      else if (verb === 'lean') { v.scale = 1.24; }
      else if (verb === 'glance') { v.xPercent = -11; }
      else if (verb === 'pass') { v.scale = 1.2; v.xPercent = -7; }
      else if (verb === 'sit') { v.yPercent = -8; v.scale = 1.1; }
      else { v.scale = 1.18; }
      return v;
    }

    function inFrom(verb, cinematic) {
      var v = { opacity: 0, scale: 1.1, xPercent: 0, yPercent: 0 };
      if (verb === 'sit') { v.yPercent = 14; v.scale = 1.16; }
      else if (verb === 'glance') { v.xPercent = 12; v.scale = 1.04; }
      else if (verb === 'lean') { v.scale = 1.18; }
      else if (verb === 'open') { v.yPercent = 10; v.scale = 1.08; }
      else if (verb === 'through' || verb === 'pass') { v.scale = 1.14; }
      if (cinematic && verb === 'through') {
        v.clipPath = 'inset(16% 22% 10% 22%)';
        v.scale = 1.12;
      } else if (cinematic && verb === 'pass') {
        v.clipPath = 'inset(10% 4% 12% 46%)';
        v.scale = 1.08;
      }
      return v;
    }

    function inTo(verb, cinematic, dur) {
      var v = { opacity: 1, scale: 1, xPercent: 0, yPercent: 0, ease: 'none', duration: dur, force3D: true };
      if (cinematic && (verb === 'through' || verb === 'pass')) {
        v.clipPath = 'inset(0% 0% 0% 0%)';
      }
      return v;
    }

    var mm = gsap.matchMedia();
    mm.add('(min-width: 810px)', function () { return build(4.6, true); });
    mm.add('(max-width: 809px)', function () { return build(3.4, false); });

    function build(vhs, cinematic) {
      var p = plan();
      var origins = scenes.map(function (el) { return el.getAttribute('data-origin') || '50% 50%'; });

      gsap.set(scenes, {
        opacity: 0, scale: 1, xPercent: 0, yPercent: 0, zIndex: 1,
        clipPath: 'inset(0% 0% 0% 0%)',
        transformOrigin: function (i) { return origins[i]; },
        force3D: true
      });
      gsap.set(scenes[0], { opacity: 1, zIndex: 2, visibility: 'visible' });
      if (intro) gsap.set(intro, { autoAlpha: 0 });
      near(0);

      var tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: pin,
          start: 'top top',
          end: function () { return '+=' + Math.round(window.innerHeight * vhs); },
          pin: true,
          scrub: 0.7,
          invalidateOnRefresh: true,
          onEnter: function (self) {
            pin.classList.add('is-live');
            if (self.progress < 0.02) playIntro();
          },
          onEnterBack: function () { pin.classList.add('is-live'); },
          onLeave: function () { pin.classList.remove('is-live'); killIntro(); },
          onLeaveBack: function () { pin.classList.remove('is-live'); killIntro(); },
          onUpdate: function (self) {
            if (self.progress > 0.018) killIntro();
            var i = roomAt(self.progress);
            if (i !== cur) { cur = i; writeHud(i); near(i); }
            paintCaption(self.progress);
            if (railEl) gsap.set(railEl, { width: (self.progress * 100).toFixed(2) + '%' });
          }
        }
      });
      st = tl.scrollTrigger;

      tl.to(scenes[0], { scale: 1.08, duration: p.first, force3D: true }, 0);
      if (wmEl) tl.fromTo(wmEl, { x: 0, scale: 1 }, { x: 36, scale: 0.9, duration: 1 }, 0);

      for (var i = 1; i < n; i++) {
        var from = scenes[i - 1];
        var to = scenes[i];
        var start = holds[i].transStart;
        var dur = p.trans;
        var verb = to.getAttribute('data-verb') || 'open';
        var holdDur = holds[i].end - holds[i].start;

        tl.set(to, { zIndex: 3, visibility: 'visible' }, start);
        tl.set(from, { zIndex: 2 }, start);
        tl.to(from, outVars(verb, dur), start);
        tl.fromTo(to, inFrom(verb, cinematic), Object.assign(inTo(verb, cinematic, dur), { immediateRender: false }), start);
        tl.to(to, { scale: 1.07, duration: holdDur, force3D: true }, holds[i].start);
      }

      return function () {
        killIntro();
        st = null;
        pin.classList.remove('is-live');
      };
    }

    steps.forEach(function (b, i) {
      b.addEventListener('click', function () {
        if (!st || !holds[i]) return;
        killIntro();
        var y = st.start + holds[i].mid * (st.end - st.start);
        if (window.lenis) window.lenis.scrollTo(y, { duration: 0.85 });
        else window.scrollTo({ top: y, behavior: 'smooth' });
      });
    });
  }
  initGallery();

  /* ---- Jazyk se nasadí teprve teď: applyLang sahá na scénu i odstavce --- */
  var fromUrl = '';
  try { fromUrl = new URLSearchParams(location.search).get('lang') || ''; } catch (e) {}
  try {
    LANG = (fromUrl === 'en' || fromUrl === 'cs')
      ? fromUrl
      : (localStorage.getItem('meshi-lang') === 'en' ? 'en' : 'cs');
  } catch (e) { LANG = 'cs'; }
  applyLang(LANG, fromUrl === 'en' || fromUrl === 'cs');
  setInterval(renderOpenState, 60000);

  if (!hasST) return;

  if (reduced) {
    // Nic se nehýbe. Řádky nadpisů ani tak nejsou v CSS schované, takže
    // není co dorovnávat — jen se ukáže tlačítko zpět nahoru.
    if (toTop) toTop.classList.add('is-on');
    return;
  }

  /* ---- 9a · řádek textu vyjíždí zpod výřezu ---------------------------- */
  function maskLines(scope, opts) {
    opts = opts || {};
    var items = gsap.utils.toArray(scope + ' .ml__i');
    if (!items.length) return null;
    return gsap.fromTo(items, { yPercent: 115 }, {
      yPercent: 0, duration: opts.duration || 1.15, ease: 'expo.out',
      stagger: opts.stagger || .085,
      scrollTrigger: opts.immediate ? undefined
        : { trigger: opts.trigger || scope, start: 'top 85%', once: true },
      delay: opts.delay || 0
    });
  }

  /* ---- 9b · hero: odhalí se, až se dveře rozjedou ---------------------- */
  /* Spouští se na meshi-door:open, ne při načtení: za zavřenými dveřmi by
     si animace odjela, aniž by ji kdo viděl. Dveře mizí do stránky v 900 ms
     ze svých 1450 ms, takže v momentě, kdy se hero objeví, je rozjeté.

     Kicker se jen rozsvítí (opacity). Pohyb mu dává práh dveří přes
     --door-p na .kicker-node, a transform by si s ním GSAP přetahoval.
     Nadpis se hýbe jako celek, ne po řádcích: řádek s „Plate“ přesahuje
     talířem a párou, takže výřez (maskLines) tady není možný.
     Tlačítko se posouvá za .hero-cta-wrap, aby zůstal volný transform na
     .hero-cta pro magnet. */
  whenDoorOpens(function () {
    gsap.timeline()
      .fromTo('.hero-kicker', { opacity: 0 }, { opacity: 1, duration: .9, ease: 'power2.out' })
      .fromTo('.hero-title', { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out' }, '-=.55')
      .fromTo('.hero-cta-wrap', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: .8, ease: 'power3.out' }, '-=.6')
      .fromTo('.hero-meta > *', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: .9, stagger: .12, ease: 'power3.out' }, '-=.55');

    // Video se lehce usadí. Jen bez dveří — s nimi je vjezdem jejich
    // rozjetí, a druhý zoom přes něj je o jedno hnutí moc. Navíc je to
    // `interior` dveří: pochodeň si čte pixely videa, které o CSS
    // transformaci nevědí, takže by se obraz v papíru rozešel s obrazem
    // na stránce.
    if (!doorEl) gsap.fromTo('.hero__video', { scale: 1.1 }, { scale: 1, duration: 2.6, ease: 'expo.out' });
  });

  /* ---- 9c · nadpisy sekcí ---------------------------------------------- */
  ['.about .secHead', '.show__head', '.res__copy', '.giftCopy', '.con__copy']
    .forEach(function (s) { maskLines(s); });

  // kanji, eyebrow a doprovodný text u nadpisu
  gsap.utils.toArray('.secHead, .show__head, .res__copy, .giftCopy, .con__copy').forEach(function (head) {
    var bits = head.querySelectorAll(':scope > .kanji, :scope > .eyebrow, :scope > .lead, :scope > .btn, :scope > .hours, :scope > .con__social, :scope > .con__facts');
    if (!bits.length) return;
    gsap.fromTo(bits, { opacity: 0, y: 20 }, {
      opacity: 1, y: 0, duration: .9, stagger: .07, ease: 'power3.out',
      scrollTrigger: { trigger: head, start: 'top 86%', once: true }
    });
  });

  gsap.fromTo('.pull', { opacity: 0, y: 26 }, {
    opacity: 1, y: 0, duration: 1.1, ease: 'expo.out',
    scrollTrigger: { trigger: '.pull', start: 'top 86%', once: true }
  });

  /* ---- 9d · fotka se otevře výřezem, nejen prolnutím ------------------- */
  gsap.utils.toArray('.giftShot').forEach(function (el, i) {
    gsap.fromTo(el,
      { clipPath: 'inset(14% 0% 14% 0% round 4px)', opacity: 0 },
      { clipPath: 'inset(0% 0% 0% 0% round 4px)', opacity: 1,
        duration: 1.15, ease: 'expo.out', delay: i * .06,
        scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
  });

  /* ---- 9e · formuláře --------------------------------------------------- */
  gsap.utils.toArray('.panel').forEach(function (el) {
    gsap.fromTo(el, { opacity: 0, y: 34 }, {
      opacity: 1, y: 0, duration: 1.05, ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 86%', once: true }
    });
  });
  gsap.fromTo('.foot__top > *', { opacity: 0, y: 22 }, {
    opacity: 1, y: 0, duration: .9, stagger: .08, ease: 'power3.out',
    scrollTrigger: { trigger: '.foot__top', start: 'top 88%', once: true }
  });

  /* ---- 9f · pozadí pluje pomaleji než obsah --------------------------- */
  gsap.utils.toArray('.secbg').forEach(function (el) {
    var im = el.querySelector('img');
    if (!im) return;
    gsap.fromTo(im, { yPercent: -5, scale: 1.1 }, {
      yPercent: 5, ease: 'none',
      scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true }
    });
  });
  gsap.fromTo('.about__bg', { yPercent: -6 }, {
    yPercent: 6, ease: 'none',
    scrollTrigger: { trigger: '.about', start: 'top bottom', end: 'bottom top', scrub: true }
  });

  /* ---- 9h · vodoznaky a vysazené MESHi -------------------------------- */
  gsap.utils.toArray('.wm:not(.wm--gal)').forEach(function (el, i) {
    gsap.fromTo(el, { y: 0 }, {
      y: i % 2 ? 80 : -80, ease: 'none',
      scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true }
    });
  });
  gsap.fromTo('.wordmark span', { yPercent: 55, opacity: 0 }, {
    yPercent: 0, opacity: 1, ease: 'none',
    scrollTrigger: { trigger: '.wordmark', start: 'top 96%', end: 'bottom bottom', scrub: .6 }
  });

  /* ---- 9i · lišta a tlačítko zpět nahoru ------------------------------ */
  var nav = $('#nav');
  if (nav) {
    ScrollTrigger.create({
      trigger: '.foot', start: 'top 55%',
      onEnter: function () { nav.classList.add('is-hidden'); closeMenu(); },
      onLeaveBack: function () { nav.classList.remove('is-hidden'); }
    });
  }
  if (toTop) {
    ScrollTrigger.create({
      trigger: '.hero', start: 'bottom 65%',
      onEnter: function () { toTop.classList.add('is-on'); },
      onLeaveBack: function () { toTop.classList.remove('is-on'); }
    });
  }

  /* Po načtení fotek a fontů je potřeba přepočítat spouštěče — výška
     připíchnutých sekcí se jinak spočítá z nedoměřené stránky. */
  window.addEventListener('load', function () { ScrollTrigger.refresh(); });
  if (document.fonts) document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
})();
