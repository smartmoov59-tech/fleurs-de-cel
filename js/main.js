/* ==========================================================================
   Fleurs de Cel — comportement et animations
   GSAP + ScrollTrigger + Lenis (tous trois hébergés dans /js/vendor).
   Règles : courbes douces (power3 / expo), transform + opacity en priorité,
   version allégée sur mobile, aucune animation si prefers-reduced-motion.
   ========================================================================== */
(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const html = document.documentElement;
  const CFG = window.FDC || {};
  const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  const motion = hasGSAP && !reduceMQ.matches;
  let lenis = null;

  /* Sécurité : si la page doit rester utilisable sans l'animation */
  if (!motion) html.classList.remove('motion', 'is-loading');
  window.__fdcReady = true;

  /* ------------------------------------------------------------------
     Utilitaires
     ------------------------------------------------------------------ */
  const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const pad = (n) => String(n).padStart(2, '0');
  const hm = (min) => { const h = Math.floor(min / 60), m = min % 60; return m ? `${h}h${pad(m)}` : `${h}h`; };

  function parisNow() {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
    const get = (t) => parts.find((p) => p.type === t).value;
    const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return { day: map[get('weekday')], min: parseInt(get('hour'), 10) % 24 * 60 + parseInt(get('minute'), 10) };
  }

  function splitText(el, mode) {
    const label = el.textContent.replace(/\s+/g, ' ').trim();
    const inners = [];
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span');
            w.className = 'split-word';
            const make = (txt) => { const c = document.createElement('span'); c.className = 'split-inner'; c.textContent = txt; w.appendChild(c); inners.push(c); };
            if (mode === 'chars') [...part].forEach(make); else make(part);
            frag.appendChild(w);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    const visual = document.createElement('span');
    visual.setAttribute('aria-hidden', 'true');
    while (el.firstChild) visual.appendChild(el.firstChild);
    el.appendChild(visual);
    walk(visual);
    const sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = label;
    el.prepend(sr);
    return inners;
  }

  function wrapWords(el) {
    const words = [];
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const s = document.createElement('span'); s.className = 'w'; s.textContent = part; words.push(s); frag.appendChild(s);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(el);
    return words;
  }

  function scrollToTarget(target, opts = {}) {
    const el = typeof target === 'string' ? $(target) : target;
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset: opts.offset ?? -40, duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) });
    else el.scrollIntoView({ behavior: reduceMQ.matches ? 'auto' : 'smooth', block: 'start' });
  }

  function toast(msg) {
    const t = $('.toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('is-on'), 3200);
  }

  /* ------------------------------------------------------------------
     Éléments statiques (sans dépendance à GSAP)
     ------------------------------------------------------------------ */
  function initOpenStatus() {
    const chip = $('#open-chip');
    const label = $('#open-label');
    const rows = $$('.hours tr[data-d]');
    const now = parisNow();
    rows.forEach((r) => r.classList.toggle('is-today', Number(r.dataset.d) === now.day));
    if (!chip || !label) return;
    const today = CFG.horaires[now.day] || [];
    const current = today.find(([a, b]) => now.min >= a && now.min < b);
    if (current) {
      chip.classList.remove('is-closed');
      label.textContent = `Ouvert · jusqu’à ${hm(current[1])}`;
      return;
    }
    chip.classList.add('is-closed');
    const later = today.find(([a]) => a > now.min);
    if (later) { label.textContent = `Fermé · rouvre à ${hm(later[0])}`; return; }
    for (let i = 1; i <= 7; i++) {
      const d = (now.day + i) % 7;
      const w = CFG.horaires[d];
      if (w && w.length) { label.textContent = `Fermé · rouvre ${i === 1 ? 'demain' : JOURS[d]} à ${hm(w[0][0])}`; return; }
    }
  }

  function initMenu() {
    const burger = $('.burger');
    const menu = $('.menu');
    if (!burger || !menu) return;
    let open = false;
    const links = $$('.menu li a, .menu .menu__foot a');
    const setOpen = (v) => {
      open = v;
      html.classList.toggle('menu-open', v);
      burger.setAttribute('aria-expanded', String(v));
      burger.setAttribute('aria-label', v ? 'Fermer le menu' : 'Ouvrir le menu');
      menu.setAttribute('aria-hidden', String(!v));
      if (v) { lenis && lenis.stop(); html.style.overflow = 'hidden'; } else { lenis && lenis.start(); html.style.overflow = ''; }
      if (hasGSAP && !reduceMQ.matches) {
        if (v) {
          gsap.set(menu, { visibility: 'visible' });
          gsap.fromTo(menu, { clipPath: 'circle(0% at calc(100% - 3rem) 2.6rem)' }, { clipPath: 'circle(150% at calc(100% - 3rem) 2.6rem)', duration: 1.1, ease: 'expo.inOut' });
          gsap.fromTo($$('.menu li a'), { yPercent: 110 }, { yPercent: 0, duration: 1, stagger: 0.07, ease: 'expo.out', delay: 0.35 });
          gsap.fromTo($('.menu__foot'), { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.8, delay: 0.8 });
        } else {
          gsap.to(menu, { clipPath: 'circle(0% at calc(100% - 3rem) 2.6rem)', duration: 0.8, ease: 'expo.inOut', onComplete: () => gsap.set(menu, { visibility: 'hidden' }) });
        }
      } else {
        menu.style.visibility = v ? 'visible' : 'hidden';
        menu.style.clipPath = v ? 'none' : '';
      }
      if (v) setTimeout(() => links[0] && links[0].focus({ preventScroll: true }), 400);
    };
    burger.addEventListener('click', () => setOpen(!open));
    links.forEach((a) => a.addEventListener('click', () => setOpen(false)));
    document.addEventListener('keydown', (e) => {
      if (!open) return;
      if (e.key === 'Escape') { setOpen(false); burger.focus(); }
      if (e.key === 'Tab') {
        const f = [burger, ...links];
        const i = f.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    });
    window.matchMedia('(min-width: 961px)').addEventListener('change', (e) => { if (e.matches && open) setOpen(false); });
  }

  function initAnchors() {
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const target = $(id);
      if (!target) return;
      e.preventDefault();
      scrollToTarget(target, { offset: id === '#reserver' ? -10 : -30 });
      history.replaceState(null, '', id);
    });
  }

  /* --- Avis : carrousel ------------------------------------------------ */
  function initCarousel() {
    const track = $('.carousel__track');
    if (!track) return;
    const cards = $$('.review', track);
    const prev = $('[data-car-prev]');
    const next = $('[data-car-next]');
    const counter = $('[data-car-count]');
    const step = () => (cards[1] ? cards[1].offsetLeft - cards[0].offsetLeft : track.clientWidth * 0.8);
    const index = () => Math.min(cards.length - 1, Math.round(track.scrollLeft / step()));
    const update = () => { if (counter) counter.textContent = `${pad(index() + 1)} / ${pad(cards.length)}`; };
    const go = (dir) => {
      const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
      if (dir > 0 && atEnd) track.scrollTo({ left: 0, behavior: 'smooth' });
      else track.scrollBy({ left: dir * step(), behavior: 'smooth' });
    };
    prev && prev.addEventListener('click', () => go(-1));
    next && next.addEventListener('click', () => go(1));
    track.addEventListener('scroll', () => requestAnimationFrame(update), { passive: true });
    update();

    /* glisser à la souris */
    if (finePointer) {
      let down = false, sx = 0, sl = 0, moved = false;
      track.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') return; down = true; moved = false; sx = e.clientX; sl = track.scrollLeft; track.style.scrollSnapType = 'none'; track.style.cursor = 'grabbing'; });
      window.addEventListener('pointermove', (e) => { if (!down) return; const dx = e.clientX - sx; if (Math.abs(dx) > 3) moved = true; track.scrollLeft = sl - dx; });
      window.addEventListener('pointerup', () => { if (!down) return; down = false; track.style.cursor = ''; track.style.scrollSnapType = ''; if (moved) { const i = index(); track.scrollTo({ left: i * step(), behavior: 'smooth' }); } });
    }

    /* défilement automatique doux, suspendu au survol / focus / onglet masqué */
    if (!reduceMQ.matches) {
      let paused = false, visible = false;
      const wrap = track.closest('.reviews');
      ['pointerenter', 'focusin'].forEach((ev) => wrap.addEventListener(ev, () => (paused = true)));
      ['pointerleave', 'focusout'].forEach((ev) => wrap.addEventListener(ev, () => (paused = false)));
      new IntersectionObserver(([en]) => (visible = en.isIntersecting), { threshold: 0.4 }).observe(wrap);
      setInterval(() => { if (!paused && visible && !document.hidden) go(1); }, 6500);
    }
  }

  /* --- Galerie : lightbox accessible ------------------------------------ */
  function initLightbox() {
    const lb = $('.lightbox');
    if (!lb) return;
    const items = $$('.g-item button');
    const img = $('img', lb);
    const cap = $('figcaption', lb);
    const closeBtn = $('.lightbox__close', lb);
    let cur = 0, lastFocus = null;
    const show = (i) => {
      cur = (i + items.length) % items.length;
      const b = items[cur];
      img.src = b.dataset.full || $('img', b).src;
      img.alt = $('img', b).alt;
      cap.textContent = b.dataset.caption || '';
    };
    const open = (i) => {
      lastFocus = document.activeElement;
      show(i);
      lb.classList.add('is-open');
      lb.removeAttribute('aria-hidden');
      lenis && lenis.stop();
      html.style.overflow = 'hidden';
      setTimeout(() => closeBtn.focus(), 60); /* après le passage en visibility: visible */
    };
    const close = () => {
      lb.classList.remove('is-open');
      lb.setAttribute('aria-hidden', 'true');
      lenis && lenis.start();
      html.style.overflow = '';
      lastFocus && lastFocus.focus({ preventScroll: true });
    };
    items.forEach((b, i) => b.addEventListener('click', () => open(i)));
    closeBtn.addEventListener('click', close);
    $('.lightbox__prev', lb).addEventListener('click', () => show(cur - 1));
    $('.lightbox__next', lb).addEventListener('click', () => show(cur + 1));
    lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
    document.addEventListener('keydown', (e) => {
      if (!lb.classList.contains('is-open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') show(cur - 1);
      if (e.key === 'ArrowRight') show(cur + 1);
      if (e.key === 'Tab') {
        const f = $$('button', lb);
        const i = f.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    });
  }

  /* --- Réservation : SMS pré-rempli, appel, agenda (.ics) --------------- */
  function initBooking() {
    const form = $('#booking-form');
    if (!form) return;
    const card = form.closest('.form-card');
    const dateEl = $('#b-date', form);
    const timeEl = $('#b-time', form);
    const weddingNote = $('#wedding-note');
    const recapMsg = $('#recap-msg');
    const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const todayParis = () => { const d = new Date(); return new Date(d.toLocaleString('en-US', { timeZone: 'Europe/Paris' })); };
    const parseDate = (v) => { const [y, m, d] = v.split('-').map(Number); return new Date(y, m - 1, d); };

    const t0 = todayParis();
    dateEl.min = ymd(t0);
    const max = new Date(t0); max.setMonth(max.getMonth() + 6);
    dateEl.max = ymd(max);

    const setError = (field, msg) => {
      const wrap = field.closest('.field');
      wrap.classList.toggle('has-error', !!msg);
      const err = $('.err', wrap);
      if (err && msg) err.textContent = msg;
      field.setAttribute('aria-invalid', msg ? 'true' : 'false');
    };

    function fillTimes() {
      timeEl.innerHTML = '';
      if (!dateEl.value) { timeEl.disabled = true; timeEl.add(new Option('Choisissez d’abord un jour', '')); return; }
      const d = parseDate(dateEl.value);
      const windows = CFG.horaires[d.getDay()] || [];
      if (!windows.length) {
        timeEl.disabled = true;
        timeEl.add(new Option('Boutique fermée ce jour-là', ''));
        setError(dateEl, `La boutique est fermée le ${JOURS[d.getDay()]} : choisissez un autre jour.`);
        return;
      }
      setError(dateEl, '');
      timeEl.disabled = false;
      timeEl.add(new Option('Choisir une heure', ''));
      const isToday = ymd(d) === ymd(t0);
      const nowMin = t0.getHours() * 60 + t0.getMinutes();
      let count = 0;
      windows.forEach(([a, b]) => {
        for (let m = a; m <= b - 30; m += 30) {
          if (isToday && m < nowMin + 30) continue;
          timeEl.add(new Option(hm(m), String(m))); count++;
        }
      });
      if (!count) { timeEl.options[0].text = 'Plus de créneau aujourd’hui'; timeEl.disabled = true; }
    }
    dateEl.addEventListener('change', fillTimes);
    fillTimes();

    $$('input[name="service"]', form).forEach((r) => r.addEventListener('change', () => { if (weddingNote) weddingNote.hidden = r.value !== 'mariage' || !r.checked; }));

    const phoneOk = (v) => { const d = v.replace(/[^\d+]/g, ''); return /^(\+|00)?\d{9,14}$/.test(d); };
    function buildMessage(data) {
      const d = parseDate(data.date);
      const lines = [
        `Bonjour ${CFG.proprietaire}, je souhaite réserver ${CFG.prestations[data.service]} chez Fleurs de Cel.`,
        `• Jour souhaité : ${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]} à ${hm(Number(data.time))}`
      ];
      if (data.budget) lines.push(`• Budget : ${data.budget}`);
      if (data.note) lines.push(`• Précisions : ${data.note}`);
      lines.push(`Mon nom : ${data.name} — mon numéro : ${data.phone}`);
      lines.push(`Merci de me confirmer le créneau par ${data.pref === 'appel' ? 'téléphone' : 'SMS'}.`);
      return lines.join('\n');
    }

    function buildICS(data, message) {
      const d = parseDate(data.date);
      const start = Number(data.time);
      const stamp = (mins) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(Math.floor(mins / 60))}${pad(mins % 60)}00`;
      const esc = (s) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
      const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
      return [
        'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Fleurs de Cel//Reservation//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        `UID:${Date.now()}@fleurs-de-cel`,
        `DTSTAMP:${now}`,
        `DTSTART:${stamp(start)}`,
        `DTEND:${stamp(start + 30)}`,
        `SUMMARY:${esc('Fleurs de Cel – ' + CFG.prestations[data.service] + ' (à confirmer)')}`,
        `LOCATION:${esc(CFG.adresse)}`,
        `DESCRIPTION:${esc(message + '\n\nCréneau à confirmer avec la boutique : ' + CFG.telephoneAffiche)}`,
        'BEGIN:VALARM', 'TRIGGER:-PT60M', 'ACTION:DISPLAY', 'DESCRIPTION:Fleurs de Cel dans 1 heure', 'END:VALARM',
        'END:VEVENT', 'END:VCALENDAR'
      ].join('\r\n');
    }

    const copy = async (text) => {
      try { await navigator.clipboard.writeText(text); }
      catch { const t = document.createElement('textarea'); t.value = text; t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }
      toast('Message copié : collez-le dans vos SMS.');
    };

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const data = {
        service: fd.get('service'), date: fd.get('date'), time: fd.get('time'),
        name: (fd.get('name') || '').toString().trim(), phone: (fd.get('phone') || '').toString().trim(),
        budget: fd.get('budget'), note: (fd.get('note') || '').toString().trim(), pref: fd.get('pref') || 'sms'
      };
      let bad = null;
      const chk = (cond, el, msg) => { setError(el, cond ? '' : msg); if (!cond && !bad) bad = el; };
      chk(!!data.service, $('input[name="service"]', form), 'Choisissez une prestation.');
      chk(!!data.date, dateEl, 'Choisissez un jour.');
      if (data.date && !(CFG.horaires[parseDate(data.date).getDay()] || []).length) chk(false, dateEl, 'La boutique est fermée ce jour-là.');
      chk(!!data.time, timeEl, 'Choisissez une heure.');
      chk(data.name.length >= 2, $('#b-name', form), 'Indiquez votre prénom.');
      chk(phoneOk(data.phone), $('#b-phone', form), 'Indiquez un numéro de téléphone valide.');
      if (bad) { bad.focus && bad.focus(); return; }

      const message = buildMessage(data);
      const smsHref = `sms:${CFG.telephone}?&body=${encodeURIComponent(message)}`;
      recapMsg.textContent = message;
      $('#recap-sms').href = smsHref;
      $('#recap-copy').onclick = () => copy(message);
      const ics = buildICS(data, message);
      const icsBtn = $('#recap-ics');
      icsBtn.onclick = () => {
        const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
        const a = document.createElement('a'); a.href = url; a.download = 'fleurs-de-cel-rendez-vous.ics'; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      };
      card.classList.add('is-sent');
      card.scrollIntoView({ behavior: 'auto', block: 'nearest' });
      scrollToTarget(card, { offset: -100 });
      $('#recap-title').focus({ preventScroll: true });
      /* Sur téléphone, on ouvre directement l'application SMS */
      if (window.matchMedia('(pointer: coarse)').matches) setTimeout(() => { window.location.href = smsHref; }, 700);
    });
    $('#recap-edit').addEventListener('click', () => { card.classList.remove('is-sent'); scrollToTarget(card, { offset: -100 }); });

    /* Boutons « Réserver cette création » */
    $$('[data-book]').forEach((b) => b.addEventListener('click', (e) => {
      e.preventDefault();
      const r = $(`input[name="service"][value="${b.dataset.book}"]`, form);
      if (r) { r.checked = true; r.dispatchEvent(new Event('change')); card.classList.remove('is-sent'); toast(`Prestation choisie : ${$('span', r.parentElement).textContent.trim()}`); }
      scrollToTarget('#reserver', { offset: -10 });
    }));
  }

  /* ------------------------------------------------------------------
     Mouvement (GSAP)
     ------------------------------------------------------------------ */
  function initLenis() {
    if (typeof window.Lenis === 'undefined') return;
    lenis = new Lenis({ duration: 1.15, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true, wheelMultiplier: 0.95 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop(); /* relancé à la fin du préchargeur */
  }

  function initHeaderAndProgress() {
    const header = $('.site-header');
    const bar = $('.progress i');
    let last = 0;
    const onScroll = (y) => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (bar) bar.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
      header.classList.toggle('is-solid', y > 60);
      if (!html.classList.contains('is-loading')) {
        if (y > last + 6 && y > 400) header.classList.add('is-hidden');
        else if (y < last - 6 || y < 400) header.classList.remove('is-hidden');
      }
      last = y;
    };
    if (lenis) lenis.on('scroll', ({ scroll }) => onScroll(scroll));
    else window.addEventListener('scroll', () => onScroll(window.scrollY), { passive: true });
    onScroll(window.scrollY || 0);
  }

  function makePetals() {
    const box = $('.hero__petals');
    if (!box) return;
    const colors = ['#f4c7cf', '#f7dcd6', '#e9a8b6', '#fbeee6', '#f2b99b', '#ffffff'];
    const n = window.matchMedia('(max-width: 960px)').matches ? 7 : 16;
    for (let i = 0; i < n; i++) {
      const p = document.createElement('i');
      p.className = 'petal';
      const r = (a, b) => a + Math.random() * (b - a);
      p.style.cssText = `left:${r(0, 100)}%;--s:${r(11, 28).toFixed(0)}px;--c:${colors[i % colors.length]};--x:${r(-12, 16).toFixed(1)}vw;--d:${r(14, 26).toFixed(1)}s;--delay:${-r(0, 24).toFixed(1)}s`;
      p.setAttribute('aria-hidden', 'true');
      box.appendChild(p);
    }
  }

  function initHeroVideo() {
    const v = $('.hero__media video');
    if (!v) return;
    if (!motion) { v.removeAttribute('autoplay'); v.pause(); return; }
    /* Économie de données / connexion lente : on garde l'affiche, sans charger les 11 Mo de vidéo */
    const conn = navigator.connection;
    if (conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || ''))) {
      v.removeAttribute('autoplay'); v.preload = 'none';
      const s = $('source', v); s && s.remove();
      v.load();
      return;
    }
    const play = () => v.play().catch(() => {});
    play();
    new IntersectionObserver(([en]) => (en.isIntersecting ? play() : v.pause()), { threshold: 0.05 }).observe(v.closest('.hero'));
    document.addEventListener('visibilitychange', () => (document.hidden ? v.pause() : play()));
  }

  /* Préchargeur → ouverture en arche vers le héros */
  function runLoader() {
    const loader = $('.loader');
    if (!loader) { startSite(); return; }
    const count = $('.loader__count');
    const bar = $('.loader__bar i');
    const paths = $$('.loader__flower .p', loader);
    paths.forEach((p) => { const L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = L; });
    const nameInners = splitText($('.loader__name'), 'chars');
    gsap.set(nameInners, { yPercent: 115 });
    gsap.set('.loader__flower .c', { scale: 0 });
    const state = { v: 0 };

    const poster = $('.loader__img img');
    /* Prêt = polices + affiche du héros chargées, mais jamais plus de 3,5 s d'attente */
    const ready = Promise.race([
      Promise.all([
        document.fonts ? document.fonts.ready : Promise.resolve(),
        poster && !poster.complete ? new Promise((r) => { poster.addEventListener('load', r); poster.addEventListener('error', r); }) : Promise.resolve()
      ]),
      new Promise((r) => setTimeout(r, 3500))
    ]);

    const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });
    intro.to(paths, { strokeDashoffset: 0, duration: 1.5, ease: 'power2.inOut', stagger: 0.09 }, 0)
      .to('.loader__flower .c', { scale: 1, duration: 0.9, ease: 'back.out(2.2)' }, 1)
      .to(nameInners, { yPercent: 0, duration: 1.1, stagger: 0.045, ease: 'expo.out' }, 0.35)
      .to(state, { v: 100, duration: 2.1, ease: 'power1.inOut', onUpdate() { count.textContent = `${String(Math.round(state.v)).padStart(3, '0')}`; bar.style.transform = `scaleX(${state.v / 100})`; } }, 0);

    Promise.all([ready, new Promise((r) => intro.eventCallback('onComplete', r))]).then(() => {
      if (!document.body.contains(loader)) return;
      const out = gsap.timeline({ onComplete: () => { loader.remove(); startSite(); } });
      out.to('.loader__center', { opacity: 0, y: -40, duration: 0.7, ease: 'power3.in' }, 0)
        .to('.loader__bar', { opacity: 0, duration: 0.4 }, 0)
        .to('.loader__img', { clipPath: 'inset(0% 0% 0% 0% round 0vw 0vw 0px 0px)', duration: 1.5, ease: 'expo.inOut' }, 0.25)
        .to('.loader__img img', { scale: 1, duration: 1.5, ease: 'expo.inOut' }, 0.25);
    });
    /* garde-fou */
    setTimeout(() => { if (document.body.contains(loader)) { loader.remove(); startSite(); } }, 14000);
  }

  let started = false;
  function startSite() {
    if (started) return;
    started = true;
    html.classList.remove('is-loading');
    lenis && lenis.start();
    const hd = $('.site-header');
    hd && hd.classList.remove('is-hidden'); /* glisse en place via la transition CSS */
    heroIntro();
    ScrollTrigger.refresh();
  }

  function heroIntro() {
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.to('.hero__title .split-inner', { yPercent: 0, rotate: 0, duration: 1.7, stagger: 0.05 }, 0)
      .from('.hero__kicker', { opacity: 0, y: 24, duration: 1.2 }, 0.15)
      .from('.hero__lead, .hero__cta > *, .hero__badges > *', { opacity: 0, y: 34, duration: 1.2, stagger: 0.08 }, 0.5)
      .from('.hero__branch', { yPercent: 45, opacity: 0, duration: 2, stagger: 0.15 }, 0.1);
  }

  function initMarquee() {
    const rows = $$('.marquee__row');
    if (!rows.length) return;
    const state = rows.map((row, i) => ({ row, x: 0, w: 0, dir: i % 2 ? 1 : -1, set: gsap.quickSetter(row, 'x', 'px') }));
    const measure = () => state.forEach((s) => { s.w = $('.marquee__group', s.row).getBoundingClientRect().width; });
    measure();
    window.addEventListener('resize', measure);
    let dirNow = 1;
    gsap.ticker.add((time, dt) => {
      const vel = lenis ? lenis.velocity : 0;
      const boost = Math.min(Math.abs(vel) * 0.28, 7);
      if (vel > 0.4) dirNow += (1 - dirNow) * 0.1; else if (vel < -0.4) dirNow += (-1 - dirNow) * 0.1;
      state.forEach((s) => {
        s.x += s.dir * dirNow * (1 + boost) * 0.06 * dt;
        if (s.x <= -s.w) s.x += s.w; else if (s.x > 0) s.x -= s.w;
        s.set(s.x);
      });
    });
  }

  function initCursor() {
    const cur = $('.cursor');
    if (!cur || !finePointer) return;
    const label = $('span', cur);
    const qx = gsap.quickTo(cur, 'x', { duration: 0.35, ease: 'power3.out' });
    const qy = gsap.quickTo(cur, 'y', { duration: 0.35, ease: 'power3.out' });
    window.addEventListener('pointermove', (e) => { cur.classList.add('is-on'); qx(e.clientX); qy(e.clientY); }, { passive: true });
    document.addEventListener('pointerleave', () => cur.classList.remove('is-on'));
    document.addEventListener('pointerover', (e) => {
      const zoom = e.target.closest('[data-cursor="zoom"]');
      const link = e.target.closest('a, button, [data-magnetic], input, select, textarea, label');
      cur.classList.toggle('is-zoom', !!zoom);
      cur.classList.toggle('is-link', !!link && !zoom);
      if (zoom) label.textContent = 'Voir';
    });
  }

  function initMagnetic() {
    if (!finePointer) return;
    $$('[data-magnetic]').forEach((el) => {
      const label = $('.btn__label', el);
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - (r.left + r.width / 2)) * 0.32;
        const y = (e.clientY - (r.top + r.height / 2)) * 0.45;
        gsap.to(el, { x, y, duration: 0.5, ease: 'power3.out' });
        label && gsap.to(label, { x: x * 0.4, y: y * 0.4, duration: 0.5, ease: 'power3.out' });
      });
      el.addEventListener('pointerleave', () => {
        gsap.to(el, { x: 0, y: 0, duration: 1.1, ease: 'elastic.out(1, 0.35)' });
        label && gsap.to(label, { x: 0, y: 0, duration: 1.1, ease: 'elastic.out(1, 0.35)' });
      });
    });
  }

  function initTilt() {
    if (!finePointer) return;
    $$('.tilt').forEach((el) => {
      const target = el.matches('.g-item') ? $('button', el) : el;
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        gsap.to(target, { rotationY: (px - 0.5) * 14, rotationX: (0.5 - py) * 12, transformPerspective: 900, duration: 0.6, ease: 'power3.out' });
        el.style.setProperty('--mx', `${px * 100}%`);
        el.style.setProperty('--my', `${py * 100}%`);
      });
      el.addEventListener('pointerleave', () => gsap.to(target, { rotationY: 0, rotationX: 0, duration: 1, ease: 'power3.out' }));
    });
  }

  function initScrollAnimations() {
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();

    mm.add({ desk: '(min-width: 961px)', mob: '(max-width: 960px)' }, (ctx) => {
      const { desk } = ctx.conditions;
      html.classList.toggle('no-pin', !desk);

      /* Héros : parallax multicouche */
      const heroST = { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true };
      gsap.to('.hero__media', { scale: 1.25, yPercent: 10, ease: 'none', scrollTrigger: heroST });
      gsap.to('.hero__petals', { yPercent: -22, ease: 'none', scrollTrigger: heroST });
      gsap.to('.hero__inner', { yPercent: -16, opacity: 0.1, ease: 'none', scrollTrigger: { ...heroST, end: 'bottom 30%' } });
      gsap.to('.hero__branch--l', { yPercent: -34, rotate: -7, ease: 'none', scrollTrigger: heroST });
      gsap.to('.hero__branch--r', { yPercent: -26, rotate: 6, ease: 'none', scrollTrigger: heroST });

      /* Titres : mot par mot, masque qui monte */
      $$('[data-split]').forEach((h) => {
        const inners = splitText(h, 'words');
        gsap.set(inners, { yPercent: 112 });
        ScrollTrigger.create({ trigger: h, start: 'top 86%', once: true, onEnter: () => gsap.to(inners, { yPercent: 0, duration: 1.3, stagger: 0.06, ease: 'expo.out' }) });
      });

      /* Apparitions génériques (par lots, avec décalage) */
      ScrollTrigger.batch('[data-reveal]', {
        start: 'top 90%', once: true,
        onEnter: (els) => {
          gsap.to(els, { opacity: 1, y: 0, duration: 1.3, ease: 'expo.out', stagger: 0.1, overwrite: true });
          els.forEach((e) => { e.classList.add('is-in'); $$('.eyebrow', e).forEach((x) => x.classList.add('is-in')); });
        }
      });
      $$('.eyebrow').forEach((e) => ScrollTrigger.create({ trigger: e, start: 'top 92%', once: true, onEnter: () => e.classList.add('is-in') }));

      /* Manifeste : les mots se remplissent au fil du scroll */
      const man = $('.manifesto__text');
      if (man) {
        const words = wrapWords(man);
        gsap.set(words, { opacity: 0.13 });
        gsap.to(words, { opacity: 1, ease: 'none', stagger: 0.12, scrollTrigger: { trigger: man, start: 'top 80%', end: 'bottom 48%', scrub: 0.6 } });
        gsap.fromTo('.manifesto__sprig', { yPercent: 40, rotate: -12 }, { yPercent: -120, rotate: 12, ease: 'none', scrollTrigger: { trigger: '.manifesto', start: 'top bottom', end: 'bottom top', scrub: true } });
      }

      /* Savoir-faire : section épinglée, 4 étapes */
      if (desk) {
        const steps = $$('.story__steps .step');
        const imgs = $$('.story__img');
        const dots = $$('.story__dots i b');
        gsap.set(steps.slice(1), { autoAlpha: 0, y: 60 });
        gsap.set(imgs.slice(1), { clipPath: 'inset(100% 0% 0% 0%)' });
        gsap.set($$('img', imgs[0]), { scale: 1.0 });
        const tl = gsap.timeline({
          defaults: { ease: 'power3.inOut' },
          scrollTrigger: { trigger: '.story', start: 'top top', end: () => `+=${window.innerHeight * (steps.length * 0.85)}`, pin: '.story__pin', scrub: 0.7, anticipatePin: 1, invalidateOnRefresh: true }
        });
        tl.to(dots[0], { scaleX: 1, duration: 0.8, ease: 'none' }, 0);
        steps.forEach((_, i) => {
          if (i === 0) return;
          const t = i * 1.3;
          tl.to(steps[i - 1], { autoAlpha: 0, y: -60, duration: 0.5 }, t - 0.2)
            .to(steps[i], { autoAlpha: 1, y: 0, duration: 0.6 }, t)
            .fromTo(imgs[i], { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.9 }, t - 0.2)
            .fromTo($$('img', imgs[i]), { scale: 1.35 }, { scale: 1, duration: 1.1 }, t - 0.2)
            .to($$('img', imgs[i - 1]), { scale: 1.12, duration: 1.1 }, t - 0.2)
            .to(dots[i], { scaleX: 1, duration: 0.8, ease: 'none' }, t);
        });
        tl.to({}, { duration: 0.6 });
        gsap.to('.story__sticker', { rotate: 360, ease: 'none', scrollTrigger: { trigger: '.story', start: 'top top', end: () => `+=${window.innerHeight * steps.length * 0.85}`, scrub: true } });
      } else {
        $$('.story__steps .step').forEach((s) => gsap.from(s, { opacity: 0, y: 50, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: s, start: 'top 85%', once: true } }));
      }

      /* Créations : défilement horizontal piloté par le scroll vertical */
      const track = $('.hscroll__track');
      if (track && desk) {
        const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
        const tween = gsap.to(track, {
          x: () => -dist(), ease: 'none',
          scrollTrigger: {
            trigger: '.hscroll', pin: true, scrub: 0.8, anticipatePin: 1, invalidateOnRefresh: true,
            start: 'top top', end: () => `+=${dist()}`,
            onUpdate: (self) => { const b = $('.hscroll__bar i'); if (b) b.style.transform = `scaleX(${self.progress})`; }
          }
        });
        $$('.card__media img').forEach((img) => {
          gsap.fromTo(img, { xPercent: -6 }, { xPercent: 6, ease: 'none', scrollTrigger: { trigger: img.closest('.card'), containerAnimation: tween, start: 'left right', end: 'right left', scrub: true } });
        });
        gsap.from('.card', { opacity: 0, y: 70, duration: 1.3, stagger: 0.12, ease: 'expo.out', scrollTrigger: { trigger: '.hscroll', start: 'top 70%', once: true } });
      } else {
        $$('.card').forEach((c) => gsap.from(c, { opacity: 0, y: 40, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: c, start: 'left 95%', horizontal: false, once: true } }));
      }

      /* Chiffres clés : compteurs */
      $$('[data-count]').forEach((el) => {
        const end = parseFloat(el.dataset.count);
        const dec = Number(el.dataset.decimals || 0);
        const o = { v: 0 };
        ScrollTrigger.create({
          trigger: el, start: 'top 88%', once: true,
          onEnter: () => gsap.to(o, { v: end, duration: 2.4, ease: 'power3.out', onUpdate: () => { el.textContent = o.v.toFixed(dec).replace('.', ','); } })
        });
      });
      gsap.from('.stat', { opacity: 0, y: 50, duration: 1.2, stagger: 0.12, ease: 'expo.out', scrollTrigger: { trigger: '.stats__grid', start: 'top 85%', once: true } });

      /* Mariages : cercle qui s'agrandit */
      const circle = $('.wedding__main');
      if (circle) {
        gsap.fromTo(circle, { clipPath: 'circle(0% at 50% 50%)' }, { clipPath: 'circle(75% at 50% 50%)', duration: 1.8, ease: 'expo.inOut', scrollTrigger: { trigger: circle, start: 'top 80%', once: true } });
        gsap.from($('img', circle), { scale: 1.5, duration: 2.2, ease: 'expo.out', scrollTrigger: { trigger: circle, start: 'top 80%', once: true } });
        gsap.fromTo('.wedding__small', { y: 90, rotate: 5 }, { y: -40, rotate: -3, ease: 'none', scrollTrigger: { trigger: '.wedding', start: 'top bottom', end: 'bottom top', scrub: true } });
      }

      /* Images qui bougent dans leur cadre */
      $$('.season__media img').forEach((img) => gsap.fromTo(img, { yPercent: -7 }, { yPercent: 7, ease: 'none', scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } }));
      $$('.g-item').forEach((it) => {
        const img = $('img', it);
        gsap.fromTo(img, { yPercent: -6, scale: 1.16 }, { yPercent: 6, scale: 1.16, ease: 'none', scrollTrigger: { trigger: it, start: 'top bottom', end: 'bottom top', scrub: true } });
        const frame = $('button', it);
        gsap.from(frame, { clipPath: 'inset(0 0 100% 0 round 18px)', duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: it, start: 'top 92%', once: true } });
      });
      $$('.season__card').forEach((c) => gsap.from($('.season__media', c), { clipPath: 'inset(100% 0 0 0 round 999px 999px 22px 22px)', duration: 1.6, ease: 'expo.out', scrollTrigger: { trigger: c, start: 'top 85%', once: true } }));

      /* Avis */
      gsap.from('.review', { opacity: 0, x: 80, duration: 1.3, stagger: 0.1, ease: 'expo.out', scrollTrigger: { trigger: '.carousel', start: 'top 85%', once: true } });

      /* Pied de page : le grand nom se lève lettre par lettre */
      const giant = $('.footer__giant');
      if (giant) {
        const chars = splitText(giant, 'chars');
        gsap.set(chars, { yPercent: 110 });
        ScrollTrigger.create({ trigger: giant, start: 'top 92%', once: true, onEnter: () => gsap.to(chars, { yPercent: 0, duration: 1.6, stagger: 0.04, ease: 'expo.out' }) });
      }

      ScrollTrigger.refresh();
    });
  }

  /* ------------------------------------------------------------------
     Démarrage
     ------------------------------------------------------------------ */
  /* Tarifs : affichés depuis js/config.js (« Sur mesure » tant qu'aucun prix n'est renseigné) */
  $$('.card[data-id]').forEach((c) => {
    const p = (CFG.prix || {})[c.dataset.id];
    const box = $('.card__price', c);
    if (!box) return;
    box.innerHTML = p ? `${p}<small>à partir de, selon la composition</small>` : `Sur mesure<small>selon vos envies et votre budget</small>`;
  });

  initOpenStatus();
  initMenu();
  initAnchors();
  initCarousel();
  initLightbox();
  initBooking();
  $$('.year').forEach((y) => (y.textContent = new Date().getFullYear()));
  setInterval(initOpenStatus, 60000);

  if (motion) {
    gsap.registerPlugin(ScrollTrigger);
    initLenis();
    makePetals();
    initHeroVideo();
    initHeaderAndProgress();
    initScrollAnimations();
    initMarquee();
    initCursor();
    initMagnetic();
    initTilt();
    window.addEventListener('load', () => ScrollTrigger.refresh());
    if (document.fonts) document.fonts.ready.then(() => ScrollTrigger.refresh());
    $('.site-header').classList.add('is-hidden'); /* caché pendant le préchargeur */
    const heroTitle = $('.hero__title');
    if (heroTitle) gsap.set(splitText(heroTitle, 'chars'), { yPercent: 118, rotate: 5, transformOrigin: '0% 100%' });
    runLoader();
  } else {
    /* Version allégée : pas de loader, pas de pin, contenu immédiatement visible */
    html.classList.add('no-pin');
    $('.loader') && $('.loader').remove();
    initHeroVideo();
    initHeaderAndProgress();
    $$('[data-count]').forEach((el) => { el.textContent = Number(el.dataset.count).toFixed(Number(el.dataset.decimals || 0)).replace('.', ','); });
    $$('.marquee').forEach((m) => m.classList.add('marquee--static'));
  }
})();
