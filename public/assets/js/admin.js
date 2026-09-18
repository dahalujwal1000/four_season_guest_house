/**
 * Admin panel for Four Seasons Guest House.
 * Talks to /api/admin/* only. Session lives in an httpOnly cookie.
 */
(function () {
  'use strict';

  var S = { settings: null, roomTypes: [], reviews: [], menu: [], state: {} };

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n, cur) { return (cur || 'NPR') + ' ' + Number(n || 0).toLocaleString('en-US'); }
  function today() { return new Date().toISOString().slice(0, 10); }
  function api(path, opts) {
    return fetch(path, Object.assign({ headers: { 'content-type': 'application/json' } }, opts || {}))
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (r.status === 401) { showLogin(); throw new Error('Session expired - please sign in again.'); }
          if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
          return j;
        });
      });
  }
  function notify(el, message, kind) {
    if (!el) return;
    el.className = 'notice notice--' + (kind || 'ok');
    el.textContent = message;
    el.hidden = false;
    setTimeout(function () { el.hidden = true; }, 4000);
  }
  function statusPill(status) {
    return '<span class="pill pill--' + esc(status) + '">' + esc(status.replace('-', ' ')) + '</span>';
  }

  /* ------------------------------- auth ----------------------------------- */
  function showLogin() { $('#login-view').hidden = false; $('#panel').hidden = true; $('#logout').hidden = true; }
  function showPanel() { $('#login-view').hidden = true; $('#panel').hidden = false; $('#logout').hidden = false; }

  function boot() {
    $('#login-form').addEventListener('submit', function (e) {
      e.preventDefault();
      api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password: $('#pw').value }) })
        .then(function (d) {
          $('#login-error').textContent = '';
          showPanel();
          loadSettings().then(function () { loadTab('dash'); });
          if (d.firstLogin) alert('Signed in. Please set your own password in the Content tab - the default is not secure.');
        })
        .catch(function (err) { $('#login-error').textContent = err.message; });
    });

    $('#logout').addEventListener('click', function () {
      api('/api/admin/logout', { method: 'POST' }).then(function () { showLogin(); });
    });

    $('#tabs').addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-tab]');
      if (!btn) return;
      $$('#tabs button').forEach(function (b) { b.classList.toggle('is-active', b === btn); });
      $$('.panel').forEach(function (p) { p.classList.remove('is-active'); });
      $('#tab-' + btn.getAttribute('data-tab')).classList.add('is-active');
      loadTab(btn.getAttribute('data-tab'));
    });

    api('/api/admin/session').then(function (s) {
      if (!s.authenticated) { showLogin(); if (s.setupRequired) $('#default-pw').hidden = false; return; }
      showPanel();
      loadSettings().then(function () { loadTab('dash'); });
    }).catch(function () { showLogin(); });
  }

  function loadSettings() {
    return api('/api/admin/settings').then(function (d) {
      S.settings = d.settings;
      S.roomTypes = d.roomTypes;
      S.reviews = d.reviews;
      S.menu = d.menu || [];
      S.counts = d;
      var opts = S.roomTypes.map(function (r) { return '<option value="' + esc(r.id) + '">' + esc(r.name) + '</option>'; }).join('');
      $('#bl-room').innerHTML = opts;
      return d;
    });
  }

  function loadTab(tab) {
    if (tab === 'dash') return renderDash();
    if (tab === 'bookings') return renderBookings();
    if (tab === 'calendar') return renderCalendar();
    if (tab === 'rooms') return renderRooms();
    if (tab === 'content') return renderContent();
    if (tab === 'menu') return renderMenu();
    if (tab === 'reviews') return renderReviews();
    if (tab === 'messages') return renderMessages();
    if (tab === 'notifications') return renderNotifications();
  }
/* ----------------------------- dashboard -------------------------------- */
  function renderDash() {
    return api('/api/admin/overview').then(function (o) {
      var c = o.counters;
      var kpi = function (num, label) { return '<div class="kpi__card"><div class="kpi__num">' + num + '</div><div class="kpi__label">' + label + '</div></div>'; };
      var bars = o.next7.map(function (d) {
        return '<div style="display:flex;align-items:center;gap:12px;padding:8px 0">' +
          '<span class="tiny" style="width:96px">' + esc(d.date.slice(5)) + '</span>' +
          '<div style="flex:1;height:8px;background:var(--bg-soft);border-radius:999px;overflow:hidden">' +
          '<div style="width:' + d.percent + '%;height:100%;background:var(--accent)"></div></div>' +
          '<span class="tiny" style="width:80px;text-align:right">' + d.occupancy + '/' + d.total + ' rooms</span></div>';
      }).join('');

      function list(title, rows, empty) {
        return '<div class="card" style="padding:22px"><h3 class="h3">' + title + '</h3>' +
          (rows.length ? '<div style="margin-top:14px">' + rows.map(function (b) {
            return '<div style="padding:10px 0;border-bottom:1px solid var(--line)"><strong>' + esc(b.name) + '</strong> <span class="tiny">' + esc(b.code) + '</span><div class="tiny">' +
              esc(b.roomTypeName) + ' &middot; ' + esc(b.checkIn) + ' to ' + esc(b.checkOut) + ' &middot; ' + b.guests + ' guest(s)</div></div>';
          }).join('') + '</div>' : '<p class="small muted" style="margin-top:12px">' + empty + '</p>') + '</div>';
      }

      $('#tab-dash').innerHTML =
        '<div class="kpi">' +
          kpi(c.pending, 'Pending requests') +
          kpi(c.confirmed, 'Confirmed') +
          kpi(c.checkedIn, 'In house today') +
          kpi(c.roomsOccupiedTonight + ' / ' + c.totalRooms, 'Rooms tonight') +
          kpi(c.inquiries, 'Messages') +
          kpi(money(c.bookedValue, S.settings.currency), 'Booked value') +
        '</div>' +
        '<div class="card" style="padding:22px;margin-top:26px"><h3 class="h3">Next 7 nights</h3><div style="margin-top:10px">' + bars + '</div></div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px;margin-top:26px">' +
          list('Arriving today', o.arrivals, 'Nobody arriving today.') +
          list('Departing today', o.departures, 'Nobody checking out today.') +
          list('Upcoming arrivals', o.upcoming, 'No future bookings yet.') +
          list('Pending requests', o.pendingList, 'No pending requests - all clear.') +
        '</div>' +
        (o.emailConfigured ? '' : '<p class="notice notice--warn" style="margin-top:24px">Email alerts are off. Every booking is still saved here and in the Log tab. Add RESEND_API_KEY and MAIL_FROM in .env to receive emails.</p>');
    });
  }
/* ----------------------------- bookings --------------------------------- */
  function renderBookings() {
    var status = $('#b-status').value, q = $('#b-search').value.trim();
    return api('/api/admin/bookings?status=' + encodeURIComponent(status) + '&q=' + encodeURIComponent(q)).then(function (d) {
      var rows = d.bookings.map(function (b) {
        var actions = [
          ['confirmed', 'Confirm', 'mini--ok'], ['checked-in', 'Check in', 'mini--ok'],
          ['checked-out', 'Check out', ''], ['cancelled', 'Cancel', 'mini--err']
        ].filter(function (a) { return a[0] !== b.status; }).map(function (a) {
          return '<button class="mini ' + a[2] + '" data-act="status" data-id="' + esc(b.id) + '" data-status="' + a[0] + '">' + a[1] + '</button>';
        }).join('');
        return '<tr>' +
          '<td><strong>' + esc(b.code) + '</strong><div class="tiny">' + esc((b.source || 'website')) + ' &middot; ' + esc(String(b.createdAt).slice(0, 10)) + '</div></td>' +
          '<td>' + esc(b.name) + '<div class="tiny">' + esc(b.phone || '') + ' ' + (b.email ? '&middot; ' + esc(b.email) : '') + (b.country ? ' &middot; ' + esc(b.country) : '') + '</div>' +
            (b.notes ? '<div class="tiny">Notes: ' + esc(b.notes) + '</div>' : '') + '</td>' +
          '<td>' + esc(b.roomTypeName) + '<div class="tiny">' + money(b.rate, S.settings.currency) + '/night</div></td>' +
          '<td>' + esc(b.checkIn) + ' &rarr; ' + esc(b.checkOut) + '<div class="tiny">' + b.nights + ' night(s), ' + b.guests + ' guest(s)</div></td>' +
          '<td>' + money(b.total, S.settings.currency) + '</td>' +
          '<td>' + statusPill(b.status) + '</td>' +
          '<td><div class="row-actions">' + actions + '<button class="mini mini--err" data-act="delete" data-id="' + esc(b.id) + '">Delete</button></div></td>' +
          '</tr>';
      }).join('');
      var tbody = $('#b-table tbody');
      tbody.innerHTML = rows || '<tr><td colspan="7" class="muted" style="padding:26px">No bookings match this filter.</td></tr>';
      $('#b-table').dataset.count = d.total;
    });
  }

  function bookingActions() {
    $('#b-table').addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-act]');
      if (!btn) return;
      var id = btn.getAttribute('data-id'), act = btn.getAttribute('data-act');
      if (act === 'delete') {
        if (!confirm('Delete this booking permanently? This cannot be undone.')) return;
        api('/api/admin/bookings/' + id, { method: 'DELETE' }).then(renderBookings);
        return;
      }
      api('/api/admin/bookings/' + id, { method: 'PATCH', body: JSON.stringify({ status: btn.getAttribute('data-status') }) })
        .then(renderBookings);
    });

    $('#b-refresh').addEventListener('click', renderBookings);
    $('#b-status').addEventListener('change', renderBookings);
    var t;
    $('#b-search').addEventListener('input', function () { clearTimeout(t); t = setTimeout(renderBookings, 250); });

    $('#b-add').addEventListener('click', function () {
      var opts = S.roomTypes.map(function (r) { return '<option value="' + esc(r.id) + '">' + esc(r.name) + ' - ' + money(r.price, S.settings.currency) + '</option>'; }).join('');
      $('#b-walkin').innerHTML =
        '<div class="card" style="padding:22px;margin-bottom:18px"><h3 class="h3">New walk-in booking</h3>' +
        '<form id="walkin-form" class="form-grid" style="margin-top:16px">' +
        '<div class="field"><label for="wi-name">Guest name</label><input id="wi-name" name="name" required></div>' +
        '<div class="field"><label for="wi-phone">Phone</label><input id="wi-phone" name="phone"></div>' +
        '<div class="field"><label for="wi-room">Room type</label><select id="wi-room" name="roomTypeId">' + opts + '</select></div>' +
        '<div class="field"><label for="wi-guests">Guests</label><input id="wi-guests" name="guests" type="number" min="1" max="8" value="2"></div>' +
        '<div class="field"><label for="wi-in">Check-in</label><input id="wi-in" name="checkIn" type="date" value="' + today() + '" required></div>' +
        '<div class="field"><label for="wi-out">Check-out</label><input id="wi-out" name="checkOut" type="date" required></div>' +
        '<div class="field span-2"><label for="wi-notes">Notes</label><input id="wi-notes" name="notes" placeholder="Paid in cash, breakfast included..."></div>' +
        '<div class="span-2" style="display:flex;gap:10px"><button class="btn btn--accent btn--sm" type="submit">Save booking</button>' +
        '<button class="btn btn--ghost btn--sm" type="button" id="wi-cancel">Cancel</button></div>' +
        '</form></div>';
      $('#wi-cancel').addEventListener('click', function () { $('#b-walkin').innerHTML = ''; });
      $('#walkin-form').addEventListener('submit', function (ev) {
        ev.preventDefault();
        var f = ev.target;
        var body = {
          roomTypeId: f.elements.roomTypeId.value, checkIn: f.elements.checkIn.value, checkOut: f.elements.checkOut.value,
          guests: Number(f.elements.guests.value || 1), name: f.elements.name.value, phone: f.elements.phone.value,
          notes: f.elements.notes.value, status: 'confirmed'
        };
        api('/api/admin/bookings', { method: 'POST', body: JSON.stringify(body) })
          .then(function () { $('#b-walkin').innerHTML = ''; renderBookings(); })
          .catch(function (err) { alert(err.message); });
      });
    });
  }
/* ----------------------------- calendar --------------------------------- */
  function renderCalendar(days) {
    var from = $('#cal-from').value || today();
    var span = days || 30;
    return api('/api/admin/calendar?from=' + from + '&days=' + span).then(function (g) {
      var head = g.roomTypes[0] ? g.roomTypes[0].cells.map(function (c) {
        return '<th>' + esc(c.date.slice(8)) + '<div class="tiny" style="font-weight:400">' + esc(c.date.slice(5, 7)) + '</div></th>';
      }).join('') : '';
      var body = g.roomTypes.map(function (rt) {
        return '<tr><th style="text-align:left;white-space:nowrap">' + esc(rt.name) + '</th>' + rt.cells.map(function (c) {
          var cls = c.free === 0 ? 'cell--full' : (c.occupied > 0 ? 'cell--part' : '');
          var isPast = c.date < today();
          return '<td><div class="cell ' + cls + (isPast && c.occupied === 0 ? ' cell--past' : '') + '" title="' + esc(c.date) + ': ' + c.occupied + ' of ' + c.total + ' booked">' + c.free + '</div></td>';
        }).join('') + '</tr>';
      }).join('');
      $('#cal-grid').innerHTML = '<table class="cal"><thead><tr><th></th>' + head + '</tr></thead><tbody>' + body + '</tbody></table>' +
        '<p class="tiny" style="margin-top:14px">Numbers show free rooms. Hover a day for the full count.</p>';
    }).then(renderBlocks);
  }

  function renderBlocks() {
    return api('/api/admin/blocks').then(function (d) {
      var list = d.blocks.slice().sort(function (a, b) { return a.dateFrom.localeCompare(b.dateFrom); });
      $('#block-list').innerHTML = list.length ? '<div class="table-wrap"><table><thead><tr><th>Room</th><th>From</th><th>To</th><th>Reason</th><th></th></tr></thead><tbody>' +
        list.map(function (b) {
          return '<tr><td>' + esc(b.roomTypeName) + '</td><td>' + esc(b.dateFrom) + '</td><td>' + esc(b.dateTo) + '</td><td>' + esc(b.reason) + '</td>' +
            '<td><button class="mini mini--err" data-block="' + esc(b.id) + '">Remove</button></td></tr>';
        }).join('') + '</tbody></table></div>' : '<p class="small muted">No dates are blocked.</p>';
    });
  }

  function calendarActions() {
    $('#cal-30').addEventListener('click', function () { renderCalendar(30); });
    $('#cal-60').addEventListener('click', function () { renderCalendar(60); });
    $('#cal-from').addEventListener('change', function () { renderCalendar(30); });

    $('#block-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target;
      api('/api/admin/blocks', {
        method: 'POST',
        body: JSON.stringify({
          roomTypeId: f.elements.roomTypeId.value, dateFrom: f.elements.dateFrom.value,
          dateTo: f.elements.dateTo.value, reason: f.elements.reason.value
        })
      }).then(function () { f.reset(); renderCalendar(30); })
        .catch(function (err) { alert(err.message); });
    });

    $('#block-list').addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-block]');
      if (!btn) return;
      api('/api/admin/blocks/' + btn.getAttribute('data-block'), { method: 'DELETE' }).then(renderCalendar);
    });
  }
/* ------------------------- rooms, content, menu ------------------------- */
  function renderRooms() {
    $('#tab-rooms').innerHTML =
      '<h2 class="h2" style="font-size:1.5rem">Rooms, prices and inventory</h2>' +
      '<p class="lede" style="margin:14px 0 24px">Change a price or the number of rooms you have. The website and availability update immediately.</p>' +
      '<form id="rooms-form"><div class="table-wrap"><table><thead><tr><th>Room type</th><th>Rooms</th><th>Sleeps</th><th>Price / night (NPR)</th><th>Description</th></tr></thead><tbody>' +
      S.roomTypes.map(function (r) {
        return '<tr data-room="' + esc(r.id) + '">' +
          '<td><strong>' + esc(r.name) + '</strong><div class="tiny">' + esc(r.beds) + ' &middot; ' + esc(r.size) + '</div></td>' +
          '<td><input class="mini" style="width:70px" type="number" min="0" name="rooms" value="' + r.rooms + '"></td>' +
          '<td><input class="mini" style="width:70px" type="number" min="1" name="capacity" value="' + r.capacity + '"></td>' +
          '<td><input class="mini" style="width:100px" type="number" min="0" step="50" name="price" value="' + r.price + '"></td>' +
          '<td><input class="mini" style="width:100%" name="blurb" value="' + esc(r.blurb) + '"></td>' +
          '</tr>';
      }).join('') + '</tbody></table></div>' +
      '<div style="display:flex;gap:12px;align-items:center;margin-top:18px">' +
      '<button class="btn btn--accent btn--sm" type="submit">Save rooms</button>' +
      '<span class="notice notice--ok" id="rooms-ok" hidden></span></div></form>';

    $('#rooms-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var rooms = $$('#rooms-form tbody tr').map(function (tr) {
        return {
          id: tr.getAttribute('data-room'),
          rooms: Number(tr.querySelector('[name=rooms]').value),
          capacity: Number(tr.querySelector('[name=capacity]').value),
          price: Number(tr.querySelector('[name=price]').value),
          blurb: tr.querySelector('[name=blurb]').value
        };
      });
      api('/api/admin/rooms', { method: 'PUT', body: JSON.stringify({ rooms: rooms }) })
        .then(function (d) {
          S.roomTypes = d.roomTypes;
          notify($('#rooms-ok'), 'Rooms and prices saved.');
          var opts = S.roomTypes.map(function (r) { return '<option value="' + esc(r.id) + '">' + esc(r.name) + '</option>'; }).join('');
          $('#bl-room').innerHTML = opts;
        })
        .catch(function (err) { alert(err.message); });
    });
  }
function renderContent() {
    var s = S.settings;
    function field(name, label, value, type) {
      return '<div class="field"><label for="set-' + name + '">' + label + '</label>' +
        '<input id="set-' + name + '" name="' + name + '" type="' + (type || 'text') + '" value="' + esc(value || '') + '"></div>';
    }
    $('#tab-content').innerHTML =
      '<h2 class="h2" style="font-size:1.5rem">Website content</h2>' +
      '<p class="lede" style="margin:14px 0 24px">These fields feed the whole website - contact buttons, map links and policy text.</p>' +
      '<form id="content-form" class="form-grid">' +
        field('name', 'Lodge name', s.name) +
        field('shortName', 'Short name', s.shortName) +
        field('phone', 'Phone', s.phone) +
        field('whatsapp', 'WhatsApp number (with country code)', s.whatsapp) +
        field('email', 'Public email', s.email, 'email') +
        field('ownerEmail', 'Booking alerts email', s.ownerEmail, 'email') +
        field('address', 'Address', s.address) +
        field('plusCode', 'Plus code', s.plusCode) +
        field('altitude', 'Altitude', s.altitude) +
        field('currency', 'Currency', s.currency) +
        field('checkIn', 'Check-in time', s.checkIn) +
        field('checkOut', 'Check-out time', s.checkOut) +
        field('mapsUrl', 'Google Maps link', s.mapsUrl) +
        field('mapEmbed', 'Map embed URL', s.mapEmbed) +
        '<div class="field span-2"><label for="set-tagline">Tagline</label><input id="set-tagline" name="tagline" value="' + esc(s.tagline) + '"></div>' +
        '<div class="field span-2"><label for="set-intro">Intro paragraph</label><textarea id="set-intro" name="intro">' + esc(s.intro) + '</textarea></div>' +
        '<div class="span-2" style="display:flex;gap:12px;align-items:center">' +
        '<button class="btn btn--accent btn--sm" type="submit">Save content</button>' +
        '<span class="notice notice--ok" id="content-ok" hidden></span></div>' +
      '</form>' +
      '<hr class="rule" style="margin:40px 0">' +
      '<h3 class="h3">Change admin password</h3>' +
      '<form id="pw-form" class="form-grid" style="max-width:640px;margin-top:16px">' +
        '<div class="field"><label for="pw-current">Current password</label><input id="pw-current" name="currentPassword" type="password" required></div>' +
        '<div class="field"><label for="pw-new">New password</label><input id="pw-new" name="newPassword" type="password" minlength="10" required></div>' +
        '<div class="span-2" style="display:flex;gap:12px;align-items:center">' +
        '<button class="btn btn--sm" type="submit">Update password</button>' +
        '<span class="notice notice--ok" id="pw-ok" hidden></span></div>' +
      '</form>';

    $('#content-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target, settings = {};
      $$('input, textarea', f).forEach(function (el) { if (el.name) settings[el.name] = el.value; });
      api('/api/admin/settings', { method: 'PUT', body: JSON.stringify({ settings: settings }) })
        .then(function () { S.settings = Object.assign(S.settings, settings); notify($('#content-ok'), 'Website content saved.'); })
        .catch(function (err) { alert(err.message); });
    });

    $('#pw-form').addEventListener('submit', function (e) {
      e.preventDefault();
      api('/api/admin/password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: $('#pw-current').value, newPassword: $('#pw-new').value })
      }).then(function (d) { notify($('#pw-ok'), d.message); e.target.reset(); })
        .catch(function (err) { alert(err.message); });
    });
  }
/* -------------------------------- menu ---------------------------------- */
  function renderMenu() {
    $('#tab-menu').innerHTML =
      '<h2 class="h2" style="font-size:1.5rem">Restaurant menu</h2>' +
      '<p class="lede" style="margin:14px 0 24px">Edit item names, prices (NPR) and descriptions. Add a section with the button at the bottom.</p>' +
      '<form id="menu-form"><div id="menu-sections"></div>' +
      '<button class="btn btn--ghost btn--sm" type="button" id="menu-add-section" style="margin-top:16px">Add a section</button>' +
      '<div style="display:flex;gap:12px;align-items:center;margin-top:20px">' +
      '<button class="btn btn--accent btn--sm" type="submit">Save menu</button>' +
      '<span class="notice notice--ok" id="menu-ok" hidden></span></div></form>';
    drawMenu();
    $('#menu-add-section').addEventListener('click', function () {
      S.menu.push({ section: 'New section', items: [['New dish', 300, '']] });
      drawMenu();
    });
    $('#menu-sections').addEventListener('click', function (e) {
      var del = e.target.closest('button[data-del-section]');
      if (del) { S.menu.splice(Number(del.getAttribute('data-del-section')), 1); drawMenu(); return; }
      var add = e.target.closest('button[data-add-item]');
      if (add) { S.menu[Number(add.getAttribute('data-add-item'))].items.push(['New dish', 300, '']); drawMenu(); return; }
      var rm = e.target.closest('button[data-del-item]');
      if (rm) {
        var parts = rm.getAttribute('data-del-item').split(':');
        S.menu[Number(parts[0])].items.splice(Number(parts[1]), 1);
        drawMenu();
      }
    });
    $('#menu-form').addEventListener('submit', function (e) {
      e.preventDefault();
      collectMenu();
      api('/api/admin/settings', { method: 'PUT', body: JSON.stringify({ settings: { menu: S.menu } }) })
        .then(function () { notify($('#menu-ok'), 'Menu saved - the website is updated.'); })
        .catch(function (err) { alert(err.message); });
    });
  }

  function drawMenu() {
    $('#menu-sections').innerHTML = S.menu.map(function (sec, si) {
      return '<div class="card" style="padding:20px;margin-bottom:18px">' +
        '<div style="display:flex;gap:12px;align-items:end">' +
        '<div class="field" style="flex:1"><label>Section name</label><input class="mini" style="width:100%" data-sec="' + si + '" value="' + esc(sec.section) + '"></div>' +
        '<button class="mini mini--err" type="button" data-del-section="' + si + '">Remove section</button></div>' +
        '<div style="margin-top:14px">' + sec.items.map(function (it, ii) {
          return '<div style="display:flex;gap:10px;margin-bottom:8px;align-items:center">' +
            '<input class="mini" style="flex:2" data-name="' + si + ':' + ii + '" value="' + esc(it[0]) + '" placeholder="Dish">' +
            '<input class="mini" style="width:90px" type="number" data-price="' + si + ':' + ii + '" value="' + Number(it[1] || 0) + '" placeholder="NPR">' +
            '<input class="mini" style="flex:2" data-desc="' + si + ':' + ii + '" value="' + esc(it[2] || '') + '" placeholder="Description">' +
            '<button class="mini mini--err" type="button" data-del-item="' + si + ':' + ii + '">x</button></div>';
        }).join('') + '</div>' +
        '<button class="mini" type="button" data-add-item="' + si + '" style="margin-top:8px">Add dish</button></div>';
    }).join('');
  }

  function collectMenu() {
    $$('#menu-sections [data-sec]').forEach(function (el) {
      S.menu[Number(el.getAttribute('data-sec'))].section = el.value;
    });
    $$('#menu-sections [data-name]').forEach(function (el) {
      var p = el.getAttribute('data-name').split(':');
      S.menu[Number(p[0])].items[Number(p[1])][0] = el.value;
    });
    $$('#menu-sections [data-price]').forEach(function (el) {
      var p = el.getAttribute('data-price').split(':');
      S.menu[Number(p[0])].items[Number(p[1])][1] = Number(el.value || 0);
    });
    $$('#menu-sections [data-desc]').forEach(function (el) {
      var p = el.getAttribute('data-desc').split(':');
      S.menu[Number(p[0])].items[Number(p[1])][2] = el.value;
    });
  }
function renderReviews() {
    $('#tab-reviews').innerHTML =
      '<h2 class="h2" style="font-size:1.5rem">Guest reviews</h2>' +
      '<p class="lede" style="margin:14px 0 24px">Paste your best Google reviews here. Three to six short quotes work best on the home page.</p>' +
      '<form id="reviews-form"><div id="review-rows"></div>' +
      '<button class="btn btn--ghost btn--sm" type="button" id="review-add" style="margin-top:14px">Add a review</button>' +
      '<div style="display:flex;gap:12px;align-items:center;margin-top:20px">' +
      '<button class="btn btn--accent btn--sm" type="submit">Save reviews</button>' +
      '<span class="notice notice--ok" id="reviews-ok" hidden></span></div></form>';
    drawReviews();
    $('#review-add').addEventListener('click', function () {
      S.reviews.push({ name: '', country: '', rating: 5, text: '', date: today() });
      drawReviews();
    });
    $('#review-rows').addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-del-review]');
      if (!btn) return;
      S.reviews.splice(Number(btn.getAttribute('data-del-review')), 1);
      drawReviews();
    });
    $('#reviews-form').addEventListener('submit', function (e) {
      e.preventDefault();
      $$('#review-rows [data-i]').forEach(function (row) {
        var i = Number(row.getAttribute('data-i'));
        S.reviews[i] = {
          name: row.querySelector('[data-f=name]').value,
          country: row.querySelector('[data-f=country]').value,
          rating: Number(row.querySelector('[data-f=rating]').value || 5),
          text: row.querySelector('[data-f=text]').value,
          date: row.querySelector('[data-f=date]').value || today()
        };
      });
      api('/api/admin/reviews', { method: 'PUT', body: JSON.stringify({ reviews: S.reviews }) })
        .then(function () { notify($('#reviews-ok'), 'Reviews saved.'); })
        .catch(function (err) { alert(err.message); });
    });
  }

  function drawReviews() {
    $('#review-rows').innerHTML = S.reviews.map(function (r, i) {
      return '<div class="card" style="padding:18px;margin-bottom:14px" data-i="' + i + '">' +
        '<div class="form-grid" style="grid-template-columns:1fr 1fr 100px 150px">' +
        '<div class="field"><label>Name</label><input class="mini" data-f="name" value="' + esc(r.name) + '"></div>' +
        '<div class="field"><label>Country</label><input class="mini" data-f="country" value="' + esc(r.country || '') + '"></div>' +
        '<div class="field"><label>Stars</label><input class="mini" type="number" min="1" max="5" data-f="rating" value="' + r.rating + '"></div>' +
        '<div class="field"><label>Date</label><input class="mini" type="date" data-f="date" value="' + esc(r.date) + '"></div>' +
        '<div class="field span-2"><label>Review text</label><textarea class="mini" data-f="text" style="min-height:70px">' + esc(r.text) + '</textarea></div>' +
        '</div><button class="mini mini--err" type="button" data-del-review="' + i + '">Remove</button></div>';
    }).join('') || '<p class="small muted">No reviews yet. Add your first one.</p>';
  }
/* ------------------------ messages and log ------------------------------ */
  function renderMessages() {
    return api('/api/admin/inquiries').then(function (d) {
      $('#tab-messages').innerHTML = '<h2 class="h2" style="font-size:1.5rem">Website messages</h2>' +
        '<p class="lede" style="margin:14px 0 24px">Every message sent from the contact form.</p>' +
        (d.inquiries.length ? '<div class="table-wrap"><table><thead><tr><th>When</th><th>From</th><th>Message</th><th></th></tr></thead><tbody>' +
          d.inquiries.map(function (i) {
            return '<tr><td>' + esc(String(i.createdAt).slice(0, 16).replace('T', ' ')) + '</td>' +
              '<td>' + esc(i.name) + '<div class="tiny">' + esc(i.email) + (i.phone ? '<br>' + esc(i.phone) : '') + '</div></td>' +
              '<td>' + esc(i.message) + '</td>' +
              '<td><div class="row-actions"><a class="mini" href="mailto:' + esc(i.email) + '">Reply</a>' +
              '<button class="mini mini--err" data-inquiry="' + esc(i.id) + '">Delete</button></div></td></tr>';
          }).join('') + '</tbody></table></div>' : '<p class="small muted">No messages yet.</p>');
    });
  }

  function renderNotifications() {
    return api('/api/admin/notifications').then(function (d) {
      $('#tab-notifications').innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap">' +
        '<h2 class="h2" style="font-size:1.5rem">Booking log</h2>' +
        '<button class="mini mini--err" id="log-clear">Clear log</button></div>' +
        '<p class="lede" style="margin:14px 0 24px">Every booking and message that came in, newest first. This is the safety net if email is switched off.</p>' +
        (d.notifications.length ? d.notifications.map(function (n) {
          return '<div class="card" style="padding:18px;margin-bottom:12px">' +
            '<div class="tiny">' + esc(String(n.at).slice(0, 16).replace('T', ' ')) + ' &middot; ' + esc(n.kind) + '</div>' +
            '<strong>' + esc(n.subject) + '</strong>' +
            '<pre style="white-space:pre-wrap;font-family:var(--font);font-size:13.5px;color:var(--ink-soft);margin:10px 0 0">' + esc(n.text) + '</pre></div>';
        }).join('') : '<p class="small muted">Nothing logged yet.</p>');
      $('#log-clear').addEventListener('click', function () {
        if (!confirm('Clear the whole log?')) return;
        api('/api/admin/notifications', { method: 'DELETE' }).then(renderNotifications);
      });
    });
  }
/* --------------------------------- boot --------------------------------- */
  document.addEventListener('DOMContentLoaded', function () {
    boot();
    bookingActions();
    calendarActions();
    $('#tab-messages').addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-inquiry]');
      if (!btn) return;
      if (!confirm('Delete this message?')) return;
      api('/api/admin/inquiries/' + btn.getAttribute('data-inquiry'), { method: 'DELETE' }).then(renderMessages);
    });
  });
})();
