/* ============================================================
   FRUIT LOOP PVD — App Logic (js/app.js)
   ============================================================ */

/* ── App state ── */
let DATA = { events: [], performers: [], djs: [], bartenders: [], venues: [] };

const state = {
  calFilter:    'all',
  perfSortAZ:   true,
  djFilter:     'all',
  djUpcoming:   false,
  djSortAZ:     true,
  barSortAZ:    true,
  venueTypes:   new Set(),
  venueHood:    'all',
  venueSortAZ:  true,
};

/* ── Boot ── */
document.addEventListener('DOMContentLoaded', async () => {
  drawGrain();
  setupMobileNav();
  setupSubmitForm();

  DATA = await loadData();

  buildFilterChips();
  buildVenueTypeChips();
  buildPerformerChips();
  renderEvents();
  renderPerformers();
  renderDJs();
  renderBartenders();
  renderVenues();

  // Update hero subtitle with current month
  const now = new Date();
  const monthName = now.toLocaleString('en-US', { month: 'long' });
  const yearNum = now.getFullYear();
  const sub = document.getElementById('calendarSub');
  if (sub) sub.textContent = `${monthName} ${yearNum} · Click a performer or DJ name to see all their shows`;
});

/* ── Page navigation ── */
function showPage(name, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item, .nav-dropdown-item').forEach(n => n.classList.remove('active'));
  const page = document.getElementById('page-' + name);
  if (page) page.classList.add('active');
  if (el) {
    el.classList.add('active');
    // If it's a dropdown item, also highlight the People trigger
    if (el.classList.contains('nav-dropdown-item')) {
      const trigger = el.closest('.nav-dropdown')?.querySelector('.nav-dropdown-trigger');
      if (trigger) trigger.classList.add('active');
    }
  } else {
    const navEl = document.querySelector(`[data-page="${name}"]`);
    if (navEl) {
      navEl.classList.add('active');
      if (navEl.classList.contains('nav-dropdown-item')) {
        const trigger = navEl.closest('.nav-dropdown')?.querySelector('.nav-dropdown-trigger');
        if (trigger) trigger.classList.add('active');
      }
    }
  }
  document.getElementById('siteNav')?.classList.remove('open');
  window.scrollTo(0, 0);
}

/* ── Mobile nav toggle ── */
function setupMobileNav() {
  const toggle = document.getElementById('navToggle');
  const nav = document.getElementById('siteNav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => nav.classList.toggle('open'));
  }
}

/* ── Grain texture ── */
function drawGrain() {
  const canvas = document.getElementById('grainCanvas');
  if (!canvas) return;
  const resize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(canvas.width, canvas.height);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255 | 0;
      img.data[i] = img.data[i+1] = img.data[i+2] = v;
      img.data[i+3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  };
  resize();
  window.addEventListener('resize', resize);
}

/* ── Avatar color helper ── */
function avatarClass(color) {
  const map = { pink: 'av-pink', gold: 'av-gold', purple: 'av-purple', blue: 'av-blue', teal: 'av-teal' };
  return map[color] || 'av-purple';
}

/* ── CALENDAR ── */

// Pretty display labels for known tags — anything not listed shows title-cased
const TAG_LABELS = {
  'all':      'All events',
  'drag':     'Drag shows',
  'dance':    'Dance nights',
  'brunch':   'Brunch',
  'bingo':    'Bingo',
  '21':       '21+',
  'allages':  'All ages',
};

function tagLabel(tag) {
  if (TAG_LABELS[tag]) return TAG_LABELS[tag];
  // Title-case anything not in the known list
  return tag.charAt(0).toUpperCase() + tag.slice(1).replace(/-/g, ' ');
}

function buildFilterChips() {
  const bar = document.getElementById('calendarFilters');
  if (!bar) return;

  // Collect all unique tags across all events
  const tagSet = new Set();
  DATA.events.forEach(e => e.tags.forEach(t => tagSet.add(t)));

  // Sort alphabetically, but put known tags in a preferred order first
  const preferredOrder = ['drag', 'dance', 'brunch', 'bingo', '21', 'allages'];
  const known   = preferredOrder.filter(t => tagSet.has(t));
  const unknown = [...tagSet].filter(t => !preferredOrder.includes(t)).sort();
  const allTags = [...known, ...unknown];

  // Remove any existing dynamic chips (keep the "All events" chip)
  bar.querySelectorAll('.chip:not(#chip-all)').forEach(c => c.remove());

  // Add a chip for each tag
  allTags.forEach(tag => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.dataset.tag = tag;
    chip.textContent = tagLabel(tag);
    chip.onclick = () => setCalFilter(tag, chip);
    bar.appendChild(chip);
  });
}

function setCalFilter(filter, el) {
  document.querySelectorAll('.filters-bar .chip').forEach(c => c.classList.remove('on'));
  el.classList.add('on');
  state.calFilter = filter;
  renderEvents();
}

function renderEvents() {
  const wrap = document.getElementById('eventsWrap');
  if (!wrap) return;

  const today = new Date(); today.setHours(0,0,0,0);

  let events = DATA.events.filter(e => {
    if (!e.date) return false;
    return new Date(e.date + 'T12:00:00') >= today;
  });

  if (state.calFilter !== 'all') {
    events = events.filter(e => e.tags.includes(state.calFilter));
  }

  if (!events.length) {
    wrap.innerHTML = `<div class="empty-state"><div class="empty-title">No events found</div><div class="empty-sub">Try a different filter</div></div>`;
    return;
  }

  // Group by date
  const byDate = {};
  events.forEach(e => {
    if (!byDate[e.date]) byDate[e.date] = { day: e.day, num: e.dateNum, month: e.month, events: [] };
    byDate[e.date].events.push(e);
  });

  wrap.innerHTML = Object.keys(byDate).sort().map(d => {
    const g = byDate[d];
    return `<div class="date-group">
      <div class="date-row">
        <div class="date-num">${g.num}</div>
        <div><div class="date-day">${g.day}</div><div class="date-month">${g.month}</div></div>
      </div>
      ${g.events.map(e => eventCardHTML(e)).join('')}
    </div>`;
  }).join('');
}

function eventCardHTML(e) {
  const perfPills = e.performers.map(p =>
    `<span class="eperf" onclick="event.stopPropagation();goToPerformer('${escHtml(p)}')">${escHtml(p)}</span>`
  ).join('');
  const djPills = e.djs.map(d =>
    `<span class="edj" onclick="event.stopPropagation();goToDJ('${escHtml(d)}')">${escHtml(d)}</span>`
  ).join('');
  const barPills = e.bartenders.map(b =>
    `<span class="ebar" onclick="event.stopPropagation();goToBartender('${escHtml(b)}')">${escHtml(b)}</span>`
  ).join('');
  const promoterPills = e.promoters.map(p =>
    `<span class="epromoter">${escHtml(p)}</span>`
  ).join('');
  const beneficiaryLine = e.beneficiary
    ? `<div class="ebeneficiary">Benefiting: ${escHtml(e.beneficiary)}</div>`
    : '';

  const isFree = !e.ticketUrl && (!e.cover || e.cover.toLowerCase().includes('free') || e.cover === '');
  const ticketBtn = e.ticketUrl
    ? `<a href="${escHtml(e.ticketUrl)}" target="_blank" rel="noopener" onclick="event.stopPropagation()"><button class="ticket-btn">Tickets</button></a>`
    : isFree
      ? `<span class="free-badge">Free</span>`
      : '';

  const thumbnail = e.flierUrl
    ? `<div class="eflier-thumb" onclick="event.stopPropagation();showEventDetail('${escHtml(String(e.id))}')">
        <img src="${escHtml(e.flierUrl)}" alt="Flyer for ${escHtml(e.name)}" loading="lazy">
        <div class="eflier-hint">View flyer</div>
       </div>`
    : '';

  return `<div class="event-card" onclick="showEventDetail('${escHtml(String(e.id))}')">
    <div class="etime">${escHtml(e.time)}<span class="etime-ampm">${escHtml(e.ampm)}</span></div>
    <div class="event-main">
      <div class="ename">${escHtml(e.name)}</div>
      <div class="evenue">${escHtml(e.venue)}<span>· ${escHtml(e.location)}</span></div>
      <div class="etags">
        <span class="etag etag-vibe">${escHtml(e.vibe)}</span>
        <span class="etag etag-type">${escHtml(e.type)}</span>
        <span class="etag etag-age">${escHtml(e.age)}</span>
      </div>
      ${perfPills     ? `<div class="eperfs">${perfPills}</div>`         : ''}
      ${djPills       ? `<div class="edjs">${djPills}</div>`             : ''}
      ${barPills      ? `<div class="ebars">${barPills}</div>`           : ''}
      ${promoterPills ? `<div class="epromoters">${promoterPills}</div>` : ''}
      ${beneficiaryLine}
    </div>
    <div class="emeta">
      ${thumbnail}
      ${ticketBtn}
      <span class="ecover">${escHtml(e.cover)}</span>
    </div>
  </div>`;
}

/* ── EVENT DETAIL PAGE ── */
function showEventDetail(eventId) {
  // Match by string or number id
  const e = DATA.events.find(ev => String(ev.id) === String(eventId));
  if (!e) return;

  const perfPills = e.performers.map(p =>
    `<span class="eperf" onclick="goToPerformer('${escHtml(p)}')">${escHtml(p)}</span>`
  ).join('');
  const djPills = e.djs.map(d =>
    `<span class="edj" onclick="goToDJ('${escHtml(d)}')">${escHtml(d)}</span>`
  ).join('');
  const barPills = e.bartenders.map(b =>
    `<span class="ebar" onclick="goToBartender('${escHtml(b)}')">${escHtml(b)}</span>`
  ).join('');
  const promoterPills = e.promoters.map(p =>
    `<span class="epromoter">${escHtml(p)}</span>`
  ).join('');

  const isFreeDetail = !e.ticketUrl && (!e.cover || e.cover.toLowerCase().includes('free') || e.cover === '');
  const ticketBtn = e.ticketUrl
    ? `<a href="${escHtml(e.ticketUrl)}" target="_blank" rel="noopener"><button class="ticket-btn" style="font-size:12px;padding:10px 20px">Get tickets</button></a>`
    : isFreeDetail
      ? `<span class="free-badge" style="font-size:11px;padding:8px 14px">Free</span>`
      : '';

  const flierSection = e.flierUrl
    ? `<div class="event-detail-flier">
        <img src="${escHtml(e.flierUrl)}" alt="Flyer for ${escHtml(e.name)}">
       </div>`
    : '';

  const content = `
    <div class="back-btn" onclick="backToCalendar()">&#8592; Back to calendar</div>

    <div class="event-detail-wrap">
      ${flierSection}
      <div class="event-detail-info">
        <div class="event-detail-date">${escHtml(e.day)}, ${escHtml(e.month)} ${escHtml(e.dateNum)}</div>
        <div class="event-detail-name">${escHtml(e.name)}</div>
        <div class="event-detail-venue">${escHtml(e.venue)} <span>· ${escHtml(e.location)}</span></div>

        <div class="event-detail-meta-row">
          <div class="event-detail-meta-item">
            <div class="event-detail-meta-label">Time</div>
            <div class="event-detail-meta-value">${escHtml(e.time)} ${escHtml(e.ampm)}</div>
          </div>
          <div class="event-detail-meta-item">
            <div class="event-detail-meta-label">Age</div>
            <div class="event-detail-meta-value">${escHtml(e.age)}</div>
          </div>
          <div class="event-detail-meta-item">
            <div class="event-detail-meta-label">Cover</div>
            <div class="event-detail-meta-value">${escHtml(e.cover)}</div>
          </div>
        </div>

        <div class="etags" style="margin-bottom:1.5rem">
          <span class="etag etag-vibe">${escHtml(e.vibe)}</span>
          <span class="etag etag-type">${escHtml(e.type)}</span>
        </div>

        ${perfPills     ? `<div class="event-detail-section-title">Performers</div><div class="eperfs" style="margin-bottom:1.25rem">${perfPills}</div>`         : ''}
        ${djPills       ? `<div class="event-detail-section-title">DJs</div><div class="edjs" style="margin-bottom:1.25rem">${djPills}</div>`                         : ''}
        ${barPills      ? `<div class="event-detail-section-title">Bartenders</div><div class="ebars" style="margin-bottom:1.25rem">${barPills}</div>`               : ''}
        ${promoterPills ? `<div class="event-detail-section-title">Presented by</div><div class="epromoters" style="margin-bottom:1.25rem">${promoterPills}</div>`   : ''}
        ${e.beneficiary ? `<div class="ebeneficiary" style="margin-bottom:1.25rem">Benefiting: ${escHtml(e.beneficiary)}</div>`                                      : ''}

        <div style="margin-top:1.5rem">${ticketBtn}</div>
      </div>
    </div>`;

  const detailEl = document.getElementById('eventDetailContent');
  const detailView = document.getElementById('eventDetailView');
  const calView = document.getElementById('calendarMainView');
  if (!detailEl || !detailView || !calView) return;

  detailEl.innerHTML = content;
  calView.style.display = 'none';
  detailView.style.display = 'block';
  window.scrollTo(0, 0);
}

function backToCalendar() {
  document.getElementById('calendarMainView').style.display = 'block';
  document.getElementById('eventDetailView').style.display = 'none';
  window.scrollTo(0, 0);
}

/* ── SHARED: social links ── */
function socialsHTML(socials, style) {
  if (!socials) return '';
  const links = [
    { key:'instagram', label:'Instagram', url:socials.instagram },
    { key:'tiktok',    label:'TikTok',    url:socials.tiktok },
    { key:'facebook',  label:'Facebook',  url:socials.facebook },
    { key:'youtube',   label:'YouTube',   url:socials.youtube },
    { key:'linktree',  label:'Linktree',  url:socials.linktree },
    { key:'website',   label:'Website',   url:socials.website },
  ].filter(l => l.url);
  if (!links.length) return '';
  const btnStyle = style || '';
  return '<div class="profile-socials">' +
    links.map(l =>
      '<a href="' + escHtml(l.url) + '" target="_blank" rel="noopener" class="social-link-btn" style="' + btnStyle + '">' + escHtml(l.label) + '</a>'
    ).join('') +
  '</div>';
}

/* ── SHARED: profile photo or avatar ── */
function profilePhotoHTML(person, size) {
  size = size || '80px';
  var avClass = avatarClass(person.avatarColor);
  if (person.photoUrl) {
    return '<div class="p-photo" style="width:' + size + ';height:' + size + ';border-radius:50%;overflow:hidden;flex-shrink:0;border:1px solid var(--border2)">' +
      '<img src="' + escHtml(person.photoUrl) + '" alt="' + escHtml(person.name) + '" style="width:100%;height:100%;object-fit:cover;display:block" loading="lazy">' +
      '</div>';
  }
  return '<div class="p-avatar ' + avClass + '" style="width:' + size + ';height:' + size + ';font-size:' + Math.round(parseInt(size)*0.35) + 'px">' + escHtml(person.initials) + '</div>';
}

function venuePhotoHTML(venue) {
  if (venue.photoUrl) {
    return '<div class="venue-banner" style="height:120px;overflow:hidden;padding:0">' +
      '<img src="' + escHtml(venue.photoUrl) + '" alt="' + escHtml(venue.name) + '" style="width:100%;height:100%;object-fit:cover;display:block" loading="lazy">' +
      '</div>';
  }
  var initials = venue.name.split(' ').map(function(w){return w[0];}).join('').slice(0,3).toUpperCase();
  return '<div class="venue-banner ' + venue.bannerStyle + '">' + initials + '</div>';
}

/* ── PERFORMERS ── */
let perfTagFilter = 'all';

function buildPerformerChips() {
  const bar = document.getElementById('perfFilterBar');
  if (!bar) return;
  const tagSet = new Set();
  DATA.performers.forEach(p => (p.tags||[]).forEach(t => tagSet.add(t)));
  const preferred = ['drag','burlesque','comedy','singer','dancer','host','emcee'];
  const known   = preferred.filter(t => tagSet.has(t));
  const unknown = [...tagSet].filter(t => !preferred.includes(t)).sort();
  const allTags = [...known, ...unknown];
  bar.querySelectorAll('.chip:not(#pchip-all)').forEach(c => c.remove());
  allTags.forEach(tag => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.dataset.tag = tag;
    chip.textContent = tag.charAt(0).toUpperCase() + tag.slice(1);
    chip.onclick = () => setPerfFilter(tag, chip);
    bar.appendChild(chip);
  });
}

function setPerfFilter(filter, el) {
  document.querySelectorAll('#perfFilterBar .chip').forEach(c => c.classList.remove('on'));
  el.classList.add('on');
  perfTagFilter = filter;
  renderPerformers();
}

function renderPerformers() {
  const grid = document.getElementById('perfGrid');
  if (!grid) return;
  let list = [...DATA.performers];
  if (perfTagFilter !== 'all') list = list.filter(p => (p.tags||[]).includes(perfTagFilter));
  if (state.perfSortAZ) list.sort((a, b) => a.name.localeCompare(b.name));
  else list.sort((a, b) => b.name.localeCompare(a.name));

  const resBadge = r => {
    if (r === 'visitor') return `<span class="p-badge badge-visitor"><span class="dot dot-visitor"></span>Visitor</span>`;
    if (r === 'guest')   return `<span class="p-badge badge-guest"><span class="dot dot-guest"></span>Guest booking</span>`;
    return '';
  };

  grid.innerHTML = list.map((p, i) => `
    <div class="profile-card" style="animation-delay:${i * 0.04}s" onclick="showPerformerDetail('${p.id}')">
      ${profilePhotoHTML(p)}
      <div class="p-name">${escHtml(p.name)}</div>
      <div class="p-role">${escHtml(p.role)}</div>
      ${resBadge(p.residency)}
      <div class="p-upcoming"><strong>${p.events.filter(id => { const ev = DATA.events.find(e => String(e.id)===String(id)); return ev && ev.date && new Date(ev.date+'T12:00:00') >= new Date(); }).length}</strong> upcoming show${p.events.length !== 1 ? 's' : ''}</div>
    </div>`).join('');
}

function showPerformerDetail(id) {
  const p = DATA.performers.find(x => x.id === id);
  if (!p) return;
  const events = p.events.map(eid => DATA.events.find(e => e.id === eid)).filter(Boolean);
  document.getElementById('perfListView').style.display = 'none';
  document.getElementById('perfDetailView').style.display = 'block';
  document.getElementById('perfDetailContent').innerHTML = profileDetailHTML(p, events, 'performer');
}

function goToPerformer(name) {
  const p = DATA.performers.find(x => x.name === name);
  if (!p) return;
  showPage('performers');
  setTimeout(() => showPerformerDetail(p.id), 50);
}

/* ── DJS ── */
let djFilterState = { res: 'all' };

function setDjFilter(key, val, el) {
  djFilterState[key] = val;
  document.querySelectorAll('#page-djs .controls-row:first-child .chip').forEach(c => c.classList.remove('on'));
  el.classList.add('on');
  renderDJs();
}

function toggleDjUpcoming(el) {
  state.djUpcoming = !state.djUpcoming;
  el.classList.toggle('on', state.djUpcoming);
  renderDJs();
}

function renderDJs() {
  const grid = document.getElementById('djGrid');
  if (!grid) return;

  let list = [...DATA.djs];
  if (djFilterState.res !== 'all') list = list.filter(d => d.residency === djFilterState.res);
  if (state.djUpcoming) list = list.filter(d => d.events.length > 0);
  if (state.djSortAZ) list.sort((a, b) => a.name.localeCompare(b.name));
  else list.sort((a, b) => b.name.localeCompare(a.name));

  const countEl = document.getElementById('djCount');
  if (countEl) countEl.innerHTML = `Showing <strong>${list.length}</strong> of ${DATA.djs.length} DJs`;

  if (!list.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-title">No DJs found</div><div class="empty-sub">Try adjusting your filters</div><span class="empty-reset" onclick="resetDjFilters()">Clear filters</span></div>`;
    return;
  }

  const resBadge = r => {
    if (r === 'local')   return `<span class="p-badge badge-local"><span class="dot dot-local"></span>Local</span>`;
    if (r === 'visitor') return `<span class="p-badge badge-visitor"><span class="dot dot-visitor"></span>Visitor</span>`;
    return `<span class="p-badge badge-guest"><span class="dot dot-guest"></span>Guest booking</span>`;
  };

  grid.innerHTML = list.map((d, i) => {
    const nextEvent = d.events.length > 0 ? DATA.events.find(e => e.id === d.events[0]) : null;
    return `<div class="profile-card" style="animation-delay:${i*0.04}s" onclick="showDJDetail('${d.id}')">
      ${profilePhotoHTML(d)}
      <div class="p-name">${escHtml(d.name)}</div>
      <div class="p-role">${escHtml(d.genre)}</div>
      ${resBadge(d.residency)}
      <div class="p-upcoming">
        ${d.events.length > 0
          ? `<strong>${d.events.length}</strong> upcoming set${d.events.length !== 1 ? 's' : ''}
             ${nextEvent ? `<div class="p-next">Next: ${nextEvent.day.slice(0,3)} ${nextEvent.dateNum}</div>` : ''}`
          : `<span style="color:var(--text3)">No upcoming shows</span>`}
      </div>
    </div>`;
  }).join('');
}

function resetDjFilters() {
  djFilterState.res = 'all';
  state.djUpcoming = false;
  document.getElementById('dj-upcoming-chip')?.classList.remove('on');
  document.querySelectorAll('#page-djs .controls-row:first-child .chip').forEach((c, i) => {
    c.classList.toggle('on', i === 0);
  });
  renderDJs();
}

function showDJDetail(id) {
  const d = DATA.djs.find(x => x.id === id);
  if (!d) return;
  const events = d.events.map(eid => DATA.events.find(e => e.id === eid)).filter(Boolean);
  document.getElementById('djListView').style.display = 'none';
  document.getElementById('djDetailView').style.display = 'block';
  document.getElementById('djDetailContent').innerHTML = profileDetailHTML(d, events, 'dj');
}

function goToDJ(name) {
  const d = DATA.djs.find(x => x.name === name);
  if (!d) return;
  showPage('djs');
  setTimeout(() => showDJDetail(d.id), 50);
}

/* ── BARTENDERS ── */
function renderBartenders() {
  const grid = document.getElementById('barGrid');
  if (!grid) return;
  let list = [...DATA.bartenders];
  if (state.barSortAZ) list.sort((a, b) => a.name.localeCompare(b.name));
  else list.sort((a, b) => b.name.localeCompare(a.name));

  grid.innerHTML = list.map((b, i) => `
    <div class="profile-card" style="animation-delay:${i*0.04}s" onclick="showBartenderDetail('${b.id}')">
      ${profilePhotoHTML(b)}
      <div class="p-name">${escHtml(b.name)}</div>
      <div class="p-role">${b.venues.length ? escHtml(b.venues.join(' · ')) : 'Bartender'}</div>
      ${b.schedule ? `<div class="p-schedule">${escHtml(b.schedule)}</div>` : ''}
      <div class="p-upcoming"><strong>${b.events.length}</strong> upcoming show${b.events.length !== 1 ? 's' : ''}</div>
    </div>`).join('');
}

function showBartenderDetail(id) {
  const b = DATA.bartenders.find(x => x.id === id);
  if (!b) return;
  const events = b.events.map(eid => DATA.events.find(e => e.id === eid)).filter(Boolean);
  document.getElementById('barListView').style.display = 'none';
  document.getElementById('barDetailView').style.display = 'block';
  const scheduleSection = b.schedule
    ? `<div class="detail-section"><div class="detail-section-title">Regular schedule</div><div class="bar-schedule">${escHtml(b.schedule)}</div></div>`
    : '';
  document.getElementById('barDetailContent').innerHTML = profileDetailHTML(b, events, 'bartender') + scheduleSection;
}

function goToBartender(name) {
  const b = DATA.bartenders.find(x => x.name === name);
  if (!b) return;
  showPage('bartenders');
  setTimeout(() => showBartenderDetail(b.id), 50);
}

/* ── VENUES ── */
function toggleVenueType(type, el) {
  if (state.venueTypes.has(type)) { state.venueTypes.delete(type); el.classList.remove('on'); }
  else { state.venueTypes.add(type); el.classList.add('on'); }
  renderVenues();
}

function setVenueHood(hood, el) {
  state.venueHood = hood;
  document.querySelectorAll('[id^="vhood-"]').forEach(c => c.classList.remove('on'));
  el.classList.add('on');
  renderVenues();
}

// Known types with labels, badge classes, and tooltip text
// Any type not listed here gets a auto-generated label and no tooltip
const TYPE_META = {
  queer:      { label: 'LGBTQIA+ venue',  badgeClass: 'badge-queer',      tooltip: 'Queer-owned or operated, with programming specifically for the LGBTQIA+ community as a core part of their identity.' },
  safe:       { label: 'Safe space',       badgeClass: 'badge-safe',       tooltip: 'Not specifically queer-owned, but actively welcoming and affirming. Staff are trained and the environment is intentionally inclusive.' },
  arts:       { label: 'Arts space',       badgeClass: 'badge-arts',       tooltip: 'A gallery, performance venue, or cultural organization. May host one-off events rather than recurring nightlife.' },
  restaurant: { label: 'Bar & restaurant', badgeClass: 'badge-restaurant', tooltip: 'A food-and-drink establishment that hosts queer events. May have more daytime programming like brunches.' },
};

function getTypeMeta(type) {
  if (TYPE_META[type]) return TYPE_META[type];
  // Auto-generate for unknown types — title case, no tooltip
  const label = type.charAt(0).toUpperCase() + type.slice(1).replace(/-/g, ' ');
  return { label, badgeClass: 'badge-hood', tooltip: null };
}

function buildVenueTypeChips() {
  // Collect all unique types across all venues
  const typeSet = new Set();
  DATA.venues.forEach(v => v.types.forEach(t => typeSet.add(t)));

  // Known types first in preferred order, then any new ones alphabetically
  const preferred = ['queer', 'safe', 'arts', 'restaurant'];
  const known   = preferred.filter(t => typeSet.has(t));
  const unknown = [...typeSet].filter(t => !preferred.includes(t)).sort();
  const allTypes = [...known, ...unknown];

  // Find the controls row that holds the type chips
  const typeRow = document.querySelector('#page-venues .controls-row:first-child');
  if (!typeRow) return;

  // Remove existing type chips (keep the label)
  typeRow.querySelectorAll('.chip-wrap, .chip[id^="vchip-"]').forEach(c => c.remove());

  allTypes.forEach(type => {
    const meta = getTypeMeta(type);
    const wrap = document.createElement('div');
    wrap.className = 'chip-wrap';

    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.id = `vchip-${type}`;
    chip.innerHTML = `${meta.label}${meta.tooltip ? ' <span class="chip-info">i</span>' : ''}`;
    chip.onclick = () => toggleVenueType(type, chip);
    wrap.appendChild(chip);

    if (meta.tooltip) {
      const tt = document.createElement('div');
      tt.className = 'tooltip';
      // Right-align tooltips for the last two to avoid overflow
      tt.innerHTML = `<div class="tt-title">${meta.label}</div><div class="tt-body">${meta.tooltip}</div>`;
      wrap.appendChild(tt);
    }

    typeRow.appendChild(wrap);
  });
}

function renderVenues() {
  const grid = document.getElementById('venueGrid');
  if (!grid) return;

  let list = [...DATA.venues];
  if (state.venueTypes.size > 0) {
    list = list.filter(v => Array.from(state.venueTypes).every(t => v.types.includes(t)));
  }
  if (state.venueHood !== 'all') list = list.filter(v => v.hood === state.venueHood);
  if (state.venueSortAZ) list.sort((a, b) => a.name.localeCompare(b.name));
  else list.sort((a, b) => b.name.localeCompare(a.name));

  const countEl = document.getElementById('venueCount');
  if (countEl) countEl.innerHTML = `Showing <strong>${list.length}</strong> of ${DATA.venues.length} venues`;

  // Active filter pills
  const af = document.getElementById('venueActiveFilters');
  if (af) {
    if (state.venueTypes.size === 0) {
      af.innerHTML = `<span class="filter-note">Showing all venue types — select one or more above to filter</span>`;
    } else {
      const pills = Array.from(state.venueTypes).map(t => `
        <div class="active-pill">${TYPE_META[t]?.label || t}
          <span class="pill-x" onclick="removeVenueType('${t}')">&times;</span>
        </div>`).join('');
      const note = state.venueTypes.size > 1
        ? `<span class="filter-note">Showing venues that are <em style="font-style:normal;color:var(--purple)">all of</em> the selected types</span>`
        : '';
      af.innerHTML = `${pills}${note}<span class="clear-all-btn" onclick="clearVenueTypes()">Clear all</span>`;
    }
  }

  if (!list.length) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-title">No venues match</div><div class="empty-sub">No venues are tagged with all of those types combined</div><span class="empty-reset" onclick="clearVenueTypes()">Clear filters</span></div>`;
    return;
  }

  // Count upcoming events per venue dynamically
  const today = new Date(); today.setHours(0,0,0,0);
  const venueCounts = {};
  DATA.events.forEach(e => {
    if (!e.date) return;
    const d = new Date(e.date + 'T12:00:00');
    if (d >= today) venueCounts[e.venue] = (venueCounts[e.venue] || 0) + 1;
  });

  grid.innerHTML = list.map((v, i) => {
    const badges = v.types.map(t => {
      const meta = getTypeMeta(t);
      return `<span class="badge ${meta.badgeClass}">${meta.label}</span>`;
    }).join('');
    const initials = v.name.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase();
    const count = venueCounts[v.name] || 0;
    const safeName = escHtml(v.name);
    return `<div class="venue-card" style="animation-delay:${i*0.04}s;cursor:pointer" onclick="showVenueDetail('${safeName}')">
      ${venuePhotoHTML(v)}
      <div class="venue-body">
        <div class="venue-name">${escHtml(v.name)}</div>
        <div class="venue-loc">${escHtml(v.hoodLabel)}</div>
        <div class="venue-badges">${badges}<span class="badge badge-hood">${escHtml(v.hoodLabel)}</span></div>
        <div class="venue-events">${count} upcoming event${count !== 1 ? 's' : ''}</div>
      </div>
    </div>`;
  }).join('');
}

function removeVenueType(type) {
  state.venueTypes.delete(type);
  const el = document.getElementById('vchip-' + type);
  if (el) el.classList.remove('on');
  renderVenues();
}

function clearVenueTypes() {
  state.venueTypes.clear();
  document.querySelectorAll('[id^="vchip-"]').forEach(c => c.classList.remove('on'));
  renderVenues();
}

/* ── SHARED: profile detail view ── */
function profileDetailHTML(person, events, type) {
  const avClass = avatarClass(person.avatarColor);
  const detailPhoto = person.photoUrl
    ? ('<div class="detail-avatar" style="width:80px;height:80px;border-radius:50%;overflow:hidden;border:1px solid var(--border2);flex-shrink:0">' +
       '<img src="' + escHtml(person.photoUrl) + '" alt="' + escHtml(person.name) + '" style="width:100%;height:100%;object-fit:cover;display:block">' +
       '</div>')
    : ('<div class="detail-avatar ' + avClass + '">' + escHtml(person.initials) + '</div>');
  const extraInfo = type === 'dj'
    ? `<div style="font-size:12px;color:var(--text3);margin-bottom:12px;letter-spacing:0.06em">${escHtml(person.genre || '')}</div>`
    : type === 'bartender' && person.venues?.length
    ? `<div style="font-size:12px;color:var(--teal);margin-bottom:12px;letter-spacing:0.04em">${person.venues.map(escHtml).join(' · ')}</div>`
    : '';

  const today2 = new Date(); today2.setHours(0,0,0,0);
  const upcomingOnly = events.filter(e => e.date && new Date(e.date + 'T12:00:00') >= today2);
  const eventRows = upcomingOnly.length
    ? upcomingOnly.map(e => {
        const perfPills = e.performers.map(p =>
          `<span class="eperf" onclick="event.stopPropagation();goToPerformer('${escHtml(p)}')">${escHtml(p)}</span>`
        ).join('');
        const djPills = e.djs.map(d =>
          `<span class="edj" onclick="event.stopPropagation();goToDJ('${escHtml(d)}')">${escHtml(d)}</span>`
        ).join('');
        const barPills = e.bartenders.map(b =>
          `<span class="ebar" onclick="event.stopPropagation();goToBartender('${escHtml(b)}')">${escHtml(b)}</span>`
        ).join('');
        const ticketBtn = e.ticketUrl
          ? `<a href="${escHtml(e.ticketUrl)}" target="_blank" rel="noopener" onclick="event.stopPropagation()"><button class="ticket-btn" style="font-size:9px;padding:4px 10px">Tickets</button></a>`
          : (!e.cover || e.cover.toLowerCase().includes('free'))
            ? `<span class="free-badge" style="font-size:9px;padding:3px 8px">Free</span>`
            : '';
        return `<div class="profile-event-card">
          <div class="profile-event-top">
            <div class="profile-event-date">${escHtml(e.day.slice(0,3))} ${escHtml(e.dateNum)} ${escHtml(e.month)}</div>
            <div class="profile-event-time">${escHtml(e.time)} ${escHtml(e.ampm)}</div>
            ${ticketBtn}
          </div>
          <div class="profile-event-name">${escHtml(e.name)}</div>
          <div class="profile-event-venue">${escHtml(e.venue)}<span style="color:var(--text3);margin-left:4px">· ${escHtml(e.location)}</span></div>
          <div class="etags" style="margin:6px 0">
            <span class="etag etag-vibe">${escHtml(e.vibe)}</span>
            <span class="etag etag-age">${escHtml(e.age)}</span>
            ${e.cover && !e.cover.toLowerCase().includes('free') ? `<span class="etag etag-type">${escHtml(e.cover)}</span>` : ''}
          </div>
          ${perfPills  ? `<div class="eperfs">${perfPills}</div>`   : ''}
          ${djPills    ? `<div class="edjs">${djPills}</div>`       : ''}
          ${barPills   ? `<div class="ebars">${barPills}</div>`     : ''}
        </div>`;
      }).join('')
    : `<div style="font-size:13px;color:var(--text3);padding:1rem 0">No upcoming shows scheduled</div>`;

  return `
    <div class="detail-header">
      ${detailPhoto}
      <div>
        <div class="detail-name">${escHtml(person.name)}</div>
        <div class="detail-role">${escHtml(person.role || '')}</div>
        ${extraInfo}
        ${person.bio ? `<div class="detail-bio">"${escHtml(person.bio)}"</div>` : ''}
        ${socialsHTML(person.socials)}
      </div>
    </div>
    <div class="detail-section">
      <div class="detail-section-title">Upcoming shows</div>
      ${eventRows}
    </div>`;
}

/* ── SORT toggles ── */
function toggleSort(which, el) {
  const key = which === 'perf' ? 'perfSortAZ' : which === 'dj' ? 'djSortAZ' : which === 'bar' ? 'barSortAZ' : 'venueSortAZ';
  state[key] = !state[key];
  el.classList.toggle('active', state[key]);
  el.innerHTML = `${state[key] ? 'A–Z' : 'Z–A'} &#8597;`;
  if (which === 'perf')  renderPerformers();
  if (which === 'dj')    renderDJs();
  if (which === 'bar')   renderBartenders();
  if (which === 'venue') renderVenues();
}

/* ── VENUE DETAIL ── */
function showVenueDetail(name) {
  const v = DATA.venues.find(x => x.name === name);
  if (!v) return;

  const today = new Date(); today.setHours(0,0,0,0);
  const upcomingEvents = DATA.events
    .filter(e => e.venue === v.name && e.date && new Date(e.date + 'T12:00:00') >= today)
    .sort((a, b) => a.date < b.date ? -1 : 1);

  const badges = v.types.map(t => {
    const meta = getTypeMeta(t);
    return `<span class="badge ${meta.badgeClass}">${meta.label}</span>`;
  }).join('');

  const photoSection = v.photoUrl
    ? `<div style="border-radius:4px;overflow:hidden;border:1px solid var(--border);margin-bottom:1.5rem;max-width:500px">
        <img src="${escHtml(v.photoUrl)}" alt="${escHtml(v.name)}" style="width:100%;display:block;object-fit:cover;max-height:280px">
       </div>`
    : '';

  const metaItems = [
    v.hoodLabel ? `<div class="event-detail-meta-item"><div class="event-detail-meta-label">Area</div><div class="event-detail-meta-value" style="font-size:14px;font-family:var(--font-body)">${escHtml(v.hoodLabel)}</div></div>` : '',
    v.address   ? `<div class="event-detail-meta-item"><div class="event-detail-meta-label">Address</div><div class="event-detail-meta-value" style="font-size:14px;font-family:var(--font-body)">${escHtml(v.address)}</div></div>` : '',
    v.website   ? `<div class="event-detail-meta-item"><div class="event-detail-meta-label">Website</div><div class="event-detail-meta-value" style="font-size:14px;font-family:var(--font-body)"><a href="${escHtml(v.website)}" target="_blank" rel="noopener" style="color:var(--pink)">${escHtml(v.website.replace(/https?:\/\//, ''))}</a></div></div>` : '',
  ].filter(Boolean).join('');

  const eventRows = upcomingEvents.length
    ? upcomingEvents.map(e => {
        const perfPills = e.performers.map(p =>
          `<span class="eperf" onclick="goToPerformer('${escHtml(p)}')">${escHtml(p)}</span>`
        ).join('');
        const djPills = e.djs.map(d =>
          `<span class="edj" onclick="goToDJ('${escHtml(d)}')">${escHtml(d)}</span>`
        ).join('');
        return `<div class="detail-event-row" style="flex-direction:column;align-items:flex-start;gap:6px">
          <div style="display:flex;align-items:baseline;gap:1rem;width:100%">
            <div class="detail-event-date">${escHtml(e.day.slice(0,3))} ${escHtml(e.dateNum)} ${escHtml(e.month)}</div>
            <div class="detail-event-name" style="flex:1">${escHtml(e.name)}</div>
            <div style="font-size:11px;color:var(--text3)">${escHtml(e.time)} ${escHtml(e.ampm)}</div>
          </div>
          <div style="display:flex;gap:5px;flex-wrap:wrap">
            <span class="etag etag-vibe">${escHtml(e.vibe)}</span>
            <span class="etag etag-age">${escHtml(e.age)}</span>
            ${e.cover ? `<span class="etag etag-type">${escHtml(e.cover)}</span>` : ''}
          </div>
          ${perfPills ? `<div class="eperfs">${perfPills}</div>` : ''}
          ${djPills   ? `<div class="edjs">${djPills}</div>`     : ''}
        </div>`;
      }).join('')
    : `<div style="font-size:13px;color:var(--text3);padding:1rem 0">No upcoming events scheduled</div>`;

  document.getElementById('venueDetailContent').innerHTML = `
    ${photoSection}
    <div class="detail-name">${escHtml(v.name)}</div>
    <div class="venue-badges" style="margin-bottom:1rem">${badges}</div>
    ${socialsHTML(v.socials)}
    <div class="event-detail-meta-row" style="margin:1rem 0 2rem">${metaItems}</div>
    <div class="detail-section">
      <div class="detail-section-title">Upcoming events</div>
      ${eventRows}
    </div>`;

  document.getElementById('venueListView').style.display = 'none';
  document.getElementById('venueDetailView').style.display = 'block';
  window.scrollTo(0, 0);
}

/* ── BACK to list ── */
function backToList(section) {
  const views = {
    performers: ['perfListView', 'perfDetailView'],
    djs:        ['djListView',   'djDetailView'],
    bartenders: ['barListView',  'barDetailView'],
    venues:     ['venueListView','venueDetailView'],
  };
  const [list, detail] = views[section] || [];
  if (list)   document.getElementById(list).style.display = 'block';
  if (detail) document.getElementById(detail).style.display = 'none';
}

/* ── SUBMIT FORM ── */
function setupSubmitForm() {
  const form = document.getElementById('submitForm');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));

    // If you connect a form service (Formspree, Netlify Forms, etc.),
    // replace this block with a real fetch() call to your endpoint.
    // For now it just shows the success state.
    console.log('Form submission:', data);

    form.style.display = 'none';
    document.getElementById('submitSuccess').style.display = 'block';
  });
}

/* ── Utility: HTML escape ── */
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
