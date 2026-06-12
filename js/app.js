/* ============================================================
   FRUIT LOOP PVD — App Logic (js/app.js)
   ============================================================ */

/* ── App state ── */
let DATA = { events: [], performers: [], djs: [], bartenders: [], organizers: [], venues: [] };

const state = {
  calFilters:   new Set(),
  calNeighborhoods: new Set(),
  calVenues: new Set(),
  calOrganizers: new Set(),
  calCovers: new Set(),
  calAges: new Set(),
  calPerformers: new Set(),
  perfSortAZ:   true,
  djFilter:     'all',
  djUpcoming:   false,
  djSortAZ:     true,
  barSortAZ:    true,
  orgSortAZ:    true,
  perfSearch:   '',
  djSearch:     '',
  barSearch:    '',
  orgSearch:    '',
  venueSearch:  '',
  venueTypes:   new Set(),
  venueHood:    'all',
  venueSortAZ:  true,
};

let calendarViewDate = null;
let calendarSelectedDate = '';
let calendarSelectedExplicit = false;
let calendarSidebarOpen = true;
let venueMap = null;
let venueMapMarkers = [];
let venueMarkerByKey = new Map();
let activeVenueKey = '';
let fruitLoopOverlay = null;
let venueMapInitialFocusApplied = false;
let venueMapUserMoved = false;
let venueMapProgrammaticMove = false;
let venueMapRenderToken = 0;
let venueDetailMap = null;
let venueDetailMapMarker = null;
let lastRenderedVenues = [];
const venueGeoCache = {};
const VENUE_MAP_CACHE_KEY = 'fruitloop_venue_geo_cache_v1';
const VENUE_MAP_DEFAULT_CENTER = [41.820889, -71.412323];
const VENUE_MAP_LOOP_CENTER = [41.820889, -71.412323];
const VENUE_MAP_LOOP_RADIUS_M = 420;

// SVG icon constants and helpers were moved into js/svg-icons.js

function injectStaticFilterAllIcons() {
  document.querySelectorAll('.filter-all-icon').forEach(node => {
    const label = node.dataset.filterLabel || node.nextElementSibling?.textContent || '';
    node.innerHTML = filterAllIconForLabel(label);
  });
}

function djBadgePill(name) {
  return `<span class="edj" onclick="event.stopPropagation();goToDJ('${escHtml(name)}')">${DJ_BADGE_ICON}${escHtml(name)}</span>`;
}

function bartenderBadgePill(name) {
  return `<span class="ebar" onclick="event.stopPropagation();goToBartender('${escHtml(name)}')">${BARTENDER_BADGE_ICON}${escHtml(name)}</span>`;
}

function promoterBadgePill(name) {
  return `<span class="epromoter" onclick="event.preventDefault(); event.stopPropagation(); goToOrganizer('${encodeURIComponent(name)}')">${PROMOTER_BADGE_ICON}${escHtml(name)}</span>`;
}

try {
  const cached = JSON.parse(localStorage.getItem(VENUE_MAP_CACHE_KEY) || '{}');
  Object.assign(venueGeoCache, cached);
} catch (err) {
  console.warn('Unable to restore venue geocode cache', err);
}

/* ── Boot ── */
document.addEventListener('DOMContentLoaded', async () => {
  drawGrain();
  setupMobileNav();
  setupSubmitForm();

  // Add social SVG icons to the static social buttons in the calendar sidebar
  document.getElementById('tiktokLink')?.insertAdjacentHTML('beforeend', ICON_TIKTOK);
  document.getElementById('facebookLink')?.insertAdjacentHTML('beforeend', ICON_FACEBOOK);
  document.getElementById('instagramLink')?.insertAdjacentHTML('beforeend', ICON_INSTAGRAM);
  document.getElementById('headerTiktokLink')?.insertAdjacentHTML('beforeend', ICON_TIKTOK);
  document.getElementById('headerFacebookLink')?.insertAdjacentHTML('beforeend', ICON_FACEBOOK);
  document.getElementById('headerInstagramLink')?.insertAdjacentHTML('beforeend', ICON_INSTAGRAM);
  document.getElementById('headerMerchLink')?.insertAdjacentHTML('afterbegin', ICON_MERCH + ' ');

  // Add social SVG icons to the footer and footer social buttons
  document.getElementById('footerInstagramLink')?.insertAdjacentHTML('afterbegin', ICON_INSTAGRAM);
  document.getElementById('footerTiktokLink')?.insertAdjacentHTML('afterbegin', ICON_TIKTOK);
  document.getElementById('footerFacebookLink')?.insertAdjacentHTML('afterbegin', ICON_FACEBOOK);
  document.getElementById('footerMerchLink')?.insertAdjacentHTML('afterbegin', ICON_MERCH + ' ');
  document.querySelectorAll('.social-links a[href*="instagram.com"]').forEach(el => el.insertAdjacentHTML('afterbegin', ICON_INSTAGRAM));
  document.querySelectorAll('.social-links a[href*="tiktok.com"]').forEach(el => el.insertAdjacentHTML('afterbegin', ICON_TIKTOK));
  document.querySelectorAll('.social-links a[href*="facebook.com"]').forEach(el => el.insertAdjacentHTML('afterbegin', ICON_FACEBOOK));

  // Add contact page SVG icons
  document.getElementById('contactEventIcon')?.insertAdjacentHTML('afterbegin', ICON_FILTER_ALL_EVENTS);
  document.getElementById('contactPerformerIcon')?.insertAdjacentHTML('afterbegin', ICON_PERFORMER);
  document.getElementById('contactDjIcon')?.insertAdjacentHTML('afterbegin', ICON_MUSIC);

  injectStaticFilterAllIcons();

  DATA = await loadData();
  DATA.organizers = buildOrganizersFromEvents(DATA.events);

  buildFilterChips();
  buildVenueTypeChips();
  buildPerformerChips();
  buildPeopleVenueMenu();
  setupPageFilterMenus();
  initPageFilterCollapseButtons();
  renderEvents();
  renderPerformers();
  renderDJs();
  renderBartenders();
  renderOrganizers();
  renderVenues();
  setupPageSearchInputs();

  const params = new URLSearchParams(window.location.search);
  const state = {
    page: params.get('page') || document.querySelector('.nav-item.active, .nav-dropdown-item.active')?.dataset.page || 'calendar',
    event: params.get('event') || null,
    performer: params.get('performer') || null,
    dj: params.get('dj') || null,
    bartender: params.get('bartender') || null,
    organizer: params.get('organizer') || null,
    venue: params.get('venue') || null,
  };

  showPage(state.page, null, false);

  if (state.page === 'calendar' && state.event) {
    showEventDetail(state.event, false);
  } else if (state.page === 'performers' && state.performer) {
    showPerformerDetail(state.performer, false);
  } else if (state.page === 'djs' && state.dj) {
    showDJDetail(state.dj, false);
  } else if (state.page === 'bartenders' && state.bartender) {
    showBartenderDetail(state.bartender, false);
  } else if (state.page === 'organizers' && state.organizer) {
    showOrganizerDetail(state.organizer, false);
  } else if (state.page === 'venues' && state.venue) {
    showVenueDetail(state.venue, false);
  }

  updatePageHistory(state.page, true, state);

  window.addEventListener('popstate', event => {
    const nextState = event.state || {};
    const page = nextState.page || new URLSearchParams(window.location.search).get('page') || 'calendar';
    showPage(page, null, false);

    if (page === 'calendar' && nextState.event) {
      showEventDetail(nextState.event, false);
    } else if (page === 'performers' && nextState.performer) {
      showPerformerDetail(nextState.performer, false);
    } else if (page === 'djs' && nextState.dj) {
      showDJDetail(nextState.dj, false);
    } else if (page === 'bartenders' && nextState.bartender) {
      showBartenderDetail(nextState.bartender, false);
    } else if (page === 'organizers' && nextState.organizer) {
      showOrganizerDetail(nextState.organizer, false);
    } else if (page === 'venues' && nextState.venue) {
      showVenueDetail(nextState.venue, false);
    }
  });

  // Update hero subtitle with current month
  const now = new Date();
  const monthName = now.toLocaleString('en-US', { month: 'long' });
  const yearNum = now.getFullYear();
  const sub = document.getElementById('calendarSub');
  if (sub) sub.textContent = `${monthName} ${yearNum} · Click a performer or DJ name to see all their shows`;
});

/* ── Page navigation ── */
function updatePageHistory(name, replace = false, extras = {}) {
  if (!window.history || !window.history.pushState) return;
  const url = new URL(window.location.href);
  url.searchParams.set('page', name);
  const keys = ['event', 'performer', 'dj', 'bartender', 'organizer', 'venue'];
  keys.forEach(key => {
    if (extras[key]) url.searchParams.set(key, extras[key]);
    else url.searchParams.delete(key);
  });
  const state = { page: name, ...extras };
  if (replace) {
    window.history.replaceState(state, '', url);
  } else {
    window.history.pushState(state, '', url);
  }
}

function hideAllDetailViews() {
  const detailViews = [
    { detail: 'eventDetailView', main: 'calendarMainView' },
    { detail: 'perfDetailView', main: 'perfListView' },
    { detail: 'djDetailView', main: 'djListView' },
    { detail: 'barDetailView', main: 'barListView' },
    { detail: 'orgDetailView', main: 'orgListView' },
    { detail: 'venueDetailView', main: 'venueListView' },
  ];
  detailViews.forEach(view => {
    const detailEl = document.getElementById(view.detail);
    const mainEl = document.getElementById(view.main);
    if (detailEl) detailEl.style.display = 'none';
    if (mainEl) mainEl.style.display = 'block';
  });
}

function showPage(name, el, pushState = true) {
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
  hideAllDetailViews();
  document.getElementById('siteNav')?.classList.remove('open');
  document.querySelectorAll('.nav-dropdown.open').forEach(dropdown => dropdown.classList.remove('open'));
  if (name === 'venues') {
    requestAnimationFrame(() => {
      ensureVenueMap();
      if (venueMap) venueMap.invalidateSize();
      updateVenueMap(lastRenderedVenues);
    });
  }
  if (pushState) updatePageHistory(name);
  window.scrollTo(0, 0);
}

/* ── Mobile nav toggle ── */
function setupMobileNav() {
  const toggle = document.getElementById('navToggle');
  const nav = document.getElementById('siteNav');
  if (toggle && nav) {
    toggle.addEventListener('click', event => {
      event.stopPropagation();
      nav.classList.toggle('open');
    });
  }

  document.querySelectorAll('.nav-dropdown-trigger').forEach(trigger => {
    trigger.addEventListener('click', event => {
      const dropdown = trigger.closest('.nav-dropdown');
      if (!dropdown) return;
      const isOpen = dropdown.classList.toggle('open');
      if (isOpen) {
        document.querySelectorAll('.nav-dropdown.open').forEach(other => {
          if (other !== dropdown) other.classList.remove('open');
        });
      }
      event.stopPropagation();
    });
  });

  document.addEventListener('click', event => {
    if (!event.target.closest('.nav-dropdown')) {
      document.querySelectorAll('.nav-dropdown.open').forEach(dropdown => dropdown.classList.remove('open'));
    }
  });
}

function setupPageFilterMenus() {
  if (pageFilterMenuBound) return;

  syncPerfFilterUI();
  syncDjFilterUI();
  syncSortMenus();
  syncVenueFilterUI();

  document.addEventListener('click', (event) => {
    document.querySelectorAll('.page-filter-wrap.open').forEach(wrap => {
      if (!wrap.contains(event.target)) wrap.classList.remove('open');
    });
    syncPageFilterToggleState();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      document.querySelectorAll('.page-filter-wrap.open').forEach(wrap => wrap.classList.remove('open'));
      syncPageFilterToggleState();
    }
  });

  window.addEventListener('resize', () => {
    document.querySelectorAll('.page-filter-wrap.open').forEach(wrap => {
      const toggle = wrap.querySelector('.calendar-filter-toggle');
      if (toggle) positionPageFilterMenu(wrap.id, toggle.id);
    });
  });

  pageFilterMenuBound = true;
}

function setupPageSearchInputs() {
  const configs = [
    { id: 'perfSearchInput', key: 'perfSearch', render: renderPerformers },
    { id: 'djSearchInput', key: 'djSearch', render: renderDJs },
    { id: 'barSearchInput', key: 'barSearch', render: renderBartenders },
    { id: 'orgSearchInput', key: 'orgSearch', render: renderOrganizers },
    { id: 'venueSearchInput', key: 'venueSearch', render: renderVenues },
  ];

  configs.forEach(cfg => {
    const input = document.getElementById(cfg.id);
    if (!input) return;
    input.value = state[cfg.key] || '';
    input.addEventListener('input', () => {
      state[cfg.key] = (input.value || '').trim().toLowerCase();
      cfg.render();
    });
  });
}

function togglePageFilterMenu(wrapId, toggleId) {
  const wrap = document.getElementById(wrapId);
  if (!wrap) return;
  const shouldOpen = !wrap.classList.contains('open');

  document.querySelectorAll('.page-filter-wrap.open').forEach(other => {
    if (other.id !== wrapId) other.classList.remove('open');
  });

  wrap.classList.toggle('open', shouldOpen);
  const toggle = document.getElementById(toggleId);
  if (toggle) toggle.classList.toggle('is-open', shouldOpen);
  syncPageFilterToggleState();
  if (shouldOpen) {
    requestAnimationFrame(() => positionPageFilterMenu(wrapId, toggleId));
  }
}

function syncPageFilterToggleState() {
  document.querySelectorAll('.page-filter-wrap').forEach(wrap => {
    const toggle = wrap.querySelector('.calendar-filter-toggle');
    if (toggle) toggle.classList.toggle('is-open', wrap.classList.contains('open'));
  });
}

function positionPageFilterMenu(wrapId, toggleId) {
  const wrap = document.getElementById(wrapId);
  if (!wrap) return;
  const menu = wrap.querySelector('.calendar-filter-menu');
  if (!menu) return;
  const toggle = document.getElementById(toggleId) || wrap.querySelector('.calendar-filter-toggle');
  const viewportPad = 8;
  const isMobile = window.innerWidth <= 640;

  menu.style.position = 'absolute';
  menu.style.transform = '';
  menu.style.width = '';
  menu.style.maxHeight = isMobile ? '60vh' : '420px';
  menu.style.right = 'auto';

  if (toggle) {
    menu.style.top = `${toggle.offsetTop + toggle.offsetHeight - 1}px`;
    menu.style.left = '0px';
    let rect = menu.getBoundingClientRect();
    const menuWidth = rect.width;
    const desiredLeft = toggle.offsetLeft + (toggle.offsetWidth / 2) - (menuWidth / 2);
    const clampedLeft = Math.min(Math.max(0, desiredLeft), wrap.offsetWidth - menuWidth);
    menu.style.left = `${Math.max(0, clampedLeft)}px`;
  } else {
    menu.style.top = 'calc(100% - 1px)';
    menu.style.left = '0px';
  }
}

function initPageFilterCollapseButtons() {
  document.querySelectorAll('.filters-bar.page-filters').forEach(bar => {
    if (bar.querySelector('.page-filters-collapse-btn')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sort-btn page-filters-collapse-btn';
    btn.textContent = 'Hide';
    btn.setAttribute('aria-label', 'Toggle filters');
    btn.setAttribute('title', 'Show/hide filters');
    btn.addEventListener('click', event => {
      event.stopPropagation();
      togglePageFiltersCollapse(bar.id || '', btn);
    });
    const firstToggle = bar.querySelector('.calendar-filter-wrap');
    const heading = document.createElement('div');
    heading.className = 'page-filters-heading';
    if (firstToggle) {
      bar.insertBefore(heading, firstToggle);
    } else {
      bar.appendChild(heading);
    }
    const label = bar.querySelector('.filter-label');
    if (label) heading.appendChild(label);
    heading.appendChild(btn);
  });
}

function togglePageFiltersCollapse(barId, btn) {
  const bar = document.getElementById(barId);
  if (!bar) return;
  const collapsed = bar.classList.toggle('collapsed');
  if (btn) btn.textContent = collapsed ? 'Show' : 'Hide';
  if (collapsed) {
    bar.querySelectorAll('.page-filter-wrap.open').forEach(wrap => wrap.classList.remove('open'));
    syncPageFilterToggleState();
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

function makeOrganizerId(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'organizer';
}

function buildOrganizersFromEvents(events) {
  const byName = new Map();
  (events || []).forEach(e => {
    const eventId = String(e.id || '');
    (e.promoters || []).forEach(name => {
      const trimmed = String(name || '').trim();
      if (!trimmed) return;
      const key = trimmed.toLowerCase();
      if (!byName.has(key)) {
        byName.set(key, {
          id: makeOrganizerId(trimmed),
          personId: makeOrganizerId(trimmed),
          name: trimmed,
          role: 'Organizer',
          initials: trimmed.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'OR',
          avatarColor: 'purple',
          bio: '',
          socials: {},
          events: [],
          venues: new Set(),
        });
      }
      const org = byName.get(key);
      if (eventId && !org.events.includes(eventId)) org.events.push(eventId);
      if (e.venue) org.venues.add(e.venue);
    });
  });

  return [...byName.values()]
    .map(o => ({ ...o, venues: [...o.venues].sort((a, b) => a.localeCompare(b)) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function matchesSearch(parts, query) {
  if (!query) return true;
  return parts.filter(Boolean).join(' ').toLowerCase().includes(query);
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

const CALENDAR_TAG_GROUP_DEFS = [
  {
    key: 'music',
    label: 'Music & Dance',
    exact: ['dance party', 'edm', 'rave', 'karaoke', 'live music', 'live singing', 'sing along', 'sing-along', 'tea dance', 'show tunes', 'disco music', 'latin music', 'country music', 'punk music', 'grunge music', 'rock music', 'retro music', 'piano'],
    keywords: ['music', 'dance', 'dj', 'set', 'rave', 'karaoke', 'sing']
  },
  {
    key: 'performance',
    label: 'Performance & Stage',
    exact: ['drag show', 'burlesque show', 'comedy', 'open mic', 'open stage', 'improv show', 'ballroom', 'watch party', 'movie night', 'reality tv', 'rupaul\'s drag race', 'rupaul\'s drag race all stars', 'real housewives of rhode island', 'pride party', 'block party', 'live singing', 'singing competition'],
    keywords: ['drag', 'burlesque', 'comedy', 'show', 'stage', 'open mic', 'watch party', 'movie', 'theater', 'theatre']
  },
  {
    key: 'games',
    label: 'Games & Trivia',
    exact: ['bingo', 'game night', 'trivia', 'board games', 'card games', 'tabletop games', 'pictionary', 'card game lesson', 'bowling'],
    keywords: ['bingo', 'trivia', 'game', 'games', 'pictionary', 'bowling']
  },
  {
    key: 'community',
    label: 'Community & Pride',
    exact: ['social mixer', 'community', 'community event', 'support group', 'book club', 'speed dating', 'pride festival', 'flag raising', 'charity fundraiser', 'charity event', 'bar tour', 'activism', 'online'],
    keywords: ['community', 'mixer', 'meetup', 'support', 'book club', 'pride', 'fundraiser', 'charity', 'social', 'network', 'dating', 'online']
  },
  {
    key: 'wellness',
    label: 'Wellness, Sports & Workshops',
    exact: ['yoga', 'wellness', 'volleyball', 'roller derby', 'dance workshop', 'burlesque workshop', 'fetish workshop', 'body positivity workshop', 'market'],
    keywords: ['wellness', 'yoga', 'workshop', 'volleyball', 'roller derby', 'fitness', 'sports', 'market']
  },
  {
    key: 'nightlife',
    label: 'Nightlife & Adult',
    exact: ['sex party', 'bath house', 'bath house specials', 'drink specials', 'night out', 'leather gear', 'fetish night', 'goth night'],
    keywords: ['sex party', 'bath house', 'drink specials', 'night out', 'fetish', 'leather']
  },
  {
    key: 'access',
    label: 'Age & Access',
    exact: ['18+', '21+', 'all ages'],
    keywords: ['18+', '21+', 'all ages', 'allages', 'accessible', 'free', 'pay what you can']
  },
];

let calendarTagGroups = [];
let calendarFilterMenuBound = false;
let calendarNeighborhoodOptions = [];
let calendarVenueOptions = [];
let calendarOrganizerOptions = [];
let calendarAgeOptions = [];
let calendarPerformerOptions = [];
let pageFilterMenuBound = false;
let venueNeighborhoodOptions = [];
const CALENDAR_COVER_OPTIONS = [
  { key: 'free', label: 'Free' },
  { key: 'paid', label: 'Paid' },
  { key: 'unknown', label: 'Unlisted' },
  { key: 'notaflof', label: 'NOTAFLOF' },
];

function normFilterKey(v) {
  return String(v || '').trim().toLowerCase();
}

function tagLabel(tag) {
  if (TAG_LABELS[tag]) return TAG_LABELS[tag];
  // Title-case anything not in the known list
  return tag.charAt(0).toUpperCase() + tag.slice(1).replace(/-/g, ' ');
}

function tagMatchesKeywords(tag, keywords) {
  return keywords.some(k => tag === k || tag.includes(k));
}

function tagMatchesGroup(tag, def) {
  if (def.exact && def.exact.includes(tag)) return true;
  return tagMatchesKeywords(tag, def.keywords || []);
}

function isAgeTag(tag) {
  const key = normFilterKey(tag);
  return key === 'all ages' || key === 'allages' || /^\d{1,2}\+$/.test(key);
}

function tagGroupIcon(groupKey, label) {
  const key = String(label || groupKey || '').trim().toLowerCase();
  switch (key) {
    case 'music':
    case 'music genres':
    case 'music-genres':
      return ICON_MUSIC;
    case 'performance':
    case 'performances':
      return ICON_PERFORMANCE;
    case 'games':
    case 'game nights':
    case 'game-nights':
      return ICON_GAMES;
    case 'community':
    case 'community events':
    case 'community-events':
      return ICON_COMMUNITY;
    case 'wellness':
    case 'sports':
    case 'sports & wellness':
    case 'sports--wellness':
      return ICON_WELLNESS;
    case 'nightlife':
    case 'adult':
      return ICON_NIGHTLIFE;
    case 'night out':
    case 'nights out':
    case 'night-out':
    case 'nights-out':
      return ICON_NIGHT_OUT;
    case 'access':
    case 'age':
    case 'age restrictions':
    case 'age-restrictions':
      return ICON_AGE;
    case 'charity':
      return ICON_CHARITY;
    case 'food':
    case 'food and drink':
    case 'food-and-drink':
      return ICON_FOOD;
    case 'watch parties':
    case 'watch-parties':
      return ICON_WATCH_PARTIES;
    case 'virtual':
    case 'virtual events':
    case 'virtual-events':
      return ICON_VIRTUAL;
    case 'pride':
    case 'pride events':
    case 'pride-events':
      return ICON_PRIDE;
    case 'holiday':
    case 'holidays':
      return ICON_HOLIDAY;
    case 'education':
      return ICON_EDUCATION;
    case 'other':
      return ICON_OTHER;
    default:
      return ICON_TAG;
  }
}

function tagBadgeIconForTag(tag) {
  try {
    const key = (DATA && DATA.tagGroupMap && DATA.tagGroupMap.get(normFilterKey(tag))) || '';
    return tagGroupIcon(key || 'other');
  } catch (err) {
    return ICON_TAG;
  }
}

function classifyCalendarTags(tags, tagGroupMap = new Map(), groupDefs = []) {
  const sortedTags = [...tags].sort();
  const other = { key: 'other', label: 'Other', tags: [] };

  if (groupDefs && groupDefs.length) {
    const groups = groupDefs.map(def => ({
      key: def.key,
      label: def.label || def.key,
      iconKey: def.iconKey || '',
      tags: [],
    }));
    const groupsByKey = new Map(groups.map(g => [g.key, g]));

    sortedTags.forEach(tag => {
      const tagKey = normFilterKey(tag);
      const groupKey = tagGroupMap.get(tagKey);
      if (groupKey && groupsByKey.has(groupKey)) {
        groupsByKey.get(groupKey).tags.push(tag);
      } else {
        other.tags.push(tag);
      }
    });

    return [...groups.filter(g => g.tags.length), ...(other.tags.length ? [other] : [])];
  }

  const groups = CALENDAR_TAG_GROUP_DEFS.map(def => ({ key: def.key, label: def.label, tags: [] }));

  sortedTags.forEach(tag => {
    const match = CALENDAR_TAG_GROUP_DEFS.find(def => tagMatchesGroup(tag, def));
    if (!match) {
      other.tags.push(tag);
      return;
    }
    const g = groups.find(x => x.key === match.key);
    if (g) g.tags.push(tag);
  });

  return [...groups.filter(g => g.tags.length), ...(other.tags.length ? [other] : [])];
}

function coverBucket(eventItem) {
  const cover = String(eventItem.cover || '').trim().toLowerCase();
  if (!cover) return 'unknown';
  if (cover.includes('free') || cover.includes('pay what you can') || cover.includes('pwyc')) return 'free';
  if (cover.includes('$') || /\d/.test(cover)) return 'paid';
  return 'unknown';
}

function collectFilterOptions(values) {
  const byKey = new Map();
  values.forEach(value => {
    const label = String(value || '').trim();
    if (!label) return;
    const key = normFilterKey(label);
    if (!key || byKey.has(key)) return;
    byKey.set(key, label);
  });
  return [...byKey.entries()]
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function filterAllIconForLabel(label) {
  switch (String(label || '').trim().toLowerCase()) {
    case 'all events': return ICON_FILTER_ALL_EVENTS;
    case 'all neighborhoods': return ICON_FILTER_ALL_NEIGHBORHOODS;
    case 'all organizers': return PROMOTER_BADGE_ICON;
    case 'all venues': return ICON_FILTER_ALL_VENUES;
    case 'all ages': return ICON_FILTER_ALL_AGES;
    case 'all cover types': return ICON_FILTER_ALL_COVER_TYPES;
    case 'all performers': return ICON_PERFORMER;
    case 'all venue types': return ICON_FILTER_ALL_VENUES;
    case 'all residency types': return ICON_FILTER_ALL_EVENTS;
    case 'all djs': return ICON_MUSIC;
    default: return ICON_FILTER_ALL_EVENTS;
  }
}

function buildSimpleCalendarMenu(menuId, allLabel, allCheckId, optionClass, options, toggleOptionFnName, toggleAllFnName) {
  const menu = document.getElementById(menuId);
  if (!menu) return;

  menu.innerHTML = `
    <div class="cal-filter-all-line">
      <label class="cal-filter-option cal-filter-all-option">
        <input type="checkbox" id="${allCheckId}" onchange="${toggleAllFnName}(this.checked)">
        <span class="cal-filter-group-icon" data-filter-label="${escHtml(allLabel)}">${filterAllIconForLabel(allLabel)}</span><span>${escHtml(allLabel)}</span>
      </label>
    </div>
    <div class="cal-filter-group">
      <div class="cal-filter-options">
        ${options.map(opt => `
          <label class="cal-filter-option">
            <input type="checkbox" class="${optionClass}" data-key="${escHtml(opt.key)}" onchange="${toggleOptionFnName}('${encodeURIComponent(opt.key)}', this.checked)">
            <span>${escHtml(opt.label)}</span>
          </label>
        `).join('')}
      </div>
    </div>`;
}

function buildFilterChips() {
  const menu = document.getElementById('calendarFilterMenu');
  if (!menu) return;

  calendarAgeOptions = collectFilterOptions(DATA.events.map(e => e.age).filter(Boolean));

  // Collect all unique tags across all events
  const tagSet = new Set();
  DATA.events.forEach(e => e.tags.forEach(t => tagSet.add(t)));

  // Ensure NOTAFLOF and age-related tags are only handled by their own filters
  [...tagSet].forEach(t => {
    const key = normFilterKey(t);
    if (key === 'notaflof' || isAgeTag(t)) tagSet.delete(t);
  });

  calendarNeighborhoodOptions = collectFilterOptions(DATA.events.map(e => e.location));
  calendarVenueOptions = collectFilterOptions(DATA.events.map(e => e.venue));
  calendarOrganizerOptions = collectFilterOptions(DATA.events.flatMap(e => e.promoters || []));
  calendarPerformerOptions = collectFilterOptions(DATA.events.flatMap(e => e.performers || []));

  calendarTagGroups = classifyCalendarTags([...tagSet], DATA.tagGroupMap, DATA.tagGroups);

  // Ensure pride events, then music group appears first in the filter list
  calendarTagGroups.sort((a,b) => {
    if (a.key === 'pride-events') return -1;
    if (b.key === 'pride-events') return 1;
    if (a.key === 'music-genres') return -1;
    if (b.key === 'music-genres') return 1;

    return 0;
  });

  menu.innerHTML = `
    <div class="cal-filter-all-line">
      <label class="cal-filter-option cal-filter-all-option">
        <input type="checkbox" id="calendarFilterAllCheck" onchange="toggleCalendarAll(this.checked)">
        <span class="cal-filter-group-icon">${filterAllIconForLabel('All events')}</span><span>All events</span>
      </label>
    </div>
  ` + calendarTagGroups.map(group => `
    <div class="cal-filter-group">
      <label class="cal-filter-group-title">
        <input type="checkbox" class="cal-group-check" data-group="${escHtml(group.key)}" onchange="toggleCalendarGroup('${escHtml(group.key)}', this.checked)">
        <span class="cal-filter-group-icon">${tagGroupIcon(group.key, group.label)}</span>
        ${escHtml(group.label)}
      </label>
      <div class="cal-filter-options">
        ${group.tags.map(tag => `
          <label class="cal-filter-option">
            <input type="checkbox" class="cal-tag-check" data-tag="${escHtml(tag)}" onchange="toggleCalendarTag('${encodeURIComponent(tag)}', this.checked)">
            <span>${escHtml(tagLabel(tag))}</span>
          </label>
        `).join('')}
      </div>
    </div>
  `).join('');

  buildSimpleCalendarMenu(
    'calendarNeighborhoodMenu',
    'All neighborhoods',
    'calendarNeighborhoodAllCheck',
    'cal-neighborhood-check',
    calendarNeighborhoodOptions,
    'toggleCalendarNeighborhood',
    'toggleCalendarNeighborhoodAll'
  );

  buildSimpleCalendarMenu(
    'calendarOrganizerMenu',
    'All organizers',
    'calendarOrganizerAllCheck',
    'cal-organizer-check',
    calendarOrganizerOptions,
    'toggleCalendarOrganizer',
    'toggleCalendarOrganizerAll'
  );

  buildSimpleCalendarMenu(
    'calendarVenueMenu',
    'All venues',
    'calendarVenueAllCheck',
    'cal-venue-check',
    calendarVenueOptions,
    'toggleCalendarVenue',
    'toggleCalendarVenueAll'
  );

  buildSimpleCalendarMenu(
    'calendarAgeMenu',
    'All ages',
    'calendarAgeAllCheck',
    'cal-age-check',
    calendarAgeOptions,
    'toggleCalendarAge',
    'toggleCalendarAgeAll'
  );

  buildSimpleCalendarMenu(
    'calendarCoverMenu',
    'All cover types',
    'calendarCoverAllCheck',
    'cal-cover-check',
    CALENDAR_COVER_OPTIONS,
    'toggleCalendarCover',
    'toggleCalendarCoverAll'
  );

  buildSimpleCalendarMenu(
    'calendarPerformerMenu',
    'All performers',
    'calendarPerformerAllCheck',
    'cal-performer-check',
    calendarPerformerOptions,
    'toggleCalendarPerformer',
    'toggleCalendarPerformerAll'
  );

  if (!calendarFilterMenuBound) {
    document.addEventListener('click', (event) => {
      document.querySelectorAll('.calendar-filter-wrap.open').forEach(wrap => {
        if (!wrap.contains(event.target)) wrap.classList.remove('open');
      });
      syncCalendarMenuToggleState();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        document.querySelectorAll('.calendar-filter-wrap.open').forEach(wrap => wrap.classList.remove('open'));
        syncCalendarMenuToggleState();
      }
    });
    window.addEventListener('resize', () => {
      document.querySelectorAll('.calendar-filter-wrap.open').forEach(wrap => positionCalendarMenu(wrap));
    });
    calendarFilterMenuBound = true;
  }

  syncCalendarFilterUI();
  updateCalendarFilterSummary();
}

function syncCalendarMenuToggleState() {
  const map = [
    ['calendarFilterWrap', 'calendarFilterToggle'],
    ['calendarNeighborhoodWrap', 'calendarNeighborhoodToggle'],
    ['calendarVenueWrap', 'calendarVenueToggle'],
    ['calendarOrganizerWrap', 'calendarOrganizerToggle'],
    ['calendarAgeWrap', 'calendarAgeToggle'],
    ['calendarCoverWrap', 'calendarCoverToggle'],
    ['calendarPerformerWrap', 'calendarPerformerToggle'],
  ];

  map.forEach(([wrapId, toggleId]) => {
    const wrap = document.getElementById(wrapId);
    const toggle = document.getElementById(toggleId);
    if (!toggle) return;
    toggle.classList.toggle('is-open', !!wrap?.classList.contains('open'));
  });
}

function renderCalendarToggleContent(toggle, label, count) {
  if (!toggle) return;
  const badgeText = count === 0 ? 'All' : String(count);
  toggle.innerHTML = `<span class="calendar-toggle-label">${escHtml(label)}</span><span class="calendar-toggle-badge">${escHtml(badgeText)}</span><span class="calendar-toggle-chevron">${CALENDAR_FILTER_CHEVRON_ICON}</span>`;
}

function setCalFilter() {
  syncCalendarFilterUI();
  updateCalendarFilterSummary();
  renderEvents();
}

function toggleCalendarFilterMenu(toggleEl) {
  toggleCalendarMenuWrap('calendarFilterWrap', toggleEl);
}

function toggleCalendarNeighborhoodMenu(toggleEl) {
  toggleCalendarMenuWrap('calendarNeighborhoodWrap', toggleEl);
}

function toggleCalendarVenueMenu(toggleEl) {
  toggleCalendarMenuWrap('calendarVenueWrap', toggleEl);
}

function toggleCalendarOrganizerMenu(toggleEl) {
  toggleCalendarMenuWrap('calendarOrganizerWrap', toggleEl);
}

function toggleCalendarCoverMenu(toggleEl) {
  toggleCalendarMenuWrap('calendarCoverWrap', toggleEl);
}

function toggleCalendarAgeMenu(toggleEl) {
  toggleCalendarMenuWrap('calendarAgeWrap', toggleEl);
}

function toggleCalendarPerformerMenu(toggleEl) {
  toggleCalendarMenuWrap('calendarPerformerWrap', toggleEl);
}

function toggleCalendarMenuWrap(wrapId, toggleEl) {
  const target = document.getElementById(wrapId);
  if (!target) return;
  const shouldOpen = !target.classList.contains('open');

  document.querySelectorAll('.calendar-filter-wrap.open').forEach(wrap => {
    if (wrap.id !== wrapId) wrap.classList.remove('open');
  });

  target.classList.toggle('open', shouldOpen);
  syncCalendarMenuToggleState();
  if (shouldOpen) {
    requestAnimationFrame(() => positionCalendarMenu(wrapId, toggleEl));
  }
}

function positionCalendarMenu(wrapId, toggleEl) {
  const wrap = document.getElementById(wrapId);
  if (!wrap) return;
  const menu = wrap.querySelector('.calendar-filter-menu');
  if (!menu) return;

  const viewportPad = 8;
  const isMobile = window.innerWidth <= 640;
  const toggle = toggleEl || wrap.querySelector('.calendar-filter-toggle');
  const wrapRect = wrap.getBoundingClientRect();

  menu.style.position = 'absolute';
  menu.style.transform = '';
  menu.style.width = '';
  menu.style.maxHeight = isMobile ? '60vh' : '420px';
  menu.style.left = '0px';
  menu.style.right = 'auto';

  if (toggle) {
    const offsetTop = toggle.offsetTop + toggle.offsetHeight - 1;
    menu.style.top = `${offsetTop}px`;
  } else {
    menu.style.top = 'calc(100% - 1px)';
  }

  let rect = menu.getBoundingClientRect();
  const menuWidth = rect.width;

  const desiredLeft = (wrapRect.width / 2) - (menuWidth / 2);
  const minLeft = viewportPad - wrapRect.left;
  const maxLeft = (window.innerWidth - viewportPad) - wrapRect.left - menuWidth;
  const clampedLeft = Math.min(maxLeft, Math.max(minLeft, desiredLeft));

  menu.style.left = `${clampedLeft}px`;
  rect = menu.getBoundingClientRect();

  if (rect.left < viewportPad) {
    menu.style.left = `${viewportPad - wrapRect.left}px`;
  } else if (rect.right > window.innerWidth - viewportPad) {
    menu.style.left = `${(window.innerWidth - viewportPad) - wrapRect.left - menuWidth}px`;
  }
}

/* ── Collapse calendar filters (calendar page) ── */
let calendarFiltersCollapsed = false;
function toggleCalendarFiltersCollapse() {
  const el = document.getElementById('calendarFilters');
  if (!el) return;
  calendarFiltersCollapsed = !calendarFiltersCollapsed;
  el.classList.toggle('collapsed', calendarFiltersCollapsed);
  const btn = document.getElementById('calendarFiltersToggle');
  if (btn) btn.textContent = calendarFiltersCollapsed ? 'Show' : 'Hide';
  // Close any open menus when collapsing
  if (calendarFiltersCollapsed) {
    document.querySelectorAll('.calendar-filter-wrap.open').forEach(wrap => wrap.classList.remove('open'));
    syncCalendarMenuToggleState();
  }
}

function toggleCalendarTag(encodedTag, checked) {
  const tag = decodeURIComponent(encodedTag || '');
  if (!tag) return;

  if (checked) state.calFilters.add(tag);
  else state.calFilters.delete(tag);

  syncCalendarFilterUI();
  updateCalendarFilterSummary();
  renderEvents();
}

function toggleCalendarAll(checked) {
  if (!checked) {
    syncCalendarFilterUI();
    return;
  }
  state.calFilters.clear();
  syncCalendarFilterUI();
  updateCalendarFilterSummary();
  renderEvents();
}

function toggleCalendarNeighborhood(encodedKey, checked) {
  const key = decodeURIComponent(encodedKey || '');
  if (!key) return;
  if (checked) state.calNeighborhoods.add(key);
  else state.calNeighborhoods.delete(key);
  syncCalendarFilterUI();
  updateCalendarFilterSummary();
  renderEvents();
}

function toggleCalendarNeighborhoodAll(checked) {
  if (!checked) {
    syncCalendarFilterUI();
    return;
  }
  state.calNeighborhoods.clear();
  syncCalendarFilterUI();
  updateCalendarFilterSummary();
  renderEvents();
}

function toggleCalendarVenue(encodedKey, checked) {
  const key = decodeURIComponent(encodedKey || '');
  if (!key) return;
  if (checked) state.calVenues.add(key);
  else state.calVenues.delete(key);
  syncCalendarFilterUI();
  updateCalendarFilterSummary();
  renderEvents();
}

function toggleCalendarVenueAll(checked) {
  if (!checked) {
    syncCalendarFilterUI();
    return;
  }
  state.calVenues.clear();
  syncCalendarFilterUI();
  updateCalendarFilterSummary();
  renderEvents();
}

function toggleCalendarOrganizer(encodedKey, checked) {
  const key = decodeURIComponent(encodedKey || '');
  if (!key) return;
  if (checked) state.calOrganizers.add(key);
  else state.calOrganizers.delete(key);
  syncCalendarFilterUI();
  updateCalendarFilterSummary();
  renderEvents();
}

function toggleCalendarOrganizerAll(checked) {
  if (!checked) {
    syncCalendarFilterUI();
    return;
  }
  state.calOrganizers.clear();
  syncCalendarFilterUI();
  updateCalendarFilterSummary();
  renderEvents();
}

function toggleCalendarCover(encodedKey, checked) {
  const key = decodeURIComponent(encodedKey || '');
  if (!key) return;
  if (checked) state.calCovers.add(key);
  else state.calCovers.delete(key);
  syncCalendarFilterUI();
  updateCalendarFilterSummary();
  renderEvents();
}

function toggleCalendarAge(encodedKey, checked) {
  const key = decodeURIComponent(encodedKey || '');
  if (!key) return;
  if (checked) state.calAges.add(normFilterKey(key));
  else state.calAges.delete(normFilterKey(key));
  syncCalendarFilterUI();
  updateCalendarFilterSummary();
  renderEvents();
}

function toggleCalendarAgeAll(checked) {
  if (!checked) {
    syncCalendarFilterUI();
    return;
  }
  state.calAges.clear();
  syncCalendarFilterUI();
  updateCalendarFilterSummary();
  renderEvents();
}

function toggleCalendarCoverAll(checked) {
  if (!checked) {
    syncCalendarFilterUI();
    return;
  }
  state.calCovers.clear();
  syncCalendarFilterUI();
  updateCalendarFilterSummary();
  renderEvents();
}

function toggleCalendarPerformer(encodedKey, checked) {
  const key = decodeURIComponent(encodedKey || '');
  if (!key) return;
  if (checked) state.calPerformers.add(key);
  else state.calPerformers.delete(key);
  syncCalendarFilterUI();
  updateCalendarFilterSummary();
  renderEvents();
}

function toggleCalendarPerformerAll(checked) {
  if (!checked) {
    syncCalendarFilterUI();
    return;
  }
  state.calPerformers.clear();
  syncCalendarFilterUI();
  updateCalendarFilterSummary();
  renderEvents();
}

function toggleCalendarGroup(groupKey, checked) {
  const group = calendarTagGroups.find(g => g.key === groupKey);
  if (!group) return;

  group.tags.forEach(tag => {
    if (checked) state.calFilters.add(tag);
    else state.calFilters.delete(tag);
  });

  syncCalendarFilterUI();
  updateCalendarFilterSummary();
  renderEvents();
}

function syncCalendarFilterUI() {
  const allCheck = document.getElementById('calendarFilterAllCheck');
  if (allCheck) {
    allCheck.checked = state.calFilters.size === 0;
    allCheck.indeterminate = false;
  }

  document.querySelectorAll('#calendarFilterMenu .cal-tag-check').forEach(input => {
    const tag = input.dataset.tag || '';
    input.checked = state.calFilters.has(tag);
  });

  document.querySelectorAll('#calendarFilterMenu .cal-group-check').forEach(input => {
    const key = input.dataset.group;
    const group = calendarTagGroups.find(g => g.key === key);
    if (!group || !group.tags.length) {
      input.checked = false;
      input.indeterminate = false;
      return;
    }
    const selectedCount = group.tags.filter(tag => state.calFilters.has(tag)).length;
    input.checked = selectedCount === group.tags.length;
    input.indeterminate = selectedCount > 0 && selectedCount < group.tags.length;
  });

  const syncSimple = (allCheckId, optionSelector, selectedSet) => {
    const all = document.getElementById(allCheckId);
    if (all) {
      all.checked = selectedSet.size === 0;
      all.indeterminate = false;
    }
    document.querySelectorAll(optionSelector).forEach(input => {
      const key = input.dataset.key || '';
      input.checked = selectedSet.has(key);
    });
  };

  syncSimple('calendarNeighborhoodAllCheck', '#calendarNeighborhoodMenu .cal-neighborhood-check', state.calNeighborhoods);
  syncSimple('calendarVenueAllCheck', '#calendarVenueMenu .cal-venue-check', state.calVenues);
  syncSimple('calendarOrganizerAllCheck', '#calendarOrganizerMenu .cal-organizer-check', state.calOrganizers);
  syncSimple('calendarAgeAllCheck', '#calendarAgeMenu .cal-age-check', state.calAges);
  syncSimple('calendarCoverAllCheck', '#calendarCoverMenu .cal-cover-check', state.calCovers);
  syncSimple('calendarPerformerAllCheck', '#calendarPerformerMenu .cal-performer-check', state.calPerformers);
}

function updateCalendarFilterSummary() {
  const toggle = document.getElementById('calendarFilterToggle');
  const neighborhoodToggle = document.getElementById('calendarNeighborhoodToggle');
  const venueToggle = document.getElementById('calendarVenueToggle');
  const organizerToggle = document.getElementById('calendarOrganizerToggle');
  const ageToggle = document.getElementById('calendarAgeToggle');
  const coverToggle = document.getElementById('calendarCoverToggle');
  const performerToggle = document.getElementById('calendarPerformerToggle');
  if (!toggle) return;

  renderCalendarToggleContent(toggle, 'Event types', state.calFilters.size);
  if (neighborhoodToggle) renderCalendarToggleContent(neighborhoodToggle, 'Neighborhood', state.calNeighborhoods.size);
  if (venueToggle) renderCalendarToggleContent(venueToggle, 'Venues', state.calVenues.size);
  if (organizerToggle) renderCalendarToggleContent(organizerToggle, 'Organizers', state.calOrganizers.size);
  if (coverToggle) renderCalendarToggleContent(coverToggle, 'Cover', state.calCovers.size);
  if (performerToggle) renderCalendarToggleContent(performerToggle, 'Performers', state.calPerformers.size);
  if (neighborhoodToggle) renderCalendarToggleContent(neighborhoodToggle, 'Neighborhood', state.calNeighborhoods.size);
  if (venueToggle) renderCalendarToggleContent(venueToggle, 'Venues', state.calVenues.size);
  if (organizerToggle) renderCalendarToggleContent(organizerToggle, 'Organizers', state.calOrganizers.size);
  if (ageToggle) renderCalendarToggleContent(ageToggle, 'Ages', state.calAges.size);
  if (coverToggle) renderCalendarToggleContent(coverToggle, 'Cover', state.calCovers.size);
  if (performerToggle) renderCalendarToggleContent(performerToggle, 'Performers', state.calPerformers.size);
  syncCalendarMenuToggleState();
}

function getCalendarRenderData() {
  const today = new Date();
  today.setHours(0,0,0,0);

  let events = DATA.events.filter(e => !!e.date);

  if (state.calFilters.size) {
    const selectedTags = [...state.calFilters];
    events = events.filter(e => selectedTags.some(tag => e.tags.includes(tag)));
  }

  if (state.calAges.size) {
    events = events.filter(e => {
      const age = normFilterKey(e.age || '');
      return state.calAges.has(age);
    });
  }

  if (state.calNeighborhoods.size) {
    events = events.filter(e => state.calNeighborhoods.has(normFilterKey(e.location)));
  }

  if (state.calVenues.size) {
    events = events.filter(e => state.calVenues.has(normFilterKey(e.venue)));
  }

  if (state.calOrganizers.size) {
    events = events.filter(e => (e.promoters || []).some(p => state.calOrganizers.has(normFilterKey(p))));
  }

  if (state.calCovers.size) {
    events = events.filter(e => {
      // Match by cover bucket (free/paid/unknown)
      const bucket = coverBucket(e);
      if (state.calCovers.has(bucket)) return true;
      // Special-case: NOTAFLOF is represented as a tag on events
      if (state.calCovers.has('notaflof') && (e.tags || []).includes('notaflof')) return true;
      return false;
    });
  }

  if (state.calPerformers.size) {
    events = events.filter(e => (e.performers || []).some(p => state.calPerformers.has(normFilterKey(p))));
  }

  if (!calendarViewDate) {
    calendarViewDate = new Date(today.getFullYear(), today.getMonth(), 1);
  }

  if (!calendarSelectedDate) {
    calendarSelectedDate = toYMD(today);
  }

  const year = calendarViewDate.getFullYear();
  const month = calendarViewDate.getMonth();
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);

  const byDate = {};
  events.forEach(e => {
    if (!byDate[e.date]) byDate[e.date] = [];
    byDate[e.date].push(e);
  });

  Object.keys(byDate).forEach(ymd => {
    byDate[ymd].sort((a, b) => eventToMinutes(a) - eventToMinutes(b));
  });

  const firstCell = new Date(monthStart);
  firstCell.setDate(monthStart.getDate() - monthStart.getDay());

  const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekdayRow = `<div class="cal-weekdays">${weekdayNames.map(w => `<div>${w}</div>`).join('')}</div>`;

  const dayCells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(firstCell);
    d.setDate(firstCell.getDate() + i);
    const ymd = toYMD(d);
    const inMonth = d.getMonth() === month;
    const count = (byDate[ymd] || []).length;
    const isSelected = ymd === calendarSelectedDate;
    const isToday = ymd === toYMD(today);
    const classes = [
      'cal-day',
      inMonth ? 'in-month' : 'out-month',
      count ? 'has-events' : '',
      isSelected ? 'is-selected' : '',
      isToday ? 'is-today' : '',
    ].filter(Boolean).join(' ');

    const click = inMonth ? `onclick="selectCalendarDate('${ymd}')"` : '';
    const countLabel = `${count} event${count !== 1 ? 's' : ''}`;

    dayCells.push(`<button class="${classes}" ${click} ${inMonth ? '' : 'disabled'}>
      <span class="cal-day-num">${d.getDate()}</span>
      ${count ? `<span class="cal-day-count" title="${countLabel}" aria-label="${countLabel}">${count}</span>` : '<span class="cal-day-empty">&nbsp;</span>'}
    </button>`);
  }

  const selectedEvents = calendarSelectedDate ? (byDate[calendarSelectedDate] || []) : [];
  const selectedTitle = calendarSelectedDate
    ? new Date(calendarSelectedDate + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : 'No day selected';
  const selectedCountLabel = calendarSelectedDate
    ? `${selectedEvents.length} event${selectedEvents.length !== 1 ? 's' : ''}`
    : 'Click a day to view events';

  return {
    today,
    byDate,
    year,
    month,
    monthStart,
    monthEnd,
    weekdayRow,
    dayCells,
    selectedEvents,
    selectedTitle,
    selectedCountLabel,
  };
}

function renderCalendarGrid(data) {
  const leftWrap = document.getElementById('calendarViewWrap');
  const shell = document.querySelector('#calendarMainView .calendar-shell');
  const sidebarToggle = document.getElementById('calendarSidebarToggle');
  if (!leftWrap) return;

  if (shell) shell.classList.toggle('sidebar-collapsed', !calendarSidebarOpen);
  if (sidebarToggle) {
    const actionLabel = calendarSidebarOpen ? 'Hide calendar' : 'Show calendar';
    sidebarToggle.setAttribute('aria-label', actionLabel);
    sidebarToggle.setAttribute('title', actionLabel);
    sidebarToggle.innerHTML = calendarSidebarOpen ? CALENDAR_TOGGLE_ICON_HIDE : CALENDAR_TOGGLE_ICON_SHOW;
  }

  const today = new Date();
  leftWrap.innerHTML = `
    <div class="calendar-layout">
      <div class="calendar-month-wrap">
        <div class="calendar-toolbar">
          <button class="cal-nav-btn" onclick="changeCalendarMonth(-1)">&#8592;</button>
          <div class="cal-month-label">${calendarViewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
          <button class="cal-nav-btn" onclick="changeCalendarMonth(1)">&#8594;</button>
        </div>
        ${data.weekdayRow}
        <div class="cal-grid">${data.dayCells.join('')}</div>
      </div>
    </div>`;
}

function renderCalendarSelectionPane(data) {
  const rightWrap = document.getElementById('calendarEventsWrap');
  if (!rightWrap) return;

  rightWrap.innerHTML = `
    <div class="cal-selected-wrap">
      <div class="cal-selected-hero">
        <div class="cal-selected-head">
          <div>
            <div class="cal-selected-kicker">Selected day</div>
            <div class="cal-selected-title">${escHtml(data.selectedTitle)}</div>
            <div class="cal-selected-meta">${escHtml(data.selectedCountLabel)}</div>
          </div>
        </div>
      </div>
      <div class="cal-selected-body">
        ${calendarSelectedDate && data.selectedEvents.length
          ? data.selectedEvents.map(e => eventCardHTML(e)).join('')
          : `<div class="empty-state" style="padding:1.5rem 1rem"><div class="empty-sub">Click a day to view events</div></div>`}
      </div>
    </div>`;
}

function renderEvents() {
  const data = getCalendarRenderData();
  renderCalendarGrid(data);
  renderCalendarSelectionPane(data);
  updateCalendarFilterSummary();
}

function eventToMinutes(e) {
  const m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(e.time || '');
  if (!m) return 9999;
  let h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if ((e.ampm || '').toUpperCase() === 'PM' && h !== 12) h += 12;
  if ((e.ampm || '').toUpperCase() === 'AM' && h === 12) h = 0;
  return h * 60 + mm;
}

function toYMD(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function changeCalendarMonth(delta) {
  const base = calendarViewDate || new Date();
  calendarViewDate = new Date(base.getFullYear(), base.getMonth() + delta, 1);
  renderCalendarGrid(getCalendarRenderData());
}

function selectCalendarDate(ymd) {
  calendarSelectedDate = ymd;
  calendarSelectedExplicit = true;
  renderEvents();
}

function toggleCalendarSidebar() {
  calendarSidebarOpen = !calendarSidebarOpen;
  renderEvents();
}

function eventCardHTML(e) {
  const perfPills = e.performers.map(p =>
    `<span class="eperf" onclick="event.stopPropagation();goToPerformer('${escHtml(p)}')">${ICON_PERFORMER}${escHtml(p)}</span>`
  ).join('');
  const djPills = e.djs.map(d => djBadgePill(d)).join('');
  const barPills = e.bartenders.map(b => bartenderBadgePill(b)).join('');
  const promoterPills = e.promoters.map(p => promoterBadgePill(p)).join('');
  const beneficiaryLine = e.beneficiary
    ? `<div class="ebeneficiary">Benefiting: ${escHtml(e.beneficiary)}</div>`
    : '';

  const isFree = !e.ticketUrl && (!e.cover || e.cover.toLowerCase().includes('free') || e.cover === '');
  const ticketBtn = e.ticketUrl
    ? `<a href="${escHtml(e.ticketUrl)}" target="_blank" rel="noopener" onclick="event.stopPropagation()"><button class="ticket-btn">Tickets</button></a>`
    : '';

  let coverLabel = '';
  if (e.cover) {
    let cov = String(e.cover || '').trim();
    cov = cov.replace(/pay what you can/i, 'PWYC');
    if (cov.length > 22) cov = cov.slice(0, 19) + '…';
    coverLabel = `<span class="ecover">${escHtml(cov)}</span>`;
  }

  const thumbnail = e.flierUrl
    ? `<div class="eflier-thumb" onclick="event.stopPropagation();showEventDetail('${escHtml(String(e.id))}')">
        <img src="${escHtml(e.flierUrl)}" alt="Flyer for ${escHtml(e.name)}" loading="lazy">
        <div class="eflier-hint">View flyer</div>
       </div>`
    : '<div class="eflier-thumb-placeholder">No flyer</div>';

  const tagBadges = [
    e.vibe ? `<span class="etag etag-vibe">${escHtml(e.vibe)}</span>` : '',
    ...(e.tags || []).filter(tag => !isAgeTag(tag)).map(tag => `<span class="etag etag-type">${tagBadgeIconForTag(tag)}${escHtml(tagLabel(tag))}</span>`),
    e.age ? ageBadge(e.age) : ''
  ].filter(Boolean).join('');

  const venueLine = e.venue
    ? `<div class="evenue"><button type="button" class="event-card-venue-link" onclick="event.stopPropagation();showVenueDetail('${escHtml(e.venue)}')">${escHtml(e.venue)}</button><span>· ${escHtml(e.location)}</span></div>`
    : `<div class="evenue">${escHtml(e.location)}</div>`;

  return `<div class="event-card" onclick="showEventDetail('${escHtml(String(e.id))}')">
    <div class="event-media">${thumbnail}</div>
    <div class="event-main">
      <div class="ename">${escHtml(e.name)}</div>
      ${venueLine}
      ${tagBadges ? `<div class="etags">${tagBadges}</div>` : ''}
      ${perfPills     ? `<div class="eperfs">${perfPills}</div>`         : ''}
      ${djPills       ? `<div class="edjs">${djPills}</div>`             : ''}
      ${barPills      ? `<div class="ebars">${barPills}</div>`           : ''}
      ${promoterPills ? `<div class="epromoters">${promoterPills}</div>` : ''}
      ${beneficiaryLine}
    </div>
    <div class="event-side">
      <div class="etime">${escHtml(e.time)}<span class="etime-ampm">${escHtml(e.ampm)}</span></div>
      <div class="event-side-bottom">
        ${coverLabel}
        ${ticketBtn}
      </div>
    </div>
  </div>`;
}

/* ── EVENT DETAIL PAGE ── */
function showEventDetail(eventId, pushState = true) {
  // Match by string or number id
  const e = DATA.events.find(ev => String(ev.id) === String(eventId));
  if (!e) return;

  showPage('calendar', null, false);

  const perfPills = e.performers.map(p =>
    `<span class="eperf" onclick="goToPerformer('${escHtml(p)}')">${ICON_PERFORMER}${escHtml(p)}</span>`
  ).join('');
  const djPills = e.djs.map(d => djBadgePill(d)).join('');
  const barPills = e.bartenders.map(b => bartenderBadgePill(b)).join('');
  const promoterPills = e.promoters.map(p => promoterBadgePill(p)).join('');

  const isFreeDetail = !e.ticketUrl && (!e.cover || e.cover.toLowerCase().includes('free') || e.cover === '');
  const ticketBtn = e.ticketUrl
    ? `<a href="${escHtml(e.ticketUrl)}" target="_blank" rel="noopener"><button class="ticket-btn" style="font-size:12px;padding:10px 20px">Get tickets</button></a>`
    : '';

  const flierSection = e.flierUrl
    ? `<div class="event-detail-flier detail-avatar">
        <img src="${escHtml(e.flierUrl)}" alt="Flyer for ${escHtml(e.name)}">
       </div>`
    : '';

  const venueLink = e.venue ? `<button type="button" class="event-detail-venue-link" onclick="showVenueDetail('${escHtml(e.venue)}')">${escHtml(e.venue)}</button>` : escHtml(e.venue);

  const content = `
    <div class="back-btn" onclick="backToCalendar()">&#8592; Back to calendar</div>

    <div class="event-detail-wrap">
      ${flierSection}
      <div class="event-detail-info">
        <div class="event-detail-date">${escHtml(e.day)}, ${escHtml(e.month)} ${escHtml(e.dateNum)}</div>
        <div class="event-detail-name">${escHtml(e.name)}</div>
        <div class="event-detail-venue">${venueLink} <span>· ${escHtml(e.location)}</span></div>

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

        ${(() => {
          const detailTags = [
            e.vibe ? `<span class="etag etag-vibe">${escHtml(e.vibe)}</span>` : '',
            ...(e.tags || []).filter(tag => !isAgeTag(tag)).map(tag => `<span class="etag etag-type">${tagBadgeIconForTag(tag)}${escHtml(tagLabel(tag))}</span>`)
          ].filter(Boolean).join('');
          return detailTags ? `<div class="etags" style="margin-bottom:1.5rem">${detailTags}</div>` : '';
        })()}

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
  if (pushState) updatePageHistory('calendar', false, { event: String(eventId) });
  window.scrollTo(0, 0);
}

function backToCalendar() {
  if (window.history && window.history.state && window.history.state.event) {
    window.history.back();
    return;
  }
  document.getElementById('calendarMainView').style.display = 'block';
  document.getElementById('eventDetailView').style.display = 'none';
  window.scrollTo(0, 0);
}

/* ── SHARED: social links ── */
function socialIconForKey(key) {
  switch (key) {
    case 'instagram': return ICON_INSTAGRAM;
    case 'tiktok': return ICON_TIKTOK;
    case 'facebook': return ICON_FACEBOOK;
    case 'youtube': return ICON_YOUTUBE;
    case 'linktree': return ICON_LINK;
    case 'website': return ICON_WEBSITE;
    default: return ICON_TAG;
  }
}

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
      '<a href="' + escHtml(l.url) + '" target="_blank" rel="noopener" class="social-link-btn" style="' + btnStyle + '">' + socialIconForKey(l.key) + escHtml(l.label) + '</a>'
    ).join('') +
  '</div>';
}

/* ── SHARED: profile photo or avatar ── */
function profilePhotoHTML(person, size) {
  size = size || '110px';
  var avClass = avatarClass(person.avatarColor);
  if (person.photoUrl) {
    return '<div class="p-photo" style="width:' + size + ';height:' + size + ';border-radius:12px;overflow:hidden;flex-shrink:0;border:1px solid var(--border2)">' +
      '<img src="' + escHtml(person.photoUrl) + '" alt="' + escHtml(person.name) + '" style="width:100%;height:100%;object-fit:contain;object-position:center;display:block" loading="lazy">' +
      '</div>';
  }
  return '<div class="p-avatar ' + avClass + '" style="width:' + size + ';height:' + size + ';font-size:' + Math.round(parseInt(size)*0.35) + 'px">' + escHtml(person.initials) + '</div>';
}

function venuePhotoHTML(venue) {
  if (venue.photoUrl) {
    return '<div class="venue-banner venue-banner-photo" style="height:120px;overflow:hidden">' +
      '<img src="' + escHtml(venue.photoUrl) + '" alt="' + escHtml(venue.name) + '" style="width:100%;height:100%;object-fit:contain;object-position:center;display:block" loading="lazy">' +
      '</div>';
  }
  var initials = venue.name.split(' ').map(function(w){return w[0];}).join('').slice(0,3).toUpperCase();
  return '<div class="venue-banner ' + venue.bannerStyle + '">' + initials + '</div>';
}

/* ── PERFORMERS ── */
let perfFilterState = { tags: new Set() };
let peopleVenueFilter = new Set();

function performerRoleList(p) {
  return String(p.role || '')
    .split(/[,|]/)
    .map(r => r.trim().toLowerCase())
    .filter(Boolean);
}

function buildPerformerChips() {
  const menu = document.getElementById('perfFilterMenu');
  if (!menu) return;
  const tagSet = new Set();
  DATA.performers.forEach(p => (p.tags || []).forEach(t => tagSet.add(t)));
  const preferred = ['drag', 'burlesque', 'comedy', 'singer', 'dancer', 'host', 'emcee'];
  const known = preferred.filter(t => tagSet.has(t));
  const unknown = [...tagSet].filter(t => !preferred.includes(t)).sort();
  const allTags = [...known, ...unknown];

  menu.innerHTML = `
    <div class="cal-filter-group">
      <div class="cal-filter-group-title">
        <label class="cal-filter-option cal-filter-all-option">
          <input type="checkbox" id="perfAllCheck" onchange="togglePerformerAll(this.checked)">
          <span class="cal-filter-group-icon">${ICON_PERFORMER}</span><span>All performers</span>
        </label>
      </div>
    </div>
    ${allTags.length ? `
      <div class="cal-filter-group">
        <div class="cal-filter-group-title">
          <label class="cal-filter-option cal-filter-all-option">
            <input type="checkbox" id="perfTagAllCheck" onchange="togglePerformerTagAll(this.checked)">
            <span class="cal-filter-group-icon">${ICON_TAG}</span><span>All tags</span>
          </label>
        </div>
        <div class="cal-filter-options" style="grid-template-columns:1fr;">
          ${allTags.map(tag => `<label class="cal-filter-option"><input type="checkbox" class="perf-tag-check" data-key="${escHtml(tag)}" onchange="togglePerformerTag('${encodeURIComponent(tag)}', this.checked)"><span>${escHtml(tag.charAt(0).toUpperCase() + tag.slice(1))}</span></label>`).join('')}
        </div>
      </div>
    ` : ''}
  `;

  syncPerfFilterUI();
}

function buildPeopleVenueMenu() {
  const allVenues = [...new Set(DATA.venues.map(v => v.name).filter(Boolean))].sort((a,b) => a.localeCompare(b));
  const menuHtml = `
    <div class="cal-filter-group">
      <div class="cal-filter-all-line">
        <label class="cal-filter-option cal-filter-all-option">
          <input type="checkbox" id="peopleVenueAllCheck" checked onchange="togglePeopleVenueAll(this.checked)">
          <span class="cal-filter-group-icon">${filterAllIconForLabel('All Venues')}</span><span>All Venues</span>
        </label>
      </div>
      <div class="cal-filter-options" style="grid-template-columns:1fr;">
        ${allVenues.map(venue => `<label class="cal-filter-option"><input type="checkbox" class="people-venue-check" data-key="${escHtml(venue)}" onchange="togglePeopleVenue('${encodeURIComponent(venue)}', this.checked)"><span>${escHtml(venue)}</span></label>`).join('')}
      </div>
    </div>
  `;
  ['perfVenueMenu','djVenueMenu','barVenueMenu','orgVenueMenu'].forEach(id => {
    const menu = document.getElementById(id);
    if (menu) menu.innerHTML = menuHtml;
  });
  syncPeopleVenueFilterUI();
}

function togglePeopleVenue(encodedVenue, checked) {
  const venue = decodeURIComponent(encodedVenue || '');
  if (!venue) return;
  if (checked) peopleVenueFilter.add(venue);
  else peopleVenueFilter.delete(venue);
  syncPeopleVenueFilterUI();
  renderPerformers();
  renderDJs();
  renderBartenders();
  renderOrganizers();
}

function togglePeopleVenueAll(checked) {
  if (checked) {
    peopleVenueFilter.clear();
  }
  syncPeopleVenueFilterUI();
  renderPerformers();
  renderDJs();
  renderBartenders();
  renderOrganizers();
}

function syncPeopleVenueFilterUI() {
  const count = peopleVenueFilter.size;
  ['perfVenueToggle','djVenueToggle','barVenueToggle','orgVenueToggle'].forEach(id => {
    const toggle = document.getElementById(id);
    if (toggle) {
      toggle.innerHTML = `<span class="calendar-toggle-label">Venues</span><span class="calendar-toggle-badge">${count === 0 ? 'All' : count}</span><span class="calendar-toggle-chevron">${CALENDAR_FILTER_CHEVRON_ICON}</span>`;
    }
  });

  const allCheck = document.getElementById('peopleVenueAllCheck');
  if (allCheck) allCheck.checked = peopleVenueFilter.size === 0;
  document.querySelectorAll('.people-venue-check').forEach(input => {
    const key = input.dataset.key || '';
    input.checked = peopleVenueFilter.has(key);
  });
}

function getPersonVenueNames(person, type) {
  if (type === 'organizer') {
    return new Set((person.venues || []).filter(Boolean));
  }
  if (type === 'bartender') {
    return new Set((person.venues || []).filter(Boolean));
  }
  const venueNames = new Set();
  (person.events || []).forEach(eventId => {
    const event = DATA.events.find(e => String(e.id) === String(eventId));
    if (event && event.venue) venueNames.add(event.venue);
  });
  return venueNames;
}

function personMatchesVenueFilter(person, type) {
  if (peopleVenueFilter.size === 0) return true;
  const venueNames = getPersonVenueNames(person, type);
  return Array.from(peopleVenueFilter).some(venue => venueNames.has(venue));
}

function togglePerformerTag(encodedTag, checked) {
  const tag = decodeURIComponent(encodedTag || '');
  if (!tag) return;
  if (checked) perfFilterState.tags.add(tag);
  else perfFilterState.tags.delete(tag);
  syncPerfFilterUI();
  renderPerformers();
}

function togglePerformerAll(checked) {
  if (!checked) {
    syncPerfFilterUI();
    return;
  }
  perfFilterState.tags.clear();
  syncPerfFilterUI();
  renderPerformers();
}

function togglePerformerTagAll(checked) {
  if (!checked) {
    syncPerfFilterUI();
    return;
  }
  perfFilterState.tags.clear();
  syncPerfFilterUI();
  renderPerformers();
}

function syncPerfFilterUI() {
  const toggle = document.getElementById('perfFilterToggle');
  const count = perfFilterState.tags.size;
  if (toggle) {
    toggle.innerHTML = `<span class="calendar-toggle-label">Category</span><span class="calendar-toggle-badge">${count === 0 ? 'All' : count}</span><span class="calendar-toggle-chevron">${CALENDAR_FILTER_CHEVRON_ICON}</span>`;
  }

  const allCheck = document.getElementById('perfAllCheck');
  if (allCheck) allCheck.checked = count === 0;

  const tagAllCheck = document.getElementById('perfTagAllCheck');
  if (tagAllCheck) tagAllCheck.checked = perfFilterState.tags.size === 0;
  document.querySelectorAll('.perf-tag-check').forEach(input => {
    const key = input.dataset.key || '';
    input.checked = perfFilterState.tags.has(key);
  });
}

function renderPerformers() {
  const grid = document.getElementById('perfGrid');
  if (!grid) return;
  let list = [...DATA.performers];

  if (perfFilterState.tags.size > 0) {
    list = list.filter(p => Array.from(perfFilterState.tags).some(tag => (p.tags || []).includes(tag)));
  }
  if (peopleVenueFilter.size > 0) {
    list = list.filter(p => personMatchesVenueFilter(p, 'performer'));
  }
  if (state.perfSearch) {
    list = list.filter(p => matchesSearch([p.name, p.role, (p.tags || []).join(' ')], state.perfSearch));
  }
  if (state.perfSortAZ) list.sort((a, b) => a.name.localeCompare(b.name));
  else list.sort((a, b) => b.name.localeCompare(a.name));

  const resBadge = r => {
    if (r === 'visitor') return `<span class="p-badge badge-visitor"><span class="dot dot-visitor"></span>Visitor</span>`;
    if (r === 'guest') return `<span class="p-badge badge-guest"><span class="dot dot-guest"></span>Guest booking</span>`;
    return '';
  };

  const countEl = document.getElementById('perfCount');
  if (countEl) countEl.innerHTML = `Showing <strong>${list.length}</strong> of ${DATA.performers.length} Performers`;

  grid.innerHTML = list.map((p, i) => {
    const upcomingCount = p.events.filter(id => {
      const ev = DATA.events.find(e => String(e.id) === String(id));
      return ev && ev.date && new Date(ev.date + 'T12:00:00') >= new Date();
    }).length;
    return `<div class="profile-card" style="animation-delay:${i * 0.04}s" onclick="showPerformerDetail('${p.id}')">
      ${profilePhotoHTML(p)}
      <div class="p-name">${escHtml(p.name)}</div>
      <div class="p-role">${escHtml(p.role)}</div>
      ${resBadge(p.residency)}
      <div class="p-upcoming"><strong>${upcomingCount}</strong> upcoming event${upcomingCount !== 1 ? 's' : ''}</div>
    </div>`;
  }).join('');
}

function showPerformerDetail(id, pushState = true) {
  const p = DATA.performers.find(x => x.id === id);
  if (!p) return;
  const events = p.events.map(eid => DATA.events.find(e => e.id === eid)).filter(Boolean);
  showPage('performers', null, false);
  document.getElementById('perfListView').style.display = 'none';
  document.getElementById('perfDetailView').style.display = 'block';
  document.getElementById('perfDetailContent').innerHTML = profileDetailHTML(p, events, 'performer');
  if (pushState) updatePageHistory('performers', false, { performer: String(id) });
}

function goToPerformer(name) {
  const p = DATA.performers.find(x => x.name === name);
  if (!p) return;
  showPerformerDetail(p.id);
}

function goToOrganizer(name) {
  const decodedName = decodeURIComponent(name || '');
  const targetId = makeOrganizerId(decodedName);
  const org = DATA.organizers.find(x => x.id === targetId || normPersonId(x.name) === normPersonId(decodedName));
  if (!org) return;
  showOrganizerDetail(org.id);
}

/* ── DJS ── */
let djFilterState = { residencies: new Set() };

function toggleDjResidency(key, checked) {
  if (!key) return;
  if (checked) djFilterState.residencies.add(key);
  else djFilterState.residencies.delete(key);
  syncDjFilterUI();
  renderDJs();
}

function toggleDjResidencyAll(checked) {
  if (!checked) {
    syncDjFilterUI();
    return;
  }
  djFilterState.residencies.clear();
  syncDjFilterUI();
  renderDJs();
}

function setDjUpcomingOnly(enabled) {
  state.djUpcoming = !!enabled;
  syncDjFilterUI();
  renderDJs();
}

function syncDjFilterUI() {
  const residencyToggle = document.getElementById('djResidencyToggle');
  if (residencyToggle) {
    residencyToggle.innerHTML = `<span class="calendar-toggle-label">Residency</span><span class="calendar-toggle-badge">${djFilterState.residencies.size === 0 ? 'All' : djFilterState.residencies.size}</span><span class="calendar-toggle-chevron">${CALENDAR_FILTER_CHEVRON_ICON}</span>`;
  }

  const upcomingToggle = document.getElementById('djUpcomingToggle');
  if (upcomingToggle) {
    upcomingToggle.innerHTML = `<span class="calendar-toggle-label">Upcoming</span><span class="calendar-toggle-badge">${state.djUpcoming ? 'On' : 'All'}</span><span class="calendar-toggle-chevron">${CALENDAR_FILTER_CHEVRON_ICON}</span>`;
  }

  const allResidency = document.getElementById('djResidencyAllCheck');
  if (allResidency) allResidency.checked = djFilterState.residencies.size === 0;
  document.querySelectorAll('.dj-residency-check').forEach(input => {
    const key = input.dataset.key || '';
    input.checked = djFilterState.residencies.has(key);
  });

  const allUpcoming = document.getElementById('djUpcomingAllCheck');
  if (allUpcoming) allUpcoming.checked = !state.djUpcoming;
  const upcomingOnly = document.getElementById('djUpcomingOnlyCheck');
  if (upcomingOnly) upcomingOnly.checked = state.djUpcoming;
}

function renderDJs() {
  const grid = document.getElementById('djGrid');
  if (!grid) return;

  let list = [...DATA.djs];
  if (djFilterState.residencies.size > 0) {
    list = list.filter(d => djFilterState.residencies.has(d.residency));
  }
  if (peopleVenueFilter.size > 0) {
    list = list.filter(d => personMatchesVenueFilter(d, 'dj'));
  }
  if (state.djSearch) {
    list = list.filter(d => matchesSearch([d.name, d.genre], state.djSearch));
  }
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
    if (r === 'local') return `<span class="p-badge badge-local"><span class="dot dot-local"></span>Local</span>`;
    if (r === 'visitor') return `<span class="p-badge badge-visitor"><span class="dot dot-visitor"></span>Visitor</span>`;
    return `<span class="p-badge badge-guest"><span class="dot dot-guest"></span>Guest booking</span>`;
  };

  grid.innerHTML = list.map((d, i) => {
    const nextEvent = d.events.length > 0 ? DATA.events.find(e => e.id === d.events[0]) : null;
    return `<div class="profile-card" style="animation-delay:${i * 0.04}s" onclick="showDJDetail('${d.id}')">
      ${profilePhotoHTML(d)}
      <div class="p-name">${escHtml(d.name)}</div>
      <div class="p-role">${escHtml(d.genre)}</div>
      ${resBadge(d.residency)}
      <div class="p-upcoming">
        ${d.events.length > 0
          ? `<strong>${d.events.length}</strong> upcoming event${d.events.length !== 1 ? 's' : ''}
             ${nextEvent ? `<div class="p-next">Next event: ${nextEvent.day.slice(0,3)} ${nextEvent.dateNum}</div>` : ''}`
          : `<span style="color:var(--text3)">No upcoming events</span>`}
      </div>
    </div>`;
  }).join('');
}

function resetDjFilters() {
  djFilterState.residencies.clear();
  state.djUpcoming = false;
  syncDjFilterUI();
  renderDJs();
}

function showDJDetail(id, pushState = true) {
  const d = DATA.djs.find(x => x.id === id);
  if (!d) return;
  const events = d.events.map(eid => DATA.events.find(e => e.id === eid)).filter(Boolean);
  showPage('djs', null, false);
  document.getElementById('djListView').style.display = 'none';
  document.getElementById('djDetailView').style.display = 'block';
  document.getElementById('djDetailContent').innerHTML = profileDetailHTML(d, events, 'dj');
  if (pushState) updatePageHistory('djs', false, { dj: String(id) });
}

function goToDJ(name) {
  const d = DATA.djs.find(x => x.name === name);
  if (!d) return;
  showDJDetail(d.id);
}

function showBartenderDetail(id, pushState = true) {
  const b = DATA.bartenders.find(x => x.id === id);
  if (!b) return;
  const events = b.events.map(eid => DATA.events.find(e => e.id === eid)).filter(Boolean);
  showPage('bartenders', null, false);
  document.getElementById('barListView').style.display = 'none';
  document.getElementById('barDetailView').style.display = 'block';
  const scheduleSection = b.schedule
    ? `<div class="detail-section"><div class="detail-section-title">Regular schedule</div><div class="bar-schedule">${escHtml(b.schedule)}</div></div>`
    : '';
  document.getElementById('barDetailContent').innerHTML = profileDetailHTML(b, events, 'bartender') + scheduleSection;
  if (pushState) updatePageHistory('bartenders', false, { bartender: String(id) });
}

function goToBartender(name) {
  const b = DATA.bartenders.find(x => x.name === name);
  if (!b) return;
  showBartenderDetail(b.id);
}

/* ── BARTENDERS ── */
function renderBartenders() {
  const grid = document.getElementById('barGrid');
  if (!grid) return;
  let list = [...DATA.bartenders];
  if (peopleVenueFilter.size > 0) {
    list = list.filter(b => personMatchesVenueFilter(b, 'bartender'));
  }
  if (state.barSearch) {
    list = list.filter(b => matchesSearch([b.name, (b.venues || []).join(' '), b.schedule], state.barSearch));
  }
  if (state.barSortAZ) list.sort((a, b) => a.name.localeCompare(b.name));
  else list.sort((a, b) => b.name.localeCompare(a.name));

  const countEl = document.getElementById('barCount');
  if (countEl) countEl.innerHTML = `Showing <strong>${list.length}</strong> of ${DATA.bartenders.length} Bartenders`;

  grid.innerHTML = list.map((b, i) => `
    <div class="profile-card" style="animation-delay:${i*0.04}s" onclick="showBartenderDetail('${b.id}')">
      ${profilePhotoHTML(b)}
      <div class="p-name">${escHtml(b.name)}</div>
      <div class="p-role">${b.venues.length ? escHtml(b.venues.join(' · ')) : 'Bartender'}</div>
      ${b.schedule ? `<div class="p-schedule">${escHtml(b.schedule)}</div>` : ''}
      <div class="p-upcoming"><strong>${b.events.length}</strong> upcoming event${b.events.length !== 1 ? 's' : ''}</div>
    </div>`).join('');
}

function renderOrganizers() {
  const grid = document.getElementById('orgGrid');
  if (!grid) return;

  let list = [...(DATA.organizers || [])];
  if (peopleVenueFilter.size > 0) {
    list = list.filter(o => personMatchesVenueFilter(o, 'organizer'));
  }
  if (state.orgSearch) {
    list = list.filter(o => matchesSearch([o.name, (o.venues || []).join(' ')], state.orgSearch));
  }
  if (state.orgSortAZ) list.sort((a, b) => a.name.localeCompare(b.name));
  else list.sort((a, b) => b.name.localeCompare(a.name));

  const countEl = document.getElementById('orgCount');
  if (countEl) countEl.innerHTML = `Showing <strong>${list.length}</strong> of ${(DATA.organizers || []).length} Organizers`;

  grid.innerHTML = list.map((o, i) => {
    const upcomingCount = o.events.filter(id => {
      const ev = DATA.events.find(e => String(e.id) === String(id));
      return ev && ev.date && new Date(ev.date + 'T12:00:00') >= new Date();
    }).length;

    return `<div class="profile-card" style="animation-delay:${i*0.04}s" onclick="showOrganizerDetail('${o.id}')">
      ${profilePhotoHTML(o)}
      <div class="p-name">${escHtml(o.name)}</div>
      <div class="p-role">${o.venues.length ? escHtml(o.venues.join(' · ')) : 'Organizer'}</div>
      <div class="p-upcoming"><strong>${upcomingCount}</strong> upcoming event${upcomingCount !== 1 ? 's' : ''}</div>
    </div>`;
  }).join('');
}

function showOrganizerDetail(id, pushState = true) {
  const org = (DATA.organizers || []).find(x => x.id === id);
  if (!org) return;
  const events = org.events.map(eid => DATA.events.find(e => String(e.id) === String(eid))).filter(Boolean);
  showPage('organizers', null, false);
  document.getElementById('orgListView').style.display = 'none';
  document.getElementById('orgDetailView').style.display = 'block';
  document.getElementById('orgDetailContent').innerHTML = profileDetailHTML(org, events, 'organizer');
  if (pushState) updatePageHistory('organizers', false, { organizer: String(id) });
}

function normPersonId(v) {
  return String(v || '').trim().toLowerCase();
}

function openProfileByPersonId(type, encodedPersonId) {
  const personId = normPersonId(decodeURIComponent(encodedPersonId || ''));
  if (!personId) return;

  if (type === 'performer') {
    const p = DATA.performers.find(x => normPersonId(x.personId || x.id) === personId);
    if (!p) return;
    showPerformerDetail(p.id);
    return;
  }

  if (type === 'dj') {
    const d = DATA.djs.find(x => normPersonId(x.personId || x.id) === personId);
    if (!d) return;
    showDJDetail(d.id);
    return;
  }

  if (type === 'bartender') {
    const b = DATA.bartenders.find(x => normPersonId(x.personId || x.id) === personId);
    if (!b) return;
    showBartenderDetail(b.id);
  }
}

function linkedProfilesHTML(person, currentType) {
  const personId = normPersonId(person.personId || person.id);
  if (!personId) return '';

  const links = [];

  if (currentType !== 'performer' && DATA.performers.some(x => normPersonId(x.personId || x.id) === personId)) {
    links.push({ type: 'performer', label: 'Performer profile' });
  }
  if (currentType !== 'dj' && DATA.djs.some(x => normPersonId(x.personId || x.id) === personId)) {
    links.push({ type: 'dj', label: 'DJ profile' });
  }
  if (currentType !== 'bartender' && DATA.bartenders.some(x => normPersonId(x.personId || x.id) === personId)) {
    links.push({ type: 'bartender', label: 'Bartender profile' });
  }

  if (!links.length) return '';

  const idArg = encodeURIComponent(personId);
  return `<div class="detail-linked-profiles">
    <div class="detail-linked-title">Also appears as</div>
    <div class="detail-linked-links">${links.map(l => `<span class="text-link" onclick="openProfileByPersonId('${l.type}','${idArg}')">${l.label}</span>`).join(' · ')}</div>
  </div>`;
}

/* ── VENUES ── */
function toggleVenueType(type, el) {
  const decoded = decodeURIComponent(type || '');
  if (!decoded) return;
  if (state.venueTypes.has(decoded)) state.venueTypes.delete(decoded);
  else state.venueTypes.add(decoded);
  syncVenueFilterUI();
  renderVenues();
}

function setVenueHood(hood, el) {
  state.venueHood = decodeURIComponent(hood || 'all');
  syncVenueFilterUI();
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
  const menu = document.getElementById('venueTypeMenu');
  const hoodMenu = document.getElementById('venueNeighborhoodMenu');
  if (!menu || !hoodMenu) return;

  // Collect all unique types across all venues
  const typeSet = new Set();
  DATA.venues.forEach(v => v.types.forEach(t => typeSet.add(t)));

  // Known types first in preferred order, then any new ones alphabetically
  const preferred = ['queer', 'safe', 'arts', 'restaurant'];
  const known   = preferred.filter(t => typeSet.has(t));
  const unknown = [...typeSet].filter(t => !preferred.includes(t)).sort();
  const allTypes = [...known, ...unknown];

  menu.innerHTML = `
    <div class="cal-filter-all-line">
      <label class="cal-filter-option cal-filter-all-option">
        <input type="checkbox" id="venueTypeAllCheck" onchange="toggleVenueTypeAll(this.checked)">
        <span class="cal-filter-group-icon">${filterAllIconForLabel('All venue types')}</span><span>All venue types</span>
      </label>
    </div>
    <div class="cal-filter-group">
      <div class="cal-filter-options">
        ${allTypes.map(type => {
          const meta = getTypeMeta(type);
          return `<label class="cal-filter-option"><input type="checkbox" class="venue-type-check" data-key="${escHtml(type)}" onchange="toggleVenueType('${encodeURIComponent(type)}')"><span>${escHtml(meta.label)}</span></label>`;
        }).join('')}
      </div>
    </div>
  `;

  const hoodMap = new Map();
  DATA.venues.forEach(v => {
    const key = normFilterKey(v.hood || '');
    const label = String(v.hoodLabel || v.hood || '').trim();
    if (!key || !label || hoodMap.has(key)) return;
    hoodMap.set(key, label);
  });
  venueNeighborhoodOptions = [{ key: 'all', label: 'All areas' }, ...[...hoodMap.entries()].map(([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label))];

  hoodMenu.innerHTML = `
    <div class="cal-filter-group">
      <div class="cal-filter-options" style="grid-template-columns:1fr;">
        ${venueNeighborhoodOptions.map(opt => `<label class="cal-filter-option"><input type="radio" name="venueHood" value="${escHtml(opt.key)}" onchange="setVenueHood('${encodeURIComponent(opt.key)}')"><span>${escHtml(opt.label)}</span></label>`).join('')}
      </div>
    </div>
  `;

  syncVenueFilterUI();
}

function renderVenues() {
  const grid = document.getElementById('venueGrid');
  if (!grid) return;

  let list = [...DATA.venues];
  if (state.venueTypes.size > 0) {
    list = list.filter(v => Array.from(state.venueTypes).every(t => v.types.includes(t)));
  }
  if (state.venueHood !== 'all') list = list.filter(v => v.hood === state.venueHood);
  if (state.venueSearch) {
    list = list.filter(v => matchesSearch([v.name, v.hoodLabel, v.hood, (v.types || []).join(' '), v.address], state.venueSearch));
  }
  if (state.venueSortAZ) list.sort((a, b) => a.name.localeCompare(b.name));
  else list.sort((a, b) => b.name.localeCompare(a.name));

  const countEl = document.getElementById('venueCount');
  if (countEl) countEl.innerHTML = `Showing <strong>${list.length}</strong> of ${DATA.venues.length} venues`;

  if (!list.length) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-title">No venues match</div><div class="empty-sub">No venues are tagged with all of those types combined</div><span class="empty-reset" onclick="clearVenueTypes()">Clear filters</span></div>`;
    renderVenueMapLegend(DATA.venues);
    lastRenderedVenues = [];
    updateVenueMap([]);
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
    const key = venueKey(v.name);
    const count = venueCounts[v.name] || 0;
    const safeName = escHtml(v.name);
    return `<div class="venue-card" data-venue-key="${escHtml(key)}" style="animation-delay:${i*0.04}s;cursor:pointer" onmouseenter="highlightVenueOnMap('${encodeURIComponent(v.name)}')" onmouseleave="clearVenueHighlight()" onclick="showVenueDetail('${safeName}')">
      <div class="venue-card-top">
        ${venuePhotoHTML(v)}
        <div class="venue-body">
          <div class="venue-name">${escHtml(v.name)}</div>
          <div class="venue-loc">${escHtml(v.hoodLabel)}</div>
          <div class="venue-badges">${badges}</div>
        </div>
      </div>
      <div class="venue-events">${count} upcoming event${count !== 1 ? 's' : ''}</div>
    </div>`;
  }).join('');

  renderVenueMapLegend(list);
  lastRenderedVenues = list;
  updateVenueMap(list);
}

function ensureVenueMap() {
  if (venueMap) return true;
  const canvas = document.getElementById('venueMap');
  const status = document.getElementById('venueMapStatus');
  if (!canvas || typeof L === 'undefined') {
    if (status) status.textContent = 'Map unavailable right now.';
    return false;
  }

  venueMap = L.map(canvas, {
    zoomControl: true,
    scrollWheelZoom: false,
  }).setView(VENUE_MAP_DEFAULT_CENTER, 14);

  venueMap.on('dragstart zoomstart', () => {
    if (!venueMapProgrammaticMove) {
      venueMapUserMoved = true;
    }
  });
  venueMap.on('moveend zoomend', () => {
    if (venueMapProgrammaticMove) {
      venueMapProgrammaticMove = false;
    }
  });

  canvas.classList.add('is-branded-map');

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
  }).addTo(venueMap);

  fruitLoopOverlay = L.layerGroup([
    L.circle(VENUE_MAP_LOOP_CENTER, {
      radius: VENUE_MAP_LOOP_RADIUS_M,
      color: 'rgba(200, 55, 45, 0.8)',
      weight: 2,
      dashArray: '6 6',
      fillColor: 'rgba(200, 55, 45, 0.15)',
      fillOpacity: 0.20,
      interactive: false,
    }),
  ]).addTo(venueMap);

  // L.marker(VENUE_MAP_LOOP_CENTER, {
  //   interactive: false,
  //   keyboard: false,
  //   icon: L.divIcon({
  //     className: 'fruit-loop-core-label-wrap',
  //     html: '<span class="fruit-loop-core-label">Fruit Loop core</span>',
  //     iconSize: [110, 20],
  //     iconAnchor: [55, 10],
  //   })
  // }).addTo(venueMap);

  if (status) status.textContent = 'Map ready';
  return true;
}

function venueGeoCacheKey(venue) {
  return normFilterKey(`${venue.name}|${venue.address}`);
}

function persistVenueGeoCache() {
  try {
    localStorage.setItem(VENUE_MAP_CACHE_KEY, JSON.stringify(venueGeoCache));
  } catch (err) {
    console.warn('Unable to persist venue geocode cache', err);
  }
}

function venueKey(name) {
  return normFilterKey(name || '');
}

function getVenuePinMeta(venue) {
  const types = new Set((venue?.types || []).map(t => String(t || '').toLowerCase()).filter(Boolean));
  const selected = Array.from(state.venueTypes || []);

  const toneByType = {
    queer: 'venue-pin-queer',
    safe: 'venue-pin-safe',
    arts: 'venue-pin-arts',
    restaurant: 'venue-pin-restaurant',
    community: 'venue-pin-community',
  };

  const labelByType = {
    queer: TYPE_META.queer?.label || 'LGBTQIA+ venue',
    safe: TYPE_META.safe?.label || 'Safe space',
    arts: TYPE_META.arts?.label || 'Arts space',
    restaurant: TYPE_META.restaurant?.label || 'Bar & restaurant',
    community: 'LGBTQIA+ & Safe space',
  };

  if (selected.length) {
    const activeType = selected.find(t => types.has(String(t || '').toLowerCase()));
    if (activeType && toneByType[activeType]) {
      const group = activeType === 'arts' ? 'Culture' : activeType === 'restaurant' ? 'Food/Bar' : 'Community';
      return { key: activeType, tone: toneByType[activeType], label: labelByType[activeType], group };
    }
  }

  if (types.has('arts')) return { key: 'arts', tone: toneByType.arts, label: labelByType.arts, group: 'Culture' };
  if (types.has('restaurant')) return { key: 'restaurant', tone: toneByType.restaurant, label: labelByType.restaurant, group: 'Food/Bar' };
  if (types.has('queer') && types.has('safe')) return { key: 'community', tone: toneByType.community, label: labelByType.community, group: 'Community' };
  if (types.has('queer')) return { key: 'queer', tone: toneByType.queer, label: labelByType.queer, group: 'Community' };
  if (types.has('safe')) return { key: 'safe', tone: toneByType.safe, label: labelByType.safe, group: 'Community' };
  return { key: 'safe', tone: toneByType.safe, label: labelByType.safe, group: 'Community' };
}

function markerToneClassForVenue(venue) {
  return getVenuePinMeta(venue).tone;
}

function renderVenueMapLegend(list) {
  const legend = document.getElementById('venueMapLegend');
  if (!legend) return;

  const grouped = new Map();
  (list || []).forEach(venue => {
    const meta = getVenuePinMeta(venue);
    if (!grouped.has(meta.group)) grouped.set(meta.group, new Map());
    grouped.get(meta.group).set(meta.key, meta);
  });

  const groupOrder = ['Community', 'Culture', 'Food/Bar'];
  const rows = groupOrder
    .map(groupTitle => {
      const itemsMap = grouped.get(groupTitle);
      if (!itemsMap || !itemsMap.size) return '';
      const items = Array.from(itemsMap.values());
      return `<div class="venue-legend-group"><span class="venue-legend-title">${escHtml(groupTitle)}</span>${items.map(item => `<span class="venue-legend-item"><span class="venue-legend-dot ${item.tone}"></span>${escHtml(item.label)}</span>`).join('')}</div>`;
    })
    .filter(Boolean)
    .join('');

  legend.innerHTML = rows || '<div class="venue-legend-group"><span class="venue-legend-title">Legend</span><span class="venue-legend-item">No venue types in current view</span></div>';
}

function setVenueCardActiveState(key, active) {
  document.querySelectorAll('.venue-card').forEach(card => {
    if ((card.dataset.venueKey || '') === key) card.classList.toggle('is-map-active', active);
  });
}

function setActiveVenueMarker(key, options = {}) {
  const marker = venueMarkerByKey.get(key);
  if (!marker) return;

  if (activeVenueKey && activeVenueKey !== key) {
    const prevMarker = venueMarkerByKey.get(activeVenueKey);
    if (prevMarker?.getElement()) prevMarker.getElement().classList.remove('is-active');
    setVenueCardActiveState(activeVenueKey, false);
  }

  if (marker.getElement()) marker.getElement().classList.add('is-active');
  setVenueCardActiveState(key, true);
  activeVenueKey = key;

  if (options.openPopup) marker.openPopup();
  if (options.pan && venueMap) venueMap.panTo(marker.getLatLng(), { animate: true, duration: 0.25 });
}

function clearVenueHighlight() {
  if (!activeVenueKey) return;
  const marker = venueMarkerByKey.get(activeVenueKey);
  if (marker?.getElement()) marker.getElement().classList.remove('is-active');
  setVenueCardActiveState(activeVenueKey, false);
  activeVenueKey = '';
}

function highlightVenueOnMap(encodedName) {
  const decoded = decodeURIComponent(encodedName || '');
  if (!decoded) return;
  const key = venueKey(decoded);
  setActiveVenueMarker(key, { openPopup: true, pan: false });
}

function getVenueCoords(venue) {
  if (Number.isFinite(venue.latitude) && Number.isFinite(venue.longitude)) {
    return [venue.latitude, venue.longitude];
  }
  const cached = venueGeoCache[venueGeoCacheKey(venue)];
  if (cached && Number.isFinite(cached.lat) && Number.isFinite(cached.lng)) {
    return [cached.lat, cached.lng];
  }
  return null;
}

async function geocodeVenue(venue) {
  const query = `${venue.address || venue.name}, Providence, RI`;
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&q=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data) || !data.length) return null;
  const lat = parseFloat(data[0].lat);
  const lng = parseFloat(data[0].lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const key = venueGeoCacheKey(venue);
  venueGeoCache[key] = { lat, lng };
  persistVenueGeoCache();
  return [lat, lng];
}

function ensureVenueDetailMap() {
  const canvas = document.getElementById('venueDetailMap');
  const status = document.getElementById('venueDetailMapStatus');
  if (!canvas || typeof L === 'undefined') {
    if (status) status.textContent = 'Map unavailable right now.';
    return false;
  }

  if (venueDetailMap && venueDetailMap.getContainer() === canvas) {
    setTimeout(() => {
      if (venueDetailMap) venueDetailMap.invalidateSize();
    }, 0);
    return true;
  }

  if (venueDetailMap) {
    venueDetailMap.remove();
    venueDetailMap = null;
    venueDetailMapMarker = null;
  }

  venueDetailMap = L.map(canvas, {
    zoomControl: true,
    scrollWheelZoom: false,
  }).setView(VENUE_MAP_DEFAULT_CENTER, 13);

  canvas.classList.add('is-branded-map');

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
  }).addTo(venueDetailMap);

  if (status) status.textContent = 'Map ready';
  return true;
}

async function renderVenueDetailMap(venue) {
  const status = document.getElementById('venueDetailMapStatus');
  if (!ensureVenueDetailMap()) return;

  let coords = getVenueCoords(venue);
  if (!coords) {
    if (status) status.textContent = 'Pinning venue location...';
    try {
      coords = await geocodeVenue(venue);
    } catch (err) {
      console.warn('Venue detail geocode failed:', venue.name, err);
    }
  }

  if (!coords || !venueDetailMap) {
    if (status) status.textContent = 'Could not locate this venue yet.';
    return;
  }

  if (venueDetailMapMarker) {
    venueDetailMapMarker.remove();
    venueDetailMapMarker = null;
  }

  venueDetailMapMarker = L.marker(coords, {
    icon: L.divIcon({
      className: `venue-pin ${markerToneClassForVenue(venue)}`,
      html: '<span class="venue-pin-core"></span>',
      iconSize: [20, 20],
      iconAnchor: [10, 20],
      popupAnchor: [0, -22],
    })
  }).addTo(venueDetailMap);

  if (venue.address) {
    venueDetailMapMarker.bindPopup(`<strong>${escHtml(venue.name)}</strong><br>${escHtml(venue.address)}`).openPopup();
  } else {
    venueDetailMapMarker.bindPopup(`<strong>${escHtml(venue.name)}</strong>`).openPopup();
  }

  venueDetailMap.setView(coords, 15);
  if (status) status.textContent = `Pinned ${venue.name}`;
}

function clearVenueMapMarkers() {
  venueMapMarkers.forEach(marker => marker.remove());
  venueMapMarkers = [];
  venueMarkerByKey.clear();
  activeVenueKey = '';
}

function renderVenueMapMarkers(venuesWithCoords) {
  if (!venueMap) return;
  clearVenueMapMarkers();

  const bounds = [];
  venuesWithCoords.forEach(({ venue, coords }) => {
    const key = venueKey(venue.name);
    const marker = L.marker(coords, {
      icon: L.divIcon({
        className: `venue-pin ${markerToneClassForVenue(venue)}`,
        html: '<span class="venue-pin-core"></span>',
        iconSize: [20, 20],
        iconAnchor: [10, 20],
        popupAnchor: [0, -22],
      })
    })
      .addTo(venueMap)
      .bindPopup(`<strong>${escHtml(venue.name)}</strong><br>${escHtml(venue.hoodLabel || venue.hood || '')}`, {
        offset: [0, -2],
        autoPan: false,
        autoPanPadding: [28, 28],
      });
    marker.on('mouseover', () => setActiveVenueMarker(key, { openPopup: true }));
    marker.on('mouseout', () => clearVenueHighlight());
    marker.on('click', () => {
      setActiveVenueMarker(key, { openPopup: true, pan: true });
      showVenueDetail(venue.name);
    });
    venueMapMarkers.push(marker);
    venueMarkerByKey.set(key, marker);
    bounds.push(coords);
  });

  // Keep the very first map render centered on the Fruit Loop overlay.
  if (!venueMapInitialFocusApplied) {
    venueMapInitialFocusApplied = true;
    if (fruitLoopOverlay && typeof fruitLoopOverlay.getBounds === 'function') {
      const loopBounds = fruitLoopOverlay.getBounds();
      if (loopBounds && loopBounds.isValid && loopBounds.isValid()) {
        venueMapProgrammaticMove = true;
        venueMap.fitBounds(loopBounds, { padding: [20, 20], maxZoom: 15 });
        return;
      }
    }
    venueMapProgrammaticMove = true;
    venueMap.setView(VENUE_MAP_LOOP_CENTER, 15);
    return;
  }

  if (!venueMapUserMoved) return;

  if (bounds.length === 0) {
    venueMap.setView(VENUE_MAP_DEFAULT_CENTER, 12);
    return;
  }

  if (bounds.length === 1) {
    venueMap.setView(bounds[0], 14);
    return;
  }

  venueMap.fitBounds(bounds, { padding: [28, 28], maxZoom: 14 });
}

async function updateVenueMap(list) {
  const status = document.getElementById('venueMapStatus');
  if (!ensureVenueMap()) return;

  const token = ++venueMapRenderToken;
  const withCoords = [];
  const pending = [];

  list.forEach(venue => {
    const coords = getVenueCoords(venue);
    if (coords) {
      withCoords.push({ venue, coords });
    } else {
      pending.push(venue);
    }
  });

  renderVenueMapMarkers(withCoords);

  if (status) {
    const label = withCoords.length === 1 ? 'pin' : 'pins';
    status.textContent = withCoords.length
      ? `Showing ${withCoords.length} ${label} for current venue filters`
      : 'No mapped venues yet for current filters';
  }

  if (!pending.length) return;

  if (status) status.textContent = `Mapping ${pending.length} venue${pending.length === 1 ? '' : 's'}...`;
  await Promise.all(pending.map(async venue => {
    try {
      await geocodeVenue(venue);
    } catch (err) {
      console.warn('Venue geocode failed:', venue.name, err);
    }
  }));

  if (token !== venueMapRenderToken) return;

  const hydrated = list
    .map(venue => {
      const coords = getVenueCoords(venue);
      return coords ? { venue, coords } : null;
    })
    .filter(Boolean);

  renderVenueMapMarkers(hydrated);
  if (status) {
    const label = hydrated.length === 1 ? 'pin' : 'pins';
    status.textContent = hydrated.length
      ? `Showing ${hydrated.length} ${label} for current venue filters`
      : 'No mapped venues available for this filter combination';
  }
}

function removeVenueType(type) {
  state.venueTypes.delete(type);
  syncVenueFilterUI();
  renderVenues();
}

function clearVenueTypes() {
  state.venueTypes.clear();
  syncVenueFilterUI();
  renderVenues();
}

function toggleVenueTypeAll(checked) {
  if (checked) {
    state.venueTypes.clear();
  }
  syncVenueFilterUI();
  renderVenues();
}

function syncVenueFilterUI() {
  const typeToggle = document.getElementById('venueTypeToggle');
  if (typeToggle) {
    typeToggle.innerHTML = `<span class="calendar-toggle-label">Venue type</span><span class="calendar-toggle-badge">${state.venueTypes.size === 0 ? 'All' : state.venueTypes.size}</span><span class="calendar-toggle-chevron">${CALENDAR_FILTER_CHEVRON_ICON}</span>`;
  }

  const hoodToggle = document.getElementById('venueNeighborhoodToggle');
  if (hoodToggle) {
    const hoodLabel = state.venueHood === 'all'
      ? 'All'
      : (venueNeighborhoodOptions.find(opt => opt.key === state.venueHood)?.label || 'All');
    hoodToggle.innerHTML = `<span class="calendar-toggle-label">Neighborhood</span><span class="calendar-toggle-badge">${escHtml(hoodLabel)}</span><span class="calendar-toggle-chevron">${CALENDAR_FILTER_CHEVRON_ICON}</span>`;
  }

  const allTypeCheck = document.getElementById('venueTypeAllCheck');
  if (allTypeCheck) allTypeCheck.checked = state.venueTypes.size === 0;
  document.querySelectorAll('.venue-type-check').forEach(input => {
    input.checked = state.venueTypes.has(input.dataset.key || '');
  });

  document.querySelectorAll('input[name="venueHood"]').forEach(input => {
    input.checked = input.value === state.venueHood;
  });
}

/* ── SHARED: profile detail view ── */
function profileDetailHTML(person, events, type) {
  const avClass = avatarClass(person.avatarColor);
  const detailPhoto = person.photoUrl
    ? ('<div class="detail-avatar">' +
       '<img src="' + escHtml(person.photoUrl) + '" alt="' + escHtml(person.name) + '" style="border-radius:14px;width:100%;height:100%;object-fit:contain;object-position:center;display:block">' +
       '</div>')
    : ('<div class="detail-avatar ' + avClass + '">' + escHtml(person.initials) + '</div>');
  const extraInfo = type === 'dj'
    ? `<div style="font-size:12px;color:var(--text3);margin-bottom:12px;letter-spacing:0.06em">${escHtml(person.genre || '')}</div>`
    : type === 'bartender' && person.venues?.length
    ? `<div style="font-size:12px;color:var(--teal);margin-bottom:12px;letter-spacing:0.04em">${person.venues.map(escHtml).join(' · ')}</div>`
    : '';

  const today2 = new Date(); today2.setHours(0,0,0,0);
  const upcomingOnly = events.filter(e => e.date && new Date(e.date + 'T12:00:00') >= today2);
  const sectionHeading = type === 'bartender' ? 'Upcoming events' : 'Upcoming shows';
  const emptyStateText = type === 'bartender'
    ? 'No upcoming events scheduled'
    : 'No upcoming shows scheduled';

  const eventRows = upcomingOnly.length
    ? `<div class="detail-event-cards">${upcomingOnly.map(e => eventCardHTML(e)).join('')}</div>`
    : `<div style="font-size:13px;color:var(--text3);padding:1rem 0">${emptyStateText}</div>`;

  return `
    <div class="detail-header">
      ${detailPhoto}
      <div>
        <div class="detail-name">${escHtml(person.name)}</div>
        <div class="detail-role">${escHtml(person.role || '')}</div>
        ${extraInfo}
        ${person.bio ? `<div class="detail-bio">"${escHtml(person.bio)}"</div>` : ''}
        ${linkedProfilesHTML(person, type)}
        ${socialsHTML(person.socials)}
      </div>
    </div>
    <div class="detail-section">
      <div class="detail-section-title">${sectionHeading}</div>
      ${eventRows}
    </div>`;
}

/* ── SORT toggles ── */
function setSortDirection(which, ascending) {
  const key = which === 'perf'
    ? 'perfSortAZ'
    : which === 'dj'
    ? 'djSortAZ'
    : which === 'bar'
    ? 'barSortAZ'
    : which === 'org'
    ? 'orgSortAZ'
    : 'venueSortAZ';
  state[key] = !!ascending;
  syncSortMenus();
  if (which === 'perf') renderPerformers();
  if (which === 'dj') renderDJs();
  if (which === 'bar') renderBartenders();
  if (which === 'org') renderOrganizers();
  if (which === 'venue') renderVenues();
}

function syncSortMenus() {
  const map = [
    ['perf', state.perfSortAZ, 'perfSortToggle', 'perfSort'],
    ['dj', state.djSortAZ, 'djSortToggle', 'djSort'],
    ['bar', state.barSortAZ, 'barSortToggle', 'barSort'],
    ['org', state.orgSortAZ, 'orgSortToggle', 'orgSort'],
    ['venue', state.venueSortAZ, 'venueSortToggle', 'venueSort'],
  ];

  map.forEach(([label, isAZ, toggleId, radioName]) => {
    const toggle = document.getElementById(toggleId);
    if (toggle) {
      toggle.innerHTML = `<span class="calendar-toggle-label">Sort</span><span class="calendar-toggle-badge">${isAZ ? 'A-Z' : 'Z-A'}</span><span class="calendar-toggle-chevron">${CALENDAR_FILTER_CHEVRON_ICON}</span>`;
    }
    document.querySelectorAll(`input[name="${radioName}"]`).forEach(input => {
      input.checked = (input.value === 'az') === isAZ;
    });
  });
}

function toggleSort(which, el) {
  const key = which === 'perf' ? 'perfSortAZ' : which === 'dj' ? 'djSortAZ' : which === 'bar' ? 'barSortAZ' : which === 'org' ? 'orgSortAZ' : 'venueSortAZ';
  state[key] = !state[key];
  if (el) {
    el.classList.toggle('active', state[key]);
    el.innerHTML = `${state[key] ? 'A–Z' : 'Z–A'} &#8597;`;
  }
  syncSortMenus();
  if (which === 'perf')  renderPerformers();
  if (which === 'dj')    renderDJs();
  if (which === 'bar')   renderBartenders();
  if (which === 'org')   renderOrganizers();
  if (which === 'venue') renderVenues();
}

/* ── VENUE DETAIL ── */
function showVenueDetail(name, pushState = true) {
  const v = DATA.venues.find(x => x.name === name);
  if (!v) return;

  showPage('venues', null, false);

  const today = new Date(); today.setHours(0,0,0,0);
  const upcomingEvents = DATA.events
    .filter(e => e.venue === v.name && e.date && new Date(e.date + 'T12:00:00') >= today)
    .sort((a, b) => a.date < b.date ? -1 : 1);

  const badges = v.types.map(t => {
    const meta = getTypeMeta(t);
    return `<span class="badge ${meta.badgeClass}">${meta.label}</span>`;
  }).join('');

  const photoSection = v.photoUrl
    ? `<div class="detail-avatar">
        <img src="${escHtml(v.photoUrl)}" alt="${escHtml(v.name)}" style="width:100%;display:block;object-fit:contain;object-position: center;height: 100%; border-radius: 14px;">
       </div>`
    : '';

  const metaItems = [
    v.hoodLabel ? `<div class="event-detail-meta-item"><div class="event-detail-meta-label">Area</div><div class="event-detail-meta-value" style="font-size:14px;font-family:var(--font-body)">${escHtml(v.hoodLabel)}</div></div>` : '',
    v.address   ? `<div class="event-detail-meta-item"><div class="event-detail-meta-label">Address</div><div class="event-detail-meta-value" style="font-size:14px;font-family:var(--font-body)">${escHtml(v.address)}</div></div>` : '',
    v.website   ? `<div class="event-detail-meta-item"><div class="event-detail-meta-label">Website</div><div class="event-detail-meta-value" style="font-size:14px;font-family:var(--font-body)"><a href="${escHtml(v.website)}" target="_blank" rel="noopener" style="color:var(--red)">${escHtml(v.website.replace(/https?:\/\//, ''))}</a></div></div>` : '',
  ].filter(Boolean).join('');

  const eventRows = upcomingEvents.length
    ? `<div class="detail-event-cards">${upcomingEvents.map(e => eventCardHTML(e)).join('')}</div>`
    : `<div style="font-size:13px;color:var(--text3);padding:1rem 0">No upcoming events scheduled</div>`;

  document.getElementById('venueDetailContent').innerHTML = `
    <div class="venue-detail-top">
      <div class="venue-detail-main">
        ${photoSection}
        <div class="detail-name">${escHtml(v.name)}</div>
        <div class="venue-badges" style="margin-bottom:1rem">${badges}</div>
        ${socialsHTML(v.socials)}
        <div class="event-detail-meta-row" style="margin:1rem 0 0">${metaItems}</div>
      </div>
      <div class="venue-detail-map-shell">
        <div class="venue-detail-map-header">
          <div class="venue-map-kicker">Location</div>
          <div class="venue-map-title">Find this venue</div>
        </div>
        <div class="venue-map-canvas" id="venueDetailMap" aria-label="Map pinned to ${escHtml(v.name)}"></div>
        <div class="venue-map-status" id="venueDetailMapStatus">Preparing map...</div>
      </div>
    </div>
    <div class="detail-section">
      <div class="detail-section-title">Upcoming events</div>
      ${eventRows}
    </div>`;

  document.getElementById('venueListView').style.display = 'none';
  document.getElementById('venueDetailView').style.display = 'block';
  renderVenueDetailMap(v);
  if (pushState) updatePageHistory('venues', false, { venue: name });
  window.scrollTo(0, 0);
}

/* ── BACK to list ── */
function backToList(section) {
  if (window.history && window.history.state && window.history.state[section.slice(0, -1)]) {
    window.history.back();
    return;
  }

  const views = {
    performers: ['perfListView', 'perfDetailView'],
    djs:        ['djListView',   'djDetailView'],
    bartenders: ['barListView',  'barDetailView'],
    organizers: ['orgListView',  'orgDetailView'],
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
