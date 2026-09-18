/**
 * Front-end app for Four Seasons Guest House & Restaurant, Chame.
 * No framework, no build step - fetches /api/content and renders per page.
 */
(function () {
  'use strict';

  var state = { content: null, openedAt: Date.now() };

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n, cur) { return (cur || 'NPR') + ' ' + Number(n || 0).toLocaleString('en-US'); }
  function qs(name) { return new URLSearchParams(location.search).get(name); }
  function api(path, opts) {
    return fetch(path, Object.assign({ headers: { 'content-type': 'application/json' } }, opts || {}))
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status)); return j; }); });
  }

  var NAV = [['/', 'Home'], ['/rooms', 'Rooms'], ['/restaurant', 'Restaurant'], ['/gallery', 'Gallery'], ['/guide', 'Annapurna Guide'], ['/contact', 'Contact']];

  function iconFor(name) {
    var m = { wifi: '\uD83D\uDCF6', shower: '\uD83D\uDEBF', plug: '\uD83D\uDD0C', laundry: '\uD83E\uDDFA', bag: '\uD83C\uDF92', bolt: '\u26A1', car: '\uD83D\uDE99', sun: '\u2600' };
    return m[name] || '\u2022';
  }

  function renderChrome() {
    var page = document.body.getAttribute('data-page') || '';
    var header = document.createElement('header');
    header.className = 'site-header';
    header.innerHTML =
      '<div class="wrap nav">' +
        '<a class="brand" href="/"><span class="brand__mark">FS</span><span class="brand__txt">' +
        '<span class="brand__name">Four Seasons</span><span class="brand__sub">Chame &middot; Manang</span></span></a>' +
        '<nav class="nav__links" aria-label="Main">' +
        NAV.map(function (n) { return '<a href="' + n[0] + '"' + (n[0] === ('/' + page) || (page === '' && n[0] === '/') ? ' aria-current="page"' : '') + '>' + n[1] + '</a>'; }).join('') +
        '</nav><div class="nav__right"><a class="btn btn--sm" href="/booking">Book a room</a>' +
        '<button class="nav__toggle" aria-label="Menu"><span></span><span></span><span></span></button></div></div>' +
        '<div class="nav__panel">' + NAV.map(function (n) { return '<a href="' + n[0] + '">' + n[1] + '</a>'; }).join('') + '<a href="/booking"><strong>Book a room</strong></a></div>';
    document.body.prepend(header);

    var footer = document.createElement('footer');
    footer.className = 'site-footer';
    footer.innerHTML =
      '<div class="wrap"><div class="footer-grid">' +
        '<div><h4>Four Seasons</h4><p data-c="intro"></p><p class="tiny" data-c="address"></p></div>' +
        '<div><h4>Explore</h4><ul class="footer-links">' + NAV.map(function (n) { return '<li><a href="' + n[0] + '">' + n[1] + '</a></li>'; }).join('') + '</ul></div>' +
        '<div><h4>Plan</h4><ul class="footer-links"><li><a href="/booking">Check availability</a></li><li><a href="/guide">Altitude tips</a></li><li><a href="/contact">Find us</a></li></ul></div>' +
        '<div><h4>Contact</h4><ul class="footer-links"><li data-c="phone"></li><li data-c="email"></li><li><a data-c-maps href="#" target="_blank" rel="noopener">Google Maps</a></li></ul></div>' +
      '</div><div class="footer-bottom"><span>&copy; <span id="yr"></span> Four Seasons Guest House &amp; Restaurant, Chame</span><span id="ft-alt"></span></div></div>';
    document.body.append(footer);
    $('#yr').textContent = new Date().getFullYear();
    $('.nav__toggle').addEventListener('click', function () { $('.nav__panel').classList.toggle('is-open'); });

    var wa = document.createElement('a');
    wa.className = 'btn btn--wa btn--sm';
    wa.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:50;border-radius:999px;box-shadow:var(--shadow-lg)';
    wa.target = '_blank'; wa.rel = 'noopener'; wa.innerHTML = 'WhatsApp us';
    document.body.append(wa);
    state.waBtn = wa;
  }

  function fillChrome(c) {
    var s = c.settings;
    $$('[data-c]').forEach(function (el) { el.textContent = s[el.getAttribute('data-c')] || ''; });
    var maps = $('[data-c-maps]'); if (maps) maps.href = s.mapsUrl;
    $('#ft-alt').textContent = 'Altitude ' + s.altitude + ' - Check-in ' + s.checkIn + ' / Check-out ' + s.checkOut;
    var digits = String(s.whatsapp || '').replace(/[^\d]/g, '');
    if (state.waBtn) state.waBtn.href = 'https://wa.me/' + digits;
  }
  function roomCard(r, cur, withLink) {
    return '<article class="card fade-up">' +
      '<a class="card__media" href="/booking?room=' + esc(r.id) + '"><img src="' + esc(r.image) + '" alt="' + esc(r.name) + '" loading="lazy"></a>' +
      '<div class="card__body"><div style="display:flex;justify-content:space-between;gap:12px;align-items:baseline">' +
      '<h3 class="h3">' + esc(r.name) + '</h3>' +
      '<span class="price">' + money(r.price, cur) + '<small>/night</small></span></div>' +
      '<p class="small muted" style="margin:0">' + esc(r.blurb) + '</p>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px">' + r.amenities.slice(0, 4).map(function (a) { return '<span class="tag tag--mute">' + esc(a) + '</span>'; }).join('') + '</div>' +
      '<div class="card__foot"><span class="tiny">' + esc(r.beds) + ' &middot; ' + esc(r.size) + ' &middot; sleeps ' + r.capacity + '</span>' +
      (withLink ? '<a class="btn btn--ghost btn--sm" href="/booking?room=' + esc(r.id) + '">Book</a>' : '') +
      '</div></div></article>';
  }

  function reviewCard(r) {
    var stars = '\u2605\u2605\u2605\u2605\u2605'.slice(0, r.rating);
    return '<article class="review fade-up"><div class="review__stars">' + stars + '</div>' +
      '<p class="review__text">&ldquo;' + esc(r.text) + '&rdquo;</p>' +
      '<div class="review__who">' + esc(r.name) + (r.country ? ', ' + esc(r.country) : '') + ' &middot; ' + esc(r.date) + '</div></article>';
  }

  function pageHome(c) {
    var s = c.settings;
    if ($('.hero')) {
      $('.hero__bg').innerHTML = '<img src="/images/annapurna-snow-peaks.jpg" alt="Annapurna mountains above Chame" fetchpriority="high">';
      $('.hero__meta').innerHTML =
        '<span class="chip">\u2605 ' + s.googleRating + ' on Google (' + s.googleReviewCount + ' reviews)</span>' +
        '<span class="chip">' + esc(s.altitude) + '</span><span class="chip">Hot shower in every room</span>' +
        '<span class="chip">On the Annapurna Circuit</span>';
    }
    var grid = $('#home-rooms');
    if (grid) {
      var sorted = c.roomTypes.slice().sort(function (a, b) { return (b.featured ? 1 : 0) - (a.featured ? 1 : 0); });
      grid.innerHTML = sorted.slice(0, 3).map(function (r) { return roomCard(r, s.currency, true); }).join('');
    }
    var rv = $('#home-reviews');
    if (rv) rv.innerHTML = c.reviews.slice(0, 3).map(reviewCard).join('');
    var fac = $('#home-facilities');
    if (fac) fac.innerHTML = s.facilities.map(function (f) {
      return '<div class="facility fade-up"><div class="facility__icon">' + iconFor(f.icon) + '</div><div><h4>' + esc(f.title) + '</h4><p>' + esc(f.text) + '</p></div></div>';
    }).join('');
  }

  function pageRooms(c) {
    var grid = $('#rooms-grid');
    if (grid) grid.innerHTML = c.roomTypes.map(function (r) { return roomCard(r, c.settings.currency, true); }).join('');
  }

  function pageRestaurant(c) {
    var grid = $('#menu-grid');
    if (!grid) return;
    var half = Math.ceil(c.menu.length / 2);
    var col = function (sections) {
      return sections.map(function (sec) {
        return '<div class="menu-section"><h3 class="h3">' + esc(sec.section) + '</h3>' +
          sec.items.map(function (it) {
            return '<div class="menu-item"><div class="menu-item__main"><div class="menu-item__name">' + esc(it[0]) + '</div>' +
              (it[2] ? '<div class="menu-item__desc">' + esc(it[2]) + '</div>' : '') + '</div>' +
              '<span class="menu-item__price">' + money(it[1], c.settings.currency) + '</span></div>';
          }).join('') + '</div>';
      }).join('');
    };
    grid.innerHTML = '<div>' + col(c.menu.slice(0, half)) + '</div><div>' + col(c.menu.slice(half)) + '</div>';
  }
var GALLERY = [
    ['/images/annapurna-snow-peaks.jpg', 'Annapurna at sunset', 'span-3'],
    ['/images/room-deluxe.jpg', 'Deluxe double room', 'span-3'],
    ['/images/dal-bhat.jpg', 'Dal Bhat set', 'span-2'],
    ['/images/mountain-village.jpg', 'Chame village', 'span-2'],
    ['/images/terrace-dining.jpg', 'Terrace dining', 'span-2'],
    ['/images/suspension-bridge.jpg', 'On the trail', 'span-3'],
    ['/images/room-twin.jpg', 'Standard twin', 'span-3'],
    ['/images/nepali-thali.jpg', 'Nepali thali', 'span-2'],
    ['/images/thorong-la.jpg', 'Thorong La pass', 'span-2'],
    ['/images/breakfast.jpg', 'Breakfast at the lodge', 'span-2'],
    ['/images/yaks-lake.jpg', 'Yaks on the trail', 'span-2']
  ];

  function pageGallery() {
    var g = $('#gallery');
    var lb = $('#lightbox');
    if (!g || !lb) return;
    g.innerHTML = GALLERY.map(function (im) {
      return '<button class="' + im[2] + '" type="button" data-full="' + im[0] + '" aria-label="' + esc(im[1]) + '">' +
        '<img src="' + im[0] + '" alt="' + esc(im[1]) + '" loading="lazy"></button>';
    }).join('');
    g.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-full]');
      if (!btn) return;
      $('img', lb).src = btn.getAttribute('data-full');
      lb.classList.add('is-open');
    });
    lb.addEventListener('click', function (e) { if (e.target === lb || e.target.closest('.lightbox__close')) lb.classList.remove('is-open'); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') lb.classList.remove('is-open'); });
  }
function pageBooking(c) {
    var form = $('#book-form');
    if (!form) return;
    var s = c.settings;
    ['checkIn', 'checkOut', 'guests'].forEach(function (k) { var v = qs(k); if (v && form.elements[k]) form.elements[k].value = v; });
    var minToday = new Date().toISOString().slice(0, 10);
    form.elements.checkIn.min = minToday;
    form.elements.checkOut.min = minToday;

    var results = $('#book-results');
    var details = $('#details-panel');
    var chosen = null;

    $('#date-step').addEventListener('click', function (e) {
      e.preventDefault();
      var ci = form.elements.checkIn.value, co = form.elements.checkOut.value, g = Number(form.elements.guests.value || 2);
      var err = $('#date-error'); err.textContent = '';
      if (!ci || !co || co <= ci) { err.textContent = 'Check-out must be after check-in.'; return; }
      results.innerHTML = '<p class="muted">Checking live availability&hellip;</p>';
      api('/api/availability?checkIn=' + ci + '&checkOut=' + co + '&guests=' + g)
        .then(function (d) {
          chosen = { checkIn: ci, checkOut: co, guests: g, nights: d.nights };
          if (!d.rooms.length) { results.innerHTML = '<div class="notice notice--warn">No room type fits those dates and ' + g + ' guest(s). Try shifting dates or message us on WhatsApp.</div>'; return; }
          results.innerHTML = '<div class="grid" style="gap:14px;margin-top:20px">' + d.rooms.map(function (r) {
            return '<div class="avail-row' + (r.available ? '' : ' avail-row--out') + '">' +
              '<div><strong>' + esc(r.name) + '</strong><div class="tiny">sleeps ' + r.capacity +
              (r.available ? ' &middot; <strong>' + r.minAvailable + '</strong> of ' + r.rooms + ' rooms free' : ' &middot; fully booked these nights') + '</div></div>' +
              '<div style="display:flex;align-items:center;gap:16px"><span class="price">' + money(r.price, s.currency) + '<small>/night</small></span>' +
              (r.available ? '<button class="btn btn--sm btn--accent" type="button" data-room="' + r.id + '">Select</button>' : '<span class="tag tag--mute">Full</span>') + '</div></div>';
          }).join('') + '</div>';
        })
        .catch(function (err2) { results.innerHTML = '<div class="notice notice--err">' + esc(err2.message) + '</div>'; });
    });

    results.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-room]');
      if (!btn) return;
      var rt = c.roomTypes.filter(function (r) { return r.id === btn.getAttribute('data-room'); })[0];
      if (!rt) return;
      chosen.room = rt;
      $$('.avail-row', results).forEach(function (row) { row.style.borderColor = ''; });
      btn.closest('.avail-row').style.borderColor = 'var(--accent)';
      form.elements.roomTypeId.value = rt.id;
      $('#sum-room').textContent = rt.name;
      $('#sum-dates').textContent = chosen.checkIn + ' \u2192 ' + chosen.checkOut + ' (' + chosen.nights + ' night' + (chosen.nights > 1 ? 's' : '') + ')';
      $('#sum-guests').textContent = chosen.guests + ' guest' + (chosen.guests > 1 ? 's' : '');
      $('#sum-total').textContent = money(rt.price * chosen.nights, s.currency);
      details.hidden = false;
      details.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
if (c.protection.turnstileEnabled && c.protection.siteKey) {
      var ts = document.createElement('script');
      ts.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      ts.async = true; ts.defer = true;
      document.head.appendChild(ts);
      $('#ts-slot').innerHTML = '<div class="cf-turnstile" data-sitekey="' + esc(c.protection.siteKey) + '"></div>';
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!chosen || !chosen.room) { $('#book-error').textContent = 'Please select a room first.'; return; }
      var btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      $('#book-error').textContent = '';
      var tokenEl = document.querySelector('[name="cf-turnstile-response"]');
      api('/api/bookings', {
        method: 'POST',
        body: JSON.stringify({
          roomTypeId: chosen.room.id,
          checkIn: chosen.checkIn, checkOut: chosen.checkOut, guests: chosen.guests,
          name: form.elements.name.value, email: form.elements.email.value,
          phone: form.elements.phone.value, country: form.elements.country.value,
          notes: form.elements.notes.value, website: form.elements.website.value,
          formOpenedAt: state.openedAt, turnstileToken: tokenEl ? tokenEl.value : ''
        })
      }).then(function (d) {
        $('#booking-success').hidden = false;
        form.hidden = true; results.hidden = true; details.hidden = true;
        $('#bk-code').textContent = d.booking.code;
        $('#bk-summary').textContent = d.booking.roomTypeName + ' \u00B7 ' + d.booking.checkIn + ' \u2192 ' + d.booking.checkOut + ' \u00B7 ' + money(d.booking.total, s.currency);
        var wa = $('#bk-whatsapp');
        if (d.whatsappUrl) { wa.href = d.whatsappUrl; wa.hidden = false; }
        $('#booking-success').scrollIntoView({ behavior: 'smooth' });
      }).catch(function (err) { $('#book-error').textContent = err.message; btn.disabled = false; });
    });
  }
function pageContact(c) {
    var form = $('#contact-form');
    if (!form) return;
    if (c.protection.turnstileEnabled && c.protection.siteKey) {
      var ts = document.createElement('script');
      ts.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      ts.async = true; ts.defer = true;
      document.head.appendChild(ts);
      $('#ts-slot-contact').innerHTML = '<div class="cf-turnstile" data-sitekey="' + esc(c.protection.siteKey) + '"></div>';
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      var tokenEl = document.querySelector('[name="cf-turnstile-response"]');
      api('/api/inquiries', {
        method: 'POST',
        body: JSON.stringify({
          name: form.elements.name.value, email: form.elements.email.value,
          phone: form.elements.phone.value, message: form.elements.message.value,
          website: form.elements.website.value, formOpenedAt: state.openedAt,
          turnstileToken: tokenEl ? tokenEl.value : ''
        })
      }).then(function (d) {
        $('#contact-ok').textContent = d.message;
        $('#contact-ok').hidden = false;
        form.reset();
      }).catch(function (err) { $('#contact-err').textContent = err.message; })
        .finally(function () { btn.disabled = false; });
    });
  }

  /* --------------------------------- boot --------------------------------- */
  renderChrome();
  api('/api/content').then(function (c) {
    state.content = c;
    fillChrome(c);
    var page = document.body.getAttribute('data-page');
    if (page === '' || page === 'home') pageHome(c);
    if (page === 'rooms') pageRooms(c);
    if (page === 'restaurant') pageRestaurant(c);
    if (page === 'gallery') pageGallery();
    if (page === 'booking') pageBooking(c);
    if (page === 'contact') pageContact(c);
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
      }, { threshold: 0.12 });
      $$('.fade-up').forEach(function (el) { io.observe(el); });
    } else {
      $$('.fade-up').forEach(function (el) { el.classList.add('is-in'); });
    }
  }).catch(function (err) {
    document.body.insertAdjacentHTML('afterbegin', '<div class="notice notice--err" style="margin:12px">Could not load site content: ' + esc(err.message) + '</div>');
  });
})();
