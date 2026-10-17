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
  var hasGsap = typeof window.gsap !== 'undefined';
  var hasST   = hasGsap && typeof window.ScrollTrigger !== 'undefined';

  if (hasST) gsap.registerPlugin(ScrollTrigger);
  if (reduced) document.documentElement.classList.add('no-anim');

  /* Điểm Google: đọc snapshot JSON (job cập nhật 1–2 ngày/lần). Quote giữ hard-code. */
  function czechReviewWord(n) {
    n = Math.abs(Math.round(n));
    if (n === 1) return 'recenze';
    var mod10 = n % 10;
    var mod100 = n % 100;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'recenze';
    return 'recenzí';
  }

  function applyGoogleRating(data) {
    if (!data) return;
    var rating = parseFloat(data.rating);
    var count = parseInt(data.count, 10);
    if (!isFinite(rating) || !isFinite(count) || count < 0) return;
    var word = czechReviewWord(count);
    var scoreTxt = rating.toFixed(1).replace('.', ',');
    var countTxt = count.toLocaleString('cs-CZ');
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
      duration: 1.1,
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      smoothWheel: true,
      touchMultiplier: 1.6
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

  function closeMenu() {
    body.classList.remove('menu-open');
    if (burger) burger.setAttribute('aria-expanded', 'false');
    if (lenis) lenis.start();
  }

  if (burger) {
    burger.addEventListener('click', function () {
      var open = body.classList.toggle('menu-open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
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
  var navLinks = $$('#nav a').filter(function (a) {
    return (a.getAttribute('href') || '').charAt(0) === '#';
  });
  var sections = navLinks
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
    if (snapBusy || body.classList.contains('menu-open')) return;
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

  /* ------------------------------------------------------ Signature chody */
  var stage = {
    img:   $('#stImg'),   title: $('#stTitle'), desc:  $('#stDesc'),
    price: $('#stPrice'), kanji: $('#stKanji'), badge: $('#stBadge'),
    notes: $('#stNotes'),
    ings:  $('#stIngs')
  };
  var dishes = $$('#dishes .dish');

  function paintDish(btn, animate) {
    var d = btn.dataset;
    dishes.forEach(function (b) { b.setAttribute('aria-selected', String(b === btn)); });

    var write = function () {
      stage.title.textContent = d.title;
      stage.desc.textContent  = d.desc;
      stage.price.textContent = d.price;
      stage.kanji.textContent = d.kanji;
      stage.badge.textContent = d.badge;
      stage.notes.textContent = d.notes;
      stage.ings.innerHTML = d.ings.split('|').map(function (t) {
        return '<span class="chip"><i class="dot"></i>' + t + '</span>';
      }).join('');
      stage.img.alt = d.title;
    };

    if (!animate || !hasGsap || reduced) {
      stage.img.src = d.img;
      write();
      return;
    }

    // Fotka se prolne přes klon, text se jemně překlopí.
    var old = stage.img.cloneNode(true);
    old.removeAttribute('id');
    stage.img.parentNode.insertBefore(old, stage.img);
    stage.img.src = d.img;

    gsap.set(stage.img, { opacity: 0, scale: 1.06 });
    gsap.to(stage.img, { opacity: 1, scale: 1, duration: .75, ease: 'power2.out' });
    gsap.to(old, {
      opacity: 0, scale: 1.02, duration: .6, ease: 'power2.out',
      onComplete: function () { old.remove(); }
    });

    var txt = [stage.title, stage.desc, stage.ings, stage.notes.parentNode];
    gsap.timeline()
      .to(txt, { opacity: 0, y: 7, duration: .18, ease: 'power1.in', stagger: .02, onComplete: write })
      .to(txt, { opacity: 1, y: 0, duration: .42, ease: 'power2.out', stagger: .045 });
  }

  dishes.forEach(function (btn, i) {
    btn.addEventListener('click', function () { paintDish(btn, true); });
    btn.addEventListener('keydown', function (e) {
      var n = e.key === 'ArrowDown' ? i + 1 : e.key === 'ArrowUp' ? i - 1 : -1;
      if (n < 0 || n >= dishes.length) return;
      e.preventDefault();
      dishes[n].focus();
      paintDish(dishes[n], true);
    });
  });

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
    if (lenis) lenis.start();
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

  /* ---------------------------------------------------------------- Formy */
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

  // Přepínač jazyka je zatím jen vizuální.
  $$('.lang button').forEach(function (b) {
    b.addEventListener('click', function () {
      $$('.lang button').forEach(function (x) { x.classList.remove('on'); x.setAttribute('aria-pressed', 'false'); });
      b.classList.add('on'); b.setAttribute('aria-pressed', 'true');
    });
  });

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

    if (open) {
      el.classList.remove('is-closed');
      txt.textContent = 'Otevřeno – zavíráme ' + prep(today.c) + ' ' + hhmm(today.c);
      return;
    }

    el.classList.add('is-closed');
    if (mins < today.o * 60) {
      txt.textContent = 'Zavřeno – otevíráme dnes ' + prep(today.o) + ' ' + hhmm(today.o);
    } else {
      var next = HOURS[(day + 1) % 7];
      txt.textContent = 'Zavřeno – otevíráme zítra ' + prep(next.o) + ' ' + hhmm(next.o);
    }
  }
  renderOpenState();
  setInterval(renderOpenState, 60000);

  /* ============================== POHYB ================================= */
  if (!hasGsap) {
    $$('[data-rv]').forEach(function (el) { el.style.opacity = 1; });
    return;
  }

  /* Bez pohybu: vše rovnou na místě, konec. */
  if (reduced) {
    gsap.set('[data-rv]', { opacity: 1, clearProps: 'transform' });
  } else {

    /* Úvodní sekvence hera — video se usazuje, text přichází zleva */
    var tl = gsap.timeline({ defaults: { ease: 'power3.out' }, delay: .12 });
    tl.from('.hero-media', { scale: 1.12, duration: 2.6, ease: 'power2.out' }, 0)
      .from('[data-hero="logo"]', { opacity: 0, y: 18, duration: .85 }, .18)
      .from('[data-hero="1"]', { opacity: 0, y: 14, duration: .7 }, .32)
      .from('.hero h1 .mask-line > span', { yPercent: 112, opacity: 0, duration: 1, stagger: .1 }, .35)
      .from('[data-hero="3"]', { opacity: 0, y: 16, duration: .75 }, .78)
      .from('[data-hero="4"] > *', { opacity: 0, y: 16, duration: .7, stagger: .09 }, .98)
      .from('[data-hero="6"]', { opacity: 0, scale: .5, rotate: -45, duration: .9, ease: 'back.out(1.7)' }, .95)
      .from('[data-hero="7"]', { opacity: 0, y: -14, duration: .8 }, .7);

    /* Parallax — video nejpomaleji, text nejrychleji */
    gsap.to('#heroMedia', {
      yPercent: 13, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
    });
    gsap.to('.hero-copy', {
      yPercent: -12, opacity: .1, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: .6 }
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
    var presets = {
      'fade-up':    { opacity: 0, y: 26 },
      'fade-left':  { opacity: 0, x: 26 },
      'fade-right': { opacity: 0, x: -22 },
      'pop':        { opacity: 0, scale: .92, y: 12 },
      'clip':       { opacity: 0, y: 30, clipPath: 'inset(12% 6% 12% 6% round 28px)' }
    };

    function show(el, instant) {
      if (el.__shown) return;
      el.__shown = true;
      gsap.to(el, {
        opacity: 1, x: 0, y: 0, scale: 1,
        clipPath: el.dataset.rv === 'clip' ? 'inset(0% 0% 0% 0% round 26px)' : undefined,
        duration: instant ? 0 : (el.dataset.rv === 'clip' ? 1.05 : .78),
        ease: 'power3.out',
        delay: instant ? 0 : (parseFloat(el.dataset.rvDelay) || 0),
        onComplete: function () { gsap.set(el, { clearProps: 'clipPath,willChange' }); }
      });
    }

    // Skupiny se odhalují po sobě — pořadí dáme předem, ať to nezávisí
    // na tom, kdy co proletí spouštěčem.
    [['.revs .rev', .08], ['#dishes .dish', .055]].forEach(function (pair) {
      $$(pair[0]).forEach(function (el, i) { el.dataset.rvDelay = (i * pair[1]).toFixed(3); });
    });

    var rvEls = $$('[data-rv]');
    rvEls.forEach(function (el) { gsap.set(el, presets[el.dataset.rv] || presets['fade-up']); });

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

    /* Nekonečný pás */
    var row = $('#marquee');
    if (row) {
      row.innerHTML += row.innerHTML;
      gsap.to(row, { xPercent: -50, duration: 42, ease: 'none', repeat: -1 });
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
              el.textContent = o.v.toFixed(dec).replace('.', ',');
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
