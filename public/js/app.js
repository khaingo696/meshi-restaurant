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

  /* Tiráž hera ukazuje jen číslo a hvězdu, slovy ho nese až popisek pro
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
  // Signatures si kolečko bere samy (krok po jídle, viz initShowcase) —
  // Lenis by si mezitím nastřádal posun a talíř ujel ze středu.
  var wheelHeld = false;
  // Skok na kotvu nebo nahoru právě projíždí stránkou: Signatures ho nechají
  // projet a nechytí ho na prvním jídle.
  var jumping = false;
  // Signatures (initShowcase): začátek pinu, zastavení kroku, dojezd po skoku.
  var showcase = null;
  if (!reduced && window.Lenis) {
    lenis = new Lenis({
      duration: 1.6,
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      smoothWheel: true,
      wheelMultiplier: 0.78,     // kolečko ujíždělo, tohle ho přibrzdí
      touchMultiplier: 1.4,
      virtualScroll: function () { return !wheelHeld; }
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

  /* Skok končí trojím způsobem: dojede, sáhne do něj člověk (dotyk,
     kolečko), nebo ho zastaví otevřený panel. V druhém a třetím případě
     ho Lenis tiše zahodí a onComplete nepřijde — jumping pak zůstal
     navždy true a Signatures přestaly dojíždět na jídlo. Proto konec
     hlídá i vstup a časová pojistka. */
  var JUMP_INPUT = ['touchstart', 'wheel'];
  var jumpTimer = 0;
  function endJump(e) {
    if (!jumping) return;
    jumping = false;
    clearTimeout(jumpTimer);
    JUMP_INPUT.forEach(function (type) { window.removeEventListener(type, endJump, true); });
    // Sáhl do něj člověk: skok pustí stránku hned. Sám by to Lenis poznal
    // až z pohybu prstu — a v pinu vůbec, tam vstup bere krok po jídle.
    // (scrollTo na současné místo nestačí: Lenis během skoku drží cíl na
    // současné poloze, vezme to jako „už jsem tam“ a jede dál.)
    if (e && lenis && lenis.isScrolling === 'smooth') { lenis.stop(); lenis.start(); }
    if (showcase) showcase.settle();
  }

  function jump(y, duration) {
    if (showcase) showcase.stop();
    jumping = true;
    clearTimeout(jumpTimer);
    JUMP_INPUT.forEach(function (type) { window.addEventListener(type, endJump, { capture: true, passive: true }); });
    jumpTimer = setTimeout(endJump, lenis ? duration * 1000 + 300 : (reduced ? 0 : 1400));
    if (lenis) lenis.scrollTo(y, { duration: duration, onComplete: function () { endJump(); } });
    else window.scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' });
  }

  function goTo(target) {
    var el = typeof target === 'string' ? $(target) : target;
    if (!el) return;
    // Signatures: přistát přesně na začátku pinu, s prvním jídlem v kruhu.
    if (el.id === 'menu' && showcase) return jump(showcase.top(), 1.15);
    jump(el.getBoundingClientRect().top + window.pageYOffset - headerGap(), 1.15);
  }

  /* ======================================================================
     2b · DVEŘE MESHI-DOOR

     Overlay se šódži dveřmi si kreslí a ovládá vlastní modul
     (src/components/meshi-door/).
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

  /* Video mimo obrazovku stojí. Pouští se přes play(), ne atributem
     autoplay, takže ho prohlížeč sám nezastaví — dekodér 1080p by běžel
     i pod Signatures a galerií a na telefonu ubíral snímky rolování. */
  var heroVid = $('video.hero-bg');
  if (heroVid && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      if (!heroVid.dataset.started) return;
      if (entries[entries.length - 1].isIntersecting) {
        var go = heroVid.play();
        if (go && go.catch) go.catch(function () {});
      } else heroVid.pause();
    }).observe(heroVid);
  }

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

  /* Polohy sekcí a výška stránky se měří jen po změně rozvržení, ne při
     každém rolování. Tahle obsluha běží v téže události až po
     ScrollTriggeru (Lenis ho volá ze své), který právě zapsal styly, a
     každé čtení by prohlížeč nutilo přepočítat celou stránku znovu. */
  var progressEl = $('#progress');
  var secTops = [], scrollMax = 0;
  function measureScroll() {
    var y = window.pageYOffset;
    secTops = sections.map(function (s) { return s.getBoundingClientRect().top + y; });
    scrollMax = document.documentElement.scrollHeight - window.innerHeight;
  }

  function onScroll() {
    var y = window.pageYOffset;

    var current = sections[0];
    for (var i = 0; i < sections.length; i++) {
      if (secTops[i] - y <= 140) current = sections[i];
    }
    navLinks.forEach(function (a) {
      a.classList.toggle('active', !!current && a.getAttribute('href') === '#' + current.id);
    });

    if (progressEl) {
      progressEl.style.transform = 'scaleX(' + (scrollMax > 0 ? Math.min(1, y / scrollMax) : 0) + ')';
    }
  }
  function remeasure() { measureScroll(); onScroll(); }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', remeasure);
  // Výška stránky se mění i bez změny okna: pin dostane rozpěrku,
  // formulář rezervace se rozbalí, dorazí fonty.
  if (window.ResizeObserver) new ResizeObserver(remeasure).observe(document.body);
  if (hasST) ScrollTrigger.addEventListener('refresh', remeasure);
  remeasure();

  // Zpět nahoru
  var toTop = $('#toTop');
  if (toTop) {
    toTop.addEventListener('click', function () { jump(0, 1.25); });
  }

  /* ======================================================================
     4 · LIGHTBOX
     Zvětšení fotky v jídelním lístku a v galerii (koláž ukazuje fotky
     malé, plná velikost je v data-full).
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

  $$('.gal__ph').forEach(function (b) {
    b.addEventListener('click', function () {
      var im = b.querySelector('img');
      openLb(b.getAttribute('data-full'), im ? im.alt : '');
    });
  });

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

  /* iOS Safari: fixed inset:0 sedí v layout viewportu (100vh), který je
     vyšší než viditelné okno, když je nahoře lišta. Panel se vycentroval
     a uřízl hlavičku. Dokud je překryv otevřený, drží se visualViewport. */
  function fitOverlay() {
    if (!ov) return;
    var vv = window.visualViewport;
    if (!vv) return;
    ov.style.top = Math.round(vv.offsetTop) + 'px';
    ov.style.left = Math.round(vv.offsetLeft) + 'px';
    ov.style.width = Math.round(vv.width) + 'px';
    ov.style.height = Math.round(vv.height) + 'px';
    ov.style.right = 'auto';
    ov.style.bottom = 'auto';
  }
  function clearOverlayFit() {
    if (!ov) return;
    ov.style.top = ov.style.left = ov.style.width = ov.style.height = '';
    ov.style.right = ov.style.bottom = '';
  }
  function onOverlayVp() { if (ovOpen) fitOverlay(); }

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
    fitOverlay();
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
    clearOverlayFit();
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
    if (window.visualViewport) {
      visualViewport.addEventListener('resize', onOverlayVp);
      visualViewport.addEventListener('scroll', onOverlayVp);
    }

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
     #resForm i #vForm. Stejně nedodělaná je i #objednavka v panelu
     a deska .hero-cta--order v heru — obě zatím bez obsluhy.
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
      paintReserve();
      if (hasGsap && !reduced) gsap.from(ok, { opacity: 0, y: 8, duration: .45, ease: 'power2.out' });
      ok.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
    });
  }
  wire('#resForm', '#resOk');
  wire('#vForm', '#vOk');

  /* Na telefonu spí formulář poukazu (CSS, sekce 18 — gate je html.js,
     takže bez JavaScriptu zůstane vidět). Vzhůru je jen poukaz sám:
     hodnota, řádky o doručení a tlačítko. Rezervace spí schválně ne:
     kdo chce stůl, má mít pole rovnou před sebou. Tlačítko probudí
     zbylá pole a zlato přejde z tlačítka na odeslání. Třída jde na
     sekci, ne na formulář. */
  function wakeForm(btnId, formId) {
    var btn = $(btnId), form = $(formId);
    if (!btn || !form) return;
    btn.addEventListener('click', function () {
      var sec = btn.closest('section');
      if (!sec || sec.classList.contains('is-open')) return;
      sec.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true');
      // Najíždějí jen pole, která právě vyšla ze spánku — poukaz už stojí.
      var woke = $$(':scope > .field:not(.field--val), :scope > .consent, :scope > .btn', form);
      if (hasGsap && !reduced) {
        gsap.fromTo(woke, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: .55, stagger: .05, ease: 'power3.out' });
      }
      /* Fokus na formulář, ne na první pole: na telefonu by vyskočila
         klávesnice dřív, než host uvidí, co se otevřelo. */
      form.focus({ preventScroll: true });
      if (window.ScrollTrigger) ScrollTrigger.refresh();
    });
  }
  wakeForm('#giftOpen', '#vForm');

  /* Poukaz na telefonu (CSS, sekce 18): ťuknutí na hodnotu rovnou
     probudí formulář — host už vybírá, další ťuknutí na tlačítko by
     bylo navíc. A výseky trhací linky jsou maska, která musí vědět,
     v jaké výšce linka leží; ta se mění s písmem i šířkou. */
  (function () {
    var form = $('#vForm'), open = $('#giftOpen'), tear = $('.vTear');
    if (!form || !open) return;
    var phone = window.matchMedia('(max-width: 809px)');
    form.addEventListener('change', function (e) {
      if (e.target.name !== 'val' || !phone.matches) return;
      if (!open.closest('section').classList.contains('is-open')) open.click();
    });
    if (tear && window.ResizeObserver) {
      new ResizeObserver(function () {
        form.style.setProperty('--tear', (tear.offsetTop + tear.offsetHeight / 2) + 'px');
      }).observe(form);
    }
  })();

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

  /* Rezervace (Reserve.astro): krok 1 je věta „2 osoby ve středu 28. 10.
     v 18:00“ / „2 guests on Wed 28/10 at 18:00“, krok 2 kontaktní pole na
     jejím místě. Nativní pole leží průhledně pod kusy věty, které se tady
     skládají: číslo rovně, slovo kurzívou (<b> / <i>). Den a datum dává
     Intl; jen český 4. pád dne i s předložkou (ve středu) je v tabulce,
     Intl ho neumí. Předložka před časem se řídí výslovností (prep, sekce
     7): ve 20:00. Krok 2 je .is-open na sekci, gate html.js — stejně jako
     u poukazu. */
  var CS_ON_DAY = [['v', 'neděli'], ['v', 'pondělí'], ['v', 'úterý'], ['ve', 'středu'],
    ['ve', 'čtvrtek'], ['v', 'pátek'], ['v', 'sobotu']];

  function resDate() {
    var el = $('#r-date');
    if (!el || !el.value) return null;
    var p = el.value.split('-');
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    var en = LANG === 'en';
    var loc = en ? 'en-GB' : 'cs-CZ';
    return {
      on: en ? 'on' : CS_ON_DAY[d.getDay()][0],
      day: en ? new Intl.DateTimeFormat(loc, { weekday: 'short' }).format(d) : CS_ON_DAY[d.getDay()][1],
      num: new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'numeric' }).format(d)
    };
  }

  // parts = [['b', '2'], ['i', 'osoby']] → <b>2</b><i>osoby</i>
  function fillFace(el, parts) {
    if (!el) return;
    el.textContent = '';
    parts.forEach(function (pt) {
      if (!pt[1]) return;
      var n = document.createElement(pt[0]);
      n.textContent = pt[1];
      el.appendChild(n);
    });
  }

  function paintReserve() {
    var form = $('#resForm');
    if (!form) return;
    var time = $('#r-time'), ppl = $('#r-ppl'), dp = resDate();
    if (!time || !ppl) return;
    var pplTxt = ppl.options[ppl.selectedIndex].text;
    var n = parseInt(pplTxt, 10);
    var at = LANG === 'en' ? 'at' : prep(parseInt(time.value, 10));
    fillFace($('#rPplFace'), [['b', String(n || pplTxt)], ['i', n ? pplTxt.replace(/^\d+\s*/, '') : '']]);
    fillFace($('#rDateFace'), dp ? [['i', dp.day], ['b', dp.num]] : []);
    fillFace($('#rTimeFace'), [['b', time.value]]);
    var cd = $('#rConnDate'), ct = $('#rConnTime'), sum = $('.rSum__txt', form);
    if (cd) cd.textContent = dp ? dp.on : '';
    if (ct) ct.textContent = at;
    if (sum) {
      sum.textContent = [pplTxt, dp ? dp.on + ' ' + dp.day + ' ' + dp.num : '', at + ' ' + time.value]
        .filter(Boolean).join(' ');
    }
  }

  (function () {
    var form = $('#resForm'), next = $('#resNext'), edit = $('#resEdit');
    if (!form || !next || !edit) return;
    var sec = form.closest('section'), date = $('#r-date');
    var sentence = $$('.rSent, .rGo', form);

    // Na popisu data leží průhledné nativní pole. Chrome a Edge po kliknutí
    // jen označí den, kalendář otevře až showPicker.
    if (date && date.showPicker) {
      date.addEventListener('click', function () { try { date.showPicker(); } catch (e) {} });
    }

    // Nová hodnota se zaostří z rozmazání — jako kicker v heru.
    form.addEventListener('change', function (e) {
      var pick = e.target.closest('.rPick');
      if (!pick) return;
      paintReserve();
      if (hasGsap && !reduced) {
        gsap.fromTo(pick, { filter: 'blur(6px)', opacity: .3 },
          { filter: 'blur(0px)', opacity: 1, duration: .6, ease: 'power3.out', clearProps: 'filter,opacity' });
      }
    });

    function setOpen(on) {
      sec.classList.toggle('is-open', on);
      next.setAttribute('aria-expanded', String(on));
      if (window.ScrollTrigger) ScrollTrigger.refresh();
    }

    /* Věta odjede nahoru a na jejím místě se zespoda zvednou pole —
       jedno hnutí, ne dvě, takže výška sekce se nikde neskokne. Fokus
       jde na formulář, ne na první pole: klávesnice by na telefonu
       vyskočila dřív, než host uvidí, co se otevřelo. */
    next.addEventListener('click', function () {
      if (date && !date.checkValidity()) { date.reportValidity(); return; }
      paintReserve();
      if (hasGsap && !reduced) {
        var woke = $$(':scope > .rSum, :scope > .field:not([hidden]), :scope > .note-toggle, :scope > .consent, :scope > .btn', form);
        gsap.timeline()
          .to(sentence, { opacity: 0, y: -14, duration: .26, stagger: .035, ease: 'power2.in' })
          .add(function () { setOpen(true); gsap.set(sentence, { clearProps: 'opacity,transform' }); })
          .fromTo(woke, { opacity: 0, y: 16 },
            { opacity: 1, y: 0, duration: .55, stagger: .05, ease: 'power3.out', clearProps: 'opacity,transform' });
      } else {
        setOpen(true);
      }
      form.focus({ preventScroll: true });
    });

    edit.addEventListener('click', function () {
      setOpen(false);
      if (hasGsap && !reduced) {
        gsap.fromTo(sentence, { opacity: 0, y: 14 },
          { opacity: 1, y: 0, duration: .55, stagger: .06, ease: 'power3.out', clearProps: 'opacity,transform' });
      }
      $('#r-ppl').focus({ preventScroll: true });
    });
  })();

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
     z prototypu dveří.
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

  /* Magnet na desce v heru: posune se o kousek za kurzorem. Jen na
     objednávce — druhý stupeň („Celé menu“) je vlas bez obrysu, a ten by
     se při posunu odlepil od textu, pod kterým leží. */
  var heroCta = $('.hero-cta--order');
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

  /* Ukázka jídel: překlad popisků se přepíše tady. */
  var paintShowcase = function () {};

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
    paintReserve();
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

  /* Lišta nad světlou plochou. Krémové písmo lišty by na papíře zmizelo,
     takže lišta dostane .is-day, kdykoli pod ní leží papír. Plochy hlásí
     každá svým klíčem (rozbřesk, pin, rezervace…) a stačí jedna. Pin
     signatures se hlásí sám z onUpdate, protože jeho konec je soumrak. */
  var dayZones = {};
  function setDay(key, on) {
    if (dayZones[key] === on) return;
    dayZones[key] = on;
    var nav = $('#nav');
    if (!nav) return;
    var any = false;
    for (var k in dayZones) if (dayZones[k]) any = true;
    nav.classList.toggle('is-day', any);
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
    var duskEl = $('#showDusk');
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

    var wellEl = $('.show__well');
    var pinEl = $('#showPin');
    var ringEl = $('.show__ring');

    // Posun, při kterém je střed i-tého jídla na STŘEDU KRUHU.
    // Osa je skutečný střed .show__ring ve studně, ne innerWidth / 2 ani
    // 50vw: to počítá i posuvník okna a talíř pak stál o půl posuvníku
    // vpravo. Poloha se skládá z CSS (odsazení, slot, mezera), ne z
    // offsetLeft — ten zaokrouhluje na celé px a mezera ve vw chybu sčítá
    // jídlo od jídla.
    var axisX = function () {
      var rr = ringEl.getBoundingClientRect();
      var sr = stage.getBoundingClientRect();
      var sx = parseFloat(gsap.getProperty(stage, 'x')) || 0;
      return rr.left + rr.width / 2 - sr.left + sx;
    };
    var off = function (i) {
      var slot = parseFloat(stage.style.getPropertyValue('--slot'));
      var axis = axisX();
      if (!slot) return dishes[i].offsetLeft + dishes[i].offsetWidth / 2 - axis;
      var cs = getComputedStyle(stage);
      return parseFloat(cs.paddingLeft) + i * (slot + parseFloat(cs.columnGap)) + slot / 2 - axis;
    };
    var span = function () { return off(dishes.length - 1) - off(0); };

    /* Zhasnutí: za posledním jídlem pin pokračuje ještě o DUSK délky pásu.
       Na tom kousku se od krajů okna stáhne tma k talíři (clona v
       .show__dusk), stíny talířů zmizí a nadpis odejde. Popisek, průběh
       a tlačítko zůstanou a v půlce přejdou do nočního materiálu
       (.is-night) — jinak by mezi talířem a galerií zbyla černá díra. */
    var DUSK = .14;
    var nightEl = duskEl ? duskEl.firstElementChild : null;
    var fadeEls = $$('.show__head');
    // Kruh a zář jsou denní světlo (prosvětlený papír) — ve tmě by z nich
    // zbyl šedý kotouč. Za talířem pak svítí jen lucerna noční vrstvy.
    var dayLight = $$('.show__ring, .show__glow');
    var shadows = dishes.map(function (el) { return $('.dish__shadow', el); });
    var lastStop = 1 / (1 + DUSK);   // průběh, při kterém stojí uprostřed poslední jídlo
    var dusk = 0;
    var pinLen = function () { return span() * 1.15 * (1 + DUSK); };
    /* Poloha pásu na začátku pinu. První jídlo stojí o pixel po začátku
       (viz stepY), takže pás začíná o ten pixel dřív — jinak by první talíř
       stál ~¾ px vlevo od osy. */
    var stripFrom = function () {
      var a = 1 / pinLen() / lastStop, x1 = -off(dishes.length - 1);
      return (-off(0) - a * x1) / (1 - a);
    };

    /* Jídla se srovnají podle HLAVNÍHO talíře, ne podle rámu fotky (čísla
       ze scripts/measure-dishes.py v data-fit a data-hull): talíř má ve
       všech jídlech stejný průměr a stojí středem v kruhu. Přílohy (rýže,
       sojovka) smí z kruhu vyčuhovat — asymetrii nese sama fotka — ale ne
       pod nadpis, na jméno jídla ani za okraj okna. Fotky jsou shora, takže
       jde jídlo kolem talíře pootočit: na širokém okně se rýže stočí do
       strany, na telefonu dolů, kde je místo. Zkouší se úhly od nejmenšího
       a bere se první, se kterým talíř zůstane v plné velikosti; když se
       nevejde žádný, ten s největším talířem. Přepočítá se při každém
       refreshi ScrollTriggeru (změna okna), dřív než se měří dráha pásu. */
    var PLATE = .9;                  // průměr talíře / průměr kruhu
    /* Jídlo z víc nádob (miska + rýže, data-group): hlavní talíř by stál v
       kruhu a rýže visela bokem, celek by byl mimo osu a kvůli přesahu
       malý. Tady stojí v kruhu těžiště celé fotky a delší strana kompozice
       je GROUP průměrů kruhu. */
    var GROUP = 1.2;
    var TURNS = [0, -15, 15, -30, 30, -45, 45];
    var headEl = $('.show__head');
    var metaEl = $('.show__meta');
    /* Pro onUpdate: jak daleko od středu talíře může jídlo sahat (px, i s
       natočením a stínem), které jídlo odjelo za okraj okna a stojí, a
       poslední zapsaný filtr. */
    var reach = [], parked = [], filters = [];
    function fitDishes() {
      parked = [];
      var pr = pinEl.getBoundingClientRect();
      var rr = ringEl.getBoundingClientRect();
      var D = ringEl.offsetWidth;
      var rx = rr.left + rr.width / 2 - pr.left;
      var ry = rr.top + rr.height / 2 - pr.top;
      var pad = 12;
      var room = {
        l: rx - pad,
        r: pinEl.clientWidth - pad - rx,
        t: ry - (headEl.getBoundingClientRect().bottom - pr.top + pad),
        b: metaEl.getBoundingClientRect().top - pr.top - pad - ry
      };
      stage.style.setProperty('--slot', D + 'px');
      dishes.forEach(function (el, i) {
        var f = (el.dataset.fit || '').split(' ').map(Number);
        if (f.length !== 4) return;
        var d = f[0], x = f[1], y = f[2], r = f[3];
        var hull = (el.dataset.hull || '').split(' ').map(Number);
        var full = D * ('group' in el.dataset ? GROUP : PLATE) / d;
        var best = { w: 0, a: 0 };
        // data-tilt: natočení pevně dané v Signatures.astro, nevybírá se
        var turns = el.dataset.tilt ? [Number(el.dataset.tilt)] : TURNS;
        for (var t = 0; t < turns.length; t++) {
          // obal otočený o úhel; rozměry v šířkách fotky od středu talíře
          var rad = turns[t] * Math.PI / 180, c = Math.cos(rad), s = Math.sin(rad);
          var l = 0, rt = 0, tp = 0, bt = 0;
          for (var k = 0; k + 1 < hull.length; k += 2) {
            var u = hull[k] * c - hull[k + 1] * s, v = hull[k] * s + hull[k + 1] * c;
            l = Math.max(l, -u); rt = Math.max(rt, u); tp = Math.max(tp, -v); bt = Math.max(bt, v);
          }
          var w = Math.min(full, room.l / l, room.r / rt, room.t / tp, room.b / bt);
          if (w > best.w * 1.03) best = { w: w, a: turns[t] };
          if (w >= full) break;
        }
        var w = Math.max(best.w, D * .55);
        var img = $('img', el);
        img.style.width = w + 'px';
        img.style.translate = (-x * w) + 'px ' + (-y * w * r) + 'px';
        img.style.transformOrigin = (x * 100) + '% ' + (y * 100) + '%';
        img.style.rotate = best.a ? best.a + 'deg' : '';
        // Obrys drží stín směrem dolů i u pootočené fotky (filtr se otáčí s ní).
        if (best.a) {
          var ar = best.a * Math.PI / 180, sx = Math.sin(ar), sy = Math.cos(ar);
          img.style.filter = 'drop-shadow(' + (18 * sx).toFixed(1) + 'px ' + (18 * sy).toFixed(1) + 'px 22px rgba(74, 48, 22, .26)) ' +
            'drop-shadow(' + (4 * sx).toFixed(1) + 'px ' + (4 * sy).toFixed(1) + 'px 8px rgba(74, 48, 22, .26))';
        } else img.style.filter = '';
        el.style.setProperty('--dp', d * w + 'px');
        // Nejvzdálenější roh fotky od středu talíře, plus stín.
        reach[i] = w * Math.hypot(1, r) + 60;
      });
      // Pás stojí na středu studny, kruh o kousek výš — dorovnat.
      stage.style.translate = '';
      var sr = stage.getBoundingClientRect();
      stage.style.translate = '0 ' + (ry - (sr.top + sr.height / 2 - pr.top)) + 'px';
    }
    pinEl.classList.add('is-fit');
    fitDishes();
    ScrollTrigger.addEventListener('refreshInit', fitDishes);

    /* Hloubka ostrosti: jídla mimo střed se rozostří a vyblednou, jako
       když objektiv zaostří na talíř uprostřed. Hodnoty jsou zaokrouhlené,
       aby se filtr nepřepočítával každý snímek; na dotykových zařízeních
       je rozostření mělčí (slabší GPU). */
    var BLUR = matchMedia('(pointer: coarse)').matches ? 2.5 : 5;

    /* Pin GSAP zamkne na výšku, kterou měl v okamžiku připíchnutí (100svh).
       Na telefonu se po chvíli rolování schová lišta prohlížeče, okno se
       prodlouží a pod talířem zbude pruh papíru sekce (--honey-edge).
       Dokud je pin fixed, dorovná se na visualViewport — spacer v toku
       dokumentu se nemění, jen se vyplní díra v okně. */
    var pinFitH = 0;
    var pinFitTop = -1;
    function fitPinnedPin(active) {
      if (!pinEl) return;
      if (!active) {
        if (pinFitH) {
          pinEl.style.top = '';
          pinEl.style.height = '';
        }
        pinFitH = 0;
        pinFitTop = -1;
        return;
      }
      var vv = window.visualViewport;
      var top = Math.round(vv ? vv.offsetTop : 0);
      var h = Math.round((vv && vv.height) || window.innerHeight);
      var topPx = top + 'px';
      var hPx = h + 'px';
      if (pinEl.style.top === topPx && pinEl.style.height === hPx) return;
      pinFitH = h;
      pinFitTop = top;
      pinEl.style.top = topPx;
      pinEl.style.height = hPx;
    }

    var tl = gsap.timeline({
      scrollTrigger: {
        trigger: '.show__pin', start: 'top top',
        end: function () { return '+=' + pinLen(); },
        // Bez vyhlazení: rolování v pinu řídí krok po jídle (níž), který má
        // vlastní křivku — scrub navíc by talíř do kruhu dotahoval opožděně.
        pin: true, scrub: true, invalidateOnRefresh: true,
        onToggle: function (self) {
          fitPinnedPin(self.isActive);
          setDay('pin', self.isActive && dusk < .5);
          holdPin(self.isActive, self.direction);
        },
        onRefresh: function (self) {
          fitPinnedPin(self.isActive);
          if (st && self.isActive && !stepTw) toY(stepY(stepAt), 0);
        },
        onUpdate: function (self) {
          fitPinnedPin(self.isActive);
          var p = self.progress * (1 + DUSK);
          var sp = Math.min(1, p);                        // průběh pásu jídel
          var k = gsap.utils.clamp(0, 1, (p - 1) / DUSK); // průběh soumraku
          dusk = k = k * k * (3 - 2 * k);

          /* Nejdřív všechno změřit, pak teprve psát. Čtení hned po zápisu
             nutí prohlížeč přepočítat styly znovu, a to tady bylo u každého
             jídla v každém snímku. Krok po jídle jede po hlavním vlákně
             (tween → rolování → tahle funkce), takže co stojí tahle
             smyčka, to chybí plynulosti pásu na telefonu. */
          var wr = wellEl.getBoundingClientRect();
          var half = wr.width / 2, cx = wr.left + half;
          var pos = dishes.map(function (el) {
            var r = el.getBoundingClientRect();
            return (r.left + r.width / 2 - cx) / half;       // -1 … 0 … 1
          });
          var lit = !!nightEl && k > 0;
          var rr = lit && ringEl.getBoundingClientRect();
          var pr = lit && pinEl.getBoundingClientRect();
          var ph = lit ? pinEl.clientHeight : 0;

          setMeta(Math.round(sp * (dishes.length - 1)));
          gsap.set(barEl, { width: (12 + sp * 88) + '%' });
          dishes.forEach(function (el, i) {
            var d = pos[i];
            var a = Math.abs(d);
            /* Jídlo za okrajem okna: měřítko, krytí i rozostření už stojí
               na mezi a nic z něj není vidět. Zapíše se jednou, když
               odjede, a pak stojí — jinak se každý snímek přepočítávalo
               všech třináct talířů s filtrem, i když jsou vidět dva tři. */
            var gone = (a - 1) * half > reach[i];
            if (gone && parked[i]) return;
            parked[i] = gone;
            var rot = gsap.utils.clamp(-8, 8, d * 9);
            gsap.set(el, {
              scale: gsap.utils.clamp(.55, 1, 1 - a * .42),
              rotate: rot,
              yPercent: a * 6,
              opacity: gsap.utils.clamp(.3, 1, 1 - a * .62)
            });
            var fa = Math.min(1, a);
            var blur = Math.round(fa * BLUR * 4) / 4;
            var sat = Math.round((1 - fa * .55) * 20) / 20;
            var look = blur > 0 ? 'blur(' + blur + 'px) saturate(' + sat + ')' : '';
            if (look !== filters[i]) el.style.filter = filters[i] = look;
            // Světlo stojí nad středem: stín utíká od středu, s dálkou se
            // natahuje a slábne. Natočení talíře se mu odečte — stín leží
            // na papíře, ne na talíři.
            if (shadows[i]) gsap.set(shadows[i], {
              xPercent: d * 26, scaleX: 1 + a * .4, rotate: -rot,
              opacity: (1 - a * .5) * (1 - k)
            });
          });
          // Logo dýchá s pásem a ustoupí talíři: když jídlo stojí v kruhu,
          // skoro zmizí (prosvítalo by mezerami kolem misky), mezi dvěma
          // jídly se vrátí jako razítko (~.35 — víc by se tlouklo s
          // rozostřenými přílohami, které zrovna jedou přes kruh). Za
          // soumraku se rozsvítí — na zhasnuté scéně je zlatá jediné světlo.
          var breathe = Math.sin(sp * Math.PI);
          var at = sp * (dishes.length - 1);
          var gap = Math.min(1, Math.abs(at - Math.round(at)) * 2.4);   // 0 na jídle, 1 mezi
          gsap.set(markEl, {
            scale: 1 + breathe * .07,
            opacity: (.06 + .3 * gap * gap * (3 - 2 * gap)) * (1 - k) + .7 * k
          });
          // Clona: začíná za rohy okna (polovina úhlopříčky), končí kuželem
          // o něco širším než talíř uprostřed. Poloměr se zmenšuje
          // geometricky, ne lineárně — jako clona objektivu: kraje zhasnou
          // rychle, kolem talíře zpomalí.
          if (nightEl) {
            if (lit) {
              var w = window.innerWidth, h = ph;
              var hd = Math.sqrt(w * w + h * h) / 2;
              var dw = parseFloat(dishes[dishes.length - 1].style.getPropertyValue('--dp')) || 300;
              var geo = function (a, b) { return a * Math.pow(b / a, k); };
              duskEl.style.setProperty('--cy', Math.round(rr.top + rr.height / 2 - pr.top) + 'px');
              duskEl.style.setProperty('--r0', Math.round(geo(hd * 1.02, dw * .42)) + 'px');
              duskEl.style.setProperty('--r1', Math.round(geo(hd * 1.5, dw * 1.15)) + 'px');
              duskEl.style.setProperty('--a0', (.55 * Math.pow(k, 1.5)).toFixed(3));
              duskEl.style.setProperty('--warm', (.16 * k).toFixed(3));
            }
            gsap.set(nightEl, { opacity: k > 0 ? 1 : 0 });
          }
          pinEl.classList.toggle('is-night', k > .5);
          gsap.set(fadeEls, { opacity: 1 - Math.min(1, k * 1.6) });
          gsap.set(dayLight, { opacity: 1 - k });
          setDay('pin', self.isActive && k < .5);
        }
      }
    });
    tl.fromTo(stage, { x: stripFrom }, {
      x: function () { return -off(dishes.length - 1); },
      ease: 'none', duration: 1
    }).to({}, { duration: DUSK });

    /* Krok po jídle. Volné rolování v pinu nechávalo pás stát mezi dvěma
       jídly: snap se pouštěl až po dojetí setrvačnosti (Lenis, na telefonu
       nativní dojezd) a prohrával s ní. Proto si pin, dokud je připíchnutý,
       vezme kolečko, dotyk i klávesy sám a jedno gesto = jedno jídlo, vždy
       dojeté do kruhu. Gesto končí, až kolečko na GAP ms ztichne (trackpad
       ještě vteřinu dojíždí a jinak by přeskočil několik jídel); dotyk
       končí zvednutím prstu. Před prvním a za posledním jídlem pin pustí
       stránku dál — za posledním přes soumrak rovnou do galerie. */
    var st = tl.scrollTrigger;
    var n = dishes.length;
    var GAP = 180;
    var coarse = matchMedia('(pointer: coarse)').matches;
    var stepAt = 0, stepTw = null, used = false, lastIn = 0;

    // Rolování, při kterém stojí i-té jídlo přesně v ose kruhu — spočtené
    // zpátky z dráhy pásu, bez zaokrouhlení (pixel rolování je ~¾ px pásu).
    // První jídlo tak vyjde pixel po začátku pinu, kde už je pin aktivní.
    function stepY(i) {
      var x0 = stripFrom(), x1 = -off(n - 1);
      return st.start + (st.end - st.start) * lastStop * (-off(i) - x0) / (x1 - x0);
    }
    function nearest() {
      return Math.round(gsap.utils.clamp(0, 1, st.progress / lastStop) * (n - 1));
    }
    function curY() { return lenis ? lenis.scroll : window.pageYOffset; }
    function setY(y) {
      if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
      else window.scrollTo(0, y);
    }
    function toY(y, dur, ease) {
      if (stepTw) stepTw.kill();
      stepTw = null;
      if (!dur) return setY(y);
      var at = { y: curY() };
      stepTw = gsap.to(at, {
        y: y, duration: dur, ease: ease || 'power3.inOut',
        onUpdate: function () { setY(at.y); },
        onComplete: function () { stepTw = null; }
      });
    }
    function overlayUp() {
      return body.classList.contains('ov-open') || body.classList.contains('menu-open') ||
        (lb && lb.classList.contains('on')) || document.documentElement.classList.contains('md-lock');
    }

    /* Dojezd, který naváže na rychlost, jakou stránka právě jede (v, px/s):
       začne stejně rychle a měkce stane v cíli — Hermitova křivka se
       sklonem m0 na začátku a nulou na konci (do 3 nepřejede). Dřív zámek
       dojezd prstu utnul a pás se rozjížděl znovu z nuly: zespodu tak
       stránka zastavila a pak se pomalu rozjela 700 px soumraku nahoru.
       Jede-li stránka od cíle (prst přejel začátek pinu o kus), rychlost
       se zahodí a pás se vrátí z klidu. */
    function glide(y, v) {
      var dist = y - curY();
      if (Math.abs(dist) < 2) return toY(y, 0);
      var m = v / dist;                              // 1/s; kladné = jede k cíli
      if (!(m > 0)) return toY(y, Math.min(.8, .3 + Math.abs(dist) / 1600));
      var dur = gsap.utils.clamp(.4, 1, 2 / m);
      var m0 = Math.min(3, m * dur);
      toY(y, dur, function (t) { return m0 * t * (1 - t) * (1 - t) + t * t * (3 - 2 * t); });
    }

    function step(dir) {
      if (overlayUp()) return;
      // Bez rozjetého kroku se vychází z toho, kde pás opravdu stojí —
      // stepAt mohl zůstat z dřívějška (skok na kotvu, refresh).
      if (!stepTw) stepAt = nearest();
      var to = stepAt + dir;
      // Navazující gesto během jízdy: dojet rovnou k dalšímu, bez zastávky.
      var ease = stepTw ? 'power2.out' : 'power3.inOut';
      if (to < 0) return toY(st.start - Math.round(window.innerHeight * .45), .7, ease);
      if (to >= n) return toY(st.end + Math.round(window.innerHeight * .45), 1.2, ease);
      stepAt = to;
      toY(stepY(to), .8, ease);
    }

    function gesture(dir, self) {
      // Čas vzniku události, ne obsluhy: když stránka zrovna dekóduje fotky,
      // dorazí kolečko v dávce a mezery mezi obsluhami by dělaly nová gesta.
      var now = self.event.timeStamp || performance.now();
      if (self.event.type === 'wheel') {
        if (now - lastIn > GAP) used = false;
        lastIn = now;
      }
      if (used) return;
      used = true;
      step(dir);
    }

    // wheelSpeed -1: kolečko dolů i prst nahoru jsou „onUp“ = další jídlo.
    var obs = ScrollTrigger.observe({
      target: window, type: 'wheel,touch', wheelSpeed: -1, tolerance: 12,
      preventDefault: true, ignore: '#menuOv, #sheet, #lb',
      onUp: function (self) { gesture(1, self); },
      onDown: function (self) { gesture(-1, self); },
      onPress: function () { used = false; }
    });
    obs.disable();

    function onKey(e) {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || overlayUp()) return;
      var tag = e.target && e.target.tagName;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;
      var dir = 0;
      if (e.key === 'ArrowDown' || e.key === 'PageDown') dir = 1;
      else if (e.key === 'ArrowUp' || e.key === 'PageUp') dir = -1;
      else if (e.key === ' ' && !/^(BUTTON|A)$/.test(tag)) dir = e.shiftKey ? -1 : 1;
      if (!dir) return;
      e.preventDefault();
      if (!e.repeat || !stepTw) step(dir);
    }

    /* Na dotykovém zařízení dostane <html> overflow: hidden — zastaví
       nativní dojezd prstu, který by jinak odvezl pás z kruhu (ve Safari
       na programové rolování nedbá). */
    function lock(on) {
      if (coarse) document.documentElement.classList.toggle('show-lock', on);
    }

    /* Krok, který dojíždí mimo pin (výjezd za poslední nebo před první
       jídlo, chycený dojezd před pinem), pustí stránku, jakmile do ní
       člověk sáhne. Jinak by dál každý snímek přepisoval rolování a
       přetahoval se s prstem i s kolečkem. V pinu ho vystřídá další krok.
       Nový dotyk, ne pohyb: prst, který výjezd spustil, se ještě hýbe,
       když pás pin opouští — a výjezd by utnul hned za soumrakem. */
    function stopStep() {
      if (stepTw) stepTw.kill();
      stepTw = null;
      if (!st.isActive) lock(false);
    }
    ['touchstart', 'wheel'].forEach(function (type) {
      window.addEventListener(type, function () {
        if (stepTw && !st.isActive) stopStep();
      }, { capture: true, passive: true });
    });

    /* Pin se připíchl / odepnul. */
    function holdPin(on, dir) {
      if (!obs) return;              // ScrollTrigger se ozval dřív, než krok vznikl
      wheelHeld = on;
      if (on) {
        obs.enable();
        window.addEventListener('keydown', onKey);
        // Skok na kotvu sekcí jen projíždí: zámek i dojezd na jídlo počkají,
        // jestli v ní skončí (settle).
        if (jumping) return;
        lock(true);
        if (stepTw) return;
        // Vjezd do sekce: první (shora) nebo poslední (zespodu) jídlo do kruhu.
        // Gesto, které sem dovezlo, je tím spotřebované. Načtení stránky
        // uprostřed pinu (dir 0) dojede k nejbližšímu.
        stepAt = dir < 0 ? n - 1 : dir > 0 ? 0 : nearest();
        used = true;
        lastIn = performance.now();
        glide(stepY(stepAt), st.getVelocity());
      } else {
        lock(false);
        obs.disable();
        window.removeEventListener('keydown', onKey);
      }
    }

    // Skok na kotvu skončil (dojel nebo ho člověk zastavil). Stojí-li
    // v pinu, zamknout a dojet na nejbližší jídlo.
    function settle() {
      if (!st.isActive) return;
      lock(true);
      if (stepTw) return;
      stepAt = nearest();
      if (Math.abs(curY() - stepY(stepAt)) > 2) toY(stepY(stepAt), .5);
    }

    /* Chycení dojezdu (jen dotyk). Prst pustí stránku a ta k Signatures
       dojíždí tak rychle, že by začátek pinu přejela: zámek ji zastavil
       až za ním a pás se pak vracel na první jídlo — zastavit, couvnout.
       Proto se dojezd chytí už kus před pinem a plynule, ve stejném směru
       a ze stejné rychlosti, dojede přesně na první jídlo (zespodu na
       poslední). Dojezd, který by se zastavil sám před sekcí, se nechá. */
    var CATCH = .6;                  // jak daleko před pinem (výšek okna) se chytá
    var COAST = .4;                  // s: odhad, kolik ještě dojezd ujede (v · COAST px)
    var touching = false, flung = false;
    window.addEventListener('touchstart', function () { touching = true; flung = false; }, { capture: true, passive: true });
    ['touchend', 'touchcancel'].forEach(function (type) {
      window.addEventListener(type, function (e) {
        touching = e.touches.length > 0;
        flung = !touching;
      }, { capture: true, passive: true });
    });
    window.addEventListener('wheel', function () { flung = false; }, { capture: true, passive: true });
    window.addEventListener('scroll', function () {
      if (!coarse || !flung || touching || stepTw || jumping || st.isActive || overlayUp()) return;
      var y = curY(), v = st.getVelocity(), zone = window.innerHeight * CATCH;
      var into = v > 0
        ? y < st.start && y > st.start - zone && y + v * COAST > st.start
        : v < 0 && y > st.end && y < st.end + zone && y + v * COAST < st.end;
      if (!into) return;
      flung = false;
      stepAt = v > 0 ? 0 : n - 1;
      used = true;
      lock(true);
      glide(stepY(stepAt), v);
    }, { passive: true });

    /* Rolování, které do pinu nepřišlo krokem (posuvník, skok na kotvu,
       hledání v textu), po zastavení dojede k nejbližšímu jídlu. */
    ScrollTrigger.addEventListener('scrollEnd', function () {
      flung = false;                 // dojezd doběhl, chytat už není co
      if (!st.isActive || stepTw || jumping || st.progress > lastStop + .002) return;
      stepAt = nearest();
      if (Math.abs(curY() - stepY(stepAt)) > 2) toY(stepY(stepAt), .5);
    });

    showcase = {
      top: function () { return stepY(0); },
      stop: function () { stopStep(); lock(false); },
      settle: settle
    };
    if (st.isActive) holdPin(true, 0);

    /* Fotky jídel mají loading="lazy" — v náhradní podobě scény se pás
       roluje prstem a stahovat se mají, až na ně dojde. Tady ale pás jede
       do strany po krocích a další jídlo by se stahovalo a dekódovalo až
       během kroku: talíř by přijel prázdný, nebo by krok zadrhl. Stáhnou
       se proto všechny, když je sekce ještě obrazovku daleko. */
    var warm = false;
    ScrollTrigger.create({
      trigger: '#menu', end: 'max',
      start: function () { return 'top bottom+=' + window.innerHeight; },
      onToggle: function (self) {
        if (warm || !self.isActive) return;
        warm = true;
        dishes.forEach(function (el) {
          var img = $('img', el);
          if (!img) return;
          img.loading = 'eager';
          if (img.decode) img.decode().catch(function () {});
        });
      }
    });

    if (window.visualViewport) {
      var onVp = function () {
        var st = tl.scrollTrigger;
        if (st) fitPinnedPin(st.isActive);
      };
      visualViewport.addEventListener('resize', onVp);
      visualViewport.addEventListener('scroll', onVp);
    }
  }
  initShowcase();

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

  /* ---- Lišta nad papírem ------------------------------------------------
     Bez pohybu i s ním — tohle není animace. Přepíná se, až pod lištou
     (~36 px pod hranou okna) leží papír, ne jantar švu: u Signatures za
     utrženou hranou listu, v rezervaci po většině horního švu, dole před
     švem do zlata. */
  var NAV_Y = 'top+=36';
  var tearEl = $('.show__tear');
  // Začátek: hrana listu (nejhlouběji v 47 % výšky .show__tear) už je nad
  // lištou. Konec až za začátkem pinu — spodek .show__tear přesahuje do
  // pinu, takže mezi oběma plochami nezůstane mezera, kdy lišta zhasne.
  if (tearEl) ScrollTrigger.create({
    trigger: tearEl, invalidateOnRefresh: true,
    start: function () { return 'top+=' + Math.round(tearEl.offsetHeight * .5) + ' ' + NAV_Y; },
    end: 'bottom top-=8',
    onToggle: function (self) { setDay('tear', self.isActive); }
  });
  var showPin = $('#showPin');
  if (showPin && showPin.classList.contains('is-static')) ScrollTrigger.create({
    trigger: showPin, start: 'top ' + NAV_Y, end: 'bottom ' + NAV_Y,
    onToggle: function (self) { setDay('showStatic', self.isActive); }
  });
  var resEl = $('#rezervace');
  if (resEl) {
    // Švy rezervace jsou .res::before (nahoře) a .res::after (dole). Papír
    // pod lištou je až v posledních ~30 % horního šve; dole lišta zhasne
    // dřív, než šev ztmavne k poukazu.
    var seamPx = function (pseudo) { return parseFloat(getComputedStyle(resEl, pseudo).height) || 0; };
    ScrollTrigger.create({
      trigger: resEl, invalidateOnRefresh: true,
      start: function () { return 'top+=' + Math.round(seamPx('::before') * .7) + ' ' + NAV_Y; },
      end: function () { return 'bottom-=' + Math.round(seamPx('::after') * .6) + ' ' + NAV_Y; },
      onToggle: function (self) { setDay('res', self.isActive); }
    });
  }

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
     Tlačítka se posouvají za .hero-cta-wrap, aby zůstal volný transform
     na .hero-cta--order pro magnet. */
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
  /* Výřez se po dojetí smaže: zůstal by na figure napořád a natočené
     fotce (desktop) by ořezával rohy. */
  gsap.utils.toArray('.giftShot').forEach(function (el, i) {
    gsap.fromTo(el,
      { clipPath: 'inset(14% 0% 14% 0% round 4px)', opacity: 0 },
      { clipPath: 'inset(0% 0% 0% 0% round 4px)', opacity: 1, clearProps: 'clipPath',
        duration: 1.15, ease: 'expo.out', delay: i * .06,
        scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
  });

  /* ---- 9g · galerie: hromádka → koláž → zhasnutí ----------------------- */
  /* Žádný pin a nic se nespouští jednou: všechno jede se scrubem, takže
     cesta zpět koláž zase složí. CSS drží složený stav, tady se počítá
     jen odkud fotky letí a jak zhasnou.

     Desktop: plocha je vysoká jako okno, takže jedna osa pro celou sekci.
     Fotky začnou jako hromádka uprostřed plochy (pod ní je schovaný
     nadpis), rozletí se, když střed plochy vjede do okna, a složené stojí,
     když plocha vyplní okno.

     Konec: fotky NEODLÉTAJÍ. Dřív proletěly do stran — spodní řada letěla
     dolů proti směru rolování a poloprůhledné rozmazané fotky visely přes
     nadpis rezervace. Teď se jen o kus vzdálí a ztmavnou, řada po řadě
     shora dolů, ve směru rolování — jako když v místnosti zhasínají
     světla. Poslední zhasne dřív, než přijede nadpis rezervace.
     Telefon: plocha je vyšší než okno — jedna osa by spodní fotky složila
     až pod ohybem. Každá fotka tam má vlastní osu podle své polohy.

     Za letu rozmazané a tmavé, složené ostré. Rozmazání jen na desktopu:
     sedm filtrů přepočítávaných každý snímek telefon nedá. */
  var galStage = $('#galStage');
  if (galStage) {
    var galPh = $$('.gal__ph', galStage);
    var galHead = $('.gal__head', galStage);
    var galTilt = [-9, 6, -4, 8, -6, 4, -2];

    // Vektor od středu fotky ke středu plochy (px). Funkce, ne čísla:
    // invalidateOnRefresh je po změně okna spočítá znovu.
    var toMid = function (el, axis) {
      return axis === 'x'
        ? galStage.clientWidth / 2 - (el.offsetLeft + el.offsetWidth / 2)
        : galStage.clientHeight / 2 - (el.offsetTop + el.offsetHeight / 2);
    };
    var look = function (blur, light, withBlur) {
      return (withBlur ? 'blur(' + blur + 'px) ' : '') + 'brightness(' + light + ')';
    };

    gsap.matchMedia().add({ wide: '(min-width: 810px)', narrow: '(max-width: 809px)' }, function (ctx) {
      if (ctx.conditions.wide) {
        // Střed plochy vjede do okna při ~.25, plocha ho vyplní při .5.
        // Hromádka vydrží, dokud není vidět (~.29), pak se rychle rozletí;
        // složená stojí .48–.56, pak zhasíná podle výšky řady (.56–.74).
        var tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: { trigger: galStage, start: 'top bottom', end: 'bottom top', scrub: .6, invalidateOnRefresh: true }
        });
        galPh.forEach(function (el, i) {
          var k = i / (galPh.length - 1);
          tl.fromTo(el, {
            x: function () { return toMid(el, 'x'); },
            y: function () { return toMid(el, 'y'); },
            rotation: galTilt[i], scale: .5, filter: look(9, .4, true)
          }, {
            x: 0, y: 0, rotation: 0, scale: 1, filter: look(0, 1, true),
            duration: .17, ease: 'power2.out'
          }, .29 + k * .02);
          // Výška řady v ploše (0 nahoře, ~.6 dole) určuje, kdy zhasne.
          var row = el.offsetTop / galStage.clientHeight;
          tl.to(el, {
            scale: .94, opacity: .35, filter: look(3, .15, true),
            duration: .12, ease: 'power1.inOut'
          }, .56 + row * .1);
        });
        var headRow = galHead.offsetTop / galStage.clientHeight;
        tl.fromTo(galHead, { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: .12, ease: 'power2.out' }, .36)
          .to(galHead, { opacity: 0, duration: .12, ease: 'power1.inOut' }, .56 + headRow * .1)
          .set({}, {}, 1);
        return;
      }

      // Telefon: osa každé fotky běží od chvíle, kdy její střed vjede
      // zdola do okna, do chvíle, kdy vyjede nahoře.
      galPh.forEach(function (el, i) {
        var at = function (edge) {
          return function () { return 'top+=' + Math.round(el.offsetTop + el.offsetHeight / 2) + ' ' + edge; };
        };
        gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: { trigger: galStage, start: at('bottom'), end: at('top'), scrub: .5, invalidateOnRefresh: true }
        })
          .fromTo(el, {
            x: function () { return toMid(el, 'x') * .8; },
            rotation: galTilt[i], scale: .55, filter: look(0, .4, false)
          }, { x: 0, rotation: 0, scale: 1, filter: look(0, 1, false), duration: .4, ease: 'power2.out' }, 0)
          // Konec jako na desktopu: na místě se vzdálí a zhasne.
          .to(el, {
            scale: .94, opacity: .35, filter: look(0, .15, false),
            duration: .3, ease: 'power1.inOut'
          }, .62);
      });
      gsap.fromTo(galHead, { opacity: 0, y: 24 }, {
        opacity: 1, y: 0, ease: 'none',
        scrollTrigger: { trigger: galHead, start: 'top 92%', end: 'top 62%', scrub: .5 }
      });
    });
  }

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
  /* Signatures ne: sekce je připíchnutá a roluje přes několik obrazovek,
     takže by pozadí za talířem viditelně ujíždělo. Tam stojí. */
  /* Světlé podklady (.secbg--day) taky ne: stín borovice, který by
     ujížděl pod formulářem rezervace, by tahal oko od polí. */
  gsap.utils.toArray('.secbg').forEach(function (el) {
    var im = el.querySelector('img');
    if (!im || el.closest('.show') || el.classList.contains('secbg--day')) return;
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
  gsap.utils.toArray('.wm').forEach(function (el, i) {
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
