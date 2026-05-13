/* ============================================================
   FRUIT LOOP PVD — Data Layer (js/data.js)

   HOW TO CONNECT YOUR GOOGLE SHEET:
   1. Create a Google Sheet with the tabs described below
   2. Go to File > Share > Publish to web
   3. Choose "Entire document" and "CSV" format, click Publish
   4. Copy the Sheet ID from your sheet's URL:
      https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit
   5. Paste your Sheet ID into SHEET_ID below

   EVENTS TAB COLUMNS:
   Date, Day, Time, AMPM, EventName, Venue, Location, Vibe, Type, Age,
   Cover, TicketURL, Performers, DJs, Bartenders, Tags, Cancelled,
   RecurType, RecurDay, RecurWeek, RecurStart, RecurEnd

   For ONE-OFF events: fill in Date, leave RecurType blank.
   For RECURRING events: fill in RecurType + RecurDay + RecurWeek (if needed)
     + RecurStart, leave Date blank.

   RecurType values:  weekly · biweekly · monthly · twicemonthly
   RecurDay values:   Monday · Tuesday · Wednesday · Thursday · Friday · Saturday · Sunday
   RecurWeek values:
     monthly:       1, 2, 3, 4, or "last"
     twicemonthly:  two numbers like "2,4"
     biweekly:      the date of the first occurrence (YYYY-MM-DD)

   OVERRIDING A RECURRING EVENT:
   Add a one-off row with the specific Date and the same EventName.
   Set Cancelled=TRUE to cancel that occurrence,
   or fill in different details to override it (e.g. special guest).

   OTHER TABS:
   Performers: ID, Name, Role, Initials, AvatarColor, Bio, Events
   DJs:        ID, Name, Genre, Initials, AvatarColor, Residency, Bio, Events
   Bartenders: ID, Name, Initials, AvatarColor, Bio, Venues, Events
   Venues:     Name, Types, Neighborhood, HoodLabel, BannerStyle, EventCount, Address, Website
   ============================================================ */

const SHEET_ID = '1KsVVPNNXVu-AWpIKy3ZntCBF_Af4MqW_kGIF-LDcJWQ';

const SHEET_TABS = {
  events:     'Events',
  performers: 'Performers',
  djs:        'DJs',
  bartenders: 'Bartenders',
  venues:     'Venues',
};

const RECUR_MONTHS_AHEAD = 2;

const DAY_NUM  = { sunday:0, monday:1, tuesday:2, wednesday:3, thursday:4, friday:5, saturday:6 };
const DAY_NAMES   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

/* ── Photo URL normalizer ──
   Converts Google Drive sharing URLs to direct image URLs.
   Any other URL is returned as-is.
   Drive share URL:  https://drive.google.com/file/d/FILE_ID/view?usp=sharing
   Direct image URL: https://drive.google.com/uc?export=view&id=FILE_ID        */
function normalizePhotoUrl(url) {
  if (!url) return '';
  const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return `https://drive.google.com/uc?export=view&id=${match[1]}`;
  return url;
}

/* ════════════════════════════════════════════
   RECURRENCE ENGINE
   ════════════════════════════════════════════ */

function expandRecurring(row) {
  const type    = (row.RecurType  || '').toLowerCase().trim();
  const dayName = (row.RecurDay   || '').toLowerCase().trim();
  const weekStr = (row.RecurWeek  || '').trim();
  const startStr= (row.RecurStart || '').trim();
  const endStr  = (row.RecurEnd   || '').trim();
  if (row.EventName && row.EventName.includes('Bear')) {
    console.log('DEBUG Bear Sundays row:', JSON.stringify({
      RecurType: row.RecurType,
      RecurTypeChars: [...(row.RecurType||'')].map(c => c.charCodeAt(0)),
      type, dayName, weekStr, startStr,
      hasDate: !!(row.Date||'').trim()
    }));
  }
  if (!type || !dayName) return [];

  const targetDay = DAY_NUM[dayName];
  if (targetDay === undefined) return [];

  const today   = _startOfDay(new Date());
  const horizon = _addMonths(today, RECUR_MONTHS_AHEAD);
  const start   = startStr ? _startOfDay(new Date(startStr + 'T12:00:00')) : today;
  const end     = endStr   ? _startOfDay(new Date(endStr   + 'T12:00:00')) : horizon;
  const winStart = start > today ? start : today;
  const winEnd   = end   < horizon ? end : horizon;
  if (winStart > winEnd) return [];

  const dates = [];

  if (type === 'weekly') {
    let d = _firstOnOrAfter(winStart, targetDay);
    while (d <= winEnd) { dates.push(_toYMD(d)); d = _addDays(d, 7); }

  } else if (type === 'biweekly') {
    const anchorStr = weekStr || startStr;
    if (!anchorStr) return [];
    const anchor = _startOfDay(new Date(anchorStr + 'T12:00:00'));
    let d = _firstOnOrAfter(winStart, targetDay);
    while (_weeksBetween(anchor, d) % 2 !== 0) d = _addDays(d, 7);
    while (d <= winEnd) { dates.push(_toYMD(d)); d = _addDays(d, 14); }

  } else if (type === 'monthly') {
    const isLast = weekStr.toLowerCase() === 'last';
    const nth    = isLast ? null : parseInt(weekStr);
    if (!isLast && isNaN(nth)) return [];
    let [y, m] = [winStart.getFullYear(), winStart.getMonth()];
    for (let i = 0; i < (RECUR_MONTHS_AHEAD + 2) * 2; i++) {
      const d = isLast ? _lastWeekday(y, m, targetDay) : _nthWeekday(y, m, targetDay, nth);
      if (d && d >= winStart && d <= winEnd) dates.push(_toYMD(d));
      if (++m > 11) { m = 0; y++; }
      if (new Date(y, m, 1) > winEnd) break;
    }

  } else if (type === 'twicemonthly') {
    const weeks = weekStr.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    if (!weeks.length) return [];
    let [y, m] = [winStart.getFullYear(), winStart.getMonth()];
    for (let i = 0; i < (RECUR_MONTHS_AHEAD + 2) * 2; i++) {
      for (const nth of weeks) {
        const d = _nthWeekday(y, m, targetDay, nth);
        if (d && d >= winStart && d <= winEnd) dates.push(_toYMD(d));
      }
      if (++m > 11) { m = 0; y++; }
      if (new Date(y, m, 1) > winEnd) break;
    }
  }

  return dates.sort();
}

function _startOfDay(d) { const c = new Date(d); c.setHours(0,0,0,0); return c; }
function _addDays(d, n)  { const c = new Date(d); c.setDate(c.getDate() + n); return c; }
function _addMonths(d, n){ const c = new Date(d); c.setMonth(c.getMonth() + n); return c; }
function _weeksBetween(a, b) { return Math.round(Math.abs(b-a) / (7*24*60*60*1000)); }
function _toYMD(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function _firstOnOrAfter(from, day) {
  const d = new Date(from);
  while (d.getDay() !== day) d.setDate(d.getDate() + 1);
  return d;
}
function _nthWeekday(year, month, day, nth) {
  let count = 0;
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    if (d.getDay() === day && ++count === nth) return new Date(d);
    d.setDate(d.getDate() + 1);
  }
  return null;
}
function _lastWeekday(year, month, day) {
  const d = new Date(year, month + 1, 0);
  while (d.getDay() !== day) d.setDate(d.getDate() - 1);
  return new Date(d);
}
function _dateMeta(ymd) {
  const d = _startOfDay(new Date(ymd + 'T12:00:00'));
  return { date: ymd, day: DAY_NAMES[d.getDay()], dateNum: String(d.getDate()), month: MONTH_NAMES[d.getMonth()] };
}

/* ════════════════════════════════════════════
   ROW CONVERTERS
   ════════════════════════════════════════════ */

function _baseFields(row) {
  return {
    name:        row.EventName  || '',
    venue:       row.Venue      || '',
    location:    row.Location   || '',
    time:        row.Time       || '',
    ampm:        row.AMPM       || '',
    vibe:        row.Vibe       || '',
    type:        row.Type       || '',
    age:         row.Age        || '',
    cover:       row.Cover      || '',
    ticketUrl:   row.TicketURL  || '',
    flierUrl:    row.FlierURL   || '',
    eventUrl:    row.EventURL   || '',
    socials:     { instagram:row.InstagramURL||'', facebook:row.FacebookURL||'', website:row.EventWebsite||'' },
    performers:  row.Performers ? row.Performers.split(',').map(s=>s.trim()).filter(Boolean) : [],
    djs:         row.DJs        ? row.DJs.split(',').map(s=>s.trim()).filter(Boolean) : [],
    bartenders:  row.Bartenders ? row.Bartenders.split(',').map(s=>s.trim()).filter(Boolean) : [],
    promoters:   row.Promoters  ? row.Promoters.split(',').map(s=>s.trim()).filter(Boolean)  : [],
    beneficiary: row.Beneficiary || '',
    tags:        row.Tags       ? row.Tags.split(',').map(s=>s.trim().toLowerCase()).filter(Boolean) : [],
    cancelled:   (row.Cancelled||'').toUpperCase() === 'TRUE',
    recurring:   false,
  };
}

function _oneOff(row, id) {
  const ymd = (row.Date||'').trim();
  const meta = ymd ? _dateMeta(ymd) : { date:'', day:row.Day||'', dateNum:'', month:'' };
  return { id, ...meta, ..._baseFields(row) };
}

function _recurInstances(row, baseId) {
  return expandRecurring(row).map(ymd => ({
    id: `${baseId}-${ymd}`,
    ..._dateMeta(ymd),
    ..._baseFields(row),
    recurring: true,
  }));
}

// Apply a one-off row as a partial override onto a recurring instance.
// Only fields that are explicitly filled in the one-off row will override
// the template — everything left blank inherits from the recurring event.
// This means a one-off only needs Date + EventName + whatever is different
// (e.g. just Performers to announce this week's lineup).
function _applyOverride(template, overrideRow) {
  const r = overrideRow;
  return {
    ...template,
    name:       r.EventName  || template.name,
    venue:      r.Venue      || template.venue,
    location:   r.Location   || template.location,
    time:       r.Time       || template.time,
    ampm:       r.AMPM       || template.ampm,
    vibe:       r.Vibe       || template.vibe,
    type:       r.Type       || template.type,
    age:        r.Age        || template.age,
    cover:      r.Cover      || template.cover,
    ticketUrl:  r.TicketURL  || template.ticketUrl,
    flierUrl:   r.FlierURL   || template.flierUrl,
    eventUrl:   r.EventURL   || template.eventUrl,
    // List fields only override if the one-off column has any content
    performers: r.Performers ? r.Performers.split(',').map(s=>s.trim()).filter(Boolean) : template.performers,
    djs:        r.DJs        ? r.DJs.split(',').map(s=>s.trim()).filter(Boolean)        : template.djs,
    bartenders:  r.Bartenders  ? r.Bartenders.split(',').map(s=>s.trim()).filter(Boolean)  : template.bartenders,
    promoters:   r.Promoters   ? r.Promoters.split(',').map(s=>s.trim()).filter(Boolean)   : template.promoters,
    beneficiary: r.Beneficiary || template.beneficiary,
    tags:       r.Tags       ? r.Tags.split(',').map(s=>s.trim().toLowerCase()).filter(Boolean) : template.tags,
    cancelled:  (r.Cancelled||'').toUpperCase() === 'TRUE',
    overridden: true,
    recurring:  true,
  };
}

function mergeEvents(rows) {
  const oneOffRows = [], recurRows = [];
  rows.forEach((row, i) => {
    const hasDate  = (row.Date||'').trim() !== '';
    const hasRecur = (row.RecurType||'').trim() !== '';
    if (hasRecur && !hasDate) recurRows.push({ row, baseId: i+1 });
    else if (hasDate) oneOffRows.push({ row, id: i+1 });
  });

  // Map of date+name -> one-off row for fast override lookup
  const overrideMap = new Map();
  oneOffRows.forEach(({ row, id }) => {
    const key = `${(row.Date||'').trim()}|${(row.EventName||'').toLowerCase().trim()}`;
    overrideMap.set(key, { row, id });
  });

  // Track which one-off rows matched a recurring template
  const matchedOneOffs = new Set();

  // Expand recurring rows, merging any matching one-off as a partial override
  const recurInstances = [];
  recurRows.forEach(({ row, baseId }) => {
    _recurInstances(row, baseId).forEach(inst => {
      const key = `${inst.date}|${inst.name.toLowerCase()}`;
      if (overrideMap.has(key)) {
        matchedOneOffs.add(key);
        const merged = _applyOverride(inst, overrideMap.get(key).row);
        merged.id = `${baseId}-${inst.date}`;
        if (!merged.cancelled) recurInstances.push(merged);
      } else {
        recurInstances.push(inst);
      }
    });
  });

  // One-off rows with no matching recurring template are standalone events
  const standaloneOneOffs = oneOffRows
    .filter(({ row }) => {
      const key = `${(row.Date||'').trim()}|${(row.EventName||'').toLowerCase().trim()}`;
      return !matchedOneOffs.has(key);
    })
    .map(({ row, id }) => _oneOff(row, id))
    .filter(e => !e.cancelled);

  function toMinutes(e) {
    const parts = (e.time||'0:00').split(':');
    let h = parseInt(parts[0]) || 0;
    const m = parseInt(parts[1]) || 0;
    if (e.ampm === 'PM' && h !== 12) h += 12;
    if (e.ampm === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  }

  return [...standaloneOneOffs, ...recurInstances].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return toMinutes(a) - toMinutes(b);
  });
}

function rowToPerformer(row) {
  return { id: row.ID||(row.Name||'').toLowerCase().replace(/\s+/g,'-'), name:row.Name||'', role:row.Role||'Performer', initials:row.Initials||(row.Name||'').split(' ').map(w=>w[0]).join('').slice(0,2), avatarColor:row.AvatarColor||'pink', residency:row.Residency||'local', bio:row.Bio||'', photoUrl:normalizePhotoUrl(row.PhotoURL||''), tags:row.Tags?row.Tags.split(',').map(s=>s.trim().toLowerCase()).filter(Boolean):[], socials:{instagram:row.InstagramURL||'',tiktok:row.TikTokURL||'',facebook:row.FacebookURL||'',youtube:row.YouTubeURL||'',website:row.WebsiteURL||'',linktree:row.LinktreeURL||''}, events:row.Events?row.Events.split(',').map(s=>s.trim()).filter(Boolean):[] };
}
function rowToDJ(row) {
  return { id: row.ID||(row.Name||'').toLowerCase().replace(/\s+/g,'-'), name:row.Name||'', genre:row.Genre||'', initials:row.Initials||(row.Name||'').split(' ').map(w=>w[0]).join('').slice(0,2), avatarColor:row.AvatarColor||'blue', residency:row.Residency||'local', bio:row.Bio||'', photoUrl:normalizePhotoUrl(row.PhotoURL||''), socials:{instagram:row.InstagramURL||'',tiktok:row.TikTokURL||'',facebook:row.FacebookURL||'',youtube:row.YouTubeURL||'',website:row.WebsiteURL||'',linktree:row.LinktreeURL||''}, events:row.Events?row.Events.split(',').map(s=>s.trim()).filter(Boolean):[] };
}
function rowToBartender(row) {
  return { id: row.ID||(row.Name||'').toLowerCase().replace(/\s+/g,'-'), name:row.Name||'', initials:row.Initials||(row.Name||'').split(' ').map(w=>w[0]).join('').slice(0,2), avatarColor:row.AvatarColor||'teal', residency:row.Residency||'local', bio:row.Bio||'', photoUrl:normalizePhotoUrl(row.PhotoURL||''), schedule:row.Schedule||'', socials:{instagram:row.InstagramURL||'',tiktok:row.TikTokURL||'',facebook:row.FacebookURL||'',youtube:row.YouTubeURL||'',website:row.WebsiteURL||'',linktree:row.LinktreeURL||''}, venues:row.Venues?row.Venues.split(',').map(s=>s.trim()).filter(Boolean):[], events:row.Events?row.Events.split(',').map(s=>s.trim()).filter(Boolean):[] };
}
function rowToVenue(row) {
  const types = row.Types?row.Types.split(',').map(s=>s.trim().toLowerCase()).filter(Boolean):[];
  return { name:row.Name||'', types, hood:row.Neighborhood||'', hoodLabel:row.HoodLabel||row.Neighborhood||'', bannerStyle:row.BannerStyle||`vb-${types[0]||'safe'}`, address:row.Address||'', website:row.Website||'', photoUrl:normalizePhotoUrl(row.PhotoURL||''), socials:{instagram:row.InstagramURL||'',tiktok:row.TikTokURL||'',facebook:row.FacebookURL||'',youtube:row.YouTubeURL||'',website:row.WebsiteURL||'',linktree:row.LinktreeURL||''} };
}

/* ════════════════════════════════════════════
   GOOGLE SHEETS FETCHER
   ════════════════════════════════════════════ */

async function fetchSheet(tabName) {
  if (SHEET_ID === 'YOUR_GOOGLE_SHEET_ID_HERE') return null;
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return parseCSV(await res.text());
  } catch(e) { console.warn('Sheet fetch failed:', tabName, e); return null; }
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g,'').trim());
  console.log('DEBUG sheet headers:', headers);
  return lines.slice(1).map(line => {
    const vals = []; let cur='', inQ=false;
    for (let i=0; i<line.length; i++) {
      if (line[i]==='"'){inQ=!inQ;continue}
      if (line[i]===','&&!inQ){vals.push(cur.trim());cur='';continue}
      cur+=line[i];
    }
    vals.push(cur.trim());
    const obj = {};
    headers.forEach((h,i) => { obj[h] = vals[i]||''; });
    return obj;
  });
}

/* ════════════════════════════════════════════
   SAMPLE DATA
   ════════════════════════════════════════════ */

const SAMPLE_ROWS = [
  { Date:'2026-04-04', Time:'9:00',  AMPM:'PM', EventName:'Glitter Bomb',           Venue:'Fête',         Location:'Providence',      Vibe:'Dance night', Type:'DJ set',    Age:'21+',      Cover:'$10 cover',   TicketURL:'#', Performers:'Lux Vandal',                                                       DJs:'DJ Velveeta',              FlierURL:'https://via.placeholder.com/600x800/150820/f7c6ff?text=Glitter+Bomb',              Bartenders:'Marcy Malone', Tags:'dance,21' },
  { Date:'2026-04-04', Time:'10:00', AMPM:'PM', EventName:'Drag Disaster',          Venue:'The Stable',   Location:'Providence',      Vibe:'Drag show',   Type:'Drag show', Age:'18+',      Cover:'$15 cover',   TicketURL:'#', Performers:'Rhonda Rotten,Miss Behave,Crystal Void',                          DJs:'',                         FlierURL:'https://via.placeholder.com/600x800/0d0b14/ffdb6e?text=Drag+Disaster',                         Bartenders:'Marcy Malone', Tags:'drag' },
  { Date:'2026-04-11', Time:'10:00', AMPM:'PM', EventName:'Velvet Underground',     Venue:'The Stable',   Location:'Providence',      Vibe:'Dance night', Type:'DJ set',    Age:'21+',      Cover:'$8 cover',    TicketURL:'#', Performers:'Crystal Void',                                                    DJs:'Sable Chrome',             Bartenders:'Joe Diamond',  Tags:'dance,21' },
  { Date:'2026-04-19', Time:'8:00',  AMPM:'PM', EventName:'Spring Fling Drag Ball', Venue:'AS220',        Location:'Providence',      Vibe:'Drag show',   Type:'Drag show', Age:'All ages', Cover:'$20 advance', TicketURL:'#', Performers:'Rhonda Rotten,Miss Behave,Bunny St. Claire,Lux Vandal,Crystal Void', DJs:'DJ Velveeta', Bartenders:'', Tags:'drag,allages' },
  // Override: Apr 5 brunch has special guest — wins over the recurring Saturday row
  { Date:'2026-04-05', Time:'11:00', AMPM:'AM', EventName:'Queer Brunch',           Venue:'Persimmon',    Location:'East Providence', Vibe:'Brunch',      Type:'Brunch',    Age:'All ages', Cover:'Free',        TicketURL:'',  Performers:'Bunny St. Claire,Rhonda Rotten',                                  DJs:'',                         Bartenders:'Joe Diamond',  Tags:'brunch,allages' },
  // Recurring: every Saturday brunch
  { RecurType:'weekly',       RecurDay:'Saturday',  RecurStart:'2026-04-01', Time:'11:00', AMPM:'AM', EventName:'Queer Brunch',   Venue:'Persimmon',   Location:'East Providence', Vibe:'Brunch',      Type:'Brunch',    Age:'All ages', Cover:'Free',       TicketURL:'', Performers:'Bunny St. Claire', DJs:'',            Bartenders:'Joe Diamond', Tags:'brunch,allages' },
  // Recurring: 2nd and 4th Wednesday bingo
  { RecurType:'twicemonthly', RecurDay:'Wednesday', RecurWeek:'2,4', RecurStart:'2026-04-01', Time:'7:00', AMPM:'PM', EventName:'Queer Bingo', Venue:'The Alley Cat', Location:'Providence', Vibe:'Bingo', Type:'Game night', Age:'All ages', Cover:'Free', TicketURL:'', Performers:'Rhonda Rotten', DJs:'', Bartenders:'Reyna Cruz', Tags:'bingo,allages' },
  // Recurring: last Friday dance night
  { RecurType:'monthly',      RecurDay:'Friday',    RecurWeek:'last', RecurStart:'2026-04-01', Time:'10:00', AMPM:'PM', EventName:'Last Friday', Venue:'Fête', Location:'Providence', Vibe:'Dance night', Type:'DJ set', Age:'21+', Cover:'$10 cover', TicketURL:'#', Performers:'', DJs:'DJ Velveeta', Bartenders:'Marcy Malone', Tags:'dance,21' },
  // Recurring: every other Saturday dance night
  { RecurType:'biweekly',     RecurDay:'Saturday',  RecurWeek:'2026-04-05', RecurStart:'2026-04-05', Time:'9:00', AMPM:'PM', EventName:'Neon Sabbath', Venue:'Fête', Location:'Providence', Vibe:'Dance night', Type:'DJ set', Age:'21+', Cover:'$12 cover', TicketURL:'#', Performers:'', DJs:'DJ Velveeta,Sable Chrome', Bartenders:'Marcy Malone', Tags:'dance,21' },
];

const SAMPLE_PERFORMERS = [
  { id:'rhonda',     name:'Rhonda Rotten',   role:'Drag performer',        initials:'RR', avatarColor:'pink',   bio:"Providence's reigning queen of chaos. Known for jaw-dropping makeup, death-drop finishes, and making the whole room cry with laughter.", events:[] },
  { id:'missbehave', name:'Miss Behave',      role:'Drag performer',        initials:'MB', avatarColor:'purple', bio:'Campy, chaotic, and completely committed to the bit. Miss Behave has been lighting up Providence stages since 2019.', events:[] },
  { id:'bunny',      name:'Bunny St. Claire', role:'Drag performer & host', initials:'BS', avatarColor:'gold',   bio:'The sweetest hostess in the city — equal parts warmth and shade. Bunny runs a tight show and makes every room feel like home.', events:[] },
  { id:'lux',        name:'Lux Vandal',       role:'Drag performer',        initials:'LV', avatarColor:'pink',   bio:'New to the Providence scene but already making waves. Lux brings avant-garde looks and unexpected musical choices.', events:[] },
  { id:'crystal',    name:'Crystal Void',     role:'Drag performer',        initials:'CV', avatarColor:'purple', bio:"Dark, ethereal, occasionally terrifying. Crystal's aesthetic is somewhere between goth nightmare and fever dream.", events:[] },
];

const SAMPLE_DJS = [
  { id:'velveeta', name:'DJ Velveeta',  genre:'Hi-NRG · Hyperpop · Pop',        initials:'VV', avatarColor:'blue',   residency:'local',   bio:'The unofficial soundtrack to Providence queer nightlife.', events:[] },
  { id:'sable',    name:'Sable Chrome', genre:'Darkwave · Industrial · EBM',     initials:'SC', avatarColor:'purple', residency:'local',   bio:"Darker, slower, heavier. Sable Chrome's sets make you feel like you're in a movie.", events:[] },
  { id:'bruja',    name:'DJ Bruja',     genre:'Reggaeton · Latin club · Cumbia', initials:'BR', avatarColor:'pink',   residency:'visitor', bio:'A frequent visitor from Boston bringing Latin club heat to Providence queers.', events:[] },
  { id:'mx',       name:'MX. STATIC',   genre:'Noise · Experimental · Club',     initials:'MX', avatarColor:'teal',   residency:'guest',   bio:'A one-night-only guest booking from NYC — experimental, noisy, unforgettable.', events:[] },
];

const SAMPLE_BARTENDERS = [
  { id:'marcy', name:'Marcy Malone', initials:'MM', avatarColor:'teal',   bio:'A Providence fixture for over a decade. Marcy is as known for her pour as for her commentary.', venues:['Fête','The Stable'],    events:[] },
  { id:'joe',   name:'Joe Diamond',  initials:'JD', avatarColor:'gold',   bio:'Specializes in classic cocktails and making regulars feel like royalty.',                        venues:['Persimmon','The Stable'],events:[] },
  { id:'reyna', name:'Reyna Cruz',   initials:'RC', avatarColor:'purple', bio:'Known for experimental cocktail menus and an encyclopedic knowledge of queer nightlife history.',venues:['The Alley Cat'],         events:[] },
];

const SAMPLE_VENUES = [
  { name:'The Alley Cat', types:['queer','restaurant'], hood:'downtown', hoodLabel:'Downtown PVD',    bannerStyle:'vb-queer' },
  { name:'AS220',         types:['arts','safe'],         hood:'downtown', hoodLabel:'Downtown PVD',    bannerStyle:'vb-arts' },
  { name:'Fête',          types:['safe','restaurant'],   hood:'westend',  hoodLabel:'West End',        bannerStyle:'vb-safe' },
  { name:'Oasis Bar',     types:['queer'],               hood:'downtown', hoodLabel:'Downtown PVD',    bannerStyle:'vb-queer' },
  { name:'Persimmon',     types:['restaurant','safe'],   hood:'eastprov', hoodLabel:'East Providence', bannerStyle:'vb-restaurant' },
  { name:'Riffraff',      types:['arts','safe'],         hood:'westend',  hoodLabel:'West End',        bannerStyle:'vb-arts' },
  { name:'The Stable',    types:['safe'],                hood:'eastside', hoodLabel:'East Side',       bannerStyle:'vb-safe' },
  { name:'Yacht Club',    types:['safe','restaurant'],   hood:'greater',  hoodLabel:'Greater RI',      bannerStyle:'vb-safe' },
];

function _linkPeople(events, performers, djs, bartenders) {
  const find = (list, name) => list.find(p => p.name.toLowerCase() === name.toLowerCase());
  events.forEach(e => {
    e.performers.forEach(n => { const p=find(performers,n); if(p&&!p.events.includes(e.id)) p.events.push(e.id); });
    e.djs.forEach(n => { const d=find(djs,n); if(d&&!d.events.includes(e.id)) d.events.push(e.id); });
    e.bartenders.forEach(n => { const b=find(bartenders,n); if(b&&!b.events.includes(e.id)) b.events.push(e.id); });
  });
}

/* ── Main loader ── */
async function loadData() {
  const [evRows, perfRows, djRows, barRows, venueRows] = await Promise.all([
    fetchSheet(SHEET_TABS.events),
    fetchSheet(SHEET_TABS.performers),
    fetchSheet(SHEET_TABS.djs),
    fetchSheet(SHEET_TABS.bartenders),
    fetchSheet(SHEET_TABS.venues),
  ]);

  const usingSheet = evRows !== null;
  const events     = mergeEvents(usingSheet ? evRows : SAMPLE_ROWS);
  const performers = perfRows  ? perfRows.map(rowToPerformer)  : JSON.parse(JSON.stringify(SAMPLE_PERFORMERS));
  const djs        = djRows    ? djRows.map(rowToDJ)            : JSON.parse(JSON.stringify(SAMPLE_DJS));
  const bartenders = barRows   ? barRows.map(rowToBartender)    : JSON.parse(JSON.stringify(SAMPLE_BARTENDERS));
  const venues     = venueRows ? venueRows.map(rowToVenue)      : SAMPLE_VENUES;

  _linkPeople(events, performers, djs, bartenders);

  return { events, performers, djs, bartenders, venues, usingSheet };
}
