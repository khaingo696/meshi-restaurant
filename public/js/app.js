/* ==========================================================================
   MESHi v9 — chování a pohyb
   Pravidla: hýbou se vrstvy a fotky, text ne. Žádná animace nesmí bránit
   ve čtení ani v ovládání. Vše se vypne při prefers-reduced-motion.
   ========================================================================== */
(function () {
  'use strict';

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  var body = document.body;
  var lb = null;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var skewNow = 0;
  var hasGsap = typeof window.gsap !== 'undefined';
  var hasST   = hasGsap && typeof window.ScrollTrigger !== 'undefined';

  if (hasST) gsap.registerPlugin(ScrollTrigger);
  if (reduced) document.documentElement.classList.add('no-anim');

  var LANG = 'cs';
  var ratingData = null;

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

  /* Điểm Google: đọc snapshot JSON (job cập nhật 1–2 ngày/lần). Quote giữ hard-code. */
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
    var revRating = $('#revRating');
    if (revRating) {
      revRating.setAttribute('data-count', String(rating));
      revRating.textContent = scoreTxt;
    }
    var revCount = $('#revCount');
    if (revCount) {
      revCount.setAttribute('data-count', String(count));
      revCount.textContent = countTxt;
    }
    var revWord = $('#revCountWord');
    if (revWord) revWord.textContent = word;
    if (data.mapsUrl) {
      var link = $('#gRatingLink');
      if (link) link.href = data.mapsUrl;
    }
  }

  fetch('/google-rating.json', { cache: 'no-cache' })
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(applyGoogleRating)
    .catch(function () {});

  /* ---------------------------------------------------------------- Lenis */
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

  // Skok na kotvu musí skončit na začátku obsahu sekce, ne uprostřed:
  // míříme na vnitřní .wrap a odečítáme skutečnou výšku lišty.
  function headerGap() {
    var bar = $('.bar');
    var h = bar ? bar.getBoundingClientRect().bottom : 80;
    return Math.round(h + 28);
  }

  function goTo(target) {
    var el = typeof target === 'string' ? $(target) : target;
    if (!el) return;
    var inner = el.querySelector(':scope > .wrap') || el;
    var gap = headerGap();
    snapBusy = true;
    setTimeout(function () { snapBusy = false; }, 1400);
    if (lenis) lenis.scrollTo(inner, { offset: -gap, duration: 1.15 });
    else window.scrollTo({ top: inner.getBoundingClientRect().top + window.pageYOffset - gap, behavior: 'smooth' });
  }

  /* --------------------------------------------------- Kotvy a mobilní menu */
  var burger = $('#burger');
  var sheet = $('#sheet');

  // Popisek tlačítka se mění se stavem, a mění se přes data-i18n-aria —
  // přepnutí jazyka pak nevrátí „Otevřít nabídku“ na otevřeném panelu.
  function paintBurger(open) {
    if (!burger) return;
    var key = open ? 'nav.closeMenu' : 'nav.openMenu';
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    burger.setAttribute('data-i18n-aria', key);
    burger.setAttribute('aria-label', t(key) || burger.getAttribute('aria-label'));
  }

  function closeMenu() {
    body.classList.remove('menu-open');
    paintBurger(false);
    if (lenis) lenis.start();
  }

  if (burger) {
    burger.addEventListener('click', function () {
      var open = body.classList.toggle('menu-open');
      paintBurger(open);
      if (lenis) open ? lenis.stop() : lenis.start();
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeMenu(); closeLb(); }
  });

  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (!id || id === '#' || !$(id)) return;
      e.preventDefault();
      closeMenu();
      // panel se musí stihnout zavřít, než začneme rolovat
      setTimeout(function () { goTo(id); }, body.classList.contains('menu-open') ? 260 : 0);
    });
  });

  /* ------------------------------------------------- Hlavička a scrollspy */
  var header = $('#header');
  // Scrollspy sleduje jen kotvy na této stránce; externí odkazy (PDF) přeskočí.
  // Mobilní panel se spyem jede taky — jinak na telefonu nikde nevidíš,
  // ve které sekci zrovna jsi. Hranice sekcí ale určuje dál jen lišta:
  // panel má navíc Menu, a to by na desktopu zhasínalo „O nás“.
  var navLinks = $$('#nav a, #sheet .sheet-nav a').filter(function (a) {
    return (a.getAttribute('href') || '').charAt(0) === '#';
  });
  var sections = $$('#nav a')
    .filter(function (a) { return (a.getAttribute('href') || '').charAt(0) === '#'; })
    .map(function (a) { return $(a.getAttribute('href')); })
    .filter(Boolean);

  function onScroll() {
    var y = window.pageYOffset;
    if (header) header.classList.toggle('solid', y > window.innerHeight * 0.7);

    var current = sections[0];
    for (var i = 0; i < sections.length; i++) {
      if (sections[i].getBoundingClientRect().top <= 140) current = sections[i];
    }
    navLinks.forEach(function (a) {
      a.classList.toggle('active', current && a.getAttribute('href') === '#' + current.id);
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

  /* ------------------------------------------- Dorovnání na začátek sekce */
  // Nepřebíráme rolování. Jen když uživatel dorolování skončí kousek od
  // hranice sekce, dojedeme na ni — ať nezačíná čtení uprostřed odstavce.
  var snapPoints = [];
  var snapBusy = false;
  var snapTimer = null;

  function buildSnapPoints() {
    var gap = headerGap();
    snapPoints = $$('main > section[id]').map(function (s) {
      var inner = s.querySelector(':scope > .wrap') || s;
      return inner.getBoundingClientRect().top + window.pageYOffset - gap;
    });
  }

  function maybeSnap() {
    if (snapBusy || body.classList.contains('menu-open') || body.classList.contains('ov-open')) return;
    if (lb && lb.classList.contains('on')) return;
    if (!window.matchMedia('(min-width: 901px)').matches) return;

    var y = window.pageYOffset;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    if (y < 40 || y > max - 40) return;          // úplný začátek a konec necháme být

    var limit = window.innerHeight * 0.16;        // jen „skoro na hranici“
    var best = null, bestD = Infinity;
    snapPoints.forEach(function (p) {
      var d = Math.abs(p - y);
      if (d < bestD) { bestD = d; best = p; }
    });
    if (best === null || bestD < 6 || bestD > limit) return;

    snapBusy = true;
    if (lenis) lenis.scrollTo(best, { duration: .5, easing: function (t) { return 1 - Math.pow(1 - t, 3); } });
    else window.scrollTo({ top: best, behavior: 'smooth' });
    setTimeout(function () { snapBusy = false; }, 700);
  }

  if (!reduced) {
    window.addEventListener('scroll', function () {
      clearTimeout(snapTimer);
      snapTimer = setTimeout(maybeSnap, 170);     // až když rolování utichne
    }, { passive: true });
    window.addEventListener('resize', buildSnapPoints);
    window.addEventListener('load', buildSnapPoints);
    buildSnapPoints();
  }

  /* -------------------------------------------------------------- Lightbox */
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
    // Pod lightboxem muze zustat otevreny prekryv s listkem — ten drzi zamek dal.
    if (lenis && !body.classList.contains('ov-open')) lenis.start();
  }
  $$('#gal .gal-print').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var im = btn.querySelector('img');
      if (!im) return;
      openLb(im.getAttribute('src'), btn.getAttribute('aria-label') || '');
    });
  });
  if (lb) {
    lb.addEventListener('click', function (e) { if (e.target !== lbImg) closeLb(); });
    $('#lbClose').addEventListener('click', closeLb);
  }

  /* ------------------------------------------------------- Jídelní lístek */
  /* Karty v sekci Signatures otevírají překryv se seznamem jídel.
     Adresa se mění na #menu/<slug>, takže zpět v prohlížeči překryv zavře
     a odkaz na konkrétní kategorii jde poslat dál. */
  var ov       = $('#menuOv');
  var ovPanel  = $('.menu-ov-panel', ov);
  var ovTitle  = $('#menuOvTitle');
  var ovNote   = $('#menuOvNote');
  var catBtns  = $$('.cat');
  var ovTabs   = $$('.menu-ov-tab');
  var ovPanes  = $$('.menu-pane');
  var lastOpener = null;   // kam vrátit fokus po zavření
  var ovOpen   = false;

  // Popisky bere překryv z karet, ať data žijí jen v src/data/menu.ts.
  // Počet jídel se pod kartou neukazuje, ale překryv ho v hlavičce chce,
  // takže visí na tlačítku jako data-n a text se skládá až tady.
  var catMeta = {};
  catBtns.forEach(function (btn) {
    var name = $('.cat-name', btn);
    catMeta[btn.dataset.cat] = {
      label: name ? name.textContent.trim() : '',
      count: btn.dataset.n ? dishWord(+btn.dataset.n) : ''
    };
  });

  function paintCat(slug) {
    var meta = catMeta[slug];
    if (!meta) return false;

    ovPanes.forEach(function (p) { p.hidden = p.dataset.pane !== slug; });
    ovTabs.forEach(function (t) { t.setAttribute('aria-pressed', String(t.dataset.go === slug)); });
    catBtns.forEach(function (b) { b.setAttribute('aria-expanded', String(b.dataset.cat === slug)); });

    ovTitle.textContent = meta.label;
    ovNote.textContent  = meta.count;
    if (ovOpen) ov.dataset.cat = slug;

    var pane = $('.menu-pane[data-pane="' + slug + '"]', ov);
    if (pane && hasGsap && !reduced) {
      /* Vodorovně SMÍME jedině tady: mezi kategoriemi se jde do strany,
         takže posun do strany nese význam — vlevo zpět, vpravo dál.
         Všude jinde na stránce se vjíždí zdola. */
      var order = ovPanes.map(function (p) { return p.dataset.pane; });
      var dir = (order.indexOf(slug) >= order.indexOf(ov.dataset.cat || slug)) ? 1 : -1;
      gsap.fromTo(pane, { x: dir * 46, opacity: 0 },
        { x: 0, opacity: 1, duration: .45, ease: 'power3.out', overwrite: true });
      gsap.fromTo($$('.dish-card', pane),
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: .5, ease: 'power2.out', stagger: .035,
          delay: .08, overwrite: true });
    }
    return true;
  }

  function openCat(slug, push) {
    if (!ov || !paintCat(slug)) return;

    lastOpener = $('.cat[data-cat="' + slug + '"]') || document.activeElement;
    ov.hidden = false;
    ovOpen = true;
    ov.dataset.cat = slug;
    void ov.offsetWidth;              // vynutit přechod z hidden
    ov.classList.add('on');
    body.classList.add('ov-open');
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
    catBtns.forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });

    var finish = function () { if (!ovOpen) ov.hidden = true; };
    if (reduced) finish(); else setTimeout(finish, 320);

    if (push && /^#menu\//.test(location.hash)) history.pushState(null, '', location.pathname);
    if (lastOpener && lastOpener.isConnected) lastOpener.focus();
    lastOpener = null;
  }

  // Fokus nesmí utéct za překryv, dokud je otevřený.
  function trapFocus(e) {
    if (!ovOpen || e.key !== 'Tab' || !ovPanel) return;
    var f = $$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', ovPanel)
      .filter(function (el) { return el.offsetParent !== null && !el.disabled; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  if (ov) {
    catBtns.forEach(function (btn) {
      btn.addEventListener('click', function () { openCat(btn.dataset.cat, true); });
    });
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

    // Zvětšení fotky jídla používá stejný lightbox jako galerie.
    $$('.dish-zoom', ov).forEach(function (btn) {
      btn.addEventListener('click', function () {
        openLb(btn.dataset.full, btn.dataset.name || '');
      });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && ovOpen && !(lb && lb.classList.contains('on'))) {
        e.preventDefault();
        closeCat(true);
      }
      trapFocus(e);
    });

    // Zpět/vpřed v prohlížeči i přímý odkaz na #menu/<slug>.
    function syncFromHash() {
      var m = /^#menu\/([a-z0-9-]+)$/.exec(location.hash);
      if (m && catMeta[m[1]]) {
        if (!ovOpen) openCat(m[1], false);
        else if (ov.dataset.cat !== m[1]) { paintCat(m[1]); ov.dataset.cat = m[1]; }
      } else if (ovOpen) {
        closeCat(false);
      }
    }
    window.addEventListener('popstate', syncFromHash);
    syncFromHash();
  }

  /* ---------------------------------------------------------------- Formy */
  /* POZOR — PŘEDÁVKA: tohle zatím NIC NEODESÍLÁ.
     Formulář se jen zvaliduje, ukáže hlášku o přijetí a vyresetuje se;
     rezervace ani objednávka poukazu se nikam nedoručí. Než web pustíte
     na hosty, doplňte odeslání (endpoint / mail na info@meshi-restaurant.cz)
     a teprve po úspěšné odpovědi ukazujte #resOk / #vOk. Platí pro
     #resForm i #vForm. Stejně nedodělaná je i #objednavka v hlavičce. */
  function wire(formId, okId) {
    var f = $(formId), ok = $(okId);
    if (!f) return;
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
  wire('#vForm', '#vOk');

  function setDefaultDate() {
    var el = $('#r-date');
    if (!el) return;
    var t = new Date(); t.setDate(t.getDate() + 1);
    el.min = new Date().toISOString().slice(0, 10);
    el.value = t.toISOString().slice(0, 10);
  }
  setDefaultDate();

  /* --------------------------------------------------- Máme teď otevřeno? */
  // Neděle = 0. Zavírací hodina platí pro týž den, po půlnoci nevaříme.
  var HOURS = [
    { o: 12, c: 22 }, { o: 11, c: 22 }, { o: 11, c: 22 }, { o: 11, c: 22 },
    { o: 11, c: 22 }, { o: 11, c: 23 }, { o: 11, c: 23 }
  ];
  var DAYS = ['v neděli', 'v pondělí', 'v úterý', 've středu', 've čtvrtek', 'v pátek', 'v sobotu'];

  // „ve“ před číslovkami, které se vyslovují se souhláskovým shlukem
  // (dvanáct, třináct, čtrnáct, dvacet…), jinak „v“.
  function prep(h) {
    return ([2, 4, 12, 13, 14].indexOf(h) > -1 || (h >= 20 && h <= 29)) ? 've' : 'v';
  }
  function hhmm(h) { return h + ':00'; }

  function renderOpenState() {
    var el = $('#openState');
    if (!el) return;
    var txt = el.querySelector('span');
    var now = new Date();
    var day = now.getDay();
    var mins = now.getHours() * 60 + now.getMinutes();
    var today = HOURS[day];
    var open = mins >= today.o * 60 && mins < today.c * 60;
    var en = LANG === 'en';

    if (open) {
      el.classList.remove('is-closed');
      txt.textContent = en
        ? 'Open until ' + hhmm(today.c)
        : 'Otevřeno – zavíráme ' + prep(today.c) + ' ' + hhmm(today.c);
      return;
    }

    el.classList.add('is-closed');
    if (mins < today.o * 60) {
      txt.textContent = en
        ? 'Closed, opens today at ' + hhmm(today.o)
        : 'Zavřeno – otevíráme dnes ' + prep(today.o) + ' ' + hhmm(today.o);
    } else {
      var next = HOURS[(day + 1) % 7];
      txt.textContent = en
        ? 'Closed, opens tomorrow at ' + hhmm(next.o)
        : 'Zavřeno – otevíráme zítra ' + prep(next.o) + ' ' + hhmm(next.o);
    }
  }

  function refreshCatMeta() {
    catBtns.forEach(function (btn) {
      var name = $('.cat-name', btn);
      if (!name) return;
      catMeta[btn.dataset.cat] = {
        label: name.textContent.trim(),
        count: btn.dataset.n ? dishWord(+btn.dataset.n) : ''
      };
    });
    if (ovOpen && ov && ov.dataset.cat) paintCat(ov.dataset.cat);
  }

  function paintZoomLabels() {
    $$('.dish-zoom').forEach(function (btn) {
      var name = btn.dataset.name || '';
      btn.setAttribute('aria-label', t('menu.zoom') + (name ? ': ' + name : ''));
    });
  }

  function paintMapLang() {
    var iframe = $('.map iframe');
    if (!iframe) return;
    var src = iframe.getAttribute('src') || '';
    var next = src.replace(/!1s[a-z]{2}!2s[a-z]{2}/, LANG === 'en' ? '!1sen!2scz' : '!1scs!2scz');
    if (next !== iframe.src && next !== src) iframe.src = next;
  }

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

    refreshCatMeta();
    paintZoomLabels();
    paintMapLang();
    if (ratingData) applyGoogleRating(ratingData);
    renderOpenState();
  }

  $$('.lang button').forEach(function (b) {
    b.addEventListener('click', function () {
      applyLang(b.getAttribute('data-lang'));
    });
  });

  var fromUrl = '';
  try { fromUrl = new URLSearchParams(location.search).get('lang') || ''; } catch (e) {}
  try {
    LANG = (fromUrl === 'en' || fromUrl === 'cs')
      ? fromUrl
      : (localStorage.getItem('meshi-lang') === 'en' ? 'en' : 'cs');
  } catch (e) { LANG = 'cs'; }
  applyLang(LANG, fromUrl === 'en' || fromUrl === 'cs');
  setInterval(renderOpenState, 60000);

  /* ============================== POHYB ================================= */
  if (!hasGsap) {
    // Hero startuje skrytý v CSS a rozsvítit ho má úvodní sekvence; bez GSAP
    // by zůstal zhasnutý, proto stejná záchrana jako u prefers-reduced-motion.
    document.documentElement.classList.add('no-anim');
    $$('[data-rv]').forEach(function (el) { el.style.opacity = 1; });
    return;
  }

  /* Bez pohybu: vše rovnou na místě, konec. */
  if (reduced) {
    gsap.set('[data-rv]', { opacity: 1, clearProps: 'transform' });
  } else {

    /* Úvodní sekvence hera — video se usazuje, text přichází zleva */
    var tl = gsap.timeline({ defaults: { ease: 'power3.out' }, delay: .12 });
    /* Zoom na úvod jede na <video>, ne na obalu #heroMedia: obal si při
       odjezdu hera škáluje scroll. Dvě tweeny na scale téhož elementu
       se přetahovaly, a kdo během úvodu scrolloval, viděl trhnutí. */
    tl.from('.hero-media video', { scale: 1.12, duration: 2.6, ease: 'power2.out' }, 0)
      .fromTo('[data-hero="logo"]', { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: .85 }, .18)
      .fromTo('.hero h1 .mask-line > span', { yPercent: 112, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1, stagger: .1 }, .35)
      .fromTo('[data-hero="4"] > *', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: .7, stagger: .09 }, .98)
      .fromTo('[data-hero="7"]', { opacity: 0, y: -14 }, { opacity: 1, y: 0, duration: .8 }, .7);

    /* Parallax — video nejpomaleji, text nejrychleji */
    gsap.to('#heroMedia', {
      yPercent: 13, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
    });
    gsap.to('.hero-art', {
      y: -28, opacity: .15, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: .8 }
    });
    $$('[data-hero-drift]').forEach(function (el) {
      var amt = parseFloat(el.dataset.heroDrift) || 20;
      gsap.to(el, {
        y: amt * -2.4, xPercent: -4, ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1.2 }
      });
    });

    /* Skleněné akcenty se jemně vznášejí za kurzorem */
    if (window.matchMedia('(hover:hover) and (min-width: 901px)').matches) {
      var seal = $('.seal'), float_ = $('.hero-float');
      if (seal && float_) {
        var sx = gsap.quickTo(seal, 'x', { duration: 1, ease: 'power3' });
        var sy = gsap.quickTo(seal, 'y', { duration: 1, ease: 'power3' });
        var fx = gsap.quickTo(float_, 'x', { duration: 1.2, ease: 'power3' });
        var fy = gsap.quickTo(float_, 'y', { duration: 1.2, ease: 'power3' });
        $('.hero').addEventListener('mousemove', function (e) {
          var cx = (e.clientX / window.innerWidth - .5);
          var cy = (e.clientY / window.innerHeight - .5);
          sx(cx * -22); sy(cy * -14);
          fx(cx * -13); fy(cy * -9);
        });
      }
    }

    /* Obecné odhalování obsahu */
    // Každý typ má vlastní délku i křivku. Jedno tempo na všechno je přesně
    // to, kvůli čemu stránka působí jednotvárně — pohyb pak nic neříká.
    var presets = {
      'fade-up':    { from: { opacity: 0, y: 26 },                  dur: .78, ease: 'power3.out' },
      'fade-left':  { from: { opacity: 0, x: 26 },                  dur: .78, ease: 'power3.out' },
      'fade-right': { from: { opacity: 0, x: -22 },                 dur: .78, ease: 'power3.out' },
      'pop':        { from: { opacity: 0, scale: .92, y: 12 },      dur: .62, ease: 'back.out(1.5)' },
      'clip':       { from: { opacity: 0, y: 30, clipPath: 'inset(12% 6% 12% 6% round 28px)' },
                      dur: 1.05, ease: 'power3.out' },
      // papírek, co dosedne na stůl — pro recenze
      'slip':       { from: { opacity: 0, y: 36, rotation: -1.8 },  dur: .92, ease: 'power3.out' },
      // těžší nájezd zdola pro velké karty
      'rise':       { from: { opacity: 0, y: 46, scale: .975 },     dur: .98, ease: 'power2.out' },
      // dlaždice galerie se rozevřou ze středu
      'tile':       { from: { opacity: 0, scale: .9 },              dur: .7,  ease: 'back.out(1.4)' }
    };

    function show(el, instant) {
      if (el.__shown) return;
      el.__shown = true;
      var p = presets[el.dataset.rv] || presets['fade-up'];
      gsap.to(el, {
        opacity: 1, x: 0, y: 0, scale: 1, rotation: 0,
        clipPath: el.dataset.rv === 'clip' ? 'inset(0% 0% 0% 0% round 26px)' : undefined,
        duration: instant ? 0 : p.dur,
        ease: p.ease,
        delay: instant ? 0 : (parseFloat(el.dataset.rvDelay) || 0),
        onComplete: function () { gsap.set(el, { clearProps: 'clipPath,willChange,rotation' }); }
      });
    }

    // Skupiny se odhalují po sobě — pořadí dáme předem, ať to nezávisí
    // na tom, kdy co proletí spouštěčem.
    [].forEach(function (pair) {
      $$(pair[0]).forEach(function (el, i) { el.dataset.rvDelay = (i * pair[1]).toFixed(3); });
    });

    var rvEls = $$('[data-rv]');
    rvEls.forEach(function (el) { gsap.set(el, (presets[el.dataset.rv] || presets['fade-up']).from); });

    // IntersectionObserver je spolehlivější než scroll — funguje i po skoku
    // na kotvu, po obnovení stránky uprostřed i při plynulém rolování.
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          show(e.target);
          io.unobserve(e.target);
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.01 });
      rvEls.forEach(function (el) { io.observe(el); });
    } else {
      rvEls.forEach(function (el) { show(el, true); });
    }

    // Pojistka: nic nesmí zůstat neviditelné, ani kdyby pozorovatel selhal.
    setTimeout(function () {
      rvEls.forEach(function (el) {
        if (!el.__shown && el.getBoundingClientRect().top < window.innerHeight) show(el, true);
      });
    }, 2500);

    /* Parallax fotek uvnitř rámů */
    // Vzor na pozadí se posouvá pomaleji než obsah — tím plocha získá hloubku
    // a nepusobi jako nalepena tapeta. Posouvame CSS promennou, protoze vzor
    // sedi na ::before a ten se primo animovat neda.
    if (hasST) {
      $$('[data-pat-drift]').forEach(function (sec) {
        gsap.fromTo(sec, { '--pat-x': '0px' }, {
          '--pat-x': (parseFloat(sec.dataset.patDrift) || 90) + 'px',
          ease: 'none',
          scrollTrigger: { trigger: sec, start: 'top bottom', end: 'bottom top', scrub: true }
        });
      });
    }

    /* ----------------------------------------------- Pohyb řízený scrollem */
    /* Apple gramatika: scroll neurčuje KDY, ale KDE v animaci jsme. Proto
       všechno níž jede na scrub a bez pérujících křivek — scroll je ease.
       Co se dá, se průběžně mění, místo aby se objevilo a zmizelo. */
    // POZOR: callback mm.add se volá hned, takže tohle musí být nad ním.
    var SPLIT_SEL = '.section-head h2, .rev-top h2, .res-top h2';
    var mm = gsap.matchMedia();

    mm.add({
      motion: '(prefers-reduced-motion: no-preference)',
      wide:   '(min-width: 901px)'
    }, function (ctx) {
      if (!ctx.conditions.motion || !hasST) return;
      var wide = ctx.conditions.wide;

      /* 1. Fotka se uvnitř rámu posouvá pomaleji než rám sám. Drobnost, ale
            právě ona dělá rozdíl mezi „obrázek v boxu“ a hloubkou. */
      $$('.gal-print img, .cat-shot img, .about-main img, .about-sub img').forEach(function (img) {
        gsap.set(img, { scale: 1.32, transformOrigin: '50% 50%' });
        gsap.fromTo(img, { yPercent: -13 }, {
          yPercent: 13, ease: 'none',
          scrollTrigger: { trigger: img.parentNode, start: 'top bottom', end: 'bottom top', scrub: .7 }
        });
      });

      /* 2. Nadpisy se odkrývají po řádcích zpod masky. Řádky si hledáme sami
            podle toho, kde text reálně zalomil — SplitText ve volné verzi není. */
      $$(SPLIT_SEL).forEach(function (h) {
        var lines = splitLines(h);
        if (!lines.length) return;
        gsap.fromTo(lines, { yPercent: 108 }, {
          yPercent: 0, ease: 'power3.out', duration: .9, stagger: .11,
          scrollTrigger: { trigger: h, start: 'top 88%', once: true }
        });
      });

      /* 3. Hero neodejde střihem — při odjezdu se obsah zmenší a propadne,
            zatímco video naopak povyroste. Dva plány, dvě rychlosti. */
      /* POZOR: tohle je JEDINÁ animace odjezdu hera. Dřív byla nahoře u
         parallaxu ještě jedna, která psala na .hero-copy taky yPercent a
         opacity — dvě tweeny na stejnou vlastnost si navzájem přepisovaly
         hodnotu a při návratu nahoru zůstal text viset na cizí opacitě,
         tedy vybledlý. Stejná past jako u nekonečného pásu níž: na jednu
         vlastnost jedna tween, jinak se to nedá uřídit. */
      var heroCopy = $('.hero-copy'), heroMedia = $('#heroMedia');
      if (heroCopy && heroMedia) {
        gsap.timeline({
          scrollTrigger: {
            trigger: '.hero', start: 'top top', end: 'bottom top',
            scrub: .6, invalidateOnRefresh: true
          }
        })
          .to(heroCopy, { yPercent: wide ? 38 : 24, scale: wide ? .82 : .9, opacity: 0, ease: 'none' }, 0)
          .to(heroMedia, { scale: wide ? 1.22 : 1.12, ease: 'none' }, 0);
      }

      /* 4. Tři karty kategorií už stojí v různé výšce — ať se i vezou různě
            rychle, posun pak vypadá jako prostor, ne jako nedbalost. */
      $$('.cats .cat').forEach(function (c, i) {
        var amt = [0, 9, 4][i] || 0;
        gsap.fromTo(c, { yPercent: amt }, {
          yPercent: -amt, ease: 'none',
          scrollTrigger: { trigger: '.cats', start: 'top bottom', end: 'bottom top', scrub: .9 }
        });
      });

      /* 4b. Recenze nejedou v jedné rovině — liché karty o kus napřed.
            Mřížka pak má hloubku, místo aby byla nalepená. */
      /* POZOR: vstup karet jede na  y, takže parallax musí na  yPercent —
         jinak si obě tweeny přepisují tutéž vlastnost a karta se nehne. */
      $$('.revs .rev').forEach(function (r, i) {
        var amt = i % 2 ? 7 : -5;
        gsap.fromTo(r, { yPercent: amt }, {
          yPercent: -amt, ease: 'none',
          scrollTrigger: { trigger: '.revs', start: 'top bottom', end: 'bottom top', scrub: .8 }
        });
      });

      /* Dlaždice galerie dřív dýchaly přes scrub na  scale — jenže na témže
         scale jede jejich vstup, takže si to přepisovalo. Život jim dává
         posun fotky uvnitř rámu (bod 1), to stačí. */

      /* 4d. Vstup karet po tuhách, ne naráz.
            Tři věci dělají rozdíl proti prostému fade-up:
              - dlouhá dráha (karta přijíždí zdaleka, ne o 30 px)
              - znatelný rozestup, aby šlo VIDĚT, že přijíždějí po sobě
              - vnitřek karty jede samostatně až za jejím tělem
            Bez toho se celá karta veze jako jeden kus a pohyb nic neřekne. */
      function revealGroup(sel, opt) {
        var items = $$(sel);
        if (!items.length) return;
        opt = opt || {};
        var dist = opt.dist || 90, step = opt.step || 0.17;

        var parts = items.map(function (card) {
          return {
            card:  card,
            media: $(opt.media || 'img', card),
            seal:  $('.cat-seal', card),
            bits:  opt.bits === '' ? [] : $$(opt.bits ||
                     'h3, h4, q, p, b, .price, .dish-price, .cat-name, .rev-foot', card)
          };
        });

        // Výchozí stav sázíme rovnou, ať nic neproblikne.
        /* Úklon a pootočení podle toho, v jakém sloupci karta leží: krajní se
           naklánějí ven, prostřední skoro ne. Pohyb zůstává zdola — jen už to
           není výtah, ale pokládání karty na stůl.
           Vodorovně se NEPŘIJÍŽDÍ: to je rukopis šablon (fade-left/right). */
        var mid = (items.length - 1) / 2;
        parts.forEach(function (p, i) {
          var lean = items.length > 1 ? (i - mid) / Math.max(mid, 1) : 0;   // -1 .. 1
          p.lean = lean;
          p.card.__shown = true;          // režii přebíráme, starý reveal ať nesahá
          gsap.set(p.card, {
            y: dist, x: lean * 16, rotation: lean * 1.6,
            opacity: 0, scale: .97, transformOrigin: '50% 120%'
          });
          if (p.media) gsap.set(p.media, { scale: 1.22 });
          if (p.bits.length) gsap.set(p.bits, { y: 16, opacity: 0 });
          if (p.seal) gsap.set(p.seal, { opacity: 0 });
        });

        function run(card) {
          var p = parts[items.indexOf(card)];
          if (!p || p.done) return;
          p.done = true;
          var tl = gsap.timeline();
          tl.to(p.card, { y: 0, x: 0, rotation: 0, opacity: 1, scale: 1,
                          duration: .95, ease: 'power3.out' });
          if (p.media) tl.to(p.media, { scale: 1, duration: 1.15, ease: 'power2.out' }, '-=.78');
          if (p.bits.length) {
            tl.to(p.bits, { y: 0, opacity: 1, duration: .55, ease: 'power2.out', stagger: .07 }, '-=.62');
          }
          /* Pečeť nepřiletí — praští sebou jako razítko. Zrychlující křivka
             (power4.in) je tu schválně: dojezd má být tvrdý, ne měkký.
             clearProps vrátí řízení CSS, aby zase fungoval hover. */
          if (p.seal) {
            tl.fromTo(p.seal, { scale: 1.45, rotation: -16, opacity: 0 },
              { scale: 1, rotation: -7, opacity: 1, duration: .26, ease: 'power3.in' }, '-=.3')
              /* krátké doškubnutí po dosednutí — razítko se o papír otře */
              .to(p.seal, { scale: 1.06, duration: .09, ease: 'power2.out' })
              .to(p.seal, { scale: 1, duration: .22, ease: 'power2.out',
                onComplete: function () { gsap.set(p.seal, { clearProps: 'all' }); } });
          }
        }

        /* ScrollTrigger.batch je na přesně tohle: posbírá prvky, které vjely
           naráz, a pustí je jedním vrzem s rozestupem. Dřív jsem měl na každé
           kartě vlastní uspanou timeline s delay — a ta se v jistých situacích
           nerozjela vůbec a karta zůstala neviditelná. */
        ScrollTrigger.batch(items, {
          start: 'top 92%',
          once: true,
          onEnter: function (batch) {
            batch.forEach(function (card, i) { gsap.delayedCall(i * step, function () { run(card); }); });
          }
        });

        /* Pojistka: co je po chvíli vidět v okně a pořád neodehrálo, pustíme.
           Karta se nikdy nesmí zaseknout neviditelná. */
        setTimeout(function () {
          parts.forEach(function (p) {
            if (p.done) return;
            var r = p.card.getBoundingClientRect();
            if (r.top < window.innerHeight && r.bottom > 0) run(p.card);
          });
        }, 2200);
        window.addEventListener('scroll', function onFirst() {
          window.removeEventListener('scroll', onFirst);
          setTimeout(function () {
            parts.forEach(function (p) {
              if (p.done) return;
              var r = p.card.getBoundingClientRect();
              if (r.top < window.innerHeight && r.bottom > 0) run(p.card);
            });
          }, 400);
        }, { passive: true });
      }

      revealGroup('.revs .rev',      { dist: 96, step: .16 });
      revealGroup('.cats .cat',      { dist: 110, step: .18, media: '.cat-shot img',
                                       bits: '.cat-name, .cat-arr' });
      revealGroup('#gal .gal-print', { dist: 70, step: .07, bits: '' });
      revealGroup('.map-card, .kontakt-grid > .card', { dist: 80, step: .12 });

      /* 4e. Sumi tah se nevynoří — nakreslí se zleva doprava, jako když
            po papíře projede štětec. Je to jediná cesta, SVG path, takže
            stačí odpočítat strokeDashoffset. */
      $$('.sig-rule svg path').forEach(function (path) {
        var len = path.getTotalLength ? path.getTotalLength() : 0;
        if (!len) return;
        gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
        gsap.to(path, {
          strokeDashoffset: 0, duration: 1.4, ease: 'power2.inOut',
          scrollTrigger: { trigger: path, start: 'top 92%', once: true }
        });
      });

      /* 5. Rychlost scrollu lehce naklání obsah. Pod 2 stupni to nikdo
            vědomě nevidí, ale stránka přestane působit jako nalepený papír. */
      var skewTargets = $$('.revs, .cats, .gal, .fgrid');
      var velSetter = gsap.quickSetter(skewTargets, 'skewY', 'deg');
      var clamp = gsap.utils.clamp(-2, 2);
      ScrollTrigger.create({
        onUpdate: function (self) {
          var v = clamp(self.getVelocity() / -480);
          if (Math.abs(v) > Math.abs(skewNow)) {
            skewNow = v;
            gsap.to({}, { duration: .5, onUpdate: function () {
              skewNow += (0 - skewNow) * .12; velSetter(skewNow);
            }});
          }
        }
      });

      /* 7. Hodnocení se dopočítá, až na něj dojde řada. */
      var score = $('.rev-score > b');
      if (score) {
        var target = parseFloat((score.textContent || '0').replace(',', '.')) || 0;
        var obj = { n: 0 };
        gsap.to(obj, {
          n: target, duration: 1.3, ease: 'power2.out',
          scrollTrigger: { trigger: score, start: 'top 90%', once: true },
          onUpdate: function () { score.textContent = obj.n.toFixed(1).replace('.', ','); }
        });
      }
    });

    /* Rozpad nadpisu na řádky: obalíme každé slovo, přečteme offsetTop a
       slova se stejným topem složíme do řádku s overflow:hidden.

       Text hledáme i uvnitř <span data-i18n>, jinak by se většina nadpisů
       nerozpadla — překladové obaly jsou skoro všude. Vlastní span ale
       zachováváme, takže si ho i18n pořád najde.

       Pokud překladač přepíše textContent, rozpad se tím smaže. Stačí po
       přepnutí jazyka poslat  document.dispatchEvent(new Event('i18n:applied'))
       a nadpisy se rozdělí a nastaví znovu. */

    function wrapWords(node, skip) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          if (!/\S/.test(n.textContent)) return;
          var s = document.createElement('span');
          s.innerHTML = n.textContent.replace(/(\S+)/g, '<span class="w">$1</span>');
          node.replaceChild(s, n);
          while (s.firstChild) node.insertBefore(s.firstChild, s);
          node.removeChild(s);
        } else if (n.nodeType === 1 && !n.matches(skip)) {
          wrapWords(n, skip);
        }
      });
    }

    function splitLines(el) {
      if (el.__split) return el.__split;
      if (!el.__raw) el.__raw = el.innerHTML;

      wrapWords(el, '.sub, .line-mask');
      var words = $$('.w', el);
      if (!words.length) return (el.__split = []);

      var rows = [], last = null;
      words.forEach(function (w) {
        var t = Math.round(w.offsetTop);
        if (last === null || t !== last) { rows.push([]); last = t; }
        rows[rows.length - 1].push(w);
      });

      var lines = rows.map(function (row) {
        var mask = document.createElement('span');
        mask.className = 'line-mask';
        var inner = document.createElement('span');
        inner.className = 'line-in';
        row[0].parentNode.insertBefore(mask, row[0]);
        row.forEach(function (w, i) {
          inner.appendChild(w);
          if (i < row.length - 1) inner.appendChild(document.createTextNode(' '));
        });
        mask.appendChild(inner);
        return inner;
      });
      el.__split = lines;
      return lines;
    }

    // Po přepnutí jazyka text ve span zmizí i s rozpadem — složíme ho znovu.
    document.addEventListener('i18n:applied', function () {
      $$(SPLIT_SEL).forEach(function (h) {
        h.__split = null;
        var lines = splitLines(h);
        if (lines.length) gsap.set(lines, { yPercent: 0 });
      });
      if (hasST) ScrollTrigger.refresh();
    });

    $$('[data-parallax]').forEach(function (img) {
      var amt = parseFloat(img.dataset.parallax) || -6;
      gsap.fromTo(img, { yPercent: -amt }, {
        yPercent: amt, ease: 'none',
        scrollTrigger: { trigger: img.closest('.tile') || img.parentNode, start: 'top bottom', end: 'bottom top', scrub: .8 }
      });
    });

    /* Kaligrafie na pozadí pluje pomaleji než obsah */
    $$('[data-drift]').forEach(function (el) {
      var amt = parseFloat(el.dataset.drift) || 30;
      gsap.fromTo(el, { y: amt }, {
        y: -amt, ease: 'none',
        scrollTrigger: { trigger: el.closest('section, footer') || el, start: 'top bottom', end: 'bottom top', scrub: 1.1 }
      });
    });

    /* Linka v nadpisu sekce se roztáhne */
    $$('.eyebrow').forEach(function (el) {
      ScrollTrigger.create({
        trigger: el, start: 'top 92%', once: true,
        onEnter: function () {
          gsap.fromTo(el, { letterSpacing: '.22em' }, { letterSpacing: '.16em', duration: .9, ease: 'power2.out' });
        }
      });
    });

    /* Nekonečný pás.
       Jen JEDNA tween na xPercent — druhá (přidával jsem ji zvlášť kvůli
       reakci na scroll) si s touhle přepisovala hodnotu a pás blikal.
       Rychlost se proto ladí timeScale na TÉHLE tween, a tlumí se v tickeru,
       ne novým gsap.to při každém scroll framu. */
    var row = $('#marquee');
    if (row) {
      row.innerHTML += row.innerHTML;
      var mq = gsap.to(row, { xPercent: -50, duration: 42, ease: 'none', repeat: -1 });

      if (hasST && !reduced) {
        var mqWant = 1;
        ScrollTrigger.create({
          onUpdate: function (self) {
            mqWant = gsap.utils.clamp(1, 4.5, 1 + Math.abs(self.getVelocity()) / 1400);
          }
        });
        gsap.ticker.add(function () {
          var cur = mq.timeScale();
          mq.timeScale(cur + (mqWant - cur) * 0.06);   // plynulý dojezd
          mqWant += (1 - mqWant) * 0.04;               // samo se vrací k 1
        });
      }
    }

    /* Počítadla — đọc data-count lúc chạy, để JSON Google kịp ghi số mới */
    $$('[data-count]').forEach(function (el) {
      var o = { v: 0 };
      ScrollTrigger.create({
        trigger: el, start: 'top 92%', once: true,
        onEnter: function () {
          var target = parseFloat(el.dataset.count);
          var dec = parseInt(el.dataset.dec || '0', 10);
          if (!isFinite(target)) return;
          gsap.to(o, {
            v: target, duration: 1.5, ease: 'power2.out',
            onUpdate: function () {
              el.textContent = formatScore(o.v, dec);
            }
          });
        }
      });
    });

    /* Jemný náklon hlavní fotky v sekci O nás */
    var tilt = $('[data-tilt]');
    if (tilt && window.matchMedia('(hover:hover)').matches) {
      var qx = gsap.quickTo(tilt, 'rotateY', { duration: .6, ease: 'power3' });
      var qy = gsap.quickTo(tilt, 'rotateX', { duration: .6, ease: 'power3' });
      gsap.set(tilt, { transformPerspective: 900, transformStyle: 'preserve-3d' });
      tilt.addEventListener('mousemove', function (e) {
        var r = tilt.getBoundingClientRect();
        qx(((e.clientX - r.left) / r.width - .5) * 7);
        qy(((e.clientY - r.top) / r.height - .5) * -7);
      });
      tilt.addEventListener('mouseleave', function () { qx(0); qy(0); });
    }

  }

  /* Po načtení fotek a fontů je potřeba přepočítat spouštěče */
  window.addEventListener('load', function () { if (hasST) ScrollTrigger.refresh(); });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { if (hasST) ScrollTrigger.refresh(); });
  }
})();
