'use strict';

// ── ISO week & today utilities (single source of truth) ───────────────────────

function getISOWeekKey(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return d.getFullYear() + '-W' + String(weekNo).padStart(2, '0');
}

function getTodayDayIndex() {
  // Returns 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
  return (new Date().getDay() + 6) % 7;
}

function getTodayDateString() {
  // Returns "YYYY-MM-DD" for today
  const d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function getCurrentWeekKey() {
  return getISOWeekKey(new Date());
}

const DEFAULT_START_H         = 6;
const DEFAULT_END_H_WEEKDAY   = 23;   // 11 PM
const DEFAULT_END_H_WEEKEND   = 25;   // 1 AM next day

let START_H = DEFAULT_START_H;
let END_H   = DEFAULT_END_H_WEEKDAY;

const ZOOM_LEVELS = [
  { interval: 60, hourH:  48 },
  { interval: 45, hourH:  64 },
  { interval: 30, hourH:  80 },
  { interval: 25, hourH: 100 },
  { interval: 20, hourH: 120 },
  { interval: 15, hourH: 160 },
  { interval: 10, hourH: 240 },
  { interval:  5, hourH: 360 },
];

let zoomIdx = 0;
let HOUR_H  = ZOOM_LEVELS[0].hourH;
let SNAP    = ZOOM_LEVELS[0].interval / 60;

const VIEW_MODE_KEY        = 'simsi-view-mode';
const WEEK_DISPLAY_START_H = DEFAULT_START_H;        // 6
const WEEK_DISPLAY_END_H   = DEFAULT_END_H_WEEKEND;  // 25
const WK_DAY_ABBRS         = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

const BLOCKS_KEY    = 'productive-v3-blocks';
const REMIND_KEY    = 'productive-v2-reminders';
const RISE_KEY      = 'productive-v3-rise-times';
const LIGHTS_KEY    = 'productive-v3-lights-times';
const DAY_RANGES_KEY   = 'simsi-v1-day-ranges';
const CUSTOM_ACTS_KEY  = 'productive-v1-custom-acts';
const DELETED_ACTS_KEY = 'productive-v1-deleted-acts';
const GOALS_KEY = 'simsi-goals';
const COUNTDOWNS_KEY = 'simsi-countdowns';
const DEFAULT_RISE   = '6:00am';
const DEFAULT_LIGHTS = '9:45pm';

// ── Background image rotation ─────────────────────────────────────────────────

const BACKGROUND_IMAGES = [
  'Backgrounds/Beach.jpeg',
  'Backgrounds/Boreals.jpeg',
  'Backgrounds/Croatia.jpeg',
  'Backgrounds/Dunes.jpeg',
  'Backgrounds/Earth.jpeg',
  'Backgrounds/Fuji.jpeg',
  'Backgrounds/Kilimanjro.jpeg',
  'Backgrounds/Mountain.jpeg',
  'Backgrounds/Patagonia.jpeg',
  'Backgrounds/PhiPhi.jpeg',
  'Backgrounds/Savannah.jpeg',
  'Backgrounds/Sky.jpeg',
  'Backgrounds/Soususflie.jpeg',
  'Backgrounds/Swiss background.jpg',
];
const BG_INDEX_KEY = 'simsi-bg-index';

function setHeroBackground(idx) {
  const heroImg = document.querySelector('.home-bg-img');
  const blurBg  = document.querySelector('.card-blur-bg');
  if (!heroImg) return;

  heroImg.style.opacity = '0';

  function tryLoad(i, tried) {
    if (tried >= BACKGROUND_IMAGES.length) {
      heroImg.style.opacity = '1';
      return;
    }
    const url = BACKGROUND_IMAGES[i % BACKGROUND_IMAGES.length];
    const img = new Image();
    img.onload = () => {
      heroImg.src = url;
      if (blurBg) blurBg.style.backgroundImage = `url('${url}')`;
      heroImg.style.opacity = '1';
    };
    img.onerror = () => tryLoad(i + 1, tried + 1);
    img.src = url;
  }

  tryLoad(idx, 0);
}

function advanceAndSetBackground() {
  const raw = localStorage.getItem(BG_INDEX_KEY);
  const current = raw !== null ? parseInt(raw, 10) : 0;
  const next = (current + 1) % BACKGROUND_IMAGES.length;
  localStorage.setItem(BG_INDEX_KEY, String(next));
  setHeroBackground(next);
}

function initBackgroundImage() {
  const raw = localStorage.getItem(BG_INDEX_KEY);
  const currentIndex = raw !== null ? parseInt(raw, 10) : 0;
  setHeroBackground(currentIndex);
}

// ── Activity definitions ──────────────────────────────────────────────────────

const ACTIVITIES = [
  { id:'ready',       name:'Getting Ready',      cat:'routine',  group:'morning'  },
  { id:'bfast',       name:'Breakfast',          cat:'routine',  group:'morning'  },
  { id:'bedready',    name:'Get Ready for Bed',  cat:'routine',  group:'morning'  },
  { id:'school',   name:'School',   cat:'academic', group:'academic', popup:'school',   opts:['8:35am','9:20am']                                   },
  { id:'study',    name:'Study',    cat:'academic', group:'academic', popup:'text',     prompt:'What subject?',        labelFn: s => `Study: ${s}` },
  { id:'hw',       name:'HW',       cat:'academic', group:'academic', popup:'text',     prompt:'What subject?',        labelFn: s => `HW: ${s}`    },
  { id:'mathTutor',   name:'Math Tutoring',      cat:'academic', group:'academic' },
  { id:'fit',         name:'FIT Time',           cat:'academic', group:'academic' },
  { id:'piano',       name:'Practice Piano',     cat:'academic', group:'music'    },
  { id:'pianoLesson', name:'Piano Lesson',       cat:'academic', group:'music'    },
  { id:'gym',      name:'Gym',      cat:'fitness',  group:'health',   popup:'dropdown', opts:['Chest','Back','Legs','Arms','Abs','Rest'], labelFn: s => `Gym: ${s}` },
  { id:'shower',      name:'Cold Shower',        cat:'routine',  group:'health'   },
  { id:'chores',      name:'Chores',             cat:'life',     group:'home'     },
  { id:'mealprep',    name:'Meal Prep',          cat:'life',     group:'home'     },
  { id:'shopping', name:'Shopping', cat:'life',     group:'home',     popup:'shopping'                                                              },
  { id:'social',      name:'Social Time',        cat:'social',   group:'social_d' },
  { id:'downtime',    name:'Downtime',           cat:'social',   group:'social_d' },
  { id:'custom',   name:'Custom',   cat:'custom',   group:'other',    popup:'text',     prompt:'What is this block?',  labelFn: s => s             },
  { id:'owe', name:'Owe', cat:'reminder', group:'other', popup:'owe', clickOnly: true },
];

const LIBRARY_GROUPS = [
  { key: 'morning',  label: 'Morning Routine'    },
  { key: 'academic', label: 'Academics'          },
  { key: 'music',    label: 'Music'              },
  { key: 'health',   label: 'Health & Fitness'   },
  { key: 'home',     label: 'Home'               },
  { key: 'social_d', label: 'Social & Downtime'  },
  { key: 'other',    label: 'Other'              },
];

const CUSTOM_ACT_SWATCHES = [
  { group: 'morning',  cat: 'routine',  color: '#F4A535', label: 'Morning Routine'   },
  { group: 'academic', cat: 'academic', color: '#4A9EE8', label: 'Academics'         },
  { group: 'music',    cat: 'academic', color: '#4A9EE8', label: 'Music'             },
  { group: 'health',   cat: 'fitness',  color: '#4CAF7D', label: 'Health & Fitness'  },
  { group: 'home',     cat: 'life',     color: '#F47C35', label: 'Home'              },
  { group: 'social_d', cat: 'social',   color: '#9B72CF', label: 'Social & Downtime' },
  { group: 'other',    cat: 'custom',   color: '#7A8494', label: 'Other'             },
];

// ── State ─────────────────────────────────────────────────────────────────────

let currentDate     = new Date();
let viewYear        = currentDate.getFullYear();

let activeDrag        = null;
let isDraggingFromLibrary = false;
let activeResize      = null;
let activeBlockDrag   = null;
let activeWkCrossDrag = null;
let activeWkInColDrag = null;
let pendingDrop       = null;
let pendingAct        = null;

let _blockDragJustMoved = false;
let _ctxMenu            = null;
let _dragHoverCol       = null;
let _editList           = null;

let _reorderDragActId   = null;
let _reorderDragGroup   = null;
let _chipCatDropdown    = null;
let _chipReorderPending = null;

let currentViewMode  = 'day';
let weekViewAnchor   = null;

let reminders        = [];
let riseTimes        = {};
let lightsTimes      = {};
let dayRanges        = {};
let libCollapsed     = {};
let customActivities = [];
let deletedActIds    = new Set();
let goalsData        = [];
let countdownsData   = [];
let _currentBookIdx  = 0;
let _goalModalId = null;

// ── Date helpers ──────────────────────────────────────────────────────────────

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function todayKey() {
  return dateKey(new Date());
}

function formatDateFull(d) {
  const weekDays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months   = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return `${weekDays[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

// ── Misc helpers ──────────────────────────────────────────────────────────────

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2,6)}`;

function hourLabel(h) {
  const n = ((h % 24) + 24) % 24;
  if (appSettings.timeFormat === '24hr') return `${String(n).padStart(2,'0')}:00`;
  if (n === 12) return '12 PM';
  if (n === 0)  return '12 AM';
  return n < 12 ? `${n} AM` : `${n - 12} PM`;
}

function durLabel(h) {
  const hrs  = Math.floor(h);
  const mins = Math.round((h % 1) * 60);
  if (hrs === 0)  return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

function timeRangeLabel(startHour, dur) {
  function fmt(h) {
    const totalMins = Math.round(h * 60);
    const n   = Math.floor(totalMins / 60) % 24;
    const m   = totalMins % 60;
    if (appSettings.timeFormat === '24hr') {
      return `${String(n).padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
    }
    const sfx = n < 12 ? 'AM' : 'PM';
    const h12 = n === 0 ? 12 : n > 12 ? n - 12 : n;
    return `${h12}:${m.toString().padStart(2, '0')} ${sfx}`;
  }
  return `${fmt(startHour)} – ${fmt(startHour + dur)}`;
}

function yToHour(col, clientY) {
  const rect = col.getBoundingClientRect();
  const raw  = (clientY - rect.top) / HOUR_H + START_H;
  return Math.max(START_H, Math.min(END_H, raw));
}

function parseTimeStr(s) {
  const m = s.match(/^(\d+):(\d+)(am|pm)$/i);
  if (!m) return 0;
  let h = parseInt(m[1]);
  const min = parseInt(m[2]);
  if (m[3].toLowerCase() === 'pm' && h !== 12) h += 12;
  if (m[3].toLowerCase() === 'am' && h === 12) h = 0;
  return h + min / 60;
}

// ── Day range ─────────────────────────────────────────────────────────────────

function getDefaultEndH(date) {
  const dow = date.getDay();
  return (dow === 0 || dow === 6) ? DEFAULT_END_H_WEEKEND : DEFAULT_END_H_WEEKDAY;
}

function updateDayRange() {
  const key   = dateKey(currentDate);
  const saved = dayRanges[key];
  START_H = saved?.start ?? DEFAULT_START_H;
  END_H   = saved?.end   ?? getDefaultEndH(currentDate);
}

function applyDayRangeSettings(start, end) {
  const key = dateKey(currentDate);
  dayRanges[key] = { start, end };
  localStorage.setItem(DAY_RANGES_KEY, JSON.stringify(dayRanges));
  START_H = start;
  END_H   = end;
  const { interval, hourH } = ZOOM_LEVELS[zoomIdx];
  rebuildTimeLabels(interval, hourH);
  rebuildDayCells(interval, hourH);
  updateBlockPositions();
  document.getElementById('calBody').scrollTop = 0;
}

function loadDayRanges() {
  try {
    const raw = localStorage.getItem(DAY_RANGES_KEY);
    if (raw) dayRanges = JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to load day ranges:', e);
  }
}

// ── Calendar build (single day column) ───────────────────────────────────────

function buildCalendar() {
  updateDayRange();
  const body = document.getElementById('calBody');

  const timeCol = document.createElement('div');
  timeCol.className = 'time-labels';
  body.appendChild(timeCol);

  const col = document.createElement('div');
  col.className = 'day-col';
  col.dataset.day = dateKey(currentDate);

  const ind = document.createElement('div');
  ind.className = 'drop-indicator';
  col.appendChild(ind);

  col.addEventListener('dragover',  onColDragOver);
  col.addEventListener('dragleave', onColDragLeave);
  col.addEventListener('drop',      onColDrop);
  body.appendChild(col);

  const { interval, hourH } = ZOOM_LEVELS[zoomIdx];
  rebuildTimeLabels(interval, hourH);
  rebuildDayCells(interval, hourH);
}

// ── Day navigation ────────────────────────────────────────────────────────────

function navigateDay(offset) {
  const d = new Date(currentDate);
  d.setDate(d.getDate() + offset);
  currentDate = d;
  renderCurrentDay();
}

function renderCurrentDay() {
  const key = dateKey(currentDate);

  document.getElementById('dayNavTitle').textContent = formatDateFull(currentDate);

  const col = document.querySelector('.day-col');
  if (col) col.dataset.day = key;

  document.querySelectorAll('.cal-block').forEach(b => b.remove());

  const oldStart = START_H, oldEnd = END_H;
  updateDayRange();
  if (START_H !== oldStart || END_H !== oldEnd) {
    const { interval, hourH } = ZOOM_LEVELS[zoomIdx];
    rebuildTimeLabels(interval, hourH);
    rebuildDayCells(interval, hourH);
  }

  loadBlocksForDay(key);
  updateTagRowsForDay(key);
  updateActiveBlock();
}

function initDayNav() {
  document.getElementById('prevDay').addEventListener('click', () => {
    if (currentViewMode === 'week') navigateWeek(-1); else navigateDay(-1);
  });
  document.getElementById('nextDay').addEventListener('click', () => {
    if (currentViewMode === 'week') navigateWeek(1); else navigateDay(1);
  });

  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (currentViewMode === 'week') {
      if (e.key === 'ArrowLeft')  navigateWeek(-1);
      if (e.key === 'ArrowRight') navigateWeek(1);
    } else {
      if (e.key === 'ArrowLeft')  navigateDay(-1);
      if (e.key === 'ArrowRight') navigateDay(1);
    }
  });

  document.getElementById('dayNavTitle').textContent = formatDateFull(currentDate);
}

// ── Zoom ──────────────────────────────────────────────────────────────────────

function formatSubHourTime(h, min) {
  const n   = ((h % 24) + 24) % 24;
  if (appSettings.timeFormat === '24hr') {
    return `${String(n).padStart(2,'0')}:${min.toString().padStart(2,'0')}`;
  }
  const sfx = n < 12 ? 'AM' : 'PM';
  const h12 = n === 0 ? 12 : n > 12 ? n - 12 : n;
  return `${h12}:${min.toString().padStart(2, '0')} ${sfx}`;
}

function rebuildTimeLabels(interval, hourH) {
  const timeCol = document.querySelector('.time-labels');
  if (!timeCol) return;
  timeCol.innerHTML = '';

  const totalMinutes = (END_H - START_H) * 60;
  const cellH    = (interval / 60) * hourH;
  const numCells = Math.ceil(totalMinutes / interval);

  for (let i = 0; i < numCells; i++) {
    const m   = i * interval;
    const h   = START_H + Math.floor(m / 60);
    const min = m % 60;

    const lbl = document.createElement('div');
    lbl.className    = 'time-label';
    lbl.style.height = `${cellH}px`;
    if (cellH >= 14 && h < END_H) {
      lbl.textContent = min === 0 ? hourLabel(h) : formatSubHourTime(h, min);
    }
    timeCol.appendChild(lbl);
  }
}

function rebuildDayCells(interval, hourH) {
  const totalMinutes = (END_H - START_H) * 60;
  const cellH    = (interval / 60) * hourH;
  const numCells = Math.ceil(totalMinutes / interval);

  document.querySelectorAll('.day-col').forEach(col => {
    col.querySelectorAll('.hour-cell').forEach(c => c.remove());

    const frag = document.createDocumentFragment();
    for (let i = 0; i < numCells; i++) {
      const cell = document.createElement('div');
      cell.className    = 'hour-cell';
      cell.style.height = `${cellH}px`;
      if ((i * interval) % 60 === 0) cell.classList.add('hour-boundary');
      frag.appendChild(cell);
    }

    const indicator = col.querySelector('.drop-indicator');
    col.insertBefore(frag, indicator);
  });
}

function updateBlockPositions() {
  document.querySelectorAll('.cal-block').forEach(block => {
    const startHour = parseFloat(block.dataset.startHour);
    const duration  = parseFloat(block.dataset.duration);
    block.style.top    = `${(startHour - START_H) * HOUR_H}px`;
    block.style.height = `${duration * HOUR_H - 2}px`;
    updateBlockContent(block);
  });
}

function updateBlockContent(block) {
  const h = parseFloat(block.style.height) || 0;
  block.classList.toggle('block--compact', h < 42);
  block.classList.toggle('block--tiny',    h < 30);
  block.classList.toggle('block--no-badge', h < 36);
}

function updateActiveBlock() {
  const now = new Date();
  const isToday = getTodayDateString() === dateKey(currentDate);
  const nowHour = now.getHours() + now.getMinutes() / 60;
  document.querySelectorAll('.cal-block').forEach(block => {
    const start = parseFloat(block.dataset.startHour);
    const dur   = parseFloat(block.dataset.duration);
    const active = isToday && nowHour >= start && nowHour < start + dur;
    block.classList.toggle('block--active', active);
  });
}

let _zoomThrottle = false;

function applyZoom(newIdx, anchor) {
  const idx = Math.max(0, Math.min(ZOOM_LEVELS.length - 1, newIdx));
  if (idx === zoomIdx) return;

  const calBody = document.getElementById('calBody');

  const anchorOffsetY = anchor ? anchor.anchorOffsetY : calBody.clientHeight / 2;
  const anchorHour    = anchor
    ? anchor.anchorHour
    : (calBody.scrollTop + anchorOffsetY) / HOUR_H + START_H;

  zoomIdx = idx;
  const { interval, hourH } = ZOOM_LEVELS[zoomIdx];
  HOUR_H = hourH;
  SNAP   = interval / 60;

  document.documentElement.style.setProperty('--hour-h', `${hourH}px`);

  updateZoomUI();
  rebuildDayCells(interval, hourH);
  rebuildTimeLabels(interval, hourH);
  updateBlockPositions();
  updateActiveBlock();

  requestAnimationFrame(() => {
    calBody.scrollTop = Math.max(0, (anchorHour - START_H) * HOUR_H - anchorOffsetY);
  });

  if (currentViewMode === 'week') {
    rebuildWeekTimeAxis();
    renderWeekView();
    requestAnimationFrame(() => {
      const weekScroll = document.getElementById('weekScroll');
      if (weekScroll && anchor) {
        weekScroll.scrollTop = Math.max(
          0,
          (anchor.anchorHour - WEEK_DISPLAY_START_H) * HOUR_H - anchor.anchorOffsetY
        );
      }
    });
  }
}

function updateZoomUI() {
  const { interval } = ZOOM_LEVELS[zoomIdx];
  const label  = document.getElementById('zoomLabel');
  const btnIn  = document.getElementById('zoomIn');
  const btnOut = document.getElementById('zoomOut');
  if (label)  label.textContent = `${interval} min`;
  if (btnIn)  btnIn.disabled  = zoomIdx === ZOOM_LEVELS.length - 1;
  if (btnOut) btnOut.disabled = zoomIdx === 0;
}

function initZoom() {
  const calBody = document.getElementById('calBody');

  calBody.addEventListener('wheel', e => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    if (_zoomThrottle) return;
    _zoomThrottle = true;
    setTimeout(() => { _zoomThrottle = false; }, 100);

    const rect          = calBody.getBoundingClientRect();
    const anchorOffsetY = e.clientY - rect.top;
    const anchorHour    = (calBody.scrollTop + anchorOffsetY) / HOUR_H + START_H;
    applyZoom(zoomIdx + (e.deltaY > 0 ? -1 : 1), { anchorHour, anchorOffsetY });
  }, { passive: false });

  document.getElementById('weekScroll').addEventListener('wheel', e => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    if (_zoomThrottle) return;
    _zoomThrottle = true;
    setTimeout(() => { _zoomThrottle = false; }, 100);

    const scroll = document.getElementById('weekScroll');
    const rect = scroll.getBoundingClientRect();
    const anchorOffsetY = e.clientY - rect.top;
    const anchorHour = (scroll.scrollTop + anchorOffsetY) / HOUR_H + WEEK_DISPLAY_START_H;
    applyZoom(zoomIdx + (e.deltaY > 0 ? -1 : 1), { anchorHour, anchorOffsetY });
  }, { passive: false });

  document.getElementById('zoomIn').addEventListener('click',  () => applyZoom(zoomIdx + 1));
  document.getElementById('zoomOut').addEventListener('click', () => applyZoom(zoomIdx - 1));

  updateZoomUI();
}

// ── Library build ─────────────────────────────────────────────────────────────

function makeLibChip(act) {
  const chip = document.createElement('div');
  const isCustom = customActivities.some(a => a.id === act.id);

  if (act.clickOnly) {
    chip.className = 'activity-chip chip-owe';
    chip.title = 'Add to Reminders';
    chip.addEventListener('click', () => {
      if (chip.querySelector('.chip-confirm')) return;
      openOweModal();
    });
  } else {
    chip.className = `activity-chip chip-${act.cat}${isCustom ? ' chip--custom-act' : ''}`;
    chip.draggable = true;
    chip.dataset.actId = act.id;

    chip.addEventListener('dragstart', e => {
      if (chip.querySelector('.chip-confirm')) { e.preventDefault(); return; }

      if (isCustom && _chipReorderPending === chip) {
        _chipReorderPending = null;
        _reorderDragActId = act.id;
        _reorderDragGroup = act.group;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', `reorder:${act.id}`);
        chip.classList.add('chip--reordering');
        return;
      }

      isDraggingFromLibrary = true;
      activeDrag = act;
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('text/plain', act.id);
      setTimeout(() => chip.classList.add('dragging'), 0);
    });

    chip.addEventListener('dragend', () => {
      _chipReorderPending = null;
      if (_reorderDragActId === act.id) {
        chip.classList.remove('chip--reordering');
        clearInsertionLines();
        _reorderDragActId = null;
        _reorderDragGroup = null;
        return;
      }
      chip.classList.remove('dragging');
      cleanupDragVisuals();
      activeDrag = null;
      isDraggingFromLibrary = false;
    });

    // Touch/pen: HTML5 DnD never fires, so long-press lifts a ghost we drag manually.
    chip.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse') return;
      if (chip.querySelector('.chip-confirm')) return;
      if (e.target.closest('.chip-del') ||
          e.target.closest('.chip-cat-pill') ||
          e.target.closest('.chip-drag-handle')) return;
      armTouchLongPress(e, (sx, sy, pid) => beginChipTouchDrag(act, chip, sx, sy, pid));
    });
  }

  renderChipNormal(chip, act);
  return chip;
}

function renderChipNormal(chip, act) {
  chip.innerHTML = '';
  const isCustom = customActivities.some(a => a.id === act.id);

  if (isCustom) {
    const handle = document.createElement('span');
    handle.className = 'chip-drag-handle';
    handle.textContent = '⋮⋮';
    handle.addEventListener('mousedown', e => {
      e.stopPropagation();
      _chipReorderPending = chip;
      document.addEventListener('mouseup', _clearChipReorderPending, { once: true, capture: true });
    });
    chip.appendChild(handle);
  }

  const label = document.createElement('span');
  label.className = 'chip-label';
  label.textContent = act.name;
  chip.appendChild(label);

  if (isCustom) {
    const sw = CUSTOM_ACT_SWATCHES.find(s => s.group === act.group)
            ?? CUSTOM_ACT_SWATCHES[CUSTOM_ACT_SWATCHES.length - 1];
    const pill = document.createElement('button');
    pill.className = 'chip-cat-pill';
    const dot = document.createElement('span');
    dot.className = 'chip-cat-dot';
    dot.style.background = sw.color;
    pill.appendChild(dot);
    pill.addEventListener('mousedown', e => { e.stopPropagation(); e.preventDefault(); });
    pill.addEventListener('click', e => {
      e.stopPropagation();
      if (chip.querySelector('.chip-confirm')) return;
      openCatDropdown(pill, act);
    });
    chip.appendChild(pill);
  }

  const delBtn = document.createElement('button');
  delBtn.className = 'chip-del';
  delBtn.textContent = '×';
  delBtn.title = `Delete ${act.name}`;
  delBtn.addEventListener('mousedown', e => { e.stopPropagation(); e.preventDefault(); });
  delBtn.addEventListener('click', e => {
    e.stopPropagation();
    renderChipConfirm(chip, act);
  });
  chip.appendChild(delBtn);
}

function renderChipConfirm(chip, act) {
  const wasDraggable = chip.draggable;
  chip.draggable = false;
  chip.innerHTML = '';

  const row = document.createElement('div');
  row.className = 'chip-confirm';

  const text = document.createElement('span');
  text.className = 'chip-confirm-text';
  text.textContent = `Delete ${act.name}?`;

  const yes = document.createElement('button');
  yes.className = 'chip-confirm-yes';
  yes.textContent = 'Yes';

  const no = document.createElement('button');
  no.className = 'chip-confirm-no';
  no.textContent = 'No';

  yes.addEventListener('mousedown', e => e.stopPropagation());
  no.addEventListener('mousedown', e => e.stopPropagation());

  yes.addEventListener('click', e => {
    e.stopPropagation();
    deleteLibActivity(act);
  });

  no.addEventListener('click', e => {
    e.stopPropagation();
    chip.draggable = wasDraggable;
    renderChipNormal(chip, act);
  });

  row.appendChild(text);
  row.appendChild(yes);
  row.appendChild(no);
  chip.appendChild(row);
}

function buildLibrary() {
  const list = document.getElementById('activityList');
  list.innerHTML = '';

  LIBRARY_GROUPS.forEach((group, idx) => {
    const acts = ACTIVITIES.filter(a => a.group === group.key && !deletedActIds.has(a.id));
    if (!acts.length) return;

    const isCollapsed = !!libCollapsed[group.key];

    const header = document.createElement('div');
    header.className = 'lib-group-header';
    if (idx > 0) header.classList.add('lib-group-header--spaced');
    if (isCollapsed) header.classList.add('lib-group-header--collapsed');
    header.innerHTML = `
      <span class="lib-group-label">${group.label}</span>
      <svg class="lib-group-chevron" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
    `;

    const content = document.createElement('div');
    content.className = 'lib-group-content';
    if (isCollapsed) content.classList.add('lib-group--collapsed');

    acts.forEach(act => content.appendChild(makeLibChip(act)));

    content.addEventListener('dragover', e => {
      if (!_reorderDragActId || _reorderDragGroup !== group.key) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      showInsertionLine(content, e.clientY);
    });
    content.addEventListener('dragleave', e => {
      if (!_reorderDragActId || _reorderDragGroup !== group.key) return;
      if (!content.contains(e.relatedTarget)) clearInsertionLines(content);
    });
    content.addEventListener('drop', e => {
      if (!_reorderDragActId || _reorderDragGroup !== group.key) return;
      e.preventDefault();
      const actId    = _reorderDragActId;
      const groupKey = _reorderDragGroup;
      const idx      = getDropIndex(content, e.clientY);
      _reorderDragActId = null;
      _reorderDragGroup = null;
      clearInsertionLines(content);
      reorderCustomAct(actId, groupKey, idx);
    });

    header.addEventListener('click', () => {
      const nowCollapsed = content.classList.toggle('lib-group--collapsed');
      header.classList.toggle('lib-group-header--collapsed', nowCollapsed);
      libCollapsed[group.key] = nowCollapsed;
    });

    list.appendChild(header);
    list.appendChild(content);
  });

  const addBtn = document.createElement('button');
  addBtn.className = 'lib-add-btn';
  addBtn.textContent = '+ Add Activity';
  addBtn.addEventListener('click', () => showAddActivityForm(list, addBtn));
  list.appendChild(addBtn);
}

// ── Library: reorder and category-move for custom activities ─────────────────

function _clearChipReorderPending() {
  _chipReorderPending = null;
}

function showInsertionLine(content, clientY) {
  clearInsertionLines(content);
  const chips = [...content.querySelectorAll('.chip--custom-act:not(.chip--reordering)')];
  let refEl = null;
  for (const c of chips) {
    const r = c.getBoundingClientRect();
    if (clientY < r.top + r.height / 2) { refEl = c; break; }
  }
  const line = document.createElement('div');
  line.className = 'chip-insert-line';
  if (refEl) {
    content.insertBefore(line, refEl);
  } else {
    const last = chips[chips.length - 1];
    last ? last.insertAdjacentElement('afterend', line) : content.appendChild(line);
  }
}

function clearInsertionLines(container) {
  (container || document).querySelectorAll('.chip-insert-line').forEach(el => el.remove());
}

function getDropIndex(content, clientY) {
  const chips = [...content.querySelectorAll('.chip--custom-act:not(.chip--reordering)')];
  for (let i = 0; i < chips.length; i++) {
    const r = chips[i].getBoundingClientRect();
    if (clientY < r.top + r.height / 2) return i;
  }
  return chips.length;
}

function reorderCustomAct(actId, groupKey, dropIdx) {
  const groupActs = customActivities.filter(a => a.group === groupKey);
  const srcIdx    = groupActs.findIndex(a => a.id === actId);
  if (srcIdx === -1) return;

  const [moved] = groupActs.splice(srcIdx, 1);
  groupActs.splice(Math.min(dropIdx, groupActs.length), 0, moved);

  // Apply new order back into customActivities
  let gi = 0;
  for (let i = 0; i < customActivities.length; i++) {
    if (customActivities[i].group === groupKey) customActivities[i] = groupActs[gi++];
  }

  // Sync ACTIVITIES (custom entries in this group only)
  let ai = 0;
  for (let i = 0; i < ACTIVITIES.length; i++) {
    if (ACTIVITIES[i].group === groupKey && customActivities.some(c => c.id === ACTIVITIES[i].id)) {
      ACTIVITIES[i] = groupActs[ai++];
    }
  }

  saveCustomActivities();
  buildLibrary();
}

function openCatDropdown(pillEl, act) {
  closeCatDropdown();

  const dropdown = document.createElement('div');
  dropdown.className = 'chip-cat-dropdown';

  CUSTOM_ACT_SWATCHES.forEach(sw => {
    const item = document.createElement('div');
    item.className = 'chip-cat-dropdown-item' +
      (sw.group === act.group ? ' chip-cat-dropdown-item--active' : '');

    const dot = document.createElement('span');
    dot.className = 'chip-cat-dot';
    dot.style.background = sw.color;

    const lbl = document.createElement('span');
    lbl.textContent = sw.label;

    item.appendChild(dot);
    item.appendChild(lbl);
    item.addEventListener('mousedown', e => e.stopPropagation());
    item.addEventListener('click', e => {
      e.stopPropagation();
      if (sw.group !== act.group) moveCustomActToGroup(act, sw);
      closeCatDropdown();
    });
    dropdown.appendChild(item);
  });

  // Measure before final placement
  dropdown.style.cssText = 'position:fixed;top:0;left:0;visibility:hidden;';
  document.body.appendChild(dropdown);
  _chipCatDropdown = dropdown;

  const pr = pillEl.getBoundingClientRect();
  const dr = dropdown.getBoundingClientRect();
  let top  = pr.bottom + 4;
  let left = pr.left - dr.width / 2 + pr.width / 2;
  if (top  + dr.height > window.innerHeight - 8) top  = pr.top  - dr.height - 4;
  if (left + dr.width  > window.innerWidth  - 8) left = window.innerWidth  - dr.width  - 8;
  if (left < 8) left = 8;
  dropdown.style.cssText = `position:fixed;top:${top}px;left:${left}px;`;

  // Close on outside click — deferred so the current click doesn't immediately close it
  requestAnimationFrame(() => {
    const onOutside = e => {
      if (!_chipCatDropdown?.contains(e.target)) {
        closeCatDropdown();
        document.removeEventListener('mousedown', onOutside, true);
      }
    };
    document.addEventListener('mousedown', onOutside, true);
    dropdown._closeHandler = onOutside;
  });
}

function closeCatDropdown() {
  if (!_chipCatDropdown) return;
  if (_chipCatDropdown._closeHandler) {
    document.removeEventListener('mousedown', _chipCatDropdown._closeHandler, true);
  }
  _chipCatDropdown.remove();
  _chipCatDropdown = null;
}

function moveCustomActToGroup(act, swatch) {
  const ci = customActivities.findIndex(a => a.id === act.id);
  if (ci === -1) return;
  customActivities[ci].group = swatch.group;
  customActivities[ci].cat   = swatch.cat;

  const ai = ACTIVITIES.findIndex(a => a.id === act.id);
  if (ai !== -1) {
    ACTIVITIES[ai].group = swatch.group;
    ACTIVITIES[ai].cat   = swatch.cat;
  }

  saveCustomActivities();
  buildLibrary();
}

// ── Custom activity management ────────────────────────────────────────────────

function showAddActivityForm(list, addBtn) {
  addBtn.style.display = 'none';

  let selectedSwatch = CUSTOM_ACT_SWATCHES[0];

  const form = document.createElement('div');
  form.className = 'lib-add-form';

  const input = document.createElement('input');
  input.className = 'lib-add-form-input';
  input.type = 'text';
  input.placeholder = 'Activity name…';
  input.autocomplete = 'off';
  form.appendChild(input);

  const swatchRow = document.createElement('div');
  swatchRow.className = 'lib-add-swatches';

  CUSTOM_ACT_SWATCHES.forEach((sw, i) => {
    const swatch = document.createElement('button');
    swatch.className = 'lib-add-swatch' + (i === 0 ? ' selected' : '');
    swatch.style.backgroundColor = sw.color;
    swatch.title = sw.label;
    swatch.addEventListener('click', () => {
      swatchRow.querySelectorAll('.lib-add-swatch').forEach(s => s.classList.remove('selected'));
      swatch.classList.add('selected');
      selectedSwatch = sw;
    });
    swatchRow.appendChild(swatch);
  });

  form.appendChild(swatchRow);

  const actions = document.createElement('div');
  actions.className = 'lib-add-actions';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'lib-add-cancel';
  cancelBtn.textContent = 'Cancel';

  const saveBtn = document.createElement('button');
  saveBtn.className = 'lib-add-save';
  saveBtn.textContent = 'Save';

  const doSave = () => {
    const name = input.value.trim();
    if (!name) { input.style.borderColor = 'rgba(239,68,68,0.7)'; return; }
    addCustomActivity(name, selectedSwatch.group, selectedSwatch.cat);
  };

  const doCancel = () => {
    form.remove();
    addBtn.style.display = '';
  };

  cancelBtn.addEventListener('click', doCancel);
  saveBtn.addEventListener('click', doSave);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  doSave();
    if (e.key === 'Escape') doCancel();
  });

  actions.appendChild(cancelBtn);
  actions.appendChild(saveBtn);
  form.appendChild(actions);
  list.appendChild(form);
  setTimeout(() => input.focus(), 0);
}

function addCustomActivity(name, group, cat) {
  const act = { id: `custom-${uid()}`, name, cat, group };
  customActivities.push(act);
  ACTIVITIES.push(act);
  saveCustomActivities();
  buildLibrary();
}

function deleteLibActivity(act) {
  const isCustom = customActivities.some(a => a.id === act.id);
  if (isCustom) {
    customActivities = customActivities.filter(a => a.id !== act.id);
    const idx = ACTIVITIES.findIndex(a => a.id === act.id);
    if (idx !== -1) ACTIVITIES.splice(idx, 1);
    saveCustomActivities();
  } else {
    deletedActIds.add(act.id);
    saveDeletedActs();
  }
  buildLibrary();
}

function saveCustomActivities() {
  localStorage.setItem(CUSTOM_ACTS_KEY, JSON.stringify(customActivities));
}

function loadCustomActivities() {
  try {
    const raw = localStorage.getItem(CUSTOM_ACTS_KEY);
    if (raw) {
      customActivities = JSON.parse(raw);
      customActivities.forEach(act => ACTIVITIES.push(act));
    }
  } catch (e) {
    console.warn('Failed to load custom activities:', e);
  }
}

function saveDeletedActs() {
  localStorage.setItem(DELETED_ACTS_KEY, JSON.stringify([...deletedActIds]));
}

function loadDeletedActs() {
  try {
    const raw = localStorage.getItem(DELETED_ACTS_KEY);
    if (raw) deletedActIds = new Set(JSON.parse(raw));
  } catch (e) {
    console.warn('Failed to load deleted acts:', e);
  }
}

// ── Floating panel toggles ────────────────────────────────────────────────────

function closeAllPanels() {
  document.getElementById('libraryPanel')?.classList.add('hidden');
  document.getElementById('yearPanel')?.classList.add('hidden');
  document.getElementById('dayRangePanel')?.classList.add('hidden');
  document.getElementById('toggleLibrary')?.classList.remove('panel-toggle--active');
  document.getElementById('toggleYear')?.classList.remove('panel-toggle--active');
  document.getElementById('toggleDayRange')?.classList.remove('panel-toggle--active');
  localStorage.setItem('simsi-library-open', 'false');
}

function initPanelToggles() {
  const toggleLib  = document.getElementById('toggleLibrary');
  const libPanel   = document.getElementById('libraryPanel');
  const toggleYear = document.getElementById('toggleYear');
  const yearPanel  = document.getElementById('yearPanel');

  toggleLib.addEventListener('click', e => {
    e.stopPropagation();
    const opening = libPanel.classList.contains('hidden');
    closeAllPanels();
    if (opening) {
      libPanel.classList.remove('hidden');
      toggleLib.classList.add('panel-toggle--active');
      localStorage.setItem('simsi-library-open', 'true');
    }
  });

  if (localStorage.getItem('simsi-library-open') === 'true') {
    libPanel.classList.remove('hidden');
    toggleLib.classList.add('panel-toggle--active');
  }

  toggleYear.addEventListener('click', e => {
    e.stopPropagation();
    const opening = yearPanel.classList.contains('hidden');
    closeAllPanels();
    if (opening) {
      yearPanel.classList.remove('hidden');
      toggleYear.classList.add('panel-toggle--active');
      buildYearCal();
    }
  });

  // Year panel nav buttons
  document.getElementById('viewYearPrev').addEventListener('click', e => {
    e.stopPropagation();
    viewYear--;
    document.getElementById('viewYearLabel').textContent = viewYear;
    buildYearCal();
  });

  document.getElementById('viewYearNext').addEventListener('click', e => {
    e.stopPropagation();
    viewYear++;
    document.getElementById('viewYearLabel').textContent = viewYear;
    buildYearCal();
  });

  // Click outside closes all panels
  document.addEventListener('click', e => {
    if (isDraggingFromLibrary) return;
    const rangePanel  = document.getElementById('dayRangePanel');
    const rangeToggle = document.getElementById('toggleDayRange');
    if (
      !libPanel.contains(e.target)    && e.target !== toggleLib   &&
      !yearPanel.contains(e.target)   && e.target !== toggleYear  &&
      !rangePanel?.contains(e.target) && e.target !== rangeToggle &&
      !document.getElementById('viewYearPrev').contains(e.target) &&
      !document.getElementById('viewYearNext').contains(e.target)
    ) {
      closeAllPanels();
    }
  });

  document.addEventListener('mouseup', () => { isDraggingFromLibrary = false; });
}

// ── Day range panel ───────────────────────────────────────────────────────────

function initDayRangePanel() {
  const toggle   = document.getElementById('toggleDayRange');
  const panel    = document.getElementById('dayRangePanel');
  const startSel = document.getElementById('rangeStart');
  const endSel   = document.getElementById('rangeEnd');

  for (let h = 0; h <= 12; h++) {
    const opt = document.createElement('option');
    opt.value = h;
    opt.textContent = hourLabel(h);
    startSel.appendChild(opt);
  }

  for (let h = 14; h <= 30; h++) {
    const opt = document.createElement('option');
    opt.value = h;
    opt.textContent = h < 24 ? hourLabel(h) : hourLabel(h) + ' +1';
    endSel.appendChild(opt);
  }

  toggle.addEventListener('click', e => {
    e.stopPropagation();
    const opening = panel.classList.contains('hidden');
    closeAllPanels();
    if (opening) {
      startSel.value = String(START_H);
      endSel.value   = String(END_H);
      panel.classList.remove('hidden');
      toggle.classList.add('panel-toggle--active');
    }
  });

  document.getElementById('applyRange').addEventListener('click', () => {
    const s  = parseInt(startSel.value);
    const en = parseInt(endSel.value);
    if (!isNaN(s) && !isNaN(en) && en > s + 1) applyDayRangeSettings(s, en);
    closeAllPanels();
  });

  document.getElementById('resetRange').addEventListener('click', () => {
    const key = dateKey(currentDate);
    delete dayRanges[key];
    localStorage.setItem(DAY_RANGES_KEY, JSON.stringify(dayRanges));
    updateDayRange();
    const { interval, hourH } = ZOOM_LEVELS[zoomIdx];
    rebuildTimeLabels(interval, hourH);
    rebuildDayCells(interval, hourH);
    updateBlockPositions();
    closeAllPanels();
  });
}

// ── Year calendar ─────────────────────────────────────────────────────────────

function buildYearCal() {
  const container = document.getElementById('yearCal');
  container.innerHTML = '';

  const today   = todayKey();
  const current = dateKey(currentDate);

  document.getElementById('viewYearLabel').textContent = viewYear;

  const monthNames = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ];

  for (let month = 0; month < 12; month++) {
    const monthEl = document.createElement('div');
    monthEl.className = 'year-month';

    const header = document.createElement('div');
    header.className   = 'year-month-name';
    header.textContent = monthNames[month];
    monthEl.appendChild(header);

    const weekLabels = document.createElement('div');
    weekLabels.className = 'year-week-labels';
    const dayLetters = appSettings.weekStartDay === 'Monday'
      ? ['M','T','W','T','F','S','S']
      : ['S','M','T','W','T','F','S'];
    dayLetters.forEach(d => {
      const span = document.createElement('span');
      span.textContent = d;
      weekLabels.appendChild(span);
    });
    monthEl.appendChild(weekLabels);

    const grid      = document.createElement('div');
    grid.className  = 'year-month-grid';

    const rawFirstDay  = new Date(viewYear, month, 1).getDay();
    const firstDay     = appSettings.weekStartDay === 'Monday' ? (rawFirstDay + 6) % 7 : rawFirstDay;
    const daysInMonth  = new Date(viewYear, month + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
      const empty = document.createElement('span');
      empty.className = 'year-day year-day--empty';
      grid.appendChild(empty);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${viewYear}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const dayEl = document.createElement('span');
      dayEl.className   = 'year-day';
      dayEl.textContent = d;

      if (key === today)   dayEl.classList.add('year-day--today');
      if (key === current) dayEl.classList.add('year-day--current');

      dayEl.addEventListener('click', () => {
        currentDate = new Date(viewYear, month, d);
        renderCurrentDay();
        closeAllPanels();
      });

      grid.appendChild(dayEl);
    }

    monthEl.appendChild(grid);
    container.appendChild(monthEl);
  }
}

// ── Drag handlers (library chips → calendar) ──────────────────────────────────

let lastDragCol = null;

function cleanupDragVisuals() {
  document.querySelectorAll('.day-col.drag-active').forEach(c => {
    c.classList.remove('drag-active');
    const ind = c.querySelector('.drop-indicator');
    if (ind) ind.style.display = 'none';
  });
  lastDragCol = null;
}

function onColDragOver(e) {
  if (!activeDrag) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';

  const col  = e.currentTarget;
  const hour = activeDrag.autoHour !== undefined ? activeDrag.autoHour : yToHour(col, e.clientY);
  const top  = (hour - START_H) * HOUR_H;

  const ind = col.querySelector('.drop-indicator');
  ind.className = `drop-indicator ind-${activeDrag.cat}`;
  ind.style.top     = `${top}px`;
  ind.style.display = 'block';
  col.classList.add('drag-active');
  lastDragCol = col;
}

function onColDragLeave(e) {
  const col = e.currentTarget;
  if (!col.contains(e.relatedTarget)) {
    col.classList.remove('drag-active');
    const ind = col.querySelector('.drop-indicator');
    if (ind) ind.style.display = 'none';
    if (lastDragCol === col) lastDragCol = null;
  }
}

function onColDrop(e) {
  e.preventDefault();
  const col = e.currentTarget;
  col.classList.remove('drag-active');
  const ind = col.querySelector('.drop-indicator');
  if (ind) ind.style.display = 'none';

  const act = activeDrag;
  activeDrag = null;
  if (!act) return;

  const day  = col.dataset.day;
  const hour = act.autoHour !== undefined ? act.autoHour : yToHour(col, e.clientY);

  if (act.popup) {
    pendingDrop = { day, hour };
    pendingAct  = act;
    openModal(act);
  } else {
    createBlock({ day, startHour: hour, duration: appSettings.defaultBlockDuration / 60, label: act.name, cat: act.cat, actId: act.id });
    saveBlocks();
  }
}

// ── Library chip → calendar: touch drag ─────────────────────────────────────────
// HTML5 drag-and-drop (used by mouse) never fires on touch, so touch/pen gets a
// parallel pointer-driven drag: long-press a chip to lift a ghost, drag it over a
// day or week column, release to drop. Reuses the same block-creation paths.
let activeChipTouchDrag = null;

function beginChipTouchDrag(act, chip, sx, sy, pid) {
  const rect  = chip.getBoundingClientRect();
  const ghost = chip.cloneNode(true);
  ghost.style.position      = 'fixed';
  ghost.style.left          = `${rect.left}px`;
  ghost.style.top           = `${rect.top}px`;
  ghost.style.width         = `${rect.width}px`;
  ghost.style.margin        = '0';
  ghost.style.pointerEvents = 'none';
  ghost.style.opacity       = '0.85';
  ghost.style.zIndex        = '9999';
  document.body.appendChild(ghost);

  _capturePointer(chip, pid);
  activeChipTouchDrag = { act, chip, ghost, offsetX: sx - rect.left, offsetY: sy - rect.top, hoverCol: null };
  activeDrag = act;
  isDraggingFromLibrary = true;
  document.body.classList.add('is-block-dragging');

  document.addEventListener('pointermove',   _chipTouchMove, true);
  document.addEventListener('pointerup',     _chipTouchEnd,  true);
  document.addEventListener('pointercancel', _chipTouchEnd,  true);
}

function _chipTouchClearHover() {
  const d = activeChipTouchDrag;
  if (d?.hoverCol) {
    d.hoverCol.classList.remove('drag-active');
    const ind = d.hoverCol.querySelector('.drop-indicator');
    if (ind) ind.style.display = 'none';
    d.hoverCol = null;
  }
}

function _chipTouchColAt(clientX, clientY) {
  const d = activeChipTouchDrag;
  d.ghost.style.display = 'none';
  const under = document.elementFromPoint(clientX, clientY);
  d.ghost.style.display = '';
  return under?.closest('.day-col') || under?.closest('.week-col') || null;
}

function _chipTouchMove(e) {
  const d = activeChipTouchDrag;
  if (!d) return;
  e.preventDefault();

  d.ghost.style.left = `${e.clientX - d.offsetX}px`;
  d.ghost.style.top  = `${e.clientY - d.offsetY}px`;

  const col = _chipTouchColAt(e.clientX, e.clientY);
  if (col !== d.hoverCol) _chipTouchClearHover();
  if (!col) return;
  d.hoverCol = col;

  const isWeek = col.classList.contains('week-col');
  const baseH  = isWeek ? WEEK_DISPLAY_START_H : START_H;
  const hour   = isWeek ? _wkYToHour(col, e.clientY) : yToHour(col, e.clientY);
  const ind    = isWeek ? _weekColIndicator(col) : col.querySelector('.drop-indicator');
  if (ind) {
    ind.className     = `drop-indicator ind-${d.act.cat}`;
    ind.style.top     = `${(hour - baseH) * HOUR_H}px`;
    ind.style.display = 'block';
  }
  col.classList.add('drag-active');
}

function _chipTouchEnd(e) {
  const d = activeChipTouchDrag;
  if (!d) return;

  document.removeEventListener('pointermove',   _chipTouchMove, true);
  document.removeEventListener('pointerup',     _chipTouchEnd,  true);
  document.removeEventListener('pointercancel', _chipTouchEnd,  true);

  const col = e.type === 'pointercancel' ? null : _chipTouchColAt(e.clientX, e.clientY);

  _chipTouchClearHover();
  d.ghost.remove();
  d.chip.style.touchAction = '';
  document.body.classList.remove('is-block-dragging');
  const act = d.act;
  activeChipTouchDrag = null;
  activeDrag = null;
  isDraggingFromLibrary = false;

  if (col) _dropActivityOnColumn(col, e.clientY, act);
}

function _dropActivityOnColumn(col, clientY, act) {
  const day = col.dataset.day;

  if (col.classList.contains('week-col')) {
    const hour = _wkYToHour(col, clientY);
    if (act.popup) { pendingDrop = { day, hour }; pendingAct = act; openModal(act); return; }
    const newBlockData = {
      id: uid(), day, startHour: hour, duration: appSettings.defaultBlockDuration / 60,
      label: act.name, cat: act.cat, actId: act.id, items: null,
    };
    try {
      const raw = localStorage.getItem(BLOCKS_KEY);
      const all = raw ? JSON.parse(raw) : [];
      all.push(newBlockData);
      localStorage.setItem(BLOCKS_KEY, JSON.stringify(all));
    } catch (err) {}
    _createWeekBlock(newBlockData, col);
  } else {
    const hour = yToHour(col, clientY);
    if (act.popup) { pendingDrop = { day, hour }; pendingAct = act; openModal(act); return; }
    createBlock({ day, startHour: hour, duration: appSettings.defaultBlockDuration / 60, label: act.name, cat: act.cat, actId: act.id });
    saveBlocks();
  }
}

// ── Modal system ──────────────────────────────────────────────────────────────

const modal        = document.getElementById('modal');
const modalTitle   = document.getElementById('modalTitle');
const modalBody    = document.getElementById('modalBody');
const modalConfirm = document.getElementById('modalConfirm');
const modalCancel  = document.getElementById('modalCancel');
const modalClose   = document.getElementById('modalClose');

function openModal(act) {
  modalTitle.textContent   = act.name;
  modalBody.innerHTML      = '';
  modalConfirm.textContent = act.id === 'owe' ? 'Add Reminder' : 'Add Block';

  switch (act.popup) {
    case 'text':     buildTextBody(act);     break;
    case 'dropdown': buildDropdownBody(act); break;
    case 'school':   buildSchoolBody(act);   break;
    case 'shopping': buildShoppingBody();    break;
    case 'owe':      buildOweBody();         break;
  }

  modal.classList.remove('hidden');
  const first = modalBody.querySelector('input, select');
  if (first) setTimeout(() => first.focus(), 40);
}

function closeModal() {
  modal.classList.add('hidden');
  pendingDrop = null;
  pendingAct  = null;
}

function buildTextBody(act) {
  modalBody.innerHTML = `
    <div class="field-group">
      <label class="field-label">${act.prompt}</label>
      <input class="field-input" id="textInput" type="text" placeholder="Type here…" autocomplete="off">
    </div>`;
  document.getElementById('textInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') confirmModal();
  });
}

function buildDropdownBody(act) {
  const opts = act.opts.map(o => `<option value="${o}">${o}</option>`).join('');
  modalBody.innerHTML = `
    <div class="field-group">
      <label class="field-label">Select type</label>
      <select class="field-select" id="selectInput">${opts}</select>
    </div>`;
}

function buildSchoolBody(act) {
  const btns = act.opts.map((o, i) =>
    `<button class="time-btn${i === 0 ? ' active' : ''}" data-val="${o}">${o}</button>`
  ).join('');
  modalBody.innerHTML = `
    <div class="field-group">
      <label class="field-label">Start time</label>
      <div class="time-btn-group" id="schoolOpts">${btns}</div>
    </div>
    <p class="field-note">Block ends at 3:00 PM</p>`;
  document.getElementById('schoolOpts').addEventListener('click', e => {
    const btn = e.target.closest('.time-btn');
    if (!btn) return;
    document.querySelectorAll('#schoolOpts .time-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
}

function buildShoppingBody() {
  modalBody.innerHTML = `
    <div id="shoppingItems" class="shopping-items"></div>
    <button id="addShoppingItem" class="btn-add-item">+ Add item</button>`;
  document.getElementById('addShoppingItem').addEventListener('click', addShoppingRow);
  addShoppingRow();
}

function addShoppingRow() {
  const container = document.getElementById('shoppingItems');
  const row = document.createElement('div');
  row.className = 'shopping-row';
  row.innerHTML = `
    <input class="field-input shopping-input" type="text" placeholder="Item…" autocomplete="off">
    <button class="shopping-del">×</button>`;
  row.querySelector('.shopping-del').addEventListener('click', () => row.remove());
  row.querySelector('.shopping-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') addShoppingRow();
  });
  container.appendChild(row);
  setTimeout(() => row.querySelector('.shopping-input').focus(), 0);
}

function buildOweBody() {
  modalBody.innerHTML = `
    <div class="field-group">
      <label class="field-label">Who do you owe?</label>
      <input class="field-input" id="oweName" type="text" placeholder="Name" autocomplete="off">
    </div>
    <div class="field-group">
      <label class="field-label">How much?</label>
      <input class="field-input" id="oweAmount" type="text" placeholder="0.00" autocomplete="off">
    </div>`;
  document.getElementById('oweName').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('oweAmount').focus();
  });
  document.getElementById('oweAmount').addEventListener('keydown', e => {
    if (e.key === 'Enter') confirmModal();
  });
}

function openOweModal() {
  pendingAct  = ACTIVITIES.find(a => a.id === 'owe');
  pendingDrop = null;
  openModal(pendingAct);
}

function confirmModal() {
  const act = pendingAct;
  if (!act) return;

  if (act.id === 'owe') {
    const name   = document.getElementById('oweName')?.value.trim();
    const amount = document.getElementById('oweAmount')?.value.trim();
    if (!name || !amount) {
      ['oweName','oweAmount'].forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.value.trim()) el.style.borderColor = '#ef4444';
      });
      return;
    }
    addReminder({ id: uid(), name, amount });
    closeModal();
    return;
  }

  let label     = '';
  let startHour = pendingDrop?.hour ?? 9;
  let duration  = 1;
  let items     = null;

  switch (act.popup) {
    case 'text': {
      const val = document.getElementById('textInput')?.value.trim();
      if (!val) {
        const el = document.getElementById('textInput');
        if (el) el.style.borderColor = '#ef4444';
        return;
      }
      label = act.labelFn(val);
      break;
    }
    case 'dropdown': {
      const val = document.getElementById('selectInput')?.value ?? act.opts[0];
      label = act.labelFn(val);
      break;
    }
    case 'school': {
      const activeBtn = document.querySelector('#schoolOpts .time-btn.active');
      const timeStr   = activeBtn?.dataset.val ?? act.opts[0];
      startHour = parseTimeStr(timeStr);
      duration  = 15 - startHour;
      label     = 'School';
      break;
    }
    case 'shopping': {
      items = [...document.querySelectorAll('.shopping-input')]
        .map(i => i.value.trim()).filter(Boolean);
      label = 'Shopping';
      break;
    }
  }

  createBlock({ day: pendingDrop.day, startHour, duration, label, cat: act.cat, actId: act.id, items });
  saveBlocks();
  closeModal();
}

modalConfirm.addEventListener('click', confirmModal);
modalCancel.addEventListener('click', closeModal);
modalClose.addEventListener('click', closeModal);
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
  if (e.key === 'Escape' && !document.getElementById('newGoalModal').classList.contains('hidden')) closeNewGoalModal();
  if (e.key === 'Escape' && !document.getElementById('editGoalModal').classList.contains('hidden')) closeEditGoalModal();
  if (e.key === 'Escape' && !document.getElementById('goalModal').classList.contains('hidden')) closeGoalModal();
  if (e.key === 'Escape' && !document.getElementById('countdownModal')?.classList.contains('hidden')) closeCountdownModal();
});

// ── Shopping list viewer ──────────────────────────────────────────────────────

const listModal      = document.getElementById('listModal');
const listModalBody  = document.getElementById('listModalBody');
const listModalClose = document.getElementById('listModalClose');
const listModalOk    = document.getElementById('listModalOk');

function openListModal(items, block) {
  _editList = { items: [...items], block: block || null };
  renderEditableList(false);
  listModal.classList.remove('hidden');
}

const closeListModal = () => { listModal.classList.add('hidden'); _editList = null; };
listModalClose.addEventListener('click', closeListModal);
listModalOk.addEventListener('click', closeListModal);
listModal.addEventListener('click', e => { if (e.target === listModal) closeListModal(); });

function saveEditList() {
  if (!_editList?.block) return;
  const { items, block } = _editList;
  if (items.length) {
    block.dataset.items = JSON.stringify(items);
  } else {
    delete block.dataset.items;
  }
  saveBlocks();
}

function renderEditableList(addNew) {
  const { items } = _editList;
  listModalBody.innerHTML = '';

  const ul = document.createElement('ul');
  ul.className = 'shopping-edit-list';

  items.forEach((text, idx) => ul.appendChild(makeEditListItem(text, idx)));

  const addRow = document.createElement('li');
  addRow.className = 'shopping-edit-add-row';
  addRow.textContent = '+ Add item';
  addRow.addEventListener('click', showAddInput);
  ul.appendChild(addRow);

  listModalBody.appendChild(ul);
  if (addNew) showAddInput();
}

function makeEditListItem(text, idx) {
  const li = document.createElement('li');
  li.className = 'shopping-edit-item';

  const bullet = document.createElement('span');
  bullet.className = 'edit-bullet';
  li.appendChild(bullet);

  const textSpan = document.createElement('span');
  textSpan.className = 'edit-text';
  textSpan.textContent = text;
  li.appendChild(textSpan);

  const delBtn = document.createElement('button');
  delBtn.className = 'edit-del';
  delBtn.textContent = '×';
  li.appendChild(delBtn);

  textSpan.addEventListener('click', () => beginInlineEdit(li, textSpan, idx));
  delBtn.addEventListener('click', e => {
    e.stopPropagation();
    _editList.items.splice(idx, 1);
    saveEditList();
    renderEditableList(false);
  });

  return li;
}

function beginInlineEdit(li, textSpan, idx) {
  const input = document.createElement('input');
  input.className = 'edit-input';
  input.value = textSpan.textContent;
  li.replaceChild(input, textSpan);
  input.focus();

  let done = false;

  const doSave = () => {
    const val = input.value.trim();
    if (val) {
      _editList.items[idx] = val;
      textSpan.textContent = val;
      saveEditList();
      if (input.parentElement === li) li.replaceChild(textSpan, input);
    } else {
      _editList.items.splice(idx, 1);
      saveEditList();
      renderEditableList(false);
    }
  };

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); done = true; doSave(); }
    if (e.key === 'Escape') { done = true; if (input.parentElement === li) li.replaceChild(textSpan, input); }
  });
  input.addEventListener('blur', () => { if (!done) { done = true; doSave(); } });
}

function showAddInput() {
  const ul = listModalBody.querySelector('.shopping-edit-list');
  if (!ul) return;
  ul.querySelector('.shopping-edit-add-row')?.remove();

  const li = document.createElement('li');
  li.className = 'shopping-edit-item';

  const bullet = document.createElement('span');
  bullet.className = 'edit-bullet';
  li.appendChild(bullet);

  const input = document.createElement('input');
  input.className = 'edit-input';
  input.placeholder = 'New item…';
  li.appendChild(input);

  ul.appendChild(li);
  input.focus();

  let done = false;

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      done = true;
      const val = input.value.trim();
      if (val) { _editList.items.push(val); saveEditList(); renderEditableList(true); }
      else renderEditableList(false);
    }
    if (e.key === 'Escape') { done = true; renderEditableList(false); }
  });
  input.addEventListener('blur', () => {
    if (done) return;
    done = true;
    const val = input.value.trim();
    if (val) { _editList.items.push(val); saveEditList(); }
    renderEditableList(false);
  });
}

// ── Block creation ────────────────────────────────────────────────────────────

function createBlock({ day, startHour, duration, label, cat, actId, items, id }) {
  const col = document.querySelector(`.day-col[data-day="${day}"]`);
  if (!col) return null;

  const minDur = 5 / 60;
  const dur    = Math.max(minDur, Math.min(END_H - START_H, parseFloat(duration) || 1));
  const sHour  = Math.max(START_H, Math.min(END_H - dur, parseFloat(startHour) || START_H));

  const blockId = id || uid();
  const block   = document.createElement('div');
  block.className         = `cal-block block-${cat}${actId ? ` block-act-${actId}` : ''}`;
  block.dataset.id        = blockId;
  block.dataset.day       = day;
  block.dataset.startHour = sHour;
  block.dataset.duration  = dur;
  const displayLabel = actId === 'shopping' ? 'Shopping' : (label || '');
  block.dataset.label     = displayLabel;
  block.dataset.cat       = cat;
  block.dataset.actId     = actId || '';
  if (items && items.length) block.dataset.items = JSON.stringify(items);

  block.style.top    = `${(sHour - START_H) * HOUR_H}px`;
  block.style.height = `${dur * HOUR_H - 2}px`;

  const hasItems = items && items.length > 0;

  block.innerHTML = `
    <div class="block-time-tint" style="background:${getTimeTint(sHour)}"></div>
    <div class="resize-handle-top"></div>
    <span class="block-name">${displayLabel}</span>
    <span class="block-dur">${timeRangeLabel(sHour, dur)}</span>
    ${(hasItems || actId === 'shopping') ? '<span class="block-list-hint">tap to view</span>' : ''}
    <span class="block-dur-badge">${durLabel(dur)}</span>
    <div class="resize-handle"></div>`;

  block.addEventListener('contextmenu', e => showBlockContextMenu(e, block));
  block.addEventListener('pointerdown', onBlockPointerDown);

  block.querySelector('.resize-handle-top').addEventListener('pointerdown', e => {
    e.preventDefault();
    e.stopPropagation();
    _capturePointer(e.currentTarget, e.pointerId);
    block.style.transition = 'none';
    activeResize = {
      block,
      type: 'top',
      startY: e.clientY,
      startTop: parseFloat(block.style.top),
      startH: block.offsetHeight + 2,
      endHour: parseFloat(block.dataset.startHour) + parseFloat(block.dataset.duration),
    };
    document.body.classList.add('is-resizing');
  });

  block.querySelector('.resize-handle').addEventListener('pointerdown', e => {
    e.preventDefault();
    e.stopPropagation();
    _capturePointer(e.currentTarget, e.pointerId);
    block.style.transition = 'none';
    activeResize = { block, type: 'bottom', startY: e.clientY, startH: block.offsetHeight + 2 };
    document.body.classList.add('is-resizing');
  });

  if (actId === 'shopping') {
    block.addEventListener('click', e => {
      if (_blockDragJustMoved) return;
      openListModal(JSON.parse(block.dataset.items || '[]'), block);
    });
  }

  updateBlockContent(block);
  col.appendChild(block);
  return block;
}

// ── Touch long-press helper ─────────────────────────────────────────────────
// Mouse interactions grab immediately; touch/pen ones arm after a short press so
// that a plain swipe still scrolls and a tap still counts as a click. Once armed
// (finger held roughly still) onArm(clientX, clientY) begins the real drag.
function armTouchLongPress(startEvent, onArm, { delay = 200, threshold = 10 } = {}) {
  const sx = startEvent.clientX, sy = startEvent.clientY;
  const pid = startEvent.pointerId;
  let done = false;

  const timer = setTimeout(() => {
    if (done) return;
    done = true;
    cleanup();
    onArm(sx, sy, pid);
  }, delay);

  function onMove(ev) {
    if (ev.pointerId !== pid || done) return;
    if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > threshold) {
      done = true;         // moved first → treat as scroll, never arm
      cleanup();
    }
  }
  function onUp(ev) {
    if (ev.pointerId !== pid) return;
    done = true;           // released first → treat as tap/click
    cleanup();
  }
  function cleanup() {
    clearTimeout(timer);
    document.removeEventListener('pointermove', onMove, true);
    document.removeEventListener('pointerup', onUp, true);
    document.removeEventListener('pointercancel', onUp, true);
  }
  document.addEventListener('pointermove', onMove, true);
  document.addEventListener('pointerup', onUp, true);
  document.addEventListener('pointercancel', onUp, true);
}

// ── Block drag ────────────────────────────────────────────────────────────────

function onBlockPointerDown(e) {
  if (e.target.closest('.resize-handle') || e.target.closest('.resize-handle-top')) return;
  if (e.target.closest('.block-name-input')) return;

  const block = e.currentTarget;

  if (e.pointerType === 'mouse') {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    beginBlockDrag(block, e.clientX, e.clientY);
    return;
  }

  // touch / pen: long-press to arm so scrolling and tapping still work
  armTouchLongPress(e, (sx, sy, pid) => {
    beginBlockDrag(block, sx, sy);
    _capturePointer(block, pid);
    // Lift immediately so the grab is felt the instant the press registers,
    // and place the tile exactly where it already sits (no jump).
    _liftBlock(activeBlockDrag);
    block.style.left = `${sx - activeBlockDrag.offsetX}px`;
    block.style.top  = `${sy - activeBlockDrag.offsetY}px`;
  });
}

function beginBlockDrag(block, clientX, clientY) {
  hideBlockContextMenu();

  const rect = block.getBoundingClientRect();

  activeBlockDrag = {
    block,
    originalCol: block.parentElement,
    originalTop: parseFloat(block.style.top),
    offsetX: clientX - rect.left,
    offsetY: clientY - rect.top,
    blockW:  rect.width,
    startX:  clientX,
    startY:  clientY,
    hasMoved: false,
  };

  block.style.transition = 'none';
  document.body.classList.add('is-block-dragging');
}

function _capturePointer(el, pid) {
  if (pid == null) return;
  try { el.setPointerCapture(pid); } catch (e) {}
}

// Detach the block from the grid into a free-floating fixed-position tile.
function _liftBlock(drag) {
  const { block, blockW } = drag;
  block.style.position      = 'fixed';
  block.style.right         = 'auto';
  block.style.width         = `${blockW}px`;
  block.style.opacity       = '0.78';
  block.style.zIndex        = '50';
  block.style.pointerEvents = 'none';
  drag.hasMoved = true;
}

function handleBlockDragMove(e) {
  const drag = activeBlockDrag;
  const { block, offsetX, offsetY, startX, startY } = drag;

  if (!drag.hasMoved) {
    const dist = Math.hypot(e.clientX - startX, e.clientY - startY);
    if (dist < 4) return;
    _liftBlock(drag);
  }

  block.style.left = `${e.clientX - offsetX}px`;
  block.style.top  = `${e.clientY - offsetY}px`;

  const underEl   = document.elementFromPoint(e.clientX, e.clientY);
  const targetCol = underEl?.closest('.day-col') || null;
  setDragHoverCol(targetCol);

  if (targetCol) {
    const hour = yToHour(targetCol, e.clientY - offsetY);
    const dur  = parseFloat(block.dataset.duration);
    const s = block.querySelector('.block-dur');
    if (s) s.textContent = timeRangeLabel(hour, dur);
  }
}

function handleBlockDragEnd(e) {
  const drag = activeBlockDrag;
  activeBlockDrag = null;
  document.body.classList.remove('is-block-dragging');
  setDragHoverCol(null);

  const { block, originalCol, originalTop, hasMoved } = drag;

  if (!hasMoved) {
    block.style.transition = '';
    block.style.zIndex     = '';
    block.style.touchAction = '';
    return;
  }
  block.style.touchAction = '';

  _blockDragJustMoved = true;
  setTimeout(() => { _blockDragJustMoved = false; }, 0);

  const underEl   = document.elementFromPoint(e.clientX, e.clientY);
  const targetCol = underEl?.closest('.day-col') || null;

  block.style.opacity       = '0';
  block.style.position      = '';
  block.style.left          = '';
  block.style.right         = '';
  block.style.width         = '';
  block.style.zIndex        = '';
  block.style.pointerEvents = '';
  block.style.transition    = 'none';

  if (targetCol) {
    const hour = yToHour(targetCol, e.clientY - drag.offsetY);
    const day  = targetCol.dataset.day;

    targetCol.appendChild(block);
    block.dataset.day       = day;
    block.dataset.startHour = hour;
    block.style.top         = `${(hour - START_H) * HOUR_H}px`;

    const dur = parseFloat(block.dataset.duration);
    const s = block.querySelector('.block-dur');
    if (s) s.textContent = timeRangeLabel(hour, dur);
    updateBlockTimeTint(block);

    saveBlocks();
  } else {
    originalCol.appendChild(block);
    block.style.top = `${originalTop}px`;
  }

  requestAnimationFrame(() => {
    block.style.opacity    = '';
    block.style.transition = '';
  });
}

function setDragHoverCol(col) {
  if (_dragHoverCol === col) return;
  if (_dragHoverCol) _dragHoverCol.classList.remove('block-drag-over');
  _dragHoverCol = col;
  if (col) col.classList.add('block-drag-over');
}

// ── Resize ────────────────────────────────────────────────────────────────────

document.addEventListener('pointermove', e => {
  if (activeWkInColDrag) { _handleWkInColDragMove(e); return; }
  if (activeWkCrossDrag) { _handleWkCrossDragMove(e); return; }
  if (activeBlockDrag) { handleBlockDragMove(e); return; }

  if (!activeResize) return;
  const { block, type, startY, startH } = activeResize;
  const delta = e.clientY - startY;
  const minH  = HOUR_H * (5 / 60);
  const baseH = block.classList.contains('wk-block') ? WEEK_DISPLAY_START_H : START_H;

  if (type === 'top') {
    const { startTop, endHour } = activeResize;
    let newTop = startTop + delta;
    let newH   = startH - delta;
    if (newTop < 0) { newH += newTop; newTop = 0; }
    if (newH < minH) { newTop += (newH - minH); newH = minH; }

    block.style.top    = `${newTop}px`;
    block.style.height = `${newH - 2}px`;

    const newStartHour = newTop / HOUR_H + baseH;
    const newDur       = endHour - newStartHour;
    block.dataset.startHour = newStartHour;
    block.dataset.duration  = newDur;

    const s = block.querySelector('.block-dur');
    if (s) s.textContent = timeRangeLabel(newStartHour, newDur);
    const badge = block.querySelector('.block-dur-badge');
    if (badge) badge.textContent = durLabel(newDur);
    updateBlockTimeTint(block);
  } else {
    const rawH = Math.max(minH, startH + delta);
    const dur  = rawH / HOUR_H;

    block.style.height     = `${dur * HOUR_H - 2}px`;
    block.dataset.duration = dur;

    const s = block.querySelector('.block-dur');
    if (s) s.textContent = timeRangeLabel(parseFloat(block.dataset.startHour), dur);
    const badge = block.querySelector('.block-dur-badge');
    if (badge) badge.textContent = durLabel(dur);
  }
  updateBlockContent(block);
});

function onGlobalPointerUp(e) {
  if (activeWkInColDrag) { _handleWkInColDragEnd(e); return; }
  if (activeWkCrossDrag) { _handleWkCrossDragEnd(e); return; }
  if (activeBlockDrag) { handleBlockDragEnd(e); return; }

  if (activeResize) {
    const resizingBlock = activeResize.block;
    resizingBlock.style.transition = '';
    if (resizingBlock.classList.contains('wk-block')) {
      try {
        const raw = localStorage.getItem(BLOCKS_KEY);
        if (raw) {
          const all = JSON.parse(raw);
          const idx = all.findIndex(x => x.id === resizingBlock.dataset.id);
          if (idx !== -1) {
            all[idx].startHour = parseFloat(resizingBlock.dataset.startHour);
            all[idx].duration  = parseFloat(resizingBlock.dataset.duration);
            localStorage.setItem(BLOCKS_KEY, JSON.stringify(all));
          }
        }
      } catch(ex) {}
    } else {
      saveBlocks();
    }
    activeResize = null;
    document.body.classList.remove('is-resizing');
  }
}
document.addEventListener('pointerup', onGlobalPointerUp);
document.addEventListener('pointercancel', onGlobalPointerUp);

// While a drag/resize is active, block the browser's own scroll/zoom so the
// gesture is smooth on touch. touch-action can't be changed mid-gesture (the
// browser locks it in at touchstart), so a non-passive touchmove.preventDefault
// is the reliable way to stop the page from scrolling under the finger.
function _dragInProgress() {
  return !!(activeBlockDrag || activeResize || activeChipTouchDrag ||
            activeWkCrossDrag || activeWkInColDrag);
}
document.addEventListener('touchmove', e => {
  if (_dragInProgress()) e.preventDefault();
}, { passive: false });

// ── Context menu ──────────────────────────────────────────────────────────────

function showBlockContextMenu(e, block) {
  e.preventDefault();
  e.stopPropagation();

  if (activeBlockDrag && activeBlockDrag.hasMoved) return;

  hideBlockContextMenu();

  const menu = document.createElement('div');
  menu.className   = 'block-ctx-menu';
  menu.style.left  = `${e.clientX}px`;
  menu.style.top   = `${e.clientY}px`;

  const editItem = document.createElement('div');
  editItem.className   = 'block-ctx-item block-ctx-item--edit';
  editItem.textContent = 'Edit';
  editItem.addEventListener('mousedown', ev => ev.stopPropagation());
  editItem.addEventListener('click', () => {
    hideBlockContextMenu();
    activateBlockNameEdit(block);
  });

  const delItem = document.createElement('div');
  delItem.className   = 'block-ctx-item block-ctx-item--del';
  delItem.textContent = 'Delete';
  delItem.addEventListener('mousedown', ev => ev.stopPropagation());
  delItem.addEventListener('click', () => {
    block.remove();
    saveBlocks();
    hideBlockContextMenu();
  });

  menu.appendChild(editItem);
  menu.appendChild(delItem);
  document.body.appendChild(menu);
  _ctxMenu = menu;

  requestAnimationFrame(() => {
    const r = menu.getBoundingClientRect();
    if (r.right  > window.innerWidth)  menu.style.left = `${e.clientX - r.width}px`;
    if (r.bottom > window.innerHeight) menu.style.top  = `${e.clientY - r.height}px`;
  });
}

function hideBlockContextMenu() {
  if (_ctxMenu) { _ctxMenu.remove(); _ctxMenu = null; }
}

function activateBlockNameEdit(block) {
  const nameSpan = block.querySelector('.block-name');
  if (!nameSpan) return;

  const original = block.dataset.label;
  let done = false;

  const input = document.createElement('input');
  input.className = 'block-name-input';
  input.value = original;
  nameSpan.replaceWith(input);
  input.focus();
  input.select();

  function commit() {
    if (done) return;
    done = true;
    const newName = input.value.trim() || original;
    block.dataset.label = newName;
    const span = document.createElement('span');
    span.className = 'block-name';
    span.textContent = newName;
    if (input.parentNode) input.replaceWith(span);
    saveBlocks();
  }

  function cancel() {
    if (done) return;
    done = true;
    const span = document.createElement('span');
    span.className = 'block-name';
    span.textContent = original;
    if (input.parentNode) input.replaceWith(span);
  }

  input.addEventListener('mousedown', e => e.stopPropagation());
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { cancel(); }
  });
  input.addEventListener('blur', commit);
}

document.addEventListener('mousedown', e => {
  if (_ctxMenu && !_ctxMenu.contains(e.target)) hideBlockContextMenu();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    hideBlockContextMenu();
    if (!modal.classList.contains('hidden')) closeModal();
    _cancelWkCrossDrag();
  }
});

// ── Reminders ─────────────────────────────────────────────────────────────────

function addReminder(r) {
  reminders.push(r);
  renderReminders();
  saveReminders();
}

function removeReminder(id) {
  reminders = reminders.filter(r => r.id !== id);
  renderReminders();
  saveReminders();
}

function renderReminders() {
  const list = document.getElementById('remindersList');
  if (!list) return;

  if (!reminders.length) {
    list.innerHTML = '<div class="reminders-empty">None</div>';
    return;
  }

  list.innerHTML = reminders.map(r => `
    <div class="reminder-item" data-id="${r.id}">
      <span class="reminder-text">Owe ${r.name} $${r.amount}</span>
      <button class="reminder-del" data-id="${r.id}">×</button>
    </div>`).join('');

  list.querySelectorAll('.reminder-del').forEach(btn => {
    btn.addEventListener('click', () => removeReminder(btn.dataset.id));
  });
}

// ── Persistence ───────────────────────────────────────────────────────────────

function saveBlocks() {
  // Load all stored blocks, replace current day's entries with DOM state
  let allBlocks = [];
  try {
    const raw = localStorage.getItem(BLOCKS_KEY);
    if (raw) allBlocks = JSON.parse(raw);
  } catch (e) {}

  const today = dateKey(currentDate);
  allBlocks = allBlocks.filter(b => b.day !== today);

  document.querySelectorAll('.cal-block').forEach(b => {
    allBlocks.push({
      id:        b.dataset.id,
      day:       b.dataset.day,
      startHour: parseFloat(b.dataset.startHour),
      duration:  parseFloat(b.dataset.duration),
      label:     b.dataset.label,
      cat:       b.dataset.cat,
      actId:     b.dataset.actId,
      items:     b.dataset.items ? JSON.parse(b.dataset.items) : null,
    });
  });

  localStorage.setItem(BLOCKS_KEY, JSON.stringify(allBlocks));
}

function loadBlocksForDay(day) {
  try {
    const raw = localStorage.getItem(BLOCKS_KEY);
    if (raw) {
      JSON.parse(raw)
        .filter(b => b.day === day)
        .forEach(b => createBlock(b));
    }
  } catch (e) {
    console.warn('Failed to load blocks:', e);
  }
}

function saveReminders() {
  localStorage.setItem(REMIND_KEY, JSON.stringify(reminders));
}

function loadReminders() {
  try {
    const raw = localStorage.getItem(REMIND_KEY);
    if (raw) reminders = JSON.parse(raw);
    renderReminders();
  } catch (e) {
    console.warn('Failed to load reminders:', e);
  }
}

// ── Day tags (Rise & Shine / Lights Out) ──────────────────────────────────────

function buildTagRows() {
  const topRow = document.getElementById('calTagsTop');
  const botRow = document.getElementById('calTagsBottom');
  topRow.innerHTML = '';
  botRow.innerHTML = '';

  const tg1 = document.createElement('div');
  tg1.className = 'time-gutter';
  topRow.appendChild(tg1);

  const tg2 = document.createElement('div');
  tg2.className = 'time-gutter';
  botRow.appendChild(tg2);

  const topCell = document.createElement('div');
  topCell.className = 'day-tag-cell';
  topCell.id = 'riseTagCell';
  topRow.appendChild(topCell);

  const botCell = document.createElement('div');
  botCell.className = 'day-tag-cell';
  botCell.id = 'lightsTagCell';
  botRow.appendChild(botCell);

  updateTagRowsForDay(dateKey(currentDate));
}

function updateTagRowsForDay(day) {
  const riseCell   = document.getElementById('riseTagCell');
  const lightsCell = document.getElementById('lightsTagCell');

  if (riseCell) {
    riseCell.innerHTML = '';
    riseCell.appendChild(createDayTag('rise', day));
  }
  if (lightsCell) {
    lightsCell.innerHTML = '';
    lightsCell.appendChild(createDayTag('lights', day));
  }
}

function createDayTag(type, day) {
  const tag = document.createElement('div');
  tag.className = `day-tag day-tag--${type}`;
  refreshTagContent(tag, type, day);
  tag.addEventListener('click', () => beginTagEdit(tag, type, day));
  return tag;
}

function refreshTagContent(tag, type, day) {
  const store = type === 'rise' ? riseTimes : lightsTimes;
  const def   = type === 'rise'
    ? hhmm24ToTagFormat(appSettings.riseAndShine)
    : hhmm24ToTagFormat(appSettings.lightsOut);
  const name  = type === 'rise' ? 'Rise & Shine' : 'Lights Out';
  const time  = store[day] || def;
  tag.innerHTML = `<span class="tag-name">${name}</span><span class="tag-sep">·</span><span class="tag-time">${time}</span>`;
}

function beginTagEdit(tag, type, day) {
  const store       = type === 'rise' ? riseTimes : lightsTimes;
  const def         = type === 'rise'
    ? hhmm24ToTagFormat(appSettings.riseAndShine)
    : hhmm24ToTagFormat(appSettings.lightsOut);
  const name        = type === 'rise' ? 'Rise & Shine' : 'Lights Out';
  const currentTime = store[day] || def;

  tag.innerHTML = `<span class="tag-name">${name}</span><span class="tag-sep">·</span>`;
  const input = document.createElement('input');
  input.className   = 'day-tag-input';
  input.value       = currentTime;
  input.placeholder = def;
  tag.appendChild(input);

  let done = false;
  function commit() {
    if (done) return;
    done = true;
    const val = input.value.trim();
    if (val) store[day] = val;
    saveTimes();
    refreshTagContent(tag, type, day);
  }

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  input.blur();
    if (e.key === 'Escape') { done = true; refreshTagContent(tag, type, day); }
  });
  input.addEventListener('blur', commit);
  setTimeout(() => { input.focus(); input.select(); }, 0);
}

function saveTimes() {
  localStorage.setItem(RISE_KEY,   JSON.stringify(riseTimes));
  localStorage.setItem(LIGHTS_KEY, JSON.stringify(lightsTimes));
}

function loadTimes() {
  try {
    const r = localStorage.getItem(RISE_KEY);
    const l = localStorage.getItem(LIGHTS_KEY);
    if (r) riseTimes   = JSON.parse(r);
    if (l) lightsTimes = JSON.parse(l);
  } catch (e) {
    console.warn('Failed to load times:', e);
  }
}

// ── Habits ────────────────────────────────────────────────────────────────────

const HABITS_KEY = 'simsi-habits';

let habitsData = { habits: [] };

function _dayIdxOf(d) { const w = d.getDay(); return w === 0 ? 6 : w - 1; }
function _isWeekend(d) { const w = d.getDay(); return w === 0 || w === 6; }

function getDateISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function isPausedOn(habit, isoDate) {
  return Array.isArray(habit.pausedDays) && habit.pausedDays.includes(isoDate);
}

function calcHabitStreak(habit) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekdaysOnly = !!habit.weekdaysOnly;

  const checkedOn = d => {
    const checks = habit.weeklyChecks?.[getISOWeekKey(d)];
    return !!(checks && checks[_dayIdxOf(d)]);
  };
  const pausedOn = d => isPausedOn(habit, getDateISO(d));

  const cur = new Date(today);
  if (weekdaysOnly) while (_isWeekend(cur)) cur.setDate(cur.getDate() - 1);

  if (!checkedOn(cur) && !pausedOn(cur)) {
    const prev = new Date(cur);
    prev.setDate(prev.getDate() - 1);
    if (weekdaysOnly) while (_isWeekend(prev)) prev.setDate(prev.getDate() - 1);
    let safety = 0;
    while (pausedOn(prev) && safety++ < 90) {
      prev.setDate(prev.getDate() - 1);
      if (weekdaysOnly) while (_isWeekend(prev)) prev.setDate(prev.getDate() - 1);
    }
    if (!checkedOn(prev)) return 0;
    cur.setTime(prev.getTime());
  }

  let streak = 0;
  const d = new Date(cur);
  while (true) {
    if (weekdaysOnly && _isWeekend(d)) { d.setDate(d.getDate() - 1); continue; }
    if (pausedOn(d)) { d.setDate(d.getDate() - 1); continue; }
    if (checkedOn(d)) { streak++; d.setDate(d.getDate() - 1); }
    else break;
  }
  return streak;
}

function calcWeeklyScore() {
  if (!habitsData.habits.length) return 0;
  const wk = getCurrentWeekKey();
  const monday = getMondayOfISOWeek(wk);
  let total = 0, possible = 0;
  habitsData.habits.forEach(h => {
    const checks = h.weeklyChecks?.[wk] || Array(7).fill(false);
    const limit = h.weekdaysOnly ? 5 : 7;
    let habitTotal = 0, habitPossible = limit;
    for (let i = 0; i < limit; i++) {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      if (isPausedOn(h, getDateISO(d))) {
        habitPossible--;
      } else if (checks[i]) {
        habitTotal++;
      }
    }
    if (habitPossible > 0) {
      total += habitTotal;
      possible += habitPossible;
    }
  });
  return possible ? Math.round((total / possible) * 100) : 0;
}

const DEFAULT_HABIT_NAMES = [
  'Cold Shower', 'Gym', 'No Junk Food', 'Sleep by 10 PM',
  'Drink 2L of Water', 'Complete All Homework', 'Study/Review Notes',
  'No Phone During Study', 'Read 20 Mins', 'No Phone First 30 Mins of Day',
  'Practice Piano', 'Screen Time Under 3 Hrs', 'No Social Media After 9 PM',
];

function makeDefaultHabits() {
  return DEFAULT_HABIT_NAMES.map((name, i) => ({
    id: String(Date.now() + i),
    name,
    streak: 0,
    weeklyChecks: {},
    pausedDays: [],
    lastCheckedDate: null,
    bestStreak: 0,
    lastMilestone: 0,
  }));
}

// Migrate a habit from old format (habit.weeks keyed by Monday YYYY-MM-DD)
// to new format (habit.weeklyChecks keyed by ISO week "YYYY-WNN")
function migrateHabit(h) {
  if (h.weeks && !h.weeklyChecks) {
    h.weeklyChecks = {};
    Object.entries(h.weeks).forEach(([mondayStr, checks]) => {
      // parse as local date by adding noon time to avoid UTC offset issues
      const monday = new Date(mondayStr + 'T12:00:00');
      h.weeklyChecks[getISOWeekKey(monday)] = checks;
    });
    delete h.weeks;
  }
  if (!h.weeklyChecks) h.weeklyChecks = {};
  if (typeof h.streak !== 'number') h.streak = 0;
  if (!h.lastCheckedDate) h.lastCheckedDate = null;
  if (h.name === 'Wake up at 6:00 AM' && !h.weekdaysOnly) h.weekdaysOnly = true;
  if (typeof h.bestStreak !== 'number') h.bestStreak = 0;
  if (typeof h.lastMilestone !== 'number') h.lastMilestone = 0;
  if (!Array.isArray(h.pausedDays)) h.pausedDays = [];
  return h;
}

function loadHabits() {
  try {
    const stored = localStorage.getItem(HABITS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      habitsData = { habits: Array.isArray(parsed.habits) ? parsed.habits : [] };
      habitsData.habits = habitsData.habits.map(migrateHabit);
    } else {
      habitsData = { habits: makeDefaultHabits() };
    }
  } catch (e) {
    habitsData = { habits: makeDefaultHabits() };
  }

  // Ensure current week exists, recalculate streaks, update best streaks
  habitsData.habits.forEach(h => {
    if (!h.weeklyChecks[getCurrentWeekKey()]) {
      h.weeklyChecks[getCurrentWeekKey()] = Array(7).fill(false);
    }
    h.streak = calcHabitStreak(h);
    if (h.streak > (h.bestStreak || 0)) h.bestStreak = h.streak;
  });

  // Batch save once after all initialization
  saveHabits();
}

function saveHabits() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 60);
  const cutoffISO = getDateISO(cutoff);
  habitsData.habits.forEach(h => {
    if (Array.isArray(h.pausedDays)) {
      h.pausedDays = h.pausedDays.filter(d => d >= cutoffISO);
    }
  });
  localStorage.setItem(HABITS_KEY, JSON.stringify(habitsData));
}

function saveGoals() {
  localStorage.setItem(GOALS_KEY, JSON.stringify(goalsData));
}

function loadGoals() {
  try {
    const raw = localStorage.getItem(GOALS_KEY);
    if (raw) {
      goalsData = JSON.parse(raw);
    } else {
      goalsData = JSON.parse(JSON.stringify(DEFAULT_GOALS));
      saveGoals();
    }
  } catch (e) {
    goalsData = JSON.parse(JSON.stringify(DEFAULT_GOALS));
  }
  // Ensure trading goal has lessons, checklist, and exitChecklist arrays
  const tradingGoal = goalsData.find(g => g.id === 'goal-trading');
  if (tradingGoal) {
    let tradingChanged = false;
    if (!Array.isArray(tradingGoal.lessons))       { tradingGoal.lessons = [];       tradingChanged = true; }
    if (!Array.isArray(tradingGoal.checklist))     { tradingGoal.checklist = [];     tradingChanged = true; }
    if (!Array.isArray(tradingGoal.exitChecklist)) { tradingGoal.exitChecklist = []; tradingChanged = true; }
    if (!Array.isArray(tradingGoal.journal))       { tradingGoal.journal = [];        tradingChanged = true; }
    if (tradingChanged) saveGoals();
  }

  // Migrate pre-calc goal from checklist to units
  const precalcGoal = goalsData.find(g => g.id === 'goal-precalc');
  if (precalcGoal && precalcGoal.type === 'checklist') {
    precalcGoal.type = 'units';
    if (!Array.isArray(precalcGoal.units)) precalcGoal.units = [];
    delete precalcGoal.items;
    saveGoals();
  }

  // Migrate reading goal books array if missing or malformed
  const readingGoal = goalsData.find(g => g.id === 'goal-reading');
  if (readingGoal) {
    if (!Array.isArray(readingGoal.books) || readingGoal.books.length === 0) {
      readingGoal.books = JSON.parse(JSON.stringify(DEFAULT_GOALS.find(g => g.id === 'goal-reading').books));
      saveGoals();
    } else {
      readingGoal.books.forEach(b => {
        if (!Array.isArray(b.journal)) b.journal = [];
        if (typeof b.currentPage !== 'number') b.currentPage = 0;
        if (!b.id) b.id = `book-${uid()}`;
        if (typeof b.author === 'undefined') b.author = null;
      });
    }
    // Recalculate completed-book count in case goal.current is stale
    const recalculated = readingGoal.books.filter(b => b.totalPages > 0 && b.currentPage >= b.totalPages).length;
    if (readingGoal.current !== recalculated) {
      readingGoal.current = recalculated;
      saveGoals();
    }
  }
  renderGoalsGrid();
}

  function openGoalModal(goal) {
    _goalModalId = goal.id;
    const modal   = document.getElementById('goalModal');
    const metaEl  = document.getElementById('goalModalMeta');
    const titleEl = document.getElementById('goalModalTitle');
    const bodyEl  = document.getElementById('goalModalBody');
    metaEl.textContent  = goal.category.toUpperCase();
    titleEl.textContent = goal.title;
    renderGoalModalBody(bodyEl, goal);
    modal.classList.remove('hidden');
  }

  function closeGoalModal() {
    document.getElementById('goalModal').classList.add('hidden');
    document.querySelector('.goal-modal-box')?.classList.remove('goal-modal-box--trading');
    _goalModalId = null;
  }

  function renderGoalModalBody(body, goal) {
    body.innerHTML = '';
    const box = document.querySelector('.goal-modal-box');
    box?.classList.remove('goal-modal-box--unit-detail');

    if (goal.id === 'goal-trading') {
      box?.classList.add('goal-modal-box--trading');
      renderTradingGoalModal(body, goal);
      return;
    }

    box?.classList.remove('goal-modal-box--trading');
    if (goal.type === 'counter')      renderCounterModal(body, goal);
    if (goal.type === 'checklist')    renderChecklistModal(body, goal);
    if (goal.type === 'milestones')   renderMilestonesModal(body, goal);
    if (goal.type === 'habit-linked') renderHabitLinkedModal(body, goal);
    if (goal.type === 'units')        renderUnitsModal(body, goal);
  }

  function renderCounterModal(body, goal) {
    const fraction = document.createElement('div');
    fraction.className = 'goal-modal-fraction';
    fraction.textContent = `${goal.current} / ${goal.target}`;

    const bar = document.createElement('div');
    bar.className = 'goal-modal-bar-wrap';
    const fill = document.createElement('div');
    fill.className = 'goal-modal-bar-fill';
    fill.style.width = `${goal.target > 0 ? (goal.current / goal.target) * 100 : 0}%`;
    bar.appendChild(fill);

    const bookList = document.createElement('div');
    bookList.className = 'goal-modal-book-list';

    (goal.books || []).forEach((book, idx) => {
      const row = document.createElement('div');
      row.className = 'goal-modal-book-row';

      const num = document.createElement('span');
      num.className = 'goal-book-num';
      num.textContent = idx + 1;

      const title = document.createElement('span');
      title.className = 'goal-book-title';
      title.textContent = book;

      const del = document.createElement('button');
      del.className = 'goal-item-del';
      del.textContent = '×';
      del.addEventListener('click', () => {
        const g = goalsData.find(x => x.id === _goalModalId);
        if (!g) return;
        g.books.splice(idx, 1);
        g.current = g.books.length;
        saveGoals();
        renderGoalsGrid();
        renderGoalModalBody(body, g);
      });

      row.appendChild(num);
      row.appendChild(title);
      row.appendChild(del);
      bookList.appendChild(row);
    });

    const addRow = document.createElement('div');
    addRow.className = 'goal-modal-add-row';

    const input = document.createElement('input');
    input.className = 'goal-modal-input';
    input.type = 'text';
    input.placeholder = 'Book title…';
    input.autocomplete = 'off';

    const addBtn = document.createElement('button');
    addBtn.className = 'goal-modal-add-btn';
    addBtn.textContent = 'Add';

    const doAdd = () => {
      const val = input.value.trim();
      if (!val) return;
      const g = goalsData.find(x => x.id === _goalModalId);
      if (!g || g.current >= g.target) return;
      if (!g.books) g.books = [];
      g.books.push(val);
      g.current = g.books.length;
      saveGoals();
      renderGoalsGrid();
      renderGoalModalBody(body, g);
    };

    input.addEventListener('keydown', e => { if (e.key === 'Enter') doAdd(); });
    addBtn.addEventListener('click', doAdd);

    addRow.appendChild(input);
    addRow.appendChild(addBtn);

    body.appendChild(fraction);
    body.appendChild(bar);
    body.appendChild(bookList);
    if ((goal.books || []).length < goal.target) body.appendChild(addRow);
  }

  function renderChecklistModal(body, goal) {
    const items = goal.items || [];
    const done  = items.filter(i => i.checked).length;

    const summary = document.createElement('div');
    summary.className = 'goal-modal-fraction';
    summary.textContent = items.length > 0 ? `${done} / ${items.length} complete` : 'No items yet';

    const list = document.createElement('div');
    list.className = 'goal-modal-checklist';

    items.forEach((item, idx) => {
      const row = document.createElement('div');
      row.className = 'goal-modal-check-row' + (item.checked ? ' goal-check-row--done' : '');

      const cb = document.createElement('input');
      cb.type    = 'checkbox';
      cb.checked = !!item.checked;
      cb.className = 'goal-check-cb';
      cb.addEventListener('change', () => {
        const g = goalsData.find(x => x.id === _goalModalId);
        if (!g) return;
        g.items[idx].checked = cb.checked;
        saveGoals();
        renderGoalsGrid();
        renderGoalModalBody(body, g);
      });

      const label = document.createElement('span');
      label.className = 'goal-check-label';
      label.textContent = item.text;

      const del = document.createElement('button');
      del.className = 'goal-item-del';
      del.textContent = '×';
      del.addEventListener('click', () => {
        const g = goalsData.find(x => x.id === _goalModalId);
        if (!g) return;
        g.items.splice(idx, 1);
        saveGoals();
        renderGoalsGrid();
        renderGoalModalBody(body, g);
      });

      row.appendChild(cb);
      row.appendChild(label);
      row.appendChild(del);
      list.appendChild(row);
    });

    const addRow = document.createElement('div');
    addRow.className = 'goal-modal-add-row';

    const input = document.createElement('input');
    input.className = 'goal-modal-input';
    input.type = 'text';
    input.placeholder = 'Add topic or unit…';
    input.autocomplete = 'off';

    const addBtn = document.createElement('button');
    addBtn.className = 'goal-modal-add-btn';
    addBtn.textContent = 'Add';

    const doAdd = () => {
      const val = input.value.trim();
      if (!val) return;
      const g = goalsData.find(x => x.id === _goalModalId);
      if (!g) return;
      if (!g.items) g.items = [];
      g.items.push({ text: val, checked: false });
      saveGoals();
      renderGoalsGrid();
      renderGoalModalBody(body, g);
    };

    input.addEventListener('keydown', e => { if (e.key === 'Enter') doAdd(); });
    addBtn.addEventListener('click', doAdd);

    body.appendChild(summary);
    body.appendChild(list);
    body.appendChild(addRow);
  }

  function renderMilestonesModal(body, goal) {
    const milestones = goal.milestones || [];
    const done       = milestones.filter(m => m.checked).length;

    const summary = document.createElement('div');
    summary.className = 'goal-modal-fraction';
    summary.textContent = milestones.length > 0 ? `${done} / ${milestones.length} complete` : 'No milestones yet';

    const list = document.createElement('div');
    list.className = 'goal-modal-checklist';

    milestones.forEach((item, idx) => {
      const row = document.createElement('div');
      row.className = 'goal-modal-check-row' + (item.checked ? ' goal-check-row--done' : '');

      const cb = document.createElement('input');
      cb.type    = 'checkbox';
      cb.checked = !!item.checked;
      cb.className = 'goal-check-cb';
      cb.addEventListener('change', () => {
        const g = goalsData.find(x => x.id === _goalModalId);
        if (!g) return;
        g.milestones[idx].checked = cb.checked;
        saveGoals();
        renderGoalsGrid();
        renderGoalModalBody(body, g);
      });

      const label = document.createElement('span');
      label.className = 'goal-check-label';
      label.textContent = item.text;

      const del = document.createElement('button');
      del.className = 'goal-item-del';
      del.textContent = '×';
      del.addEventListener('click', () => {
        const g = goalsData.find(x => x.id === _goalModalId);
        if (!g) return;
        g.milestones.splice(idx, 1);
        saveGoals();
        renderGoalsGrid();
        renderGoalModalBody(body, g);
      });

      row.appendChild(cb);
      row.appendChild(label);
      row.appendChild(del);
      list.appendChild(row);
    });

    const addRow = document.createElement('div');
    addRow.className = 'goal-modal-add-row';

    const input = document.createElement('input');
    input.className = 'goal-modal-input';
    input.type = 'text';
    input.placeholder = 'Add milestone…';
    input.autocomplete = 'off';

    const addBtn = document.createElement('button');
    addBtn.className = 'goal-modal-add-btn';
    addBtn.textContent = 'Add';

    const doAdd = () => {
      const val = input.value.trim();
      if (!val) return;
      const g = goalsData.find(x => x.id === _goalModalId);
      if (!g) return;
      if (!g.milestones) g.milestones = [];
      g.milestones.push({ text: val, checked: false });
      saveGoals();
      renderGoalsGrid();
      renderGoalModalBody(body, g);
    };

    input.addEventListener('keydown', e => { if (e.key === 'Enter') doAdd(); });
    addBtn.addEventListener('click', doAdd);

    body.appendChild(summary);
    body.appendChild(list);
    body.appendChild(addRow);
  }

  function renderUnitsModal(body, goal) {
    const units = goal.units || [];

    if (units.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'goal-modal-fraction';
      empty.textContent = 'No units yet';
      body.appendChild(empty);
    } else {
      const list = document.createElement('div');
      list.className = 'goal-modal-checklist';

      units.forEach((unit, idx) => {
        const row = document.createElement('div');
        row.className = 'goal-modal-check-row goal-unit-row';

        const nameEl = document.createElement('span');
        nameEl.className = 'goal-check-label';
        nameEl.textContent = unit.name;

        const del = document.createElement('button');
        del.className = 'goal-item-del';
        del.textContent = '×';

        const confirmEl = document.createElement('div');
        confirmEl.className = 'goal-unit-row-confirm hidden';

        const confirmText = document.createElement('span');
        confirmText.className = 'goal-confirm-text';
        confirmText.textContent = 'Delete?';

        const confirmBtns = document.createElement('div');
        confirmBtns.className = 'goal-confirm-btns';

        const yesBtn = document.createElement('button');
        yesBtn.className = 'goal-confirm-yes';
        yesBtn.textContent = 'Yes';
        yesBtn.addEventListener('click', e => {
          e.stopPropagation();
          const g = goalsData.find(x => x.id === _goalModalId);
          if (!g) return;
          g.units.splice(idx, 1);
          saveGoals();
          renderGoalsGrid();
          renderGoalModalBody(body, g);
        });

        const noBtn = document.createElement('button');
        noBtn.className = 'goal-confirm-no';
        noBtn.textContent = 'No';
        noBtn.addEventListener('click', e => {
          e.stopPropagation();
          confirmEl.classList.add('hidden');
          del.style.display = '';
        });

        confirmBtns.appendChild(yesBtn);
        confirmBtns.appendChild(noBtn);
        confirmEl.appendChild(confirmText);
        confirmEl.appendChild(confirmBtns);

        del.addEventListener('mousedown', e => e.stopPropagation());
        del.addEventListener('click', e => {
          e.stopPropagation();
          del.style.display = 'none';
          confirmEl.classList.remove('hidden');
        });

        row.addEventListener('click', e => {
          if (!confirmEl.classList.contains('hidden')) return;
          if (e.target === del) return;
          const g = goalsData.find(x => x.id === _goalModalId);
          if (!g) return;
          renderUnitDetail(body, g, unit.id);
        });

        row.appendChild(nameEl);
        row.appendChild(del);
        row.appendChild(confirmEl);
        list.appendChild(row);
      });

      body.appendChild(list);
    }

    const addRow = document.createElement('div');
    addRow.className = 'goal-modal-add-row';

    const addBtn = document.createElement('button');
    addBtn.className = 'goal-modal-add-btn';
    addBtn.textContent = '+ Add Unit';

    const input = document.createElement('input');
    input.className = 'goal-modal-input';
    input.type = 'text';
    input.placeholder = 'Unit name…';
    input.autocomplete = 'off';
    input.style.display = 'none';

    let addDone = false;

    const doAdd = () => {
      if (addDone) return;
      addDone = true;
      const val = input.value.trim();
      input.style.display = 'none';
      addBtn.style.display = '';
      if (!val) return;
      const g = goalsData.find(x => x.id === _goalModalId);
      if (!g) return;
      if (!g.units) g.units = [];
      g.units.push({ id: uid(), name: val, notes: '' });
      saveGoals();
      renderGoalsGrid();
      renderGoalModalBody(body, g);
    };

    addBtn.addEventListener('click', () => {
      addBtn.style.display = 'none';
      input.style.display = '';
      addDone = false;
      input.value = '';
      setTimeout(() => input.focus(), 0);
    });

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); doAdd(); }
      if (e.key === 'Escape') {
        addDone = true;
        input.style.display = 'none';
        addBtn.style.display = '';
      }
    });
    input.addEventListener('blur', doAdd);

    addRow.appendChild(addBtn);
    addRow.appendChild(input);
    body.appendChild(addRow);
  }

  function renderUnitDetail(body, goal, unitId) {
    const unit = (goal.units || []).find(u => u.id === unitId);
    if (!unit) return;
    const goalId = goal.id;

    body.innerHTML = '';
    document.querySelector('.goal-modal-box')?.classList.add('goal-modal-box--unit-detail');

    const MATH_SYMBOLS = ['√', 'π', '²', '³', '÷', '×', '±', '≤', '≥', '≠', '∞', 'θ', 'Δ'];
    let symbolsVisible = false;

    const backBtn = document.createElement('button');
    backBtn.className = 'goal-modal-back-btn';
    backBtn.textContent = '← Back';
    backBtn.addEventListener('click', () => {
      const g = goalsData.find(x => x.id === goalId);
      if (g) renderGoalModalBody(body, g);
    });

    const nameEl = document.createElement('div');
    nameEl.className = 'goal-unit-detail-name';
    nameEl.textContent = unit.name;

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'goal-unit-symbols-toggle';
    toggleBtn.textContent = '√x';

    const symbolsRow = document.createElement('div');
    symbolsRow.className = 'goal-unit-symbols-row';
    symbolsRow.style.display = 'none';

    const textarea = document.createElement('textarea');
    textarea.className = 'goal-unit-notes-textarea';
    textarea.placeholder = 'Notes…';
    textarea.value = unit.notes || '';

    MATH_SYMBOLS.forEach(sym => {
      const btn = document.createElement('button');
      btn.className = 'goal-unit-symbol-btn';
      btn.textContent = sym;
      btn.addEventListener('mousedown', e => e.preventDefault());
      btn.addEventListener('click', () => {
        const start = textarea.selectionStart;
        const end   = textarea.selectionEnd;
        const text  = textarea.value;
        textarea.value = text.slice(0, start) + sym + text.slice(end);
        const newPos = start + sym.length;
        textarea.setSelectionRange(newPos, newPos);
        textarea.focus();
      });
      symbolsRow.appendChild(btn);
    });

    toggleBtn.addEventListener('click', () => {
      symbolsVisible = !symbolsVisible;
      symbolsRow.style.display = symbolsVisible ? 'flex' : 'none';
      toggleBtn.classList.toggle('goal-unit-symbols-toggle--active', symbolsVisible);
    });

    textarea.addEventListener('blur', () => {
      const g = goalsData.find(x => x.id === goalId);
      if (!g) return;
      const u = (g.units || []).find(u => u.id === unitId);
      if (u) {
        u.notes = textarea.value;
        saveGoals();
      }
    });

    body.appendChild(backBtn);
    body.appendChild(nameEl);
    body.appendChild(toggleBtn);
    body.appendChild(symbolsRow);
    body.appendChild(textarea);
  }

let _tradingActiveTab = 'lessons';

function renderTradingGoalModal(body, goal) {
  _tradingActiveTab = 'lessons';

  const TABS = [
    { id: 'lessons',       label: 'Lessons'        },
    { id: 'journal',       label: 'Journal'        },
    { id: 'checklist',     label: 'Checklist'      },
    { id: 'exit-checklist', label: 'Exit Checklist' },
  ];

  const tabBar = document.createElement('div');
  tabBar.className = 'trading-tab-bar';

  const content = document.createElement('div');
  content.className = 'trading-tab-content';

  const renderTabContent = (tabId) => {
    content.innerHTML = '';
    content.classList.remove('trading-tab-content--detail');
    const g = goalsData.find(x => x.id === _goalModalId);
    if (!g) return;
    if (tabId === 'lessons') {
      renderTradingLessonsList(content, g);
    } else if (tabId === 'checklist') {
      renderTradingChecklistTab(content, g, 'checklist');
    } else if (tabId === 'exit-checklist') {
      renderTradingChecklistTab(content, g, 'exitChecklist');
    } else if (tabId === 'journal') {
      renderTradingJournalTab(content, g);
    }
  };

  TABS.forEach(tab => {
    const btn = document.createElement('button');
    btn.className = 'trading-tab-btn' + (tab.id === _tradingActiveTab ? ' trading-tab-btn--active' : '');
    btn.textContent = tab.label;
    btn.addEventListener('click', () => {
      _tradingActiveTab = tab.id;
      tabBar.querySelectorAll('.trading-tab-btn').forEach(b => b.classList.remove('trading-tab-btn--active'));
      btn.classList.add('trading-tab-btn--active');
      renderTabContent(tab.id);
    });
    tabBar.appendChild(btn);
  });

  body.appendChild(tabBar);
  body.appendChild(content);
  renderTabContent(_tradingActiveTab);
}

function renderTradingLessonsList(container, goal) {
  container.innerHTML = '';
  container.classList.remove('trading-tab-content--detail');

  const lessons = goal.lessons || [];

  if (!lessons.length) {
    const empty = document.createElement('div');
    empty.className = 'goal-modal-fraction';
    empty.textContent = 'No lessons yet';
    container.appendChild(empty);
  } else {
    const list = document.createElement('div');
    list.className = 'goal-modal-checklist';

    lessons.forEach((lesson, idx) => {
      const row = document.createElement('div');
      row.className = 'goal-modal-check-row goal-unit-row';

      const nameEl = document.createElement('span');
      nameEl.className = 'goal-check-label';
      nameEl.textContent = lesson.name;

      const del = document.createElement('button');
      del.className = 'goal-item-del';
      del.textContent = '×';

      const confirmEl = document.createElement('div');
      confirmEl.className = 'goal-unit-row-confirm hidden';

      const confirmText = document.createElement('span');
      confirmText.className = 'goal-confirm-text';
      confirmText.textContent = 'Delete?';

      const confirmBtns = document.createElement('div');
      confirmBtns.className = 'goal-confirm-btns';

      const yesBtn = document.createElement('button');
      yesBtn.className = 'goal-confirm-yes';
      yesBtn.textContent = 'Yes';
      yesBtn.addEventListener('click', e => {
        e.stopPropagation();
        const g = goalsData.find(x => x.id === _goalModalId);
        if (!g) return;
        g.lessons.splice(idx, 1);
        saveGoals();
        renderGoalsGrid();
        const g2 = goalsData.find(x => x.id === _goalModalId);
        if (g2) renderTradingLessonsList(container, g2);
      });

      const noBtn = document.createElement('button');
      noBtn.className = 'goal-confirm-no';
      noBtn.textContent = 'No';
      noBtn.addEventListener('click', e => {
        e.stopPropagation();
        confirmEl.classList.add('hidden');
        del.style.display = '';
      });

      confirmBtns.appendChild(yesBtn);
      confirmBtns.appendChild(noBtn);
      confirmEl.appendChild(confirmText);
      confirmEl.appendChild(confirmBtns);

      del.addEventListener('mousedown', e => e.stopPropagation());
      del.addEventListener('click', e => {
        e.stopPropagation();
        del.style.display = 'none';
        confirmEl.classList.remove('hidden');
      });

      row.addEventListener('click', e => {
        if (!confirmEl.classList.contains('hidden')) return;
        if (e.target === del) return;
        const g = goalsData.find(x => x.id === _goalModalId);
        if (!g) return;
        renderTradingLessonDetail(container, g, lesson.id);
      });

      row.appendChild(nameEl);
      row.appendChild(del);
      row.appendChild(confirmEl);
      list.appendChild(row);
    });

    container.appendChild(list);
  }

  const addRow = document.createElement('div');
  addRow.className = 'goal-modal-add-row';

  const addBtn = document.createElement('button');
  addBtn.className = 'goal-modal-add-btn';
  addBtn.textContent = '+ Add Lesson';

  const input = document.createElement('input');
  input.className = 'goal-modal-input';
  input.type = 'text';
  input.placeholder = 'Lesson name…';
  input.autocomplete = 'off';
  input.style.display = 'none';

  let addDone = false;

  const doAdd = () => {
    if (addDone) return;
    addDone = true;
    const val = input.value.trim();
    input.style.display = 'none';
    addBtn.style.display = '';
    if (!val) return;
    const g = goalsData.find(x => x.id === _goalModalId);
    if (!g) return;
    if (!g.lessons) g.lessons = [];
    g.lessons.push({ id: uid(), name: val, notes: '' });
    saveGoals();
    renderGoalsGrid();
    const g2 = goalsData.find(x => x.id === _goalModalId);
    if (g2) renderTradingLessonsList(container, g2);
  };

  addBtn.addEventListener('click', () => {
    addBtn.style.display = 'none';
    input.style.display = '';
    addDone = false;
    input.value = '';
    setTimeout(() => input.focus(), 0);
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); doAdd(); }
    if (e.key === 'Escape') { addDone = true; input.style.display = 'none'; addBtn.style.display = ''; }
  });
  input.addEventListener('blur', doAdd);

  addRow.appendChild(addBtn);
  addRow.appendChild(input);
  container.appendChild(addRow);
}

function renderTradingLessonDetail(container, goal, lessonId) {
  const lesson = (goal.lessons || []).find(l => l.id === lessonId);
  if (!lesson) return;
  const goalId = goal.id;

  container.innerHTML = '';
  container.classList.add('trading-tab-content--detail');

  const MATH_SYMBOLS = ['√', 'π', '²', '³', '÷', '×', '±', '≤', '≥', '≠', '∞', 'θ', 'Δ'];
  let symbolsVisible = false;

  const backBtn = document.createElement('button');
  backBtn.className = 'goal-modal-back-btn';
  backBtn.textContent = '← Back';
  backBtn.addEventListener('click', () => {
    const g = goalsData.find(x => x.id === goalId);
    if (g) renderTradingLessonsList(container, g);
  });

  const nameEl = document.createElement('div');
  nameEl.className = 'goal-unit-detail-name';
  nameEl.textContent = lesson.name;

  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'goal-unit-symbols-toggle';
  toggleBtn.textContent = '√x';

  const symbolsRow = document.createElement('div');
  symbolsRow.className = 'goal-unit-symbols-row';
  symbolsRow.style.display = 'none';

  const textarea = document.createElement('textarea');
  textarea.className = 'goal-unit-notes-textarea';
  textarea.placeholder = 'Write your lesson notes here…';
  textarea.value = lesson.notes || '';

  MATH_SYMBOLS.forEach(sym => {
    const btn = document.createElement('button');
    btn.className = 'goal-unit-symbol-btn';
    btn.textContent = sym;
    btn.addEventListener('mousedown', e => e.preventDefault());
    btn.addEventListener('click', () => {
      const start = textarea.selectionStart;
      const end   = textarea.selectionEnd;
      const text  = textarea.value;
      textarea.value = text.slice(0, start) + sym + text.slice(end);
      const newPos = start + sym.length;
      textarea.setSelectionRange(newPos, newPos);
      textarea.focus();
    });
    symbolsRow.appendChild(btn);
  });

  toggleBtn.addEventListener('click', () => {
    symbolsVisible = !symbolsVisible;
    symbolsRow.style.display = symbolsVisible ? 'flex' : 'none';
    toggleBtn.classList.toggle('goal-unit-symbols-toggle--active', symbolsVisible);
  });

  textarea.addEventListener('blur', () => {
    const g = goalsData.find(x => x.id === goalId);
    if (!g) return;
    const l = (g.lessons || []).find(l => l.id === lessonId);
    if (l) {
      l.notes = textarea.value;
      saveGoals();
    }
  });

  container.appendChild(backBtn);
  container.appendChild(nameEl);
  container.appendChild(toggleBtn);
  container.appendChild(symbolsRow);
  container.appendChild(textarea);
}

function renderTradingChecklistTab(container, goal, arrayKey) {
  container.innerHTML = '';

  const items = goal[arrayKey] || [];
  const emptyText = arrayKey === 'checklist'
    ? 'No rules yet — add your pre-trade checklist'
    : 'No rules yet — add your exit checklist';

  // Header row with Reset All button
  const header = document.createElement('div');
  header.className = 'trading-checklist-header';

  const headerSpacer = document.createElement('span');

  const resetBtn = document.createElement('button');
  resetBtn.className = 'trading-checklist-reset-btn';
  resetBtn.textContent = 'Reset All';

  const resetConfirm = document.createElement('div');
  resetConfirm.className = 'trading-checklist-reset-confirm hidden';

  const resetConfirmText = document.createElement('span');
  resetConfirmText.className = 'goal-confirm-text';
  resetConfirmText.textContent = 'Reset all?';

  const resetConfirmBtns = document.createElement('div');
  resetConfirmBtns.className = 'goal-confirm-btns';

  const resetYes = document.createElement('button');
  resetYes.className = 'goal-confirm-yes';
  resetYes.textContent = 'Yes';
  resetYes.addEventListener('click', () => {
    const g = goalsData.find(x => x.id === _goalModalId);
    if (!g || !Array.isArray(g[arrayKey])) return;
    g[arrayKey].forEach(item => { item.checked = false; });
    saveGoals();
    renderGoalsGrid();
    const g2 = goalsData.find(x => x.id === _goalModalId);
    if (g2) renderTradingChecklistTab(container, g2, arrayKey);
  });

  const resetNo = document.createElement('button');
  resetNo.className = 'goal-confirm-no';
  resetNo.textContent = 'No';
  resetNo.addEventListener('click', () => {
    resetConfirm.classList.add('hidden');
    resetBtn.style.display = '';
  });

  resetConfirmBtns.appendChild(resetYes);
  resetConfirmBtns.appendChild(resetNo);
  resetConfirm.appendChild(resetConfirmText);
  resetConfirm.appendChild(resetConfirmBtns);

  resetBtn.addEventListener('click', () => {
    resetBtn.style.display = 'none';
    resetConfirm.classList.remove('hidden');
  });

  header.appendChild(headerSpacer);
  header.appendChild(resetBtn);
  header.appendChild(resetConfirm);
  container.appendChild(header);

  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'trading-coming-soon';
    empty.textContent = emptyText;
    container.appendChild(empty);
  } else {
    const list = document.createElement('div');
    list.className = 'goal-modal-checklist';

    items.forEach((item, idx) => {
      const row = document.createElement('div');
      row.className = 'goal-modal-check-row' + (item.checked ? ' goal-check-row--done' : '');

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'goal-check-cb';
      cb.checked = item.checked;
      cb.addEventListener('change', () => {
        const g = goalsData.find(x => x.id === _goalModalId);
        if (!g || !Array.isArray(g[arrayKey])) return;
        g[arrayKey][idx].checked = cb.checked;
        saveGoals();
        renderGoalsGrid();
        row.classList.toggle('goal-check-row--done', cb.checked);
      });

      const label = document.createElement('span');
      label.className = 'goal-check-label';
      label.textContent = item.text;

      const del = document.createElement('button');
      del.className = 'goal-item-del';
      del.textContent = '×';

      const confirmEl = document.createElement('div');
      confirmEl.className = 'goal-unit-row-confirm hidden';

      const confirmText = document.createElement('span');
      confirmText.className = 'goal-confirm-text';
      confirmText.textContent = 'Delete?';

      const confirmBtns = document.createElement('div');
      confirmBtns.className = 'goal-confirm-btns';

      const yesBtn = document.createElement('button');
      yesBtn.className = 'goal-confirm-yes';
      yesBtn.textContent = 'Yes';
      yesBtn.addEventListener('click', e => {
        e.stopPropagation();
        const g = goalsData.find(x => x.id === _goalModalId);
        if (!g) return;
        g[arrayKey].splice(idx, 1);
        saveGoals();
        renderGoalsGrid();
        const g2 = goalsData.find(x => x.id === _goalModalId);
        if (g2) renderTradingChecklistTab(container, g2, arrayKey);
      });

      const noBtn = document.createElement('button');
      noBtn.className = 'goal-confirm-no';
      noBtn.textContent = 'No';
      noBtn.addEventListener('click', e => {
        e.stopPropagation();
        confirmEl.classList.add('hidden');
        del.style.display = '';
      });

      confirmBtns.appendChild(yesBtn);
      confirmBtns.appendChild(noBtn);
      confirmEl.appendChild(confirmText);
      confirmEl.appendChild(confirmBtns);

      del.addEventListener('mousedown', e => e.stopPropagation());
      del.addEventListener('click', e => {
        e.stopPropagation();
        del.style.display = 'none';
        confirmEl.classList.remove('hidden');
      });

      row.appendChild(cb);
      row.appendChild(label);
      row.appendChild(del);
      row.appendChild(confirmEl);
      list.appendChild(row);
    });

    container.appendChild(list);
  }

  // Add Rule input
  const addRow = document.createElement('div');
  addRow.className = 'goal-modal-add-row';

  const addBtn = document.createElement('button');
  addBtn.className = 'goal-modal-add-btn';
  addBtn.textContent = '+ Add Rule';

  const input = document.createElement('input');
  input.className = 'goal-modal-input';
  input.type = 'text';
  input.placeholder = 'Rule text…';
  input.autocomplete = 'off';
  input.style.display = 'none';

  let addDone = false;

  const doAdd = () => {
    if (addDone) return;
    addDone = true;
    const val = input.value.trim();
    input.style.display = 'none';
    addBtn.style.display = '';
    if (!val) return;
    const g = goalsData.find(x => x.id === _goalModalId);
    if (!g) return;
    if (!Array.isArray(g[arrayKey])) g[arrayKey] = [];
    g[arrayKey].push({ id: uid(), text: val, checked: false });
    saveGoals();
    renderGoalsGrid();
    const g2 = goalsData.find(x => x.id === _goalModalId);
    if (g2) renderTradingChecklistTab(container, g2, arrayKey);
  };

  addBtn.addEventListener('click', () => {
    addBtn.style.display = 'none';
    input.style.display = '';
    addDone = false;
    input.value = '';
    setTimeout(() => input.focus(), 0);
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); doAdd(); }
    if (e.key === 'Escape') { addDone = true; input.style.display = 'none'; addBtn.style.display = ''; }
  });
  input.addEventListener('blur', doAdd);

  addRow.appendChild(addBtn);
  addRow.appendChild(input);
  container.appendChild(addRow);
}

function renderTradingJournalTab(container, goal) {
  container.innerHTML = '';

  const journal = goal.journal || [];
  const trades  = journal.filter(e => e.type === 'trade');
  const entries = journal.filter(e => e.type === 'entry');

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const _d = new Date();
  const todayStr = `${MONTHS[_d.getMonth()]} ${_d.getDate()}, ${_d.getFullYear()}`;

  // ── TRADE LOG SECTION ────────────────────────────────────────────────────────
  const tradeSection = document.createElement('div');
  tradeSection.className = 'trading-journal-section';

  const tradeSectionHd = document.createElement('div');
  tradeSectionHd.className = 'trading-journal-section-header';

  const tradeSectionLabel = document.createElement('div');
  tradeSectionLabel.className = 'trading-journal-section-label';
  tradeSectionLabel.textContent = 'TRADE LOG';

  const logTradeBtn = document.createElement('button');
  logTradeBtn.className = 'goal-modal-add-btn';
  logTradeBtn.textContent = '+ Log Trade';

  tradeSectionHd.appendChild(tradeSectionLabel);
  tradeSectionHd.appendChild(logTradeBtn);
  tradeSection.appendChild(tradeSectionHd);

  // ── Trade Form ──
  const tradeForm = document.createElement('div');
  tradeForm.className = 'trading-journal-form hidden';

  const tickerField = document.createElement('div');
  tickerField.className = 'trading-form-field';
  const tickerLabel = document.createElement('div');
  tickerLabel.className = 'trading-form-label';
  tickerLabel.textContent = 'Ticker';
  const tickerInput = document.createElement('input');
  tickerInput.className = 'trading-form-input';
  tickerInput.type = 'text';
  tickerInput.placeholder = 'e.g. AAPL';
  tickerInput.autocomplete = 'off';
  tickerInput.addEventListener('input', () => { tickerInput.value = tickerInput.value.toUpperCase(); });
  tickerField.appendChild(tickerLabel);
  tickerField.appendChild(tickerInput);
  tradeForm.appendChild(tickerField);

  let selectedDirection = 'Long';
  const dirField = document.createElement('div');
  dirField.className = 'trading-form-field';
  const dirLabel = document.createElement('div');
  dirLabel.className = 'trading-form-label';
  dirLabel.textContent = 'Direction';
  const dirSeg = document.createElement('div');
  dirSeg.className = 'settings-seg';
  ['Long', 'Short'].forEach((dir, i) => {
    const btn = document.createElement('button');
    btn.className = 'settings-seg-btn' + (i === 0 ? ' settings-seg-btn--active' : '');
    btn.textContent = dir;
    btn.addEventListener('click', () => {
      selectedDirection = dir;
      dirSeg.querySelectorAll('.settings-seg-btn').forEach(b => b.classList.remove('settings-seg-btn--active'));
      btn.classList.add('settings-seg-btn--active');
    });
    dirSeg.appendChild(btn);
  });
  dirField.appendChild(dirLabel);
  dirField.appendChild(dirSeg);
  tradeForm.appendChild(dirField);

  let selectedOutcome = 'Win';
  const outField = document.createElement('div');
  outField.className = 'trading-form-field';
  const outLabel = document.createElement('div');
  outLabel.className = 'trading-form-label';
  outLabel.textContent = 'Outcome';
  const outSeg = document.createElement('div');
  outSeg.className = 'settings-seg';
  ['Win', 'Loss', 'Breakeven'].forEach((out, i) => {
    const btn = document.createElement('button');
    btn.className = 'settings-seg-btn' + (i === 0 ? ' settings-seg-btn--active' : '');
    btn.textContent = out;
    btn.addEventListener('click', () => {
      selectedOutcome = out;
      outSeg.querySelectorAll('.settings-seg-btn').forEach(b => b.classList.remove('settings-seg-btn--active'));
      btn.classList.add('settings-seg-btn--active');
    });
    outSeg.appendChild(btn);
  });
  outField.appendChild(outLabel);
  outField.appendChild(outSeg);
  tradeForm.appendChild(outField);

  const pnlField = document.createElement('div');
  pnlField.className = 'trading-form-field';
  const pnlLabel = document.createElement('div');
  pnlLabel.className = 'trading-form-label';
  pnlLabel.textContent = 'P&L';
  const pnlInput = document.createElement('input');
  pnlInput.className = 'trading-form-input';
  pnlInput.type = 'text';
  pnlInput.placeholder = 'e.g. +$240 or -$80';
  pnlInput.autocomplete = 'off';
  pnlField.appendChild(pnlLabel);
  pnlField.appendChild(pnlInput);
  tradeForm.appendChild(pnlField);

  const notesTradeField = document.createElement('div');
  notesTradeField.className = 'trading-form-field';
  const notesTradeLabel = document.createElement('div');
  notesTradeLabel.className = 'trading-form-label';
  notesTradeLabel.textContent = 'Notes';
  const notesTradeArea = document.createElement('textarea');
  notesTradeArea.className = 'trading-form-textarea';
  notesTradeArea.rows = 3;
  notesTradeArea.placeholder = 'Optional notes…';
  notesTradeField.appendChild(notesTradeLabel);
  notesTradeField.appendChild(notesTradeArea);
  tradeForm.appendChild(notesTradeField);

  const tradeFormActions = document.createElement('div');
  tradeFormActions.className = 'trading-form-actions';
  const cancelTradeBtn = document.createElement('button');
  cancelTradeBtn.className = 'book-journal-cancel-btn';
  cancelTradeBtn.textContent = 'Cancel';
  const saveTradeBtn = document.createElement('button');
  saveTradeBtn.className = 'book-journal-save-btn';
  saveTradeBtn.textContent = 'Save Trade';
  tradeFormActions.appendChild(cancelTradeBtn);
  tradeFormActions.appendChild(saveTradeBtn);
  tradeForm.appendChild(tradeFormActions);
  tradeSection.appendChild(tradeForm);

  logTradeBtn.addEventListener('click', () => {
    tickerInput.value = '';
    pnlInput.value = '';
    notesTradeArea.value = '';
    selectedDirection = 'Long';
    selectedOutcome = 'Win';
    dirSeg.querySelectorAll('.settings-seg-btn').forEach((b, i) => b.classList.toggle('settings-seg-btn--active', i === 0));
    outSeg.querySelectorAll('.settings-seg-btn').forEach((b, i) => b.classList.toggle('settings-seg-btn--active', i === 0));
    tickerInput.style.borderBottomColor = '';
    tradeForm.classList.remove('hidden');
    logTradeBtn.style.display = 'none';
    setTimeout(() => tickerInput.focus(), 0);
  });

  cancelTradeBtn.addEventListener('click', () => {
    tradeForm.classList.add('hidden');
    logTradeBtn.style.display = '';
  });

  saveTradeBtn.addEventListener('click', () => {
    const ticker = tickerInput.value.trim();
    if (!ticker) {
      tickerInput.style.borderBottomColor = 'rgba(239,68,68,0.7)';
      tickerInput.focus();
      return;
    }
    const g = goalsData.find(x => x.id === _goalModalId);
    if (!g) return;
    if (!Array.isArray(g.journal)) g.journal = [];
    g.journal.unshift({
      id: uid(),
      type: 'trade',
      date: todayStr,
      ticker,
      direction: selectedDirection,
      outcome: selectedOutcome,
      pnl: pnlInput.value.trim(),
      notes: notesTradeArea.value.trim(),
    });
    saveGoals();
    renderGoalsGrid();
    const g2 = goalsData.find(x => x.id === _goalModalId);
    if (g2) renderTradingJournalTab(container, g2);
  });

  // ── Trade List ──
  const tradeListEl = document.createElement('div');
  if (!trades.length) {
    const empty = document.createElement('div');
    empty.className = 'trading-coming-soon';
    empty.textContent = 'No trades logged yet';
    tradeListEl.appendChild(empty);
  } else {
    trades.forEach(trade => {
      const card = document.createElement('div');
      card.className = 'trading-trade-card';

      const mainRow = document.createElement('div');
      mainRow.className = 'trading-trade-row';

      const tickerEl = document.createElement('span');
      tickerEl.className = 'trading-trade-ticker';
      tickerEl.textContent = trade.ticker;
      mainRow.appendChild(tickerEl);

      const dirBadge = document.createElement('span');
      dirBadge.className = 'trading-trade-badge trading-trade-badge--' + (trade.direction === 'Long' ? 'long' : 'short');
      dirBadge.textContent = trade.direction;
      mainRow.appendChild(dirBadge);

      const outKey = trade.outcome === 'Breakeven' ? 'breakeven' : trade.outcome === 'Win' ? 'win' : 'loss';
      const outBadge = document.createElement('span');
      outBadge.className = 'trading-trade-badge trading-trade-badge--' + outKey;
      outBadge.textContent = trade.outcome;
      mainRow.appendChild(outBadge);

      if (trade.pnl) {
        const pnlEl = document.createElement('span');
        pnlEl.className = 'trading-trade-pnl';
        pnlEl.textContent = trade.pnl;
        mainRow.appendChild(pnlEl);
      }

      const tradeDelBtn = document.createElement('button');
      tradeDelBtn.className = 'trading-trade-del';
      tradeDelBtn.textContent = '×';

      const tradeConfirmEl = document.createElement('div');
      tradeConfirmEl.className = 'trading-confirm-inline hidden';
      const tConfirmText = document.createElement('span');
      tConfirmText.className = 'goal-confirm-text';
      tConfirmText.textContent = 'Delete?';
      const tConfirmBtns = document.createElement('div');
      tConfirmBtns.className = 'goal-confirm-btns';
      const tYesBtn = document.createElement('button');
      tYesBtn.className = 'goal-confirm-yes';
      tYesBtn.textContent = 'Yes';
      tYesBtn.addEventListener('click', e => {
        e.stopPropagation();
        const g = goalsData.find(x => x.id === _goalModalId);
        if (!g) return;
        g.journal = (g.journal || []).filter(j => j.id !== trade.id);
        saveGoals();
        renderGoalsGrid();
        const g2 = goalsData.find(x => x.id === _goalModalId);
        if (g2) renderTradingJournalTab(container, g2);
      });
      const tNoBtn = document.createElement('button');
      tNoBtn.className = 'goal-confirm-no';
      tNoBtn.textContent = 'No';
      tNoBtn.addEventListener('click', e => {
        e.stopPropagation();
        tradeConfirmEl.classList.add('hidden');
        tradeDelBtn.style.display = '';
      });
      tConfirmBtns.appendChild(tYesBtn);
      tConfirmBtns.appendChild(tNoBtn);
      tradeConfirmEl.appendChild(tConfirmText);
      tradeConfirmEl.appendChild(tConfirmBtns);

      tradeDelBtn.addEventListener('click', e => {
        e.stopPropagation();
        tradeDelBtn.style.display = 'none';
        tradeConfirmEl.classList.remove('hidden');
      });

      mainRow.appendChild(tradeDelBtn);
      mainRow.appendChild(tradeConfirmEl);
      card.appendChild(mainRow);

      const tradeDateEl = document.createElement('div');
      tradeDateEl.className = 'trading-trade-date';
      tradeDateEl.textContent = trade.date;
      card.appendChild(tradeDateEl);

      if (trade.notes) {
        const tradeNotesEl = document.createElement('div');
        tradeNotesEl.className = 'trading-trade-notes';
        tradeNotesEl.textContent = trade.notes;
        card.appendChild(tradeNotesEl);
      }

      tradeListEl.appendChild(card);
    });
  }
  tradeSection.appendChild(tradeListEl);
  container.appendChild(tradeSection);

  // ── JOURNAL ENTRIES SECTION ──────────────────────────────────────────────────
  const entrySection = document.createElement('div');
  entrySection.className = 'trading-journal-section';

  const entrySectionHd = document.createElement('div');
  entrySectionHd.className = 'trading-journal-section-header';

  const entrySectionLabel = document.createElement('div');
  entrySectionLabel.className = 'trading-journal-section-label';
  entrySectionLabel.textContent = 'JOURNAL ENTRIES';

  const newEntryBtn = document.createElement('button');
  newEntryBtn.className = 'goal-modal-add-btn';
  newEntryBtn.textContent = '+ New Entry';

  entrySectionHd.appendChild(entrySectionLabel);
  entrySectionHd.appendChild(newEntryBtn);
  entrySection.appendChild(entrySectionHd);

  // ── Entry Form ──
  const entryForm = document.createElement('div');
  entryForm.className = 'trading-journal-form hidden';

  const eTitleField = document.createElement('div');
  eTitleField.className = 'trading-form-field';
  const eTitleLabel = document.createElement('div');
  eTitleLabel.className = 'trading-form-label';
  eTitleLabel.textContent = 'Title';
  const eTitleInput = document.createElement('input');
  eTitleInput.className = 'trading-form-input';
  eTitleInput.type = 'text';
  eTitleInput.placeholder = 'Entry title…';
  eTitleInput.autocomplete = 'off';
  eTitleField.appendChild(eTitleLabel);
  eTitleField.appendChild(eTitleInput);
  entryForm.appendChild(eTitleField);

  const eBodyField = document.createElement('div');
  eBodyField.className = 'trading-form-field';
  const eBodyLabel = document.createElement('div');
  eBodyLabel.className = 'trading-form-label';
  eBodyLabel.textContent = 'Body';
  const eBodyArea = document.createElement('textarea');
  eBodyArea.className = 'trading-form-textarea';
  eBodyArea.rows = 5;
  eBodyArea.placeholder = 'Write here…';
  eBodyField.appendChild(eBodyLabel);
  eBodyField.appendChild(eBodyArea);
  entryForm.appendChild(eBodyField);

  const entryFormActions = document.createElement('div');
  entryFormActions.className = 'trading-form-actions';
  const cancelEntryBtn = document.createElement('button');
  cancelEntryBtn.className = 'book-journal-cancel-btn';
  cancelEntryBtn.textContent = 'Cancel';
  const saveEntryBtn = document.createElement('button');
  saveEntryBtn.className = 'book-journal-save-btn';
  saveEntryBtn.textContent = 'Save Entry';
  entryFormActions.appendChild(cancelEntryBtn);
  entryFormActions.appendChild(saveEntryBtn);
  entryForm.appendChild(entryFormActions);
  entrySection.appendChild(entryForm);

  newEntryBtn.addEventListener('click', () => {
    eTitleInput.value = '';
    eBodyArea.value = '';
    eBodyArea.style.borderBottomColor = '';
    entryForm.classList.remove('hidden');
    newEntryBtn.style.display = 'none';
    setTimeout(() => eTitleInput.focus(), 0);
  });

  cancelEntryBtn.addEventListener('click', () => {
    entryForm.classList.add('hidden');
    newEntryBtn.style.display = '';
  });

  saveEntryBtn.addEventListener('click', () => {
    const body = eBodyArea.value.trim();
    if (!body) {
      eBodyArea.style.borderBottomColor = 'rgba(239,68,68,0.7)';
      eBodyArea.focus();
      return;
    }
    const g = goalsData.find(x => x.id === _goalModalId);
    if (!g) return;
    if (!Array.isArray(g.journal)) g.journal = [];
    g.journal.unshift({
      id: uid(),
      type: 'entry',
      date: todayStr,
      title: eTitleInput.value.trim(),
      body,
    });
    saveGoals();
    renderGoalsGrid();
    const g2 = goalsData.find(x => x.id === _goalModalId);
    if (g2) renderTradingJournalTab(container, g2);
  });

  // ── Entry List ──
  const entryListEl = document.createElement('div');
  if (!entries.length) {
    const empty = document.createElement('div');
    empty.className = 'trading-coming-soon';
    empty.textContent = 'No journal entries yet';
    entryListEl.appendChild(empty);
  } else {
    entries.forEach(entry => {
      renderJournalEntryCard(entryListEl, entry, container);
    });
  }
  entrySection.appendChild(entryListEl);
  container.appendChild(entrySection);
}

function renderJournalEntryCard(listEl, entry, container) {
  const card = document.createElement('div');
  card.className = 'trading-entry-card';
  let isExpanded = false;

  const showReadView = () => {
    card.innerHTML = '';
    card.style.cursor = 'pointer';

    const hd = document.createElement('div');
    hd.className = 'trading-entry-card-hd';

    const titleEl = document.createElement('div');
    titleEl.className = 'trading-entry-title';
    titleEl.textContent = entry.title || '(No title)';

    const rightEl = document.createElement('div');
    rightEl.className = 'trading-entry-right';

    const dateEl = document.createElement('div');
    dateEl.className = 'trading-entry-date';
    dateEl.textContent = entry.date;

    const actions = document.createElement('div');
    actions.className = 'trading-entry-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'trading-entry-edit-btn';
    editBtn.textContent = '✎';

    const delBtn = document.createElement('button');
    delBtn.className = 'trading-entry-del-btn';
    delBtn.textContent = '×';

    const confirmEl = document.createElement('div');
    confirmEl.className = 'trading-confirm-inline hidden';
    const confirmText = document.createElement('span');
    confirmText.className = 'goal-confirm-text';
    confirmText.textContent = 'Delete?';
    const confirmBtns = document.createElement('div');
    confirmBtns.className = 'goal-confirm-btns';
    const yesBtn = document.createElement('button');
    yesBtn.className = 'goal-confirm-yes';
    yesBtn.textContent = 'Yes';
    yesBtn.addEventListener('click', e => {
      e.stopPropagation();
      const g = goalsData.find(x => x.id === _goalModalId);
      if (!g) return;
      g.journal = (g.journal || []).filter(j => j.id !== entry.id);
      saveGoals();
      renderGoalsGrid();
      const g2 = goalsData.find(x => x.id === _goalModalId);
      if (g2) renderTradingJournalTab(container, g2);
    });
    const noBtn = document.createElement('button');
    noBtn.className = 'goal-confirm-no';
    noBtn.textContent = 'No';
    noBtn.addEventListener('click', e => {
      e.stopPropagation();
      confirmEl.classList.add('hidden');
      delBtn.style.display = '';
    });
    confirmBtns.appendChild(yesBtn);
    confirmBtns.appendChild(noBtn);
    confirmEl.appendChild(confirmText);
    confirmEl.appendChild(confirmBtns);

    editBtn.addEventListener('mousedown', e => e.stopPropagation());
    editBtn.addEventListener('click', e => {
      e.stopPropagation();
      showEditView();
    });

    delBtn.addEventListener('mousedown', e => e.stopPropagation());
    delBtn.addEventListener('click', e => {
      e.stopPropagation();
      delBtn.style.display = 'none';
      confirmEl.classList.remove('hidden');
    });

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    actions.appendChild(confirmEl);

    rightEl.appendChild(dateEl);
    rightEl.appendChild(actions);
    hd.appendChild(titleEl);
    hd.appendChild(rightEl);
    card.appendChild(hd);

    const bodyText = entry.body || '';
    const bodyEl = document.createElement('div');
    if (isExpanded) {
      bodyEl.className = 'trading-entry-body';
      bodyEl.textContent = bodyText;
    } else {
      bodyEl.className = 'trading-entry-preview';
      bodyEl.textContent = bodyText.length > 100 ? bodyText.slice(0, 100) + '…' : bodyText;
    }
    card.appendChild(bodyEl);

    card.addEventListener('click', e => {
      if (e.target.closest('.trading-entry-actions') || e.target.closest('.trading-confirm-inline')) return;
      isExpanded = !isExpanded;
      showReadView();
    });
  };

  const showEditView = () => {
    card.innerHTML = '';
    card.style.cursor = 'default';

    const editTitleInput = document.createElement('input');
    editTitleInput.className = 'trading-form-input';
    editTitleInput.type = 'text';
    editTitleInput.value = entry.title || '';
    editTitleInput.placeholder = 'Entry title…';
    editTitleInput.style.marginBottom = '8px';
    card.appendChild(editTitleInput);

    const editBodyArea = document.createElement('textarea');
    editBodyArea.className = 'trading-form-textarea';
    editBodyArea.rows = 5;
    editBodyArea.value = entry.body || '';
    card.appendChild(editBodyArea);

    const editActions = document.createElement('div');
    editActions.className = 'trading-form-actions';

    const cancelEdit = document.createElement('button');
    cancelEdit.className = 'book-journal-cancel-btn';
    cancelEdit.textContent = 'Cancel';
    cancelEdit.addEventListener('click', () => showReadView());

    const saveEdit = document.createElement('button');
    saveEdit.className = 'book-journal-save-btn';
    saveEdit.textContent = 'Save';
    saveEdit.addEventListener('click', () => {
      const g = goalsData.find(x => x.id === _goalModalId);
      if (!g) return;
      const idx = (g.journal || []).findIndex(j => j.id === entry.id);
      if (idx !== -1) {
        g.journal[idx].title = editTitleInput.value.trim();
        g.journal[idx].body  = editBodyArea.value.trim();
        entry.title = g.journal[idx].title;
        entry.body  = g.journal[idx].body;
        saveGoals();
      }
      showReadView();
    });

    editActions.appendChild(cancelEdit);
    editActions.appendChild(saveEdit);
    card.appendChild(editActions);

    setTimeout(() => editTitleInput.focus(), 0);
  };

  showReadView();
  listEl.appendChild(card);
}

function renderGoalsGrid() {
  const grid = document.getElementById('goalsGrid');
  if (!grid) return;
  grid.innerHTML = '';

  goalsData.forEach(goal => {
    const card = document.createElement('div');
    card.className = 'goal-card';
    card.dataset.id = goal.id;

    const meta = document.createElement('div');
    meta.className = 'goal-card-meta';
    meta.textContent = goal.category.toUpperCase();

    const title = document.createElement('div');
    title.className = 'goal-card-title';
    title.textContent = goal.title;

    const date = document.createElement('div');
    date.className = 'goal-card-date';
    date.textContent = goal.targetDate || '';

    const progress = document.createElement('div');
    progress.className = 'goal-card-progress';

    if (goal.type === 'counter') {
      const fraction = document.createElement('div');
      fraction.className = 'goal-progress-fraction';
      fraction.textContent = `${goal.current} / ${goal.target}`;
      const bar = document.createElement('div');
      bar.className = 'goal-progress-bar-wrap';
      const fill = document.createElement('div');
      fill.className = 'goal-progress-bar-fill';
      fill.style.width = `${goal.target > 0 ? Math.min(100, (goal.current / goal.target) * 100) : 0}%`;
      bar.appendChild(fill);
      progress.appendChild(fraction);
      progress.appendChild(bar);
    } else if (goal.type === 'checklist') {
      const done = (goal.items || []).filter(i => i.checked).length;
      const total = (goal.items || []).length;
      const fraction = document.createElement('div');
      fraction.className = 'goal-progress-fraction';
      fraction.textContent = total > 0 ? `${done} / ${total}` : 'No items yet';
      progress.appendChild(fraction);
    } else if (goal.type === 'milestones') {
      const fraction = document.createElement('div');
      fraction.className = 'goal-progress-fraction';
      if (goal.id === 'goal-trading') {
        const journal       =  goal.journal       || [];
        const lessonCount   = (goal.lessons       || []).length;
        const tradeCount    = journal.filter(e => e.type === 'trade').length;
        const entryCount    = journal.filter(e => e.type === 'entry').length;
        const checklist     =  goal.checklist     || [];
        const exitChecklist =  goal.exitChecklist  || [];
        const checkDone     = checklist.filter(i => i.checked).length;
        const exitDone      = exitChecklist.filter(i => i.checked).length;
        const hasAny = lessonCount > 0 || tradeCount > 0 || entryCount > 0 || checklist.length > 0 || exitChecklist.length > 0;
        if (!hasAny) {
          fraction.textContent = 'No activity yet';
          progress.appendChild(fraction);
        } else {
          if (lessonCount > 0) {
            const line = document.createElement('div');
            line.className = 'goal-progress-fraction';
            line.textContent = `${lessonCount} lesson${lessonCount !== 1 ? 's' : ''}`;
            progress.appendChild(line);
          }
          if (tradeCount > 0) {
            const line = document.createElement('div');
            line.className = 'goal-progress-fraction';
            line.textContent = `${tradeCount} trade${tradeCount !== 1 ? 's' : ''}`;
            progress.appendChild(line);
          }
          if (entryCount > 0) {
            const line = document.createElement('div');
            line.className = 'goal-progress-fraction';
            line.textContent = `${entryCount} entr${entryCount !== 1 ? 'ies' : 'y'}`;
            progress.appendChild(line);
          }
          if (checklist.length > 0) {
            const line = document.createElement('div');
            line.className = 'goal-progress-fraction';
            line.textContent = `${checkDone} / ${checklist.length} pre-trade`;
            progress.appendChild(line);
          }
          if (exitChecklist.length > 0) {
            const line = document.createElement('div');
            line.className = 'goal-progress-fraction';
            line.textContent = `${exitDone} / ${exitChecklist.length} exit`;
            progress.appendChild(line);
          }
        }
      } else {
        const done = (goal.milestones || []).filter(m => m.checked).length;
        const total = (goal.milestones || []).length;
        fraction.textContent = total > 0 ? `${done} / ${total}` : 'No milestones yet';
        progress.appendChild(fraction);
      }
    } else if (goal.type === 'habit-linked') {
      const habit  = habitsData.habits.find(h => h.id === goal.habitId);
      const streak = habit ? calcHabitStreak(habit) : 0;
      const target = goal.streakTarget || 30;
      const fraction = document.createElement('div');
      fraction.className = 'goal-progress-fraction';
      fraction.textContent = `⚡ ${streak} / ${target} days`;
      const bar = document.createElement('div');
      bar.className = 'goal-progress-bar-wrap';
      const fill = document.createElement('div');
      fill.className = 'goal-progress-bar-fill';
      fill.style.width = `${Math.min(100, (streak / target) * 100)}%`;
      bar.appendChild(fill);
      progress.appendChild(fraction);
      progress.appendChild(bar);
    } else if (goal.type === 'units') {
      const count = (goal.units || []).length;
      const fraction = document.createElement('div');
      fraction.className = 'goal-progress-fraction';
      fraction.textContent = `${count} unit${count !== 1 ? 's' : ''}`;
      progress.appendChild(fraction);
    }

    card.appendChild(meta);
    card.appendChild(title);
    card.appendChild(date);
    card.appendChild(progress);

    const editBtn = document.createElement('button');
    editBtn.className = 'goal-card-edit';
    editBtn.textContent = '✎';
    editBtn.addEventListener('mousedown', e => e.stopPropagation());
    editBtn.addEventListener('click', e => {
      e.stopPropagation();
      const g = goalsData.find(x => x.id === goal.id);
      if (g) openEditGoalModal(g);
    });
    card.appendChild(editBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'goal-card-del';
    delBtn.textContent = '×';
    delBtn.addEventListener('mousedown', e => e.stopPropagation());

    const confirmEl = document.createElement('div');
    confirmEl.className = 'goal-card-confirm hidden';

    const confirmText = document.createElement('span');
    confirmText.className = 'goal-confirm-text';
    confirmText.textContent = 'Delete?';

    const confirmBtns = document.createElement('div');
    confirmBtns.className = 'goal-confirm-btns';

    const yesBtn = document.createElement('button');
    yesBtn.className = 'goal-confirm-yes';
    yesBtn.textContent = 'Yes';
    yesBtn.addEventListener('click', e => {
      e.stopPropagation();
      goalsData = goalsData.filter(x => x.id !== goal.id);
      saveGoals();
      renderGoalsGrid();
    });

    const noBtn = document.createElement('button');
    noBtn.className = 'goal-confirm-no';
    noBtn.textContent = 'No';
    noBtn.addEventListener('click', e => {
      e.stopPropagation();
      confirmEl.classList.add('hidden');
    });

    delBtn.addEventListener('click', e => {
      e.stopPropagation();
      confirmEl.classList.remove('hidden');
    });

    confirmBtns.appendChild(yesBtn);
    confirmBtns.appendChild(noBtn);
    confirmEl.appendChild(confirmText);
    confirmEl.appendChild(confirmBtns);
    card.appendChild(delBtn);
    card.appendChild(confirmEl);

    card.addEventListener('click', () => {
      const g = goalsData.find(x => x.id === goal.id);
      if (!g) return;
      if (g.id === 'goal-reading') {
        navigateToBookLibrary();
      } else {
        openGoalModal(g);
      }
    });

    grid.appendChild(card);
  });
}

function openNewGoalModal() {
  const body = document.getElementById('newGoalModalBody');
  body.innerHTML = '';
  const fields = document.createElement('div');
  fields.className = 'new-goal-fields';

  const titleGroup = document.createElement('div');
  titleGroup.className = 'field-group';
  const titleLabel = document.createElement('label');
  titleLabel.className = 'field-label';
  titleLabel.textContent = 'Goal Title';
  const titleInput = document.createElement('input');
  titleInput.className = 'field-input';
  titleInput.id = 'newGoalTitle';
  titleInput.type = 'text';
  titleInput.placeholder = 'What do you want to achieve?';
  titleInput.autocomplete = 'off';
  titleGroup.appendChild(titleLabel);
  titleGroup.appendChild(titleInput);

  const catGroup = document.createElement('div');
  catGroup.className = 'field-group';
  const catLabel = document.createElement('label');
  catLabel.className = 'field-label';
  catLabel.textContent = 'Category';
  const catInput = document.createElement('input');
  catInput.className = 'field-input';
  catInput.id = 'newGoalCategory';
  catInput.type = 'text';
  catInput.placeholder = 'e.g. Finance, Learning, Fitness';
  catInput.autocomplete = 'off';
  catGroup.appendChild(catLabel);
  catGroup.appendChild(catInput);

  const dateGroup = document.createElement('div');
  dateGroup.className = 'field-group';
  const dateLabel = document.createElement('label');
  dateLabel.className = 'field-label';
  dateLabel.textContent = 'Target Date (optional)';
  const dateInput = document.createElement('input');
  dateInput.className = 'field-input';
  dateInput.id = 'newGoalDate';
  dateInput.type = 'text';
  dateInput.placeholder = 'e.g. Summer 2026';
  dateInput.autocomplete = 'off';
  dateGroup.appendChild(dateLabel);
  dateGroup.appendChild(dateInput);

  const typeGroup = document.createElement('div');
  typeGroup.className = 'field-group';
  const typeLabel = document.createElement('label');
  typeLabel.className = 'field-label';
  typeLabel.textContent = 'Goal Type';
  const typeSeg = document.createElement('div');
  typeSeg.className = 'new-goal-type-seg';
  typeSeg.id = 'newGoalTypeSeg';
  const types = [
    { val: 'counter',      label: 'Counter'      },
    { val: 'checklist',    label: 'Checklist'    },
    { val: 'milestones',   label: 'Milestones'   },
    { val: 'habit-linked', label: 'Habit-Linked' },
  ];
  let selectedType = 'counter';
  types.forEach(t => {
    const btn = document.createElement('button');
    btn.className = 'new-goal-type-btn' + (t.val === selectedType ? ' new-goal-type-btn--active' : '');
    btn.textContent = t.label;
    btn.dataset.val = t.val;
    btn.addEventListener('click', () => {
      selectedType = t.val;
      typeSeg.querySelectorAll('.new-goal-type-btn').forEach(b => b.classList.remove('new-goal-type-btn--active'));
      btn.classList.add('new-goal-type-btn--active');
      renderTypeOptions(typeOptionsWrap, selectedType);
    });
    typeSeg.appendChild(btn);
  });
  typeGroup.appendChild(typeLabel);
  typeGroup.appendChild(typeSeg);

  const typeOptionsWrap = document.createElement('div');
  typeOptionsWrap.id = 'newGoalTypeOptions';

  fields.appendChild(titleGroup);
  fields.appendChild(catGroup);
  fields.appendChild(dateGroup);
  fields.appendChild(typeGroup);
  fields.appendChild(typeOptionsWrap);
  body.appendChild(fields);

  renderTypeOptions(typeOptionsWrap, selectedType);
  document.getElementById('newGoalModal').classList.remove('hidden');
  setTimeout(() => titleInput.focus(), 40);
}

function renderTypeOptions(wrap, type) {
  wrap.innerHTML = '';
  if (type === 'counter') {
    const group = document.createElement('div');
    group.className = 'field-group';
    const label = document.createElement('label');
    label.className = 'field-label';
    label.textContent = 'Target Count';
    const input = document.createElement('input');
    input.className = 'field-input';
    input.id = 'newGoalTarget';
    input.type = 'number';
    input.min = '1';
    input.placeholder = 'e.g. 3';
    group.appendChild(label);
    group.appendChild(input);
    wrap.appendChild(group);
  } else if (type === 'habit-linked') {
    const habitGroup = document.createElement('div');
    habitGroup.className = 'field-group';
    const habitLabel = document.createElement('label');
    habitLabel.className = 'field-label';
    habitLabel.textContent = 'Link to Habit';
    const habitSel = document.createElement('select');
    habitSel.className = 'field-select';
    habitSel.id = 'newGoalHabitId';
    habitsData.habits.forEach(h => {
      const opt = document.createElement('option');
      opt.value = h.id;
      opt.textContent = h.name;
      habitSel.appendChild(opt);
    });
    habitGroup.appendChild(habitLabel);
    habitGroup.appendChild(habitSel);

    const streakGroup = document.createElement('div');
    streakGroup.className = 'field-group';
    const streakLabel = document.createElement('label');
    streakLabel.className = 'field-label';
    streakLabel.textContent = 'Streak Target (days)';
    const streakInput = document.createElement('input');
    streakInput.className = 'field-input';
    streakInput.id = 'newGoalStreakTarget';
    streakInput.type = 'number';
    streakInput.min = '1';
    streakInput.placeholder = 'e.g. 30';
    streakGroup.appendChild(streakLabel);
    streakGroup.appendChild(streakInput);

    wrap.appendChild(habitGroup);
    wrap.appendChild(streakGroup);
  }
}

function closeNewGoalModal() {
  document.getElementById('newGoalModal').classList.add('hidden');
}

function confirmNewGoal() {
  const title    = document.getElementById('newGoalTitle')?.value.trim();
  const category = document.getElementById('newGoalCategory')?.value.trim() || 'General';
  const date     = document.getElementById('newGoalDate')?.value.trim() || '';
  const typeSeg  = document.getElementById('newGoalTypeSeg');
  const type     = typeSeg?.querySelector('.new-goal-type-btn--active')?.dataset.val || 'counter';

  if (!title) {
    const el = document.getElementById('newGoalTitle');
    if (el) el.style.borderColor = 'rgba(239,68,68,0.7)';
    return;
  }

  const newGoal = { id: `goal-${uid()}`, title, category, type, targetDate: date };

  if (type === 'counter') {
    newGoal.current = 0;
    newGoal.target  = parseInt(document.getElementById('newGoalTarget')?.value) || 1;
    newGoal.books   = [];
  } else if (type === 'checklist') {
    newGoal.items = [];
  } else if (type === 'milestones') {
    newGoal.milestones = [];
  } else if (type === 'habit-linked') {
    newGoal.habitId      = document.getElementById('newGoalHabitId')?.value;
    newGoal.streakTarget = parseInt(document.getElementById('newGoalStreakTarget')?.value) || 30;
  }

  goalsData.push(newGoal);
  saveGoals();
  renderGoalsGrid();
  closeNewGoalModal();
}

  function openEditGoalModal(goal) {
    const body = document.getElementById('editGoalModalBody');
    body.innerHTML = '';
    const fields = document.createElement('div');
    fields.className = 'new-goal-fields';

    const titleGroup = document.createElement('div');
    titleGroup.className = 'field-group';
    const titleLabel = document.createElement('label');
    titleLabel.className = 'field-label';
    titleLabel.textContent = 'Goal Title';
    const titleInput = document.createElement('input');
    titleInput.className = 'field-input';
    titleInput.id = 'editGoalTitle';
    titleInput.type = 'text';
    titleInput.value = goal.title;
    titleInput.autocomplete = 'off';
    titleGroup.appendChild(titleLabel);
    titleGroup.appendChild(titleInput);

    const catGroup = document.createElement('div');
    catGroup.className = 'field-group';
    const catLabel = document.createElement('label');
    catLabel.className = 'field-label';
    catLabel.textContent = 'Category';
    const catInput = document.createElement('input');
    catInput.className = 'field-input';
    catInput.id = 'editGoalCategory';
    catInput.type = 'text';
    catInput.value = goal.category;
    catInput.autocomplete = 'off';
    catGroup.appendChild(catLabel);
    catGroup.appendChild(catInput);

    const dateGroup = document.createElement('div');
    dateGroup.className = 'field-group';
    const dateLabel = document.createElement('label');
    dateLabel.className = 'field-label';
    dateLabel.textContent = 'Target Date';
    const dateInput = document.createElement('input');
    dateInput.className = 'field-input';
    dateInput.id = 'editGoalDate';
    dateInput.type = 'text';
    dateInput.value = goal.targetDate || '';
    dateInput.autocomplete = 'off';
    dateGroup.appendChild(dateLabel);
    dateGroup.appendChild(dateInput);

    fields.appendChild(titleGroup);
    fields.appendChild(catGroup);
    fields.appendChild(dateGroup);

    if (goal.type === 'counter') {
      const targetGroup = document.createElement('div');
      targetGroup.className = 'field-group';
      const targetLabel = document.createElement('label');
      targetLabel.className = 'field-label';
      targetLabel.textContent = 'Target Count';
      const targetInput = document.createElement('input');
      targetInput.className = 'field-input';
      targetInput.id = 'editGoalTarget';
      targetInput.type = 'number';
      targetInput.min = '1';
      targetInput.value = goal.target;
      targetGroup.appendChild(targetLabel);
      targetGroup.appendChild(targetInput);
      fields.appendChild(targetGroup);
    }

    if (goal.type === 'habit-linked') {
      const streakGroup = document.createElement('div');
      streakGroup.className = 'field-group';
      const streakLabel = document.createElement('label');
      streakLabel.className = 'field-label';
      streakLabel.textContent = 'Streak Target (days)';
      const streakInput = document.createElement('input');
      streakInput.className = 'field-input';
      streakInput.id = 'editGoalStreakTarget';
      streakInput.type = 'number';
      streakInput.min = '1';
      streakInput.value = goal.streakTarget || 30;
      streakGroup.appendChild(streakLabel);
      streakGroup.appendChild(streakInput);
      fields.appendChild(streakGroup);
    }

    body.appendChild(fields);
    document.getElementById('editGoalModalConfirm').dataset.goalId = goal.id;
    document.getElementById('editGoalModal').classList.remove('hidden');
    setTimeout(() => titleInput.focus(), 40);
  }

  function closeEditGoalModal() {
    document.getElementById('editGoalModal').classList.add('hidden');
  }

function navigateToGoals() {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById('goals').classList.add('active');
}

function navigateToBookLibrary() {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById('bookLibrary').classList.add('active');
  renderBookLibrary();
}

function navigateToBookDetail(idx) {
    _currentBookIdx = idx;
    const goal = goalsData.find(g => g.id === 'goal-reading');
    if (!goal || !goal.books[idx]) return;
    const book = goal.books[idx];

    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById('bookDetail').classList.add('active');

    if (!book.title) {
      showBookSetupForm(idx);
    } else {
      renderBookDetail(idx);
    }
  }

  function showBookSetupForm(idx) {
    const goal = goalsData.find(g => g.id === 'goal-reading');
    if (!goal || !goal.books[idx]) return;
    const book = goal.books[idx];

    // Cover
    const coverWrap = document.getElementById('bookDetailCoverWrap');
    coverWrap.innerHTML = '';
    if (book.coverDataUrl) {
      const img = document.createElement('img');
      img.className = 'book-detail-cover-img';
      img.src = book.coverDataUrl;
      coverWrap.appendChild(img);
    } else {
      const ph = document.createElement('div');
      ph.className = 'book-detail-cover-placeholder';
      ph.textContent = '?';
      coverWrap.appendChild(ph);
    }

    // Header fields
    document.getElementById('bookDetailMeta').textContent   = 'NEW BOOK';
    document.getElementById('bookDetailTitle').textContent  = '';
    document.getElementById('bookDetailAuthor').textContent = '';

    // Replace progress section with setup form
    const progressSection = document.querySelector('.book-detail-progress-section');
    const existingForm = progressSection.querySelector('.book-setup-form');
    if (existingForm) existingForm.remove();
    const progressLabel = document.getElementById('bookDetailProgressLabel');
    const barWrap       = document.querySelector('.book-detail-bar-wrap');
    const pageInputRow  = document.querySelector('.book-detail-page-input-row');
    const hintEl        = document.querySelector('.book-detail-page-hint');
    if (progressLabel) progressLabel.style.display = 'none';
    if (barWrap)       barWrap.style.display       = 'none';
    if (pageInputRow)  pageInputRow.style.display   = 'none';
    if (hintEl)        hintEl.style.display         = 'none';

    const form = document.createElement('div');
    form.className = 'book-setup-form';

    const titleGroup = document.createElement('div');
    titleGroup.className = 'field-group';
    const titleLabel = document.createElement('label');
    titleLabel.className = 'field-label';
    titleLabel.textContent = 'Book Title';
    const titleInput = document.createElement('input');
    titleInput.className = 'field-input';
    titleInput.type = 'text';
    titleInput.placeholder = 'e.g. Atomic Habits';
    titleInput.autocomplete = 'off';
    titleGroup.appendChild(titleLabel);
    titleGroup.appendChild(titleInput);

    const authorGroup = document.createElement('div');
    authorGroup.className = 'field-group';
    const authorLabel = document.createElement('label');
    authorLabel.className = 'field-label';
    authorLabel.textContent = 'Author';
    const authorInput = document.createElement('input');
    authorInput.className = 'field-input';
    authorInput.type = 'text';
    authorInput.placeholder = 'e.g. James Clear';
    authorInput.autocomplete = 'off';
    authorGroup.appendChild(authorLabel);
    authorGroup.appendChild(authorInput);

    const pagesGroup = document.createElement('div');
    pagesGroup.className = 'field-group';
    const pagesLabel = document.createElement('label');
    pagesLabel.className = 'field-label';
    pagesLabel.textContent = 'Total Pages';
    const pagesInput = document.createElement('input');
    pagesInput.className = 'field-input';
    pagesInput.type = 'number';
    pagesInput.min = '1';
    pagesInput.placeholder = 'e.g. 320';
    pagesGroup.appendChild(pagesLabel);
    pagesGroup.appendChild(pagesInput);

    const saveBtn = document.createElement('button');
    saveBtn.className = 'book-setup-save-btn';
    saveBtn.textContent = 'Start Reading';

    const doSave = () => {
      const title = titleInput.value.trim();
      if (!title) {
        titleInput.style.borderColor = 'rgba(239,68,68,0.7)';
        return;
      }
      const g = goalsData.find(x => x.id === 'goal-reading');
      if (!g || !Array.isArray(g.books) || !g.books[idx]) return;
      g.books[idx].title       = title;
      g.books[idx].author      = authorInput.value.trim() || null;
      g.books[idx].totalPages  = parseInt(pagesInput.value, 10) || null;
      g.books[idx].currentPage = 0;
      saveGoals();
      renderBookLibrary();
      renderBookDetail(idx);
    };

    saveBtn.addEventListener('click', doSave);
    titleInput.addEventListener('keydown', e => { if (e.key === 'Enter') authorInput.focus(); });
    authorInput.addEventListener('keydown', e => { if (e.key === 'Enter') pagesInput.focus(); });
    pagesInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSave(); });

    form.appendChild(titleGroup);
    form.appendChild(authorGroup);
    form.appendChild(pagesGroup);
    form.appendChild(saveBtn);
    progressSection.appendChild(form);

    // Hide journal section
    const journalList = document.getElementById('bookDetailJournalList');
    if (journalList) journalList.innerHTML = '';
    const newEntryForm = document.getElementById('bookDetailNewEntryForm');
    if (newEntryForm) newEntryForm.classList.add('hidden');
    const newEntryBtn = document.getElementById('bookJournalNewBtn');
    if (newEntryBtn) newEntryBtn.style.display = 'none';
    const journalLabel = document.querySelector('.book-detail-journal-label');
    if (journalLabel) journalLabel.style.display = 'none';

    setTimeout(() => titleInput.focus(), 40);
  }

function renderBookDetail(idx) {
    const goal = goalsData.find(g => g.id === 'goal-reading');
    if (!goal || !goal.books[idx]) return;
    const book = goal.books[idx];

    const coverWrap = document.getElementById('bookDetailCoverWrap');
    coverWrap.innerHTML = '';
    if (book.coverDataUrl) {
      const img = document.createElement('img');
      img.className = 'book-detail-cover-img';
      img.src = book.coverDataUrl;
      coverWrap.appendChild(img);
    } else {
      const ph = document.createElement('div');
      ph.className = 'book-detail-cover-placeholder';
      ph.textContent = '?';
      coverWrap.appendChild(ph);
    }

    document.getElementById('bookDetailMeta').textContent   = 'READING';
    document.getElementById('bookDetailTitle').textContent  = book.title || 'Untitled';
    document.getElementById('bookDetailAuthor').textContent = book.author || '';

    const pct = (book.totalPages && book.totalPages > 0)
      ? Math.min(100, Math.round((book.currentPage / book.totalPages) * 100))
      : 0;

    const progressSection = document.querySelector('.book-detail-progress-section');
    const existingSetupForm = progressSection?.querySelector('.book-setup-form');
    if (existingSetupForm) existingSetupForm.remove();

    const progressLabel = document.getElementById('bookDetailProgressLabel');
    const barFill       = document.getElementById('bookDetailBarFill');
    const barWrap       = document.querySelector('.book-detail-bar-wrap');
    const pageInputRow  = document.querySelector('.book-detail-page-input-row');
    const hintEl        = document.querySelector('.book-detail-page-hint');
    const pageOfEl      = document.getElementById('bookDetailPageOf');

    if (progressLabel) { progressLabel.removeAttribute('style'); progressLabel.textContent = `${pct}% complete`; }
    if (barFill)         barFill.style.width = `${pct}%`;
    if (barWrap)         barWrap.removeAttribute('style');
    if (pageInputRow)    pageInputRow.removeAttribute('style');
    if (hintEl)          hintEl.removeAttribute('style');
    if (pageOfEl)      { pageOfEl.removeAttribute('style'); pageOfEl.textContent = book.totalPages ? `of ${book.totalPages}` : ''; }

    const journalLabel = document.querySelector('.book-detail-journal-label');
    if (journalLabel)    journalLabel.removeAttribute('style');

    const oldInput = document.getElementById('bookDetailPageInput');
    if (!oldInput) return;
    const newInput = document.createElement('input');
    newInput.className   = 'book-detail-page-input';
    newInput.id          = 'bookDetailPageInput';
    newInput.type        = 'number';
    newInput.min         = '0';
    newInput.placeholder = 'Current page';
    newInput.value       = book.currentPage ?? 0;
    newInput.max         = book.totalPages || 9999;
    oldInput.parentNode.replaceChild(newInput, oldInput);

    newInput.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      const val = parseInt(newInput.value);
      if (isNaN(val) || val < 0) return;
      const g = goalsData.find(x => x.id === 'goal-reading');
      if (!g) return;
      g.books[idx].currentPage = Math.min(val, book.totalPages || val);
      g.current = g.books.filter(b => b.totalPages > 0 && b.currentPage >= b.totalPages).length;
      saveGoals();
      renderGoalsGrid();
      renderBookDetail(idx);
    });

    renderBookJournal(idx);

    const oldNewBtn = document.getElementById('bookJournalNewBtn');
    const newBtn = oldNewBtn.cloneNode(true);
    oldNewBtn.parentNode.replaceChild(newBtn, oldNewBtn);
    newBtn.style.display = '';
    newBtn.addEventListener('click', () => {
      document.getElementById('bookDetailNewEntryForm').classList.remove('hidden');
      document.getElementById('bookJournalNewTitle').focus();
      newBtn.style.display = 'none';
    });

    const oldCancelBtn = document.getElementById('bookJournalCancelBtn');
    const newCancelBtn = oldCancelBtn.cloneNode(true);
    oldCancelBtn.parentNode.replaceChild(newCancelBtn, oldCancelBtn);
    newCancelBtn.addEventListener('click', () => {
      document.getElementById('bookDetailNewEntryForm').classList.add('hidden');
      document.getElementById('bookJournalNewTitle').value = '';
      document.getElementById('bookJournalNewBody').value  = '';
      document.getElementById('bookJournalNewBtn').style.display = '';
    });

    const oldSaveBtn = document.getElementById('bookJournalSaveBtn');
    const newSaveBtn = oldSaveBtn.cloneNode(true);
    oldSaveBtn.parentNode.replaceChild(newSaveBtn, oldSaveBtn);
    newSaveBtn.addEventListener('click', () => {
      const title = document.getElementById('bookJournalNewTitle').value.trim();
      const body  = document.getElementById('bookJournalNewBody').value.trim();
      if (!title && !body) return;
      const g = goalsData.find(x => x.id === 'goal-reading');
      if (!g) return;
      if (!Array.isArray(g.books[idx].journal)) g.books[idx].journal = [];
      g.books[idx].journal.unshift({
        id:    `entry-${uid()}`,
        title: title || 'Untitled',
        date:  new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        body:  body,
      });
      saveGoals();
      document.getElementById('bookDetailNewEntryForm').classList.add('hidden');
      document.getElementById('bookJournalNewTitle').value = '';
      document.getElementById('bookJournalNewBody').value  = '';
      document.getElementById('bookJournalNewBtn').style.display = '';
      renderBookJournal(idx);
    });
  }

  function renderBookJournal(idx) {
    const list = document.getElementById('bookDetailJournalList');
    if (!list) return;
    list.innerHTML = '';

    const goal = goalsData.find(g => g.id === 'goal-reading');
    if (!goal || !goal.books[idx]) return;
    const entries = goal.books[idx].journal || [];

    if (!entries.length) {
      const empty = document.createElement('div');
      empty.className = 'book-journal-empty';
      empty.textContent = 'No entries yet.';
      list.appendChild(empty);
      return;
    }

    entries.forEach((entry, eIdx) => {
      const card = document.createElement('div');
      card.className = 'book-journal-entry-card';

      const hd = document.createElement('div');
      hd.className = 'book-journal-entry-hd';

      const titleEl = document.createElement('div');
      titleEl.className = 'book-journal-entry-title';
      titleEl.textContent = entry.title;

      const dateEl = document.createElement('div');
      dateEl.className = 'book-journal-entry-date';
      dateEl.textContent = entry.date;

      const actions = document.createElement('div');
      actions.className = 'book-journal-entry-actions';

      const editBtn = document.createElement('button');
      editBtn.className = 'book-journal-entry-edit';
      editBtn.textContent = '✎';

      const delBtn = document.createElement('button');
      delBtn.className = 'book-journal-entry-del';
      delBtn.textContent = '×';

      actions.appendChild(editBtn);
      actions.appendChild(delBtn);
      hd.appendChild(titleEl);
      hd.appendChild(dateEl);
      hd.appendChild(actions);

      const bodyEl = document.createElement('div');
      bodyEl.className = 'book-journal-entry-body';
      bodyEl.textContent = entry.body;

      const confirmEl = document.createElement('div');
      confirmEl.className = 'book-journal-confirm hidden';
      const confirmText = document.createElement('span');
      confirmText.className = 'book-journal-confirm-text';
      confirmText.textContent = 'Delete entry?';
      const confirmBtns = document.createElement('div');
      confirmBtns.className = 'book-journal-confirm-btns';
      const yesBtn = document.createElement('button');
      yesBtn.className = 'book-journal-confirm-yes';
      yesBtn.textContent = 'Yes';
      const noBtn = document.createElement('button');
      noBtn.className = 'book-journal-confirm-no';
      noBtn.textContent = 'No';
      confirmBtns.appendChild(yesBtn);
      confirmBtns.appendChild(noBtn);
      confirmEl.appendChild(confirmText);
      confirmEl.appendChild(confirmBtns);

      delBtn.addEventListener('click', () => confirmEl.classList.remove('hidden'));
      noBtn.addEventListener('click',  () => confirmEl.classList.add('hidden'));
      yesBtn.addEventListener('click', () => {
        const g = goalsData.find(x => x.id === 'goal-reading');
        if (!g) return;
        g.books[idx].journal.splice(eIdx, 1);
        saveGoals();
        renderBookJournal(idx);
      });

      editBtn.addEventListener('click', () => {
        hd.innerHTML = '';
        bodyEl.innerHTML = '';

        const titleInput = document.createElement('input');
        titleInput.className = 'book-journal-edit-title-input';
        titleInput.value = entry.title;

        const bodyTextarea = document.createElement('textarea');
        bodyTextarea.className = 'book-journal-edit-body-input';
        bodyTextarea.value = entry.body;
        bodyTextarea.rows = 4;

        const editActions = document.createElement('div');
        editActions.className = 'book-journal-form-actions';

        const cancelEdit = document.createElement('button');
        cancelEdit.className = 'book-journal-cancel-btn';
        cancelEdit.textContent = 'Cancel';

        const saveEdit = document.createElement('button');
        saveEdit.className = 'book-journal-save-btn';
        saveEdit.textContent = 'Save';

        editActions.appendChild(cancelEdit);
        editActions.appendChild(saveEdit);
        hd.appendChild(titleInput);
        hd.appendChild(editActions);
        bodyEl.appendChild(bodyTextarea);

        cancelEdit.addEventListener('click', () => renderBookJournal(idx));

        saveEdit.addEventListener('click', () => {
          const newTitle = titleInput.value.trim() || entry.title;
          const newBody  = bodyTextarea.value.trim();
          const g = goalsData.find(x => x.id === 'goal-reading');
          if (!g) return;
          g.books[idx].journal[eIdx].title = newTitle;
          g.books[idx].journal[eIdx].body  = newBody;
          saveGoals();
          renderBookJournal(idx);
        });
      });

      card.appendChild(hd);
      card.appendChild(bodyEl);
      card.appendChild(confirmEl);
      list.appendChild(card);
    });
  }

function renderBookLibrary() {
  const grid = document.getElementById('bookLibraryGrid');
  if (!grid) return;
  grid.innerHTML = '';

  const goal = goalsData.find(g => g.id === 'goal-reading');
  if (!goal || !Array.isArray(goal.books)) return;

  goal.books.forEach((book, idx) => {
    const card = document.createElement('div');
    card.className = 'book-thumb-card';

    const coverWrap = document.createElement('div');
    coverWrap.className = 'book-cover-wrap';

    if (book.coverDataUrl) {
      const img = document.createElement('img');
      img.className = 'book-cover-img';
      img.src = book.coverDataUrl;
      coverWrap.appendChild(img);
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'book-cover-placeholder';
      placeholder.textContent = '?';
      coverWrap.appendChild(placeholder);
    }

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = e => {
        const g = goalsData.find(x => x.id === 'goal-reading');
        if (!g) return;
        g.books[idx].coverDataUrl = e.target.result;
        saveGoals();
        renderBookLibrary();
      };
      reader.readAsDataURL(file);
    });
    coverWrap.appendChild(fileInput);

    coverWrap.addEventListener('click', () => fileInput.click());

    const infoWrap = document.createElement('div');
    infoWrap.className = 'book-thumb-info';

    if (book.title) {
      const title = document.createElement('div');
      title.className = 'book-thumb-title';
      title.textContent = book.title;
      infoWrap.appendChild(title);

      const pages = document.createElement('div');
      pages.className = 'book-thumb-pages';
      pages.textContent = book.totalPages ? `${book.currentPage} / ${book.totalPages} pages` : 'No page count set';
      infoWrap.appendChild(pages);
    } else {
      const untitled = document.createElement('div');
      untitled.className = 'book-thumb-untitled';
      untitled.textContent = 'Tap cover to add book';
      infoWrap.appendChild(untitled);
    }

    card.appendChild(coverWrap);
    card.appendChild(infoWrap);

    const moreBtn = document.createElement('button');
    moreBtn.className = 'book-more-btn';
    moreBtn.textContent = 'More';
    moreBtn.addEventListener('click', () => navigateToBookDetail(idx));
    card.appendChild(moreBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'book-more-btn book-delete-btn';
    delBtn.textContent = 'Delete';
    let delArmed = false;
    let delTimer = null;
    delBtn.addEventListener('click', () => {
      if (!delArmed) {
        delArmed = true;
        delBtn.textContent = 'Confirm delete?';
        delBtn.classList.add('book-delete-btn--armed');
        delTimer = setTimeout(() => {
          delArmed = false;
          delBtn.textContent = 'Delete';
          delBtn.classList.remove('book-delete-btn--armed');
        }, 3000);
        return;
      }
      if (delTimer) clearTimeout(delTimer);
      const g = goalsData.find(x => x.id === 'goal-reading');
      if (!g || !Array.isArray(g.books)) return;
      g.books.splice(idx, 1);
      g.current = g.books.filter(b => b.totalPages > 0 && b.currentPage >= b.totalPages).length;
      saveGoals();
      renderGoalsGrid();
      renderBookLibrary();
    });
    card.appendChild(delBtn);

    grid.appendChild(card);
  });

  renderAddBookCard(grid);
}

// Appends the "＋ Add Book" tile (and its inline create form) to the library grid.
function renderAddBookCard(grid) {
  const card = document.createElement('div');
  card.className = 'book-thumb-card book-add-card';

  const tile = document.createElement('button');
  tile.className = 'book-add-tile';
  tile.textContent = '＋';

  const label = document.createElement('div');
  label.className = 'book-thumb-untitled';
  label.textContent = 'Add Book';

  card.appendChild(tile);
  card.appendChild(label);

  tile.addEventListener('click', () => showAddBookForm(card));

  grid.appendChild(card);
}

// Swaps the add-card contents for an inline create form. A new book record is
// only pushed on Save, so cancelling never leaves an orphan/blank entry.
function showAddBookForm(card) {
  card.innerHTML = '';

  const form = document.createElement('div');
  form.className = 'book-add-form';

  const makeField = (labelText, type, placeholder, opts = {}) => {
    const group = document.createElement('div');
    group.className = 'field-group';
    const lbl = document.createElement('label');
    lbl.className = 'field-label';
    lbl.textContent = labelText;
    const input = document.createElement('input');
    input.className = 'field-input';
    input.type = type;
    input.placeholder = placeholder;
    input.autocomplete = 'off';
    if (opts.min != null) input.min = opts.min;
    group.appendChild(lbl);
    group.appendChild(input);
    form.appendChild(group);
    return input;
  };

  const titleInput = makeField('Book Title', 'text', 'e.g. Atomic Habits');
  const coverInput = makeField('Cover Image URL', 'url', 'https://…');
  const pagesInput = makeField('Total Pages', 'number', 'e.g. 320', { min: '1' });
  const curInput   = makeField('Current Page', 'number', '0', { min: '0' });

  const actions = document.createElement('div');
  actions.className = 'book-add-actions';

  const saveBtn = document.createElement('button');
  saveBtn.className = 'book-setup-save-btn';
  saveBtn.textContent = 'Add Book';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'book-setup-save-btn book-add-cancel';
  cancelBtn.textContent = 'Cancel';

  const doSave = () => {
    const title = titleInput.value.trim();
    if (!title) {
      titleInput.style.borderColor = 'rgba(239,68,68,0.7)';
      return;
    }
    const g = goalsData.find(x => x.id === 'goal-reading');
    if (!g) return;
    if (!Array.isArray(g.books)) g.books = [];

    const totalParsed = parseInt(pagesInput.value, 10);
    const totalPages  = Number.isFinite(totalParsed) && totalParsed > 0 ? totalParsed : null;
    const curParsed   = parseInt(curInput.value, 10);
    let currentPage   = Number.isFinite(curParsed) && curParsed > 0 ? curParsed : 0;
    if (totalPages) currentPage = Math.min(currentPage, totalPages);

    g.books.push({
      id:           `book-${uid()}`,
      title,
      author:       null,
      totalPages,
      currentPage,
      coverDataUrl: coverInput.value.trim() || null,
      journal:      [],
    });
    g.current = g.books.filter(b => b.totalPages > 0 && b.currentPage >= b.totalPages).length;
    saveGoals();
    renderGoalsGrid();
    renderBookLibrary();
  };

  saveBtn.addEventListener('click', doSave);
  cancelBtn.addEventListener('click', renderBookLibrary);
  curInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSave(); });

  actions.appendChild(saveBtn);
  actions.appendChild(cancelBtn);
  form.appendChild(actions);
  card.appendChild(form);

  setTimeout(() => titleInput.focus(), 40);
}

  function confirmEditGoal(goalId) {
    const g = goalsData.find(x => x.id === goalId);
    if (!g) return;
    const title = document.getElementById('editGoalTitle')?.value.trim();
    if (!title) {
      const el = document.getElementById('editGoalTitle');
      if (el) el.style.borderColor = 'rgba(239,68,68,0.7)';
      return;
    }
    g.title      = title;
    g.category   = document.getElementById('editGoalCategory')?.value.trim() || g.category;
    g.targetDate = document.getElementById('editGoalDate')?.value.trim() || '';
    if (g.type === 'counter') {
      g.target = parseInt(document.getElementById('editGoalTarget')?.value) || g.target;
    }
    if (g.type === 'habit-linked') {
      g.streakTarget = parseInt(document.getElementById('editGoalStreakTarget')?.value) || g.streakTarget;
    }
    saveGoals();
    renderGoalsGrid();
    closeEditGoalModal();
    if (!document.getElementById('goalModal').classList.contains('hidden') && _goalModalId === goalId) {
      const metaEl  = document.getElementById('goalModalMeta');
      const titleEl = document.getElementById('goalModalTitle');
      if (metaEl)  metaEl.textContent  = g.category.toUpperCase();
      if (titleEl) titleEl.textContent = g.title;
    }
  }

function renderHabitLinkedModal(body, goal) {
  const habit  = habitsData.habits.find(h => h.id === goal.habitId);
  const streak = habit ? calcHabitStreak(habit) : 0;
  const target = goal.streakTarget || 30;
  const pct    = Math.min(100, Math.round((streak / target) * 100));

  const habitName = document.createElement('div');
  habitName.className = 'goal-modal-fraction';
  habitName.textContent = habit ? `Linked to: ${habit.name}` : 'Habit not found';

  const streakEl = document.createElement('div');
  streakEl.className = 'goal-modal-streak-display';
  streakEl.textContent = `⚡ ${streak} / ${target} day streak`;

  const bar = document.createElement('div');
  bar.className = 'goal-modal-bar-wrap';
  const fill = document.createElement('div');
  fill.className = 'goal-modal-bar-fill';
  fill.style.width = `${pct}%`;
  bar.appendChild(fill);

  const pctEl = document.createElement('div');
  pctEl.className = 'goal-modal-fraction';
  pctEl.textContent = `${pct}% to goal`;

  body.appendChild(habitName);
  body.appendChild(streakEl);
  body.appendChild(bar);
  body.appendChild(pctEl);
}

function sortHabits() {
  habitsData.habits.sort((a, b) => b.streak - a.streak);
}

function updateHabitsScore() {
  const el = document.getElementById('habitsWeekScore');
  if (el) el.textContent = `This Week: ${calcWeeklyScore()}%`;
}

// Day-initial labels under each circle: Monday → Sunday.
const HABIT_WEEK_DAY_LBL = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// Build the single current-week row (Monday → Sunday) of 7 state circles for a
// habit. This is the ONE streak-display pattern used by BOTH the card grid and
// the detail modal — it replaces the old multi-week contributions heatmap and
// the modal's week-navigable dots. Each circle maps to exactly one calendar day
// of the current week, so there's no ambiguity about what it represents.
//
// Read-only over weeklyChecks / pausedDays: the only mutations happen inside the
// tap handlers, which reuse the EXISTING functions unchanged —
//   • today  → toggleHabitDay()  (2-state check↔empty + milestone celebration)
//   • past   → cycleHabitDayState() (3-state empty→checked→paused→empty)
// Pausing *today* stays on the separate "Pause today" button. No schema/data
// changes; no data migration.
//
// States: checked = coral fill + checkmark · paused = amber fill · empty = gray
// outline · future (later this week, or weekend on a weekday-only habit) =
// lighter disabled outline, inert (tapping does nothing).
function buildHabitWeekRow(habit, opts = {}) {
  const { compact = false, stopProp = false, afterChange = null } = opts;
  const wrap = document.createElement('div');
  wrap.className = 'habit-week-row' + (compact ? ' habit-week-row--sm' : '');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const wk       = getCurrentWeekKey();
  const monday   = getMondayOfISOWeek(wk);
  const checks   = habit.weeklyChecks?.[wk] || Array(7).fill(false);
  const todayIdx = getTodayDayIndex();

  for (let i = 0; i < 7; i++) {
    const cellDate = new Date(monday);
    cellDate.setDate(cellDate.getDate() + i);
    const iso        = getDateISO(cellDate);
    const isToday    = i === todayIdx;
    const isFuture   = cellDate > today;
    const weekendOff = !!(habit.weekdaysOnly && i >= 5);
    const inert      = isFuture || weekendOff;
    const isPaused   = isPausedOn(habit, iso);
    const isChecked  = !!checks[i];

    const col = document.createElement('div');
    col.className = 'habit-week-col';

    const circle = document.createElement('div');
    circle.className = 'habit-week-circle' +
      (isPaused  ? ' habit-week-circle--paused'  :
       isChecked ? ' habit-week-circle--checked' : ' habit-week-circle--empty') +
      (isToday ? ' habit-week-circle--today'  : '') +
      (inert   ? ' habit-week-circle--future' : '');
    circle.title = iso +
      (isChecked ? ' · done' : isPaused ? ' · paused' : '') +
      (isFuture ? ' · upcoming' : '');

    // Checkmark only inside checked (not paused) circles.
    if (isChecked && !isPaused) {
      circle.innerHTML = '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,7 6,11 12,3"/></svg>';
    }

    // Future / weekend-off circles are inert — tapping them does nothing.
    if (!inert) {
      if (stopProp) circle.addEventListener('mousedown', e => e.stopPropagation());
      circle.addEventListener('click', e => {
        if (stopProp) e.stopPropagation(); // don't open the habit modal
        if (isToday) {
          toggleHabitDay(habit.id, i);               // today: 2-state + milestone
        } else {
          cycleHabitDayState(habit.id, wk, i, iso);  // past: 3-state cycle
        }
        if (afterChange) afterChange();
      });
    }

    const lbl = document.createElement('div');
    lbl.className = 'habit-week-label';
    lbl.textContent = HABIT_WEEK_DAY_LBL[i];

    col.appendChild(circle);
    col.appendChild(lbl);
    wrap.appendChild(col);
  }
  return wrap;
}

// Cycle a single day through empty → checked → paused → empty for any date.
// This performs exactly the same data operations as the habit modal's per-day
// handler (set weeklyChecks[weekKey][dayIdx]; add/remove the ISO date in
// pausedDays) — no fields are renamed, migrated, or removed.
function cycleHabitDayState(habitId, weekKey, dayIdx, isoDate) {
  const h = habitsData.habits.find(x => x.id === habitId);
  if (!h) return;
  if (h.weekdaysOnly && dayIdx >= 5) return;
  if (!h.weeklyChecks[weekKey]) h.weeklyChecks[weekKey] = Array(7).fill(false);

  const isChecked = !!h.weeklyChecks[weekKey][dayIdx];
  const isPaused  = isPausedOn(h, isoDate);

  if (!isChecked && !isPaused) {
    // EMPTY → CHECKED
    h.weeklyChecks[weekKey][dayIdx] = true;
    h.pausedDays = (h.pausedDays || []).filter(d => d !== isoDate);
  } else if (isChecked && !isPaused) {
    // CHECKED → PAUSED
    h.weeklyChecks[weekKey][dayIdx] = false;
    if (!Array.isArray(h.pausedDays)) h.pausedDays = [];
    if (!h.pausedDays.includes(isoDate)) h.pausedDays.push(isoDate);
  } else {
    // PAUSED → EMPTY
    h.weeklyChecks[weekKey][dayIdx] = false;
    h.pausedDays = (h.pausedDays || []).filter(d => d !== isoDate);
  }

  h.streak = calcHabitStreak(h);
  if (h.streak > (h.bestStreak || 0)) h.bestStreak = h.streak;
  saveHabits();
  renderHabitsGrid();
  updateHabitsScore();
}

// ── Active challenge / featured habit card ──────────────────────────────────
// Surfaces an existing "habit-linked" goal (goalsData) as a highlighted card at
// the top of the Habits screen. Purely a read-only view over existing data —
// no schema changes. Reuses the Phase 1 coral accent (#D85A30) via CSS.
function renderActiveChallenge() {
  const container = document.querySelector('#habits .habits-container');
  const grid = document.getElementById('habitsGrid');
  if (!container || !grid) return;

  // Always clear any previously rendered card so this render is the source of truth.
  const existing = document.getElementById('habitsChallenge');
  if (existing) existing.remove();

  // Genuine data concept: goals of type 'habit-linked' pointing at a live habit.
  const candidates = (goalsData || [])
    .filter(g => g.type === 'habit-linked' && habitsData.habits.some(h => h.id === g.habitId))
    .map(g => {
      const habit  = habitsData.habits.find(h => h.id === g.habitId);
      const streak = calcHabitStreak(habit);
      const target = g.streakTarget || 30;
      const pct    = target > 0 ? Math.min(100, Math.round((streak / target) * 100)) : 0;
      return { g, habit, streak, target, pct };
    });
  if (!candidates.length) return;

  // Feature the most "active" challenge: the closest-to-target one still in
  // progress; if all are complete, fall back to the furthest along.
  const inProgress = candidates.filter(c => c.pct < 100);
  const pool = inProgress.length ? inProgress : candidates;
  const { g, habit, streak, target, pct } = pool.sort((a, b) => b.pct - a.pct)[0];
  const daysLeft = Math.max(0, target - streak);

  const card = document.createElement('div');
  card.className = 'habit-challenge-card';
  card.id = 'habitsChallenge';

  const icon = document.createElement('div');
  icon.className = 'habit-challenge-icon';
  icon.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/></svg>';

  const main = document.createElement('div');
  main.className = 'habit-challenge-main';

  const label = document.createElement('div');
  label.className = 'habit-challenge-label';
  label.textContent = 'Active Challenge';

  const titleEl = document.createElement('div');
  titleEl.className = 'habit-challenge-title';
  titleEl.textContent = g.title || habit.name;

  const bar = document.createElement('div');
  bar.className = 'habit-challenge-bar';
  const barFill = document.createElement('div');
  barFill.className = 'habit-challenge-bar-fill';
  barFill.style.width = `${pct}%`;
  bar.appendChild(barFill);

  const stat = document.createElement('div');
  stat.className = 'habit-challenge-stat';
  stat.textContent = pct >= 100
    ? `Goal reached — ${streak} day streak`
    : `${streak} of ${target} days · ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left`;

  main.appendChild(label);
  main.appendChild(titleEl);
  main.appendChild(bar);
  main.appendChild(stat);

  const C = 2 * Math.PI * 22;                 // ring circumference (r=22)
  const ring = document.createElement('div');
  ring.className = 'habit-challenge-ring';
  ring.innerHTML =
    `<svg width="56" height="56" viewBox="0 0 56 56">` +
    `<circle class="habit-challenge-ring-track" cx="28" cy="28" r="22" fill="none" stroke-width="5"/>` +
    `<circle class="habit-challenge-ring-value" cx="28" cy="28" r="22" fill="none" stroke-width="5" ` +
    `stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct / 100)}" ` +
    `transform="rotate(-90 28 28)"/></svg>` +
    `<span class="habit-challenge-ring-pct">${pct}%</span>`;

  card.appendChild(icon);
  card.appendChild(main);
  card.appendChild(ring);

  // Keep the linked habit fully reachable — open its detail modal on click.
  card.addEventListener('click', () => openHabitModal(habit));

  container.insertBefore(card, grid);
}

function renderHabitsGrid() {
  const grid = document.getElementById('habitsGrid');
  if (!grid) return;

  updateHabitsScore();
  sortHabits();
  renderActiveChallenge();
  grid.innerHTML = '';

  const todayIdx = getTodayDayIndex();
  const wk = getCurrentWeekKey();
  const monday = getMondayOfISOWeek(wk);
  const todayISO = getDateISO(new Date());

  // FIX 2: Ensure current week slot exists for every habit before rendering
  let _weekInitDirty = false;
  habitsData.habits.forEach(h => {
    if (!h.weeklyChecks[wk]) {
      h.weeklyChecks[wk] = Array(7).fill(false);
      _weekInitDirty = true;
    }
  });
  if (_weekInitDirty) saveHabits();

  habitsData.habits.forEach(habit => {
    const checks  = habit.weeklyChecks?.[wk] || Array(7).fill(false);
    const streak  = habit.streak;
    const possible = habit.weekdaysOnly ? 5 : 7;
    const checked  = habit.weekdaysOnly
      ? checks.slice(0, 5).filter(Boolean).length
      : checks.filter(Boolean).length;
    const fillPct = possible > 0 ? (checked / possible) * 100 : 0;
    const todayDone   = !!(checks[todayIdx] && !(habit.weekdaysOnly && todayIdx >= 5));
    const todayPaused = isPausedOn(habit, todayISO);

    const card = document.createElement('div');
    card.className = 'habit-card' +
      (streak > 0 ? ' habit-card--active' : ' habit-card--zero') +
      (todayDone && !todayPaused ? ' habit-card--done' : '');
    card.dataset.id = habit.id;

    // Purple fill from bottom
    const fill = document.createElement('div');
    fill.className = 'habit-card-fill';
    fill.style.height = `${fillPct}%`;
    card.appendChild(fill);

    // Inline delete confirmation — declared early so delBtn and qcBtn can both reference it
    const confirmEl = document.createElement('div');
    confirmEl.className = 'habit-card-confirm hidden';

    // × delete button
    const delBtn = document.createElement('button');
    delBtn.className = 'habit-card-del';
    delBtn.textContent = '×';
    delBtn.addEventListener('mousedown', e => e.stopPropagation());
    delBtn.addEventListener('click', e => {
      e.stopPropagation();
      confirmEl.classList.remove('hidden');
    });
    card.appendChild(delBtn);

    // ⏸/▶ pause button — revealed on hover, to the left of ×
    const pauseBtn = document.createElement('button');
    pauseBtn.className = 'habit-card-pause';
    pauseBtn.textContent = todayPaused ? '▶' : '⏸';
    pauseBtn.addEventListener('mousedown', e => e.stopPropagation());
    pauseBtn.addEventListener('click', e => {
      e.stopPropagation();
      const h = habitsData.habits.find(x => x.id === habit.id);
      if (!h) return;
      if (isPausedOn(h, todayISO)) {
        h.pausedDays = h.pausedDays.filter(d => d !== todayISO);
      } else {
        if (!Array.isArray(h.pausedDays)) h.pausedDays = [];
        h.pausedDays.push(todayISO);
      }
      h.streak = calcHabitStreak(h);
      if (h.streak > (h.bestStreak || 0)) h.bestStreak = h.streak;
      saveHabits();
      renderHabitsGrid();
      updateHabitsScore();
    });
    card.appendChild(pauseBtn);

    // Main content
    const content = document.createElement('div');
    content.className = 'habit-card-content';

    const streakNum = document.createElement('div');
    streakNum.className = 'habit-card-streak-num';
    streakNum.textContent = `⚡ ${streak}`;

    const streakLbl = document.createElement('div');
    streakLbl.className = 'habit-card-streak-label';
    streakLbl.textContent = 'day streak';

    const nameEl = document.createElement('div');
    nameEl.className = 'habit-card-name';
    nameEl.textContent = habit.name;

    // Single current-week row (Mon–Sun) — same pattern as the detail modal.
    // Read-only transform over existing weeklyChecks / pausedDays — no schema change.
    // stopProp keeps circle taps from opening the modal; toggleHabitDay /
    // cycleHabitDayState both re-render the grid, so no afterChange is needed.
    const weekRow = buildHabitWeekRow(habit, { compact: true, stopProp: true });

    content.appendChild(streakNum);
    content.appendChild(streakLbl);
    content.appendChild(nameEl);
    content.appendChild(weekRow);
    card.appendChild(content);

    // Bottom-center quick-check button
    const todayDisabled = !!(habit.weekdaysOnly && todayIdx >= 5);
    if (!todayDisabled && !todayPaused) {
      const qcBtn = document.createElement('button');
      qcBtn.className = 'habit-card-qc' + (todayDone ? ' habit-card-qc--done' : '');
      qcBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,7 6,11 12,3"/></svg>';
      qcBtn.addEventListener('mousedown', e => e.stopPropagation());
      qcBtn.addEventListener('click', e => {
        e.stopPropagation();
        if (!confirmEl.classList.contains('hidden')) return;
        toggleHabitDay(habit.id, todayIdx);
      });
      card.appendChild(qcBtn);
    }

    // Finish wiring confirmEl and append
    const confirmText = document.createElement('span');
    confirmText.className = 'habit-confirm-text';
    confirmText.textContent = 'Delete?';

    const confirmBtns = document.createElement('div');
    confirmBtns.className = 'habit-confirm-btns';

    const yesBtn = document.createElement('button');
    yesBtn.className = 'habit-confirm-yes';
    yesBtn.textContent = 'Yes';
    yesBtn.addEventListener('click', e => {
      e.stopPropagation();
      habitsData.habits = habitsData.habits.filter(h => h.id !== habit.id);
      saveHabits();
      renderHabitsGrid();
    });

    const noBtn = document.createElement('button');
    noBtn.className = 'habit-confirm-no';
    noBtn.textContent = 'No';
    noBtn.addEventListener('click', e => {
      e.stopPropagation();
      confirmEl.classList.add('hidden');
    });

    confirmBtns.appendChild(yesBtn);
    confirmBtns.appendChild(noBtn);
    confirmEl.appendChild(confirmText);
    confirmEl.appendChild(confirmBtns);
    card.appendChild(confirmEl);

    // Best streak badge (quiet, permanent)
    if ((habit.bestStreak || 0) > 0 && appSettings.showBestStreak !== false) {
      const badge = document.createElement('div');
      badge.className = 'habit-best-streak';
      badge.textContent = `Best: ${habit.bestStreak}`;
      card.appendChild(badge);
    }

    // Done badge — top-right green circle, visible only when today is checked and not paused
    if (todayDone && !todayPaused) {
      const badge = document.createElement('button');
      badge.className = 'habit-done-badge';
      badge.innerHTML = '<svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,6 5,9 10,3"/></svg>';
      badge.addEventListener('mousedown', e => e.stopPropagation());
      badge.addEventListener('click', e => {
        e.stopPropagation();
        if (!confirmEl.classList.contains('hidden')) return;
        toggleHabitDay(habit.id, todayIdx);
      });
      card.appendChild(badge);
    }

    // Persistent milestone badge (top-left corner)
    if (habit.badgeLevel) {
      const badgeInfo = _badgeForStreak(
        habit.badgeLevel === 'trophy'  ? 120 :
        habit.badgeLevel === 'flame'   ? 90  :
        habit.badgeLevel === 'diamond' ? 60  : 30
      );
      _injectCelebrationStyles();
      const milestoneBadge = document.createElement('div');
      milestoneBadge.className = 'habit-milestone-badge' + (badgeInfo.cls ? ' ' + badgeInfo.cls : '');
      milestoneBadge.textContent = badgeInfo.emoji;
      card.appendChild(milestoneBadge);
    }

    // Click card → open habit modal
    card.addEventListener('click', () => {
      if (!confirmEl.classList.contains('hidden')) return;
      openHabitModal(habit);
    });

    grid.appendChild(card);
  });
}

let _habitModalId = null;

function getMondayOfISOWeek(weekKey) {
  const [yearStr, weekStr] = weekKey.split('-W');
  const year  = parseInt(yearStr, 10);
  const week  = parseInt(weekStr, 10);
  const jan4  = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7;
  return new Date(year, 0, 4 - (jan4Day - 1) + (week - 1) * 7);
}

const WEEK_MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function openHabitModal(habit) {
  _habitModalId = habit.id;
  const modal = document.getElementById('habitModal');
  const title = document.getElementById('habitModalTitle');
  const body  = document.getElementById('habitModalBody');
  title.textContent = habit.name;
  renderHabitModalBody(body, habit);
  modal.classList.remove('hidden');
}

// The habit detail modal now shows ONLY the current week — the same single
// current-week circle row used on the card (buildHabitWeekRow). No week
// navigation, no scrolling history, no multi-week grid. Interaction is
// unchanged: today's circle toggles via toggleHabitDay() (2-state + milestone),
// past days cycle via cycleHabitDayState() (3-state), future days are inert, and
// pausing *today* stays on the "Pause today" button below the row.
function renderHabitModalBody(body, habit) {
  body.innerHTML = '';

  const streakEl = document.createElement('div');
  streakEl.className = 'habit-modal-streak';
  streakEl.textContent = `⚡ ${habit.streak}`;

  // Single current-week row. Tap handlers already persist + re-render the grid;
  // afterChange re-renders this modal body so it reflects the new state.
  const weekRow = buildHabitWeekRow(habit, {
    compact: false,
    stopProp: false,
    afterChange: () => {
      const h = habitsData.habits.find(x => x.id === _habitModalId);
      if (h) renderHabitModalBody(body, h);
    },
  });

  body.appendChild(streakEl);
  body.appendChild(weekRow);

  // "Pause today" — today's circle is a 2-state check toggle (to preserve the
  // milestone celebration), so pausing today happens here, exactly as before.
  // Hidden when today is a weekend on a weekday-only habit (nothing to pause).
  const todayPauseISO   = getDateISO(new Date());
  const todayWeekendOff = !!(habit.weekdaysOnly && getTodayDayIndex() >= 5);
  if (!todayWeekendOff) {
    const isTodayPaused = isPausedOn(habit, todayPauseISO);
    const pauseTodayBtn = document.createElement('button');
    pauseTodayBtn.className = 'habit-modal-pause-btn';
    pauseTodayBtn.textContent = isTodayPaused ? 'Resume today' : 'Pause today';
    pauseTodayBtn.addEventListener('click', () => {
      const h = habitsData.habits.find(x => x.id === _habitModalId);
      if (!h) return;
      if (isPausedOn(h, todayPauseISO)) {
        h.pausedDays = h.pausedDays.filter(d => d !== todayPauseISO);
      } else {
        if (!Array.isArray(h.pausedDays)) h.pausedDays = [];
        h.pausedDays.push(todayPauseISO);
      }
      h.streak = calcHabitStreak(h);
      if (h.streak > (h.bestStreak || 0)) h.bestStreak = h.streak;
      saveHabits();
      renderHabitsGrid();
      updateHabitsScore();
      renderHabitModalBody(body, h);
    });
    body.appendChild(pauseTodayBtn);
  }
}

function toggleHabitDay(id, dayIdx) {
  const habit = habitsData.habits.find(h => h.id === id);
  if (!habit) return;
  if (habit.weekdaysOnly && dayIdx >= 5) return;

  const wk = getCurrentWeekKey();
  if (!habit.weeklyChecks[wk]) habit.weeklyChecks[wk] = Array(7).fill(false);

  habit.weeklyChecks[wk][dayIdx] = !habit.weeklyChecks[wk][dayIdx];
  habit.streak = calcHabitStreak(habit);

  if (habit.streak > (habit.bestStreak || 0)) habit.bestStreak = habit.streak;

  const prevMilestone = habit.lastMilestone || 0;
  let milestoneType = null;
  if (habit.streak > prevMilestone && habit.streak > 0 &&
      (habit.streak % 30 === 0 || habit.streak % 7 === 0)) {
    milestoneType = habit.streak % 30 === 0 ? 'big' : 'regular';
    habit.lastMilestone = habit.streak;
  }

  saveHabits();
  renderHabitsGrid();
  updateHabitsScore();

  if (milestoneType) {
    const card = document.querySelector(`.habit-card[data-id="${id}"]`);
    if (card) triggerMilestoneReward(card, habit, milestoneType);
  }
}

function showAddHabitInput() {
  const btn  = document.getElementById('habitsAddBtn');
  const wrap = document.getElementById('habitsAddInputWrap');
  const inp  = document.getElementById('habitsAddInput');

  btn.style.display  = 'none';
  wrap.style.display = 'block';
  inp.value = '';
  setTimeout(() => inp.focus(), 0);

  let submitted = false;

  const commit = () => {
    if (submitted) return;
    submitted = true;
    const name = inp.value.trim();
    if (name) {
      habitsData.habits.push({
        id: String(Date.now()),
        name,
        streak: 0,
        weeklyChecks: {},
        pausedDays: [],
        lastCheckedDate: null,
      });
      saveHabits();
      renderHabitsGrid();
    }
    wrap.style.display = 'none';
    btn.style.display  = '';
  };

  inp.onkeydown = e => {
    if (e.key === 'Enter')  commit();
    if (e.key === 'Escape') { submitted = true; wrap.style.display = 'none'; btn.style.display = ''; }
  };
  inp.onblur = () => commit();
}

// ── Milestone rewards ─────────────────────────────────────────────────────────

let _toastContainer = null;

function getToastContainer() {
  if (!_toastContainer || !document.body.contains(_toastContainer)) {
    _toastContainer = document.createElement('div');
    _toastContainer.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
    document.body.appendChild(_toastContainer);
  }
  return _toastContainer;
}

function showMilestoneToast(message, durationMs) {
  const container = getToastContainer();
  const toast = document.createElement('div');
  toast.style.cssText = 'background:#1a1a1a;border-left:3px solid #9B72CF;border-radius:10px;padding:12px 16px;color:#f0f0f0;font-size:13px;transform:translateX(120%);transition:transform 0.3s ease;pointer-events:auto;white-space:nowrap;';
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => requestAnimationFrame(() => {
    toast.style.transform = 'translateX(0)';
  }));

  setTimeout(() => {
    toast.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
    toast.style.transform  = 'translateX(120%)';
    toast.style.opacity    = '0';
    setTimeout(() => toast.remove(), 350);
  }, durationMs);
}

function triggerCardGlow(card, isBig) {
  card.classList.remove('habit-glow', 'habit-glow--big');
  void card.offsetWidth;
  card.classList.add(isBig ? 'habit-glow--big' : 'habit-glow');
  card.addEventListener('animationend', () => {
    card.classList.remove('habit-glow', 'habit-glow--big');
  }, { once: true });
}

function spawnConfetti(card) {
  const rect    = card.getBoundingClientRect();
  const centerX = rect.left + rect.width  / 2;
  const centerY = rect.top  + rect.height / 2;
  const colors  = ['#9B72CF', '#f0f0f0', '#888888'];

  for (let i = 0; i < 30; i++) {
    const angle    = Math.random() * 360;
    const distance = 60 + Math.random() * 100;
    const dx       = (Math.cos(angle * Math.PI / 180) * distance).toFixed(1);
    const dy       = (Math.sin(angle * Math.PI / 180) * distance).toFixed(1);
    const rot      = (Math.random() * 720 - 360).toFixed(1);
    const color    = colors[Math.floor(Math.random() * colors.length)];
    const delay    = (Math.random() * 0.15).toFixed(3);

    const piece = document.createElement('div');
    piece.style.cssText = `position:fixed;left:${(centerX - 2).toFixed(1)}px;top:${(centerY - 4).toFixed(1)}px;width:4px;height:8px;background:${color};border-radius:1px;pointer-events:none;z-index:9998;animation:confetti-burst 1.2s ${delay}s ease-out forwards;--confetti-dx:${dx}px;--confetti-dy:${dy}px;--confetti-rot:${rot}deg;`;
    document.body.appendChild(piece);
    piece.addEventListener('animationend', () => piece.remove(), { once: true });
  }
}

function triggerMilestoneReward(card, habit, type) {
  if (!appSettings.milestoneRewards) return;
  if (type === 'big') {
    triggerBigMilestoneCelebration(card, habit);
    return;
  }
  triggerCardGlow(card, false);
  showMilestoneToast(`⚡ ${habit.streak} day streak — ${habit.name}!`, 3000);
}

// ── 30-day full-screen celebration ────────────────────────────────────────────

function _injectCelebrationStyles() {
  if (document.getElementById('celebration-styles')) return;
  const style = document.createElement('style');
  style.id = 'celebration-styles';
  style.textContent = `
    @keyframes celeb-overlay-in  { from{opacity:0} to{opacity:1} }
    @keyframes celeb-overlay-out { from{opacity:1} to{opacity:0} }
    @keyframes celeb-trophy-drop {
      from { transform:translateY(-200px); opacity:0; }
      to   { transform:translateY(0);      opacity:1; }
    }
    @keyframes celeb-letter-in {
      from { opacity:0; transform:translateY(20px); }
      to   { opacity:1; transform:translateY(0);    }
    }
    @keyframes celeb-fade-in { from{opacity:0} to{opacity:1} }
    @keyframes celeb-hint-in { from{opacity:0} to{opacity:0.4} }
    @keyframes celeb-particle {
      from { opacity:1; transform:translate(0,0); }
      to   { opacity:0; transform:translate(var(--px),var(--py)); }
    }
    @keyframes celeb-confetti {
      from { opacity:1; transform:translateY(-20px) translateX(0) rotate(0deg); }
      to   { opacity:0; transform:translateY(110vh) translateX(var(--cx)) rotate(360deg); }
    }
    @keyframes celeb-card-shockwave {
      0%   { box-shadow:0 0 0 0 rgba(155,114,207,0); }
      40%  { box-shadow:0 0 0 4px #9B72CF, 0 0 80px 20px rgba(155,114,207,0.8); }
      100% { box-shadow:0 0 0 0 rgba(155,114,207,0); }
    }
    .celeb-card-shockwave {
      animation:celeb-card-shockwave 800ms ease-out forwards !important;
    }
    .habit-milestone-badge {
      position:absolute; top:6px; left:6px;
      font-size:20px; line-height:1;
      pointer-events:none; z-index:5;
    }
    .habit-milestone-badge--flame {
      filter:sepia(1) saturate(5) hue-rotate(15deg) brightness(1.1);
    }
  `;
  document.head.appendChild(style);
}

function _badgeForStreak(streak) {
  if (streak >= 120) return { level:'trophy',  emoji:'🏆', cls:'' };
  if (streak >= 90)  return { level:'flame',   emoji:'🔥', cls:'habit-milestone-badge--flame' };
  if (streak >= 60)  return { level:'diamond', emoji:'💎', cls:'' };
  return                    { level:'crown',   emoji:'👑', cls:'' };
}

function triggerBigMilestoneCelebration(card, habit) {
  _injectCelebrationStyles();

  const streak  = habit.streak;
  const PALETTE = ['#9B72CF','#ffffff','#4CAF7D','#F0B429','#5B8DEF','#E8649A'];

  // STEP 2 — Sound
  try {
    const ctx   = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.2;
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.15);
    });
  } catch (_) {}

  // STEP 3 — Card shockwave
  card.classList.remove('celeb-card-shockwave');
  void card.offsetWidth;
  card.classList.add('celeb-card-shockwave');
  card.addEventListener('animationend', () => card.classList.remove('celeb-card-shockwave'), { once: true });

  // STEP 1 — Overlay
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.92);' +
    'animation:celeb-overlay-in 0.4s ease forwards;cursor:default;';
  document.body.appendChild(overlay);

  let dismissable = false, dismissed = false;

  function dismissOverlay() {
    if (!dismissable || dismissed) return;
    dismissed = true;
    overlay.style.animation = 'celeb-overlay-out 0.3s ease forwards';
    setTimeout(() => {
      overlay.remove();
      const badgeInfo = _badgeForStreak(streak);
      const h = habitsData.habits.find(x => x.id === habit.id);
      if (h) { h.badgeLevel = badgeInfo.level; saveHabits(); }
      renderHabitsGrid();
    }, 300);
  }

  setTimeout(() => {
    dismissable = true;
    overlay.addEventListener('click', dismissOverlay);
    const hint = document.createElement('div');
    hint.style.cssText =
      'position:absolute;bottom:32px;left:50%;transform:translateX(-50%);' +
      'font-size:12px;color:#555;white-space:nowrap;pointer-events:none;' +
      'animation:celeb-hint-in 0.4s ease forwards;';
    hint.textContent = 'tap anywhere to continue';
    overlay.appendChild(hint);
  }, 3000);

  document.addEventListener('keydown', function onEsc(e) {
    if (e.key === 'Escape') { dismissOverlay(); document.removeEventListener('keydown', onEsc); }
  });

  // Centered content container
  const content = document.createElement('div');
  content.style.cssText =
    'position:absolute;top:40%;left:50%;transform:translate(-50%,-50%);' +
    'text-align:center;pointer-events:none;';
  overlay.appendChild(content);

  // Simple queue dispatcher
  const queue = [];
  function runQueue() {
    if (!queue.length) return;
    const { delay, fn } = queue.shift();
    setTimeout(() => { fn(); runQueue(); }, delay);
  }

  // STEP 4 — Trophy drop (0.5s)
  queue.push({ delay: 500, fn() {
    const trophyEl = document.createElement('div');
    trophyEl.style.cssText =
      'font-size:80px;line-height:1;display:block;' +
      'animation:celeb-trophy-drop 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards;opacity:0;';
    trophyEl.textContent = '🏆';
    content.appendChild(trophyEl);

    setTimeout(() => {
      const nameLbl = document.createElement('div');
      nameLbl.style.cssText =
        'font-size:11px;color:#888;letter-spacing:0.12em;text-transform:uppercase;' +
        'margin-top:8px;margin-bottom:16px;' +
        'animation:celeb-fade-in 0.4s ease forwards;opacity:0;';
      nameLbl.textContent = habit.name;
      content.appendChild(nameLbl);
    }, 300);
  }});

  // STEP 5 — Headline (1.0s total)
  queue.push({ delay: 500, fn() {
    const headlineText = `${streak} DAYS.`;
    const line1 = document.createElement('div');
    line1.style.cssText =
      "font-family:'Audiowide',sans-serif;font-size:58px;color:#ffffff;" +
      'letter-spacing:0.08em;display:flex;justify-content:center;flex-wrap:wrap;';

    [...headlineText].forEach((ch, i) => {
      const span = document.createElement('span');
      span.textContent = ch === ' ' ? ' ' : ch;
      span.style.cssText =
        `display:inline-block;opacity:0;` +
        `animation:celeb-letter-in 0.3s ease ${(i * 0.04).toFixed(3)}s forwards;`;
      line1.appendChild(span);
    });
    content.appendChild(line1);

    const line1Ms = (headlineText.length * 0.04 + 0.3 + 0.5) * 1000;
    setTimeout(() => {
      const name     = appSettings.yourName?.trim();
      const line2Txt = name ? `${name}, you're built different.` : "You're built different.";
      const line2 = document.createElement('div');
      line2.style.cssText =
        "font-family:'Audiowide',sans-serif;font-size:16px;" +
        'color:rgba(255,255,255,0.55);margin-top:12px;' +
        'animation:celeb-fade-in 0.4s ease forwards;opacity:0;';
      line2.textContent = line2Txt;
      content.appendChild(line2);
    }, line1Ms);
  }});

  runQueue();

  // STEP 6 — Fireworks (0.3s – 3.0s)
  for (let b = 0; b < 8; b++) {
    setTimeout(() => {
      const bx = Math.random() * window.innerWidth;
      const by = Math.random() * window.innerHeight * 0.7;
      for (let p = 0; p < 16; p++) {
        const angle = (p / 16) * Math.PI * 2;
        const dist  = 80 + Math.random() * 170;
        const px    = (Math.cos(angle) * dist).toFixed(1);
        const py    = (Math.sin(angle) * dist).toFixed(1);
        const dur   = (0.8 + Math.random() * 0.6).toFixed(2);
        const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
        const ptcl  = document.createElement('div');
        ptcl.style.cssText =
          `position:fixed;left:${bx}px;top:${by}px;width:5px;height:5px;` +
          `border-radius:50%;background:${color};pointer-events:none;z-index:100000;` +
          `--px:${px}px;--py:${py}px;` +
          `animation:celeb-particle ${dur}s ease-out forwards;`;
        document.body.appendChild(ptcl);
        ptcl.addEventListener('animationend', () => ptcl.remove(), { once: true });
      }
    }, 300 + b * 300);
  }

  // STEP 7 — Confetti rain (1.5s)
  setTimeout(() => {
    for (let i = 0; i < 50; i++) {
      const x     = Math.random() * window.innerWidth;
      const cx    = (Math.random() * 60 - 30).toFixed(1);
      const dur   = (2.5 + Math.random() * 2).toFixed(2);
      const delay = (Math.random() * 2).toFixed(2);
      const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
      const piece = document.createElement('div');
      piece.style.cssText =
        `position:fixed;left:${x}px;top:-10px;width:4px;height:10px;` +
        `background:${color};pointer-events:none;z-index:100000;` +
        `--cx:${cx}px;` +
        `animation:celeb-confetti ${dur}s ${delay}s linear forwards;`;
      document.body.appendChild(piece);
      piece.addEventListener('animationend', () => piece.remove(), { once: true });
    }
  }, 1500);
}

function scheduleMidnightRefresh() {
  const now = new Date();
  const midnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0, 0, 10
  );
  const msUntilMidnight = midnight - now;

  setTimeout(() => {
    renderHabitsGrid();
    scheduleMidnightRefresh();
  }, msUntilMidnight);
}

function initHabits() {
  loadHabits();
  renderHabitsGrid();
  scheduleMidnightRefresh();

  document.getElementById('habitsAddBtn').addEventListener('click', showAddHabitInput);

  const habitModal = document.getElementById('habitModal');
  document.getElementById('habitModalClose').addEventListener('click', () => {
    habitModal.classList.add('hidden');
  });
  habitModal.addEventListener('click', e => {
    if (e.target === habitModal) habitModal.classList.add('hidden');
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !habitModal.classList.contains('hidden')) {
      habitModal.classList.add('hidden');
    }
  });
}

// ── Habits settings helpers ───────────────────────────────────────────────────

function populateHabitsSettings() {
  const list = document.getElementById('settingsWeekdaysOnlyList');
  if (!list) return;
  list.innerHTML = '';

  habitsData.habits.forEach(habit => {
    const row = document.createElement('div');
    row.className = 'settings-row';

    const lbl = document.createElement('label');
    lbl.className   = 'settings-row-label';
    lbl.textContent = habit.name;

    const toggle = document.createElement('label');
    toggle.className = 'settings-toggle';

    const cb = document.createElement('input');
    cb.type    = 'checkbox';
    cb.checked = !!habit.weekdaysOnly;

    const track = document.createElement('span');
    track.className = 'settings-toggle-track';

    cb.addEventListener('change', () => {
      const h = habitsData.habits.find(x => x.id === habit.id);
      if (!h) return;
      h.weekdaysOnly = cb.checked;
      h.streak = calcHabitStreak(h);
      if (h.streak > (h.bestStreak || 0)) h.bestStreak = h.streak;
      saveHabits();
      renderHabitsGrid();
      updateHabitsScore();
    });

    toggle.appendChild(cb);
    toggle.appendChild(track);
    row.appendChild(lbl);
    row.appendChild(toggle);
    list.appendChild(row);
  });
}

// ── Settings ──────────────────────────────────────────────────────────────────

const SETTINGS_KEY = 'simsi-settings';

const DEFAULT_SETTINGS = {
  workspaceName: 'Simsi Solutions',
  yourName: '',
  riseAndShine: '06:00',
  lightsOut: '21:45',
  defaultBlockDuration: 60,
  timeFormat: '12hr',
  calendarStartHour: 6,
  weekStartDay: 'Sunday',
  milestoneRewards: true,
  showBestStreak: true,
  accentColor: '#9B72CF',
  fontSize: 'Default',
  blockLabelStyle: 'Name + Time',
  showNoSlop: true,
  timeOfDayTinting: true,
};

const DEFAULT_GOALS = [
  {
    id: 'goal-trading',
    title: 'Get Into Trading',
    category: 'Finance',
    type: 'milestones',
    targetDate: 'Summer 2026',
    milestones: [],
    lessons: [],
  },
  {
    id: 'goal-precalc',
    title: 'Master Pre-Calc 11',
    category: 'Learning',
    type: 'units',
    targetDate: 'Summer 2026',
    units: [],
  },
  {
    id: 'goal-reading',
    title: 'Read 3 Books',
    category: 'Reading',
    type: 'counter',
    targetDate: 'Summer 2026',
    current: 0,
    target: 3,
    books: [
      {
        id: 'book-1',
        title: 'Think and Grow Rich',
        author: 'Napoleon Hill',
        totalPages: 238,
        currentPage: 0,
        coverDataUrl: null,
        journal: [],
      },
      {
        id: 'book-2',
        title: null,
        author: null,
        totalPages: null,
        currentPage: 0,
        coverDataUrl: null,
        journal: [],
      },
      {
        id: 'book-3',
        title: null,
        author: null,
        totalPages: null,
        currentPage: 0,
        coverDataUrl: null,
        journal: [],
      },
    ],
  },
];

let appSettings = { ...DEFAULT_SETTINGS };

function hhmm24ToTagFormat(hhmm) {
  const [hStr, mStr] = (hhmm || '06:00').split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const sfx = h < 12 ? 'am' : 'pm';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m.toString().padStart(2, '0')}${sfx}`;
}

function tagFormatToHHMM24(s) {
  const match = s.match(/^(\d+):(\d+)(am|pm)$/i);
  if (!match) return '06:00';
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (match[3].toLowerCase() === 'pm' && h !== 12) h += 12;
  if (match[3].toLowerCase() === 'am' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function getTimeTint(startHour) {
  if (appSettings.timeOfDayTinting === false) return 'transparent';
  const h = ((startHour % 24) + 24) % 24;
  if (h >= 5  && h < 9)  return 'rgba(255, 180, 50, 0.15)';
  if (h >= 9  && h < 12) return 'rgba(255, 210, 100, 0.10)';
  if (h >= 12 && h < 17) return 'transparent';
  if (h >= 17 && h < 21) return 'rgba(100, 120, 255, 0.12)';
  return 'rgba(60, 40, 120, 0.18)';
}

function updateBlockTimeTint(block) {
  const tintEl = block.querySelector('.block-time-tint');
  if (!tintEl) return;
  tintEl.style.background = getTimeTint(parseFloat(block.dataset.startHour));
}

function applyAllTimeTints() {
  document.querySelectorAll('.cal-block, .wk-block').forEach(updateBlockTimeTint);
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) appSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (e) {
    console.warn('Failed to load settings:', e);
  }
  applySettings();
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(appSettings));
}

function refreshCalendarDisplays() {
  if (!document.querySelector('.time-labels')) return;
  const { interval, hourH } = ZOOM_LEVELS[zoomIdx];
  rebuildTimeLabels(interval, hourH);
  document.querySelectorAll('.cal-block').forEach(block => {
    const startHour = parseFloat(block.dataset.startHour);
    const dur       = parseFloat(block.dataset.duration);
    const durSpan   = block.querySelector('.block-dur');
    if (durSpan) durSpan.textContent = timeRangeLabel(startHour, dur);
  });
  updateTagRowsForDay(dateKey(currentDate));
  if (!document.getElementById('yearPanel')?.classList.contains('hidden')) buildYearCal();
}

function scrollToStartHour() {
  const calBody = document.getElementById('calBody');
  if (!calBody) return;
  const target = Math.max(START_H, Math.min(END_H - 1, appSettings.calendarStartHour));
  calBody.scrollTop = (target - START_H) * HOUR_H;
}

const FONT_SIZE_MAP = { 'Compact': '13px', 'Default': '14px', 'Comfortable': '16px' };

function applySettings() {
  const brandName = document.querySelector('.brand-name');
  if (brandName) brandName.textContent = appSettings.workspaceName || DEFAULT_SETTINGS.workspaceName;
  refreshCalendarDisplays();

  document.documentElement.style.setProperty('--accent-color', appSettings.accentColor || '#9B72CF');
  document.documentElement.style.setProperty('--base-font-size', FONT_SIZE_MAP[appSettings.fontSize] || '14px');
  document.body.classList.toggle('blocks-name-only', appSettings.blockLabelStyle === 'Name Only');

  const noSlop = document.querySelector('.no-slop');
  if (noSlop) noSlop.style.display = appSettings.showNoSlop === false ? 'none' : '';

  applyAllTimeTints();
}

function initSettings() {
  const overlay               = document.getElementById('settingsOverlay');
  const gearBtn               = document.getElementById('settingsGearBtn');
  const closeBtn              = document.getElementById('settingsClose');
  const workspaceInput        = document.getElementById('settingWorkspaceName');
  const yourNameInput         = document.getElementById('settingYourName');
  const riseInput             = document.getElementById('settingRiseTime');
  const lightsInput           = document.getElementById('settingLightsOut');
  const durationSeg           = document.getElementById('settingBlockDuration');
  const timeFormatSeg         = document.getElementById('settingTimeFormat');
  const startHourSel          = document.getElementById('settingCalStartHour');
  const weekStartSeg          = document.getElementById('settingWeekStart');
  const milestoneRewardsToggle  = document.getElementById('settingMilestoneRewards');
  const showBestStreakToggle    = document.getElementById('settingShowBestStreak');
  const accentSwatchesEl       = document.getElementById('settingAccentColor');
  const fontSizeSeg            = document.getElementById('settingFontSize');
  const blockLabelSeg          = document.getElementById('settingBlockLabelStyle');
  const showNoSlopToggle       = document.getElementById('settingShowNoSlop');
  const timeOfDayTintingToggle = document.getElementById('settingTimeOfDayTinting');

  for (let h = 4; h <= 10; h++) {
    const opt = document.createElement('option');
    opt.value = h;
    opt.textContent = `${h}:00 AM`;
    startHourSel.appendChild(opt);
  }

  function setSegActive(seg, val) {
    seg.querySelectorAll('.settings-seg-btn').forEach(btn => {
      btn.classList.toggle('settings-seg-btn--active', btn.dataset.val === String(val));
    });
  }

  const openSettings = () => {
    workspaceInput.value = appSettings.workspaceName;
    yourNameInput.value  = appSettings.yourName;
    riseInput.value      = appSettings.riseAndShine;
    lightsInput.value    = appSettings.lightsOut;
    setSegActive(durationSeg,   String(appSettings.defaultBlockDuration));
    setSegActive(timeFormatSeg, appSettings.timeFormat);
    startHourSel.value = String(appSettings.calendarStartHour);
    setSegActive(weekStartSeg,  appSettings.weekStartDay);
    milestoneRewardsToggle.checked = appSettings.milestoneRewards !== false;
    showBestStreakToggle.checked   = appSettings.showBestStreak !== false;
    populateHabitsSettings();

    const activeColor = appSettings.accentColor || '#9B72CF';
    accentSwatchesEl.querySelectorAll('.settings-swatch').forEach(sw => {
      sw.classList.toggle('settings-swatch--active', sw.dataset.color === activeColor);
    });
    setSegActive(fontSizeSeg,    appSettings.fontSize        || 'Default');
    setSegActive(blockLabelSeg,  appSettings.blockLabelStyle || 'Name + Time');
    showNoSlopToggle.checked = appSettings.showNoSlop !== false;
    timeOfDayTintingToggle.checked = appSettings.timeOfDayTinting !== false;

    overlay.classList.remove('hidden');
  };

  const closeSettings = () => {
    overlay.classList.add('hidden');
  };

  gearBtn.addEventListener('click', openSettings);
  closeBtn.addEventListener('click', closeSettings);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeSettings(); });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) closeSettings();
  });

  workspaceInput.addEventListener('input', () => {
    appSettings.workspaceName = workspaceInput.value || DEFAULT_SETTINGS.workspaceName;
    saveSettings();
    applySettings();
  });

  yourNameInput.addEventListener('input', () => {
    appSettings.yourName = yourNameInput.value;
    saveSettings();
  });

  riseInput.addEventListener('change', () => {
    appSettings.riseAndShine = riseInput.value;
    saveSettings();
    updateTagRowsForDay(dateKey(currentDate));
  });

  lightsInput.addEventListener('change', () => {
    appSettings.lightsOut = lightsInput.value;
    saveSettings();
    updateTagRowsForDay(dateKey(currentDate));
  });

  durationSeg.addEventListener('click', e => {
    const btn = e.target.closest('.settings-seg-btn');
    if (!btn) return;
    appSettings.defaultBlockDuration = parseInt(btn.dataset.val, 10);
    saveSettings();
    setSegActive(durationSeg, btn.dataset.val);
  });

  timeFormatSeg.addEventListener('click', e => {
    const btn = e.target.closest('.settings-seg-btn');
    if (!btn) return;
    appSettings.timeFormat = btn.dataset.val;
    saveSettings();
    setSegActive(timeFormatSeg, btn.dataset.val);
    refreshCalendarDisplays();
  });

  startHourSel.addEventListener('change', () => {
    appSettings.calendarStartHour = parseInt(startHourSel.value, 10);
    saveSettings();
  });

  weekStartSeg.addEventListener('click', e => {
    const btn = e.target.closest('.settings-seg-btn');
    if (!btn) return;
    appSettings.weekStartDay = btn.dataset.val;
    saveSettings();
    setSegActive(weekStartSeg, btn.dataset.val);
    if (!document.getElementById('yearPanel')?.classList.contains('hidden')) buildYearCal();
  });

  milestoneRewardsToggle.addEventListener('change', () => {
    appSettings.milestoneRewards = milestoneRewardsToggle.checked;
    saveSettings();
  });

  showBestStreakToggle.addEventListener('change', () => {
    appSettings.showBestStreak = showBestStreakToggle.checked;
    saveSettings();
    renderHabitsGrid();
  });

  accentSwatchesEl.addEventListener('click', e => {
    const sw = e.target.closest('.settings-swatch');
    if (!sw) return;
    const color = sw.dataset.color;
    appSettings.accentColor = color;
    saveSettings();
    document.documentElement.style.setProperty('--accent-color', color);
    accentSwatchesEl.querySelectorAll('.settings-swatch').forEach(s => {
      s.classList.toggle('settings-swatch--active', s.dataset.color === color);
    });
  });

  fontSizeSeg.addEventListener('click', e => {
    const btn = e.target.closest('.settings-seg-btn');
    if (!btn) return;
    appSettings.fontSize = btn.dataset.val;
    saveSettings();
    setSegActive(fontSizeSeg, btn.dataset.val);
    document.documentElement.style.setProperty('--base-font-size', FONT_SIZE_MAP[btn.dataset.val] || '14px');
  });

  blockLabelSeg.addEventListener('click', e => {
    const btn = e.target.closest('.settings-seg-btn');
    if (!btn) return;
    appSettings.blockLabelStyle = btn.dataset.val;
    saveSettings();
    setSegActive(blockLabelSeg, btn.dataset.val);
    document.body.classList.toggle('blocks-name-only', btn.dataset.val === 'Name Only');
  });

  showNoSlopToggle.addEventListener('change', () => {
    appSettings.showNoSlop = showNoSlopToggle.checked;
    saveSettings();
    const noSlop = document.querySelector('.no-slop');
    if (noSlop) noSlop.style.display = showNoSlopToggle.checked ? '' : 'none';
  });

  timeOfDayTintingToggle.addEventListener('change', () => {
    appSettings.timeOfDayTinting = timeOfDayTintingToggle.checked;
    saveSettings();
    applyAllTimeTints();
  });
}

// ── Settings – Data section ───────────────────────────────────────────────────

const APP_STORAGE_KEYS = [
  BLOCKS_KEY, REMIND_KEY, RISE_KEY, LIGHTS_KEY,
  DAY_RANGES_KEY, CUSTOM_ACTS_KEY, DELETED_ACTS_KEY,
  HABITS_KEY, SETTINGS_KEY, 'simsi-goals',
];

let _dataConfirmMap = {};

function _showDataConfirm(btn, question, yesLabel, noLabel, onYes) {
  const confirmEl = document.createElement('div');
  confirmEl.className = 'data-confirm';

  const text = document.createElement('span');
  text.className = 'data-confirm-text';
  text.textContent = question;

  const btns = document.createElement('div');
  btns.className = 'data-confirm-btns';

  const yes = document.createElement('button');
  yes.className = 'data-confirm-yes';
  yes.textContent = yesLabel;
  yes.addEventListener('click', onYes);

  const no = document.createElement('button');
  no.className = 'data-confirm-no';
  no.textContent = noLabel;
  no.addEventListener('click', () => _restoreDataBtn(btn));

  btns.appendChild(yes);
  btns.appendChild(no);
  confirmEl.appendChild(text);
  confirmEl.appendChild(btns);

  _dataConfirmMap[btn.id] = { btn, confirmEl };
  btn.replaceWith(confirmEl);
}

function _restoreDataBtn(btn) {
  const entry = _dataConfirmMap[btn.id];
  if (entry && entry.confirmEl.parentNode) {
    entry.confirmEl.replaceWith(btn);
  }
  delete _dataConfirmMap[btn.id];
}

function _resetAllDataRows() {
  Object.values(_dataConfirmMap).forEach(({ btn }) => _restoreDataBtn(btn));
}

function initDataSettings() {
  const exportBtn      = document.getElementById('dataExportBtn');
  const clearTodayBtn  = document.getElementById('dataClearTodayBtn');
  const resetHabitsBtn = document.getElementById('dataResetHabitsBtn');
  const resetAllBtn    = document.getElementById('dataResetAllBtn');

  // Reset confirmation state whenever the settings modal opens
  document.getElementById('settingsGearBtn').addEventListener('click', _resetAllDataRows);

  // Row 1 — Export JSON
  exportBtn.addEventListener('click', () => {
    const data = {};
    // Collect all known app keys
    APP_STORAGE_KEYS.forEach(key => {
      const val = localStorage.getItem(key);
      if (val !== null) {
        try { data[key] = JSON.parse(val); } catch { data[key] = val; }
      }
    });
    // Also sweep for any additional simsi- keys not already included
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('simsi-') && !(key in data)) {
        const val = localStorage.getItem(key);
        try { data[key] = JSON.parse(val); } catch { data[key] = val; }
      }
    }
    const payload = JSON.stringify({ exportedAt: new Date().toISOString(), data }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `productive-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Row 1b — Import Backup
  const importBtn   = document.getElementById('dataImportBtn');
  const importInput = document.getElementById('dataImportInput');
  if (importBtn && importInput) {
    importBtn.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', () => {
      const file = importInput.files && importInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const parsed = JSON.parse(reader.result);
          // Accept both the Export JSON format ({ exportedAt, data: {...} })
          // and a flat { key: value } backup.
          const entries = (parsed && typeof parsed.data === 'object' && parsed.data)
            ? parsed.data
            : parsed;
          Object.keys(entries).forEach(key => {
            const value = entries[key];
            localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
          });
          // Push imported data to the cloud before reloading; otherwise the
          // reload's hydrate would overwrite it with the old cloud copy.
          // No-ops when signed out.
          if (typeof window.__syncPushNow === 'function') {
            try { await window.__syncPushNow(); } catch (e) {}
          }
          location.reload();
        } catch (e) {
          alert('Could not import that file — it is not valid backup JSON.');
        }
      };
      reader.readAsText(file);
    });
  }

  // Row 2 — Clear Today's Blocks
  clearTodayBtn.addEventListener('click', () => {
    _showDataConfirm(clearTodayBtn, "Clear today's blocks?", 'Yes', 'No', () => {
      _restoreDataBtn(clearTodayBtn);
      const key = todayKey();
      try {
        const raw = localStorage.getItem(BLOCKS_KEY);
        const all = raw ? JSON.parse(raw) : [];
        localStorage.setItem(BLOCKS_KEY, JSON.stringify(all.filter(b => b.day !== key)));
      } catch (e) {}
      document.querySelectorAll('.cal-block').forEach(b => b.remove());
      if (dateKey(currentDate) === key) loadBlocksForDay(key);
    });
  });

  // Row 3 — Reset Habits Data
  resetHabitsBtn.addEventListener('click', () => {
    _showDataConfirm(resetHabitsBtn, 'Reset all habit data?', 'Yes', 'No', () => {
      _restoreDataBtn(resetHabitsBtn);
      habitsData.habits.forEach(h => {
        h.streak        = 0;
        h.weeklyChecks  = {};
        h.lastMilestone = 0;
      });
      saveHabits();
      renderHabitsGrid();
      updateHabitsScore();
    });
  });

  // Row 4 — Reset Everything
  resetAllBtn.addEventListener('click', () => {
    _showDataConfirm(resetAllBtn, 'Delete all blocks, habits, and settings?', 'Yes, Reset', 'Cancel', () => {
      APP_STORAGE_KEYS.forEach(key => localStorage.removeItem(key));
      const extra = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('simsi-') || key.startsWith('productive-'))) extra.push(key);
      }
      extra.forEach(key => localStorage.removeItem(key));
      location.reload();
    });
  });
}

// ── Home page ─────────────────────────────────────────────────────────────────

let _homeClockInterval = null;

function getGreeting() {
  const h = new Date().getHours();
  let phrase;
  if (h >= 5 && h < 12)       phrase = 'Good morning';
  else if (h >= 12 && h < 17) phrase = 'Good afternoon';
  else                         phrase = 'Good evening';
  const name = appSettings.yourName?.trim();
  return name ? `${phrase}, ${name}` : phrase;
}

function getGreetingLine1() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12)       return 'Good morning,';
  else if (h >= 12 && h < 17) return 'Good afternoon,';
  else                         return 'Good evening,';
}

function getGreetingLine2() {
  const name = appSettings.yourName?.trim();
  return name ? name + '.' : 'welcome.';
}

function formatHomeClock() {
  const now = new Date();
  const h = now.getHours(), m = now.getMinutes();
  if (appSettings.timeFormat === '24hr') {
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  }
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2,'0')} ${period}`;
}

function getUpNext() {
  const key = todayKey();
  let blocks = [];
  try {
    const raw = localStorage.getItem(BLOCKS_KEY);
    if (raw) blocks = JSON.parse(raw).filter(b => b.day === key);
  } catch (e) {}

  if (!blocks.length) return null;

  const now = new Date();
  const nowHour = now.getHours() + now.getMinutes() / 60;
  blocks.sort((a, b) => a.startHour - b.startHour);
  const next = blocks.find(b => b.startHour > nowHour);
  if (!next) return '';

  const totalMins = Math.round(next.startHour * 60);
  const hr = Math.floor(totalMins / 60) % 24;
  const mn = totalMins % 60;
  let timeStr;
  if (appSettings.timeFormat === '24hr') {
    timeStr = `${String(hr).padStart(2,'0')}:${String(mn).padStart(2,'0')}`;
  } else {
    const period = hr < 12 ? 'AM' : 'PM';
    const h12 = hr === 0 ? 12 : hr > 12 ? hr - 12 : hr;
    timeStr = `${h12}:${String(mn).padStart(2,'0')} ${period}`;
  }
  return `Up next · ${next.label} at ${timeStr}`;
}

function tickHomeClock() {
  const clockEl = document.getElementById('homeClock');
  const line1El = document.getElementById('homeGreetingLine1');
  const line2El = document.getElementById('homeGreetingLine2');
  if (clockEl) clockEl.textContent = formatHomeClock();
  if (line1El) line1El.textContent = getGreetingLine1();
  if (line2El) line2El.textContent = getGreetingLine2();
}

function renderHomePage() {
  if (_homeClockInterval) {
    clearInterval(_homeClockInterval);
    _homeClockInterval = null;
  }

  const line1El   = document.getElementById('homeGreetingLine1');
  const line2El   = document.getElementById('homeGreetingLine2');
  const dateEl    = document.getElementById('homeDateEl');
  const clockEl   = document.getElementById('homeClock');
  const upNextEl  = document.getElementById('homeUpNext');

  if (line1El) line1El.textContent = getGreetingLine1();
  if (line2El) line2El.textContent = getGreetingLine2();

  if (dateEl) {
    const d = new Date();
    const days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    dateEl.textContent = `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
  }

  if (clockEl) clockEl.textContent = formatHomeClock();

  if (upNextEl) {
    const upNext = getUpNext();
    if (upNext === null) {
      upNextEl.style.display = 'none';
    } else {
      upNextEl.style.display = '';
      upNextEl.textContent = upNext === '' ? 'Nothing else scheduled today' : upNext;
    }
  }

  _homeClockInterval = setInterval(tickHomeClock, 1000);

  // Countdowns widget lives on the home hero; (re)start its 1s ticker here so it
  // stays in step with the home clock and never accumulates stray intervals.
  startCountdownsTicker();
}

// ── Countdowns ────────────────────────────────────────────────────────────────
// A "Countdowns" collection: like every other collection in this app it lives in
// a single localStorage key (COUNTDOWNS_KEY) that auth.js mirrors into the user's
// Firestore doc. It therefore rides the *existing* real-time onSnapshot sync and
// the existing doc-level, timestamp-based (lastModified) conflict-resolution
// transaction in auth.js — no separate/parallel sync mechanism is introduced.
// Each countdown: { id, name, targetDateTime (local-naive ISO 8601),
//                   createdAt, updatedAt }.

let _countdownsInterval = null;
let _countdownsSig      = null;   // signature of the visible set, to decide rebuild vs in-place tick

const COUNTDOWN_CONGRATS = [
  '🎉 You made it!',
  '🥳 The big day is here!',
  '🎊 It’s finally today!',
  '✨ Today’s the day!',
  '🎈 You made it — enjoy every second!',
  '🙌 The wait is over!',
];

function saveCountdowns() {
  localStorage.setItem(COUNTDOWNS_KEY, JSON.stringify(countdownsData));
}

function loadCountdowns() {
  try {
    const raw = localStorage.getItem(COUNTDOWNS_KEY);
    countdownsData = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(countdownsData)) countdownsData = [];
  } catch (e) {
    countdownsData = [];
  }
  renderCountdownsWidget();
}

// Midnight-of-local-day timestamp — the reference for "same calendar day" checks.
// Uses the browser's local timezone (Date getters are local), as required.
function localDayStart(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

// Pick a (stable per-event) cheeky congrats line from the id.
function countdownCongrats(c) {
  let h = 0;
  for (let i = 0; i < c.id.length; i++) h = (h * 31 + c.id.charCodeAt(i)) >>> 0;
  return COUNTDOWN_CONGRATS[h % COUNTDOWN_CONGRATS.length];
}

// Resolve a countdown's display state for *now*:
//   { visible, dayOf, target }
// - past calendar day  → not visible (auto-removed starting the next local day)
// - same calendar day  → visible, dayOf (show congrats message)
// - future calendar day → visible, live countdown
function countdownState(c, now) {
  const target = new Date(c.targetDateTime);   // no offset ⇒ parsed in local time
  if (isNaN(target.getTime())) return { visible: false };
  const todayStart  = localDayStart(now);
  const targetStart = localDayStart(target);
  if (targetStart < todayStart)  return { visible: false };
  if (targetStart === todayStart) return { visible: true, dayOf: true,  target };
  return { visible: true, dayOf: false, target };
}

// Calendar-accurate breakdown of (target - now) into months/days/hours/minutes/
// seconds. Months are counted by real calendar steps (setMonth), so "1 month"
// spans the actual number of days in the month(s) crossed — not a flat 30 days.
function countdownParts(now, target) {
  let months = 0;
  let cursor = new Date(now.getTime());
  while (true) {
    const next = new Date(cursor.getTime());
    next.setMonth(next.getMonth() + 1);
    if (next.getTime() <= target.getTime()) { cursor = next; months++; }
    else break;
  }
  let rem = target.getTime() - cursor.getTime();
  if (rem < 0) rem = 0;
  const days    = Math.floor(rem / 86400000); rem -= days    * 86400000;
  const hours   = Math.floor(rem / 3600000);  rem -= hours   * 3600000;
  const minutes = Math.floor(rem / 60000);    rem -= minutes * 60000;
  const seconds = Math.floor(rem / 1000);
  return { months, days, hours, minutes, seconds };
}

// "X Months, Y Days, Z Hours, W Minutes, V Seconds" — but only from the highest
// non-zero unit downward (no leading zero units), re-evaluated every tick.
function formatCountdown(p) {
  const units = [
    [p.months,  'Month'],
    [p.days,    'Day'],
    [p.hours,   'Hour'],
    [p.minutes, 'Minute'],
    [p.seconds, 'Second'],
  ];
  let start = units.findIndex(u => u[0] > 0);
  if (start === -1) start = units.length - 1;   // everything zero ⇒ show "0 Seconds"
  return units.slice(start)
    .map(([v, label]) => `${v} ${label}${v === 1 ? '' : 's'}`)
    .join(', ');
}

// Visible countdowns, soonest-first.
function visibleCountdowns(now) {
  return countdownsData
    .map(c => ({ c, st: countdownState(c, now) }))
    .filter(x => x.st.visible)
    .sort((a, b) => a.st.target.getTime() - b.st.target.getTime());
}

// A signature of the visible set + each item's day-of state. When it changes we
// rebuild the DOM; otherwise the per-second tick only updates the number text.
function countdownsSignature(items) {
  return items.map(({ c, st }) => `${c.id}:${st.dayOf ? 'D' : 'C'}`).join('|');
}

function renderCountdownsWidget() {
  const list = document.getElementById('countdownsList');
  if (!list) return;
  const now   = new Date();
  const items = visibleCountdowns(now);
  list.innerHTML = '';

  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'countdowns-empty';
    empty.textContent = 'No countdowns yet.';
    list.appendChild(empty);
    _countdownsSig = '';
    return;
  }

  items.forEach(({ c, st }) => {
    const row = document.createElement('div');
    row.className = 'countdown-item';
    row.dataset.id = c.id;

    const main = document.createElement('div');
    main.className = 'countdown-main';
    main.addEventListener('click', () => openCountdownModal(c));

    const name = document.createElement('div');
    name.className = 'countdown-name';
    name.textContent = c.name;

    const value = document.createElement('div');
    value.className = 'countdown-value' + (st.dayOf ? ' countdown-value--dayof' : '');
    value.textContent = st.dayOf
      ? countdownCongrats(c)
      : formatCountdown(countdownParts(now, st.target));

    main.appendChild(name);
    main.appendChild(value);

    const editBtn = document.createElement('button');
    editBtn.className = 'countdown-edit-btn';
    editBtn.title = 'Edit countdown';
    editBtn.setAttribute('aria-label', 'Edit countdown');
    editBtn.innerHTML = '<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>';
    editBtn.addEventListener('click', (e) => { e.stopPropagation(); openCountdownModal(c); });

    row.appendChild(main);
    row.appendChild(editBtn);
    list.appendChild(row);
  });

  _countdownsSig = countdownsSignature(items);
}

// Per-second update. Rebuilds only when the visible set / day-of state changes
// (add, delete, an event turning day-of, or one dropping off after its day);
// otherwise just refreshes the number text in place — cheap and flicker-free.
function tickCountdowns() {
  const list = document.getElementById('countdownsList');
  if (!list) return;
  const now   = new Date();
  const items = visibleCountdowns(now);
  const sig   = countdownsSignature(items);
  if (sig !== _countdownsSig) { renderCountdownsWidget(); return; }

  items.forEach(({ c, st }) => {
    if (st.dayOf) return;   // congrats text is static
    const row = list.querySelector(`.countdown-item[data-id="${CSS.escape(c.id)}"]`);
    const value = row && row.querySelector('.countdown-value');
    if (value) value.textContent = formatCountdown(countdownParts(now, st.target));
  });
}

function startCountdownsTicker() {
  if (_countdownsInterval) { clearInterval(_countdownsInterval); _countdownsInterval = null; }
  renderCountdownsWidget();
  _countdownsInterval = setInterval(tickCountdowns, 1000);
}

// datetime-local <input> value ("YYYY-MM-DDTHH:mm") reconstructed from a stored
// ISO string, in local wall-clock time.
function toDateTimeLocalValue(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function openCountdownModal(existing) {
  const modal     = document.getElementById('countdownModal');
  const titleEl   = document.getElementById('countdownModalTitle');
  const nameInput = document.getElementById('countdownNameInput');
  const dtInput   = document.getElementById('countdownDateTimeInput');
  const errEl     = document.getElementById('countdownModalError');
  const delBtn    = document.getElementById('countdownModalDelete');
  const confirmBtn = document.getElementById('countdownModalConfirm');
  if (!modal) return;

  errEl.textContent = '';
  nameInput.style.borderColor = '';
  dtInput.style.borderColor = '';

  if (existing) {
    titleEl.textContent = 'Edit Countdown';
    nameInput.value = existing.name || '';
    dtInput.value   = toDateTimeLocalValue(existing.targetDateTime);
    modal.dataset.editId = existing.id;
    delBtn.style.display = '';
    confirmBtn.textContent = 'Save';
  } else {
    titleEl.textContent = 'New Countdown';
    nameInput.value = '';
    dtInput.value   = '';
    delete modal.dataset.editId;
    delBtn.style.display = 'none';
    confirmBtn.textContent = 'Add';
  }
  modal.classList.remove('hidden');
  setTimeout(() => nameInput.focus(), 40);
}

function closeCountdownModal() {
  document.getElementById('countdownModal')?.classList.add('hidden');
}

function confirmCountdown() {
  const modal     = document.getElementById('countdownModal');
  const nameInput = document.getElementById('countdownNameInput');
  const dtInput   = document.getElementById('countdownDateTimeInput');
  const errEl     = document.getElementById('countdownModalError');
  if (!modal) return;

  const name  = nameInput.value.trim();
  const dtVal = dtInput.value;   // "YYYY-MM-DDTHH:mm" (local), or "" if unset
  errEl.textContent = '';
  nameInput.style.borderColor = '';
  dtInput.style.borderColor = '';

  if (!name) {
    errEl.textContent = 'Please enter an event name.';
    nameInput.style.borderColor = 'rgba(239,68,68,0.7)';
    nameInput.focus();
    return;
  }
  if (!dtVal) {
    errEl.textContent = 'Please pick a date and time.';
    dtInput.style.borderColor = 'rgba(239,68,68,0.7)';
    return;
  }
  const target = new Date(dtVal);   // parsed as local time
  if (isNaN(target.getTime())) {
    errEl.textContent = 'That date and time looks invalid.';
    dtInput.style.borderColor = 'rgba(239,68,68,0.7)';
    return;
  }
  if (target.getTime() <= Date.now()) {
    errEl.textContent = 'That date and time is already in the past — pick a moment in the future.';
    dtInput.style.borderColor = 'rgba(239,68,68,0.7)';
    return;
  }

  // Store a local-naive ISO 8601 string (no offset ⇒ interpreted as local time),
  // with seconds for a full date+time.
  const iso   = dtVal.length === 16 ? `${dtVal}:00` : dtVal;
  const nowIso = new Date().toISOString();
  const editId = modal.dataset.editId;

  if (editId) {
    const c = countdownsData.find(x => x.id === editId);
    if (c) {
      c.name = name;
      c.targetDateTime = iso;
      c.updatedAt = nowIso;
    }
  } else {
    countdownsData.push({
      id: `cd-${uid()}`,
      name,
      targetDateTime: iso,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  }

  saveCountdowns();
  renderCountdownsWidget();
  closeCountdownModal();
}

function deleteCountdown(id) {
  countdownsData = countdownsData.filter(c => c.id !== id);
  saveCountdowns();
  renderCountdownsWidget();
  closeCountdownModal();
}

// ── Navigation ────────────────────────────────────────────────────────────────

function initNav() {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const target = link.dataset.section;
      document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      link.classList.add('active');
      document.getElementById(target)?.classList.add('active');
      if (target === 'home') { advanceAndSetBackground(); renderHomePage(); }
      if (isMobileView()) closeDrawer();
    });
  });
}

// Mobile bottom-nav "+" — context-aware add. It clicks the active section's
// EXISTING add control, so it runs today's handler with no new behavior. It is
// hidden on sections that have no single add action (e.g. Schedule). This does
// not touch the nav switching in initNav(); the extra .nav-link listener only
// keeps the "+" visibility in sync with the active section.
function initBottomNavAdd() {
  const btn = document.getElementById('bottomNavAdd');
  if (!btn) return;
  const addBtnBySection = {
    home:   'countdownsAddBtn',
    habits: 'habitsAddBtn',
    goals:  'goalsAddBtn',
  };
  const currentSection = () =>
    document.querySelector('.nav-link.active')?.dataset.section
    || document.querySelector('.section.active')?.id;
  const syncVisibility = () => {
    btn.style.display = addBtnBySection[currentSection()] ? '' : 'none';
  };
  btn.addEventListener('click', () => {
    document.getElementById(addBtnBySection[currentSection()])?.click();
  });
  document.querySelectorAll('.nav-link').forEach(l =>
    l.addEventListener('click', syncVisibility));
  syncVisibility();
}

// ── Init ──────────────────────────────────────────────────────────────────────

const mobileMQ = window.matchMedia('(max-width: 768px)');
function isMobileView() { return mobileMQ.matches; }

function closeDrawer() {
  document.querySelector('.app')?.classList.remove('drawer-open');
}

function initSidebarToggle() {
  const btn = document.getElementById('sidebarToggle');
  const app = document.querySelector('.app');
  const scrim = document.getElementById('sidebarScrim');
  const STORAGE_KEY = 'simsi-sidebar-collapsed';

  // Apply saved state without animation
  if (localStorage.getItem(STORAGE_KEY) === '1') {
    app.classList.add('no-transition', 'sidebar-collapsed');
    void app.offsetWidth; // force reflow so transitions are paused
    app.classList.remove('no-transition');
  }

  btn.addEventListener('click', () => {
    if (isMobileView()) {
      // Mobile: the button is a hamburger that opens the off-canvas drawer.
      app.classList.toggle('drawer-open');
      return;
    }
    const collapsed = app.classList.toggle('sidebar-collapsed');
    localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
  });

  scrim?.addEventListener('click', closeDrawer);

  // Leaving mobile width should never leave a drawer stuck open.
  mobileMQ.addEventListener('change', () => { if (!isMobileView()) closeDrawer(); });
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    advanceAndSetBackground();
  }
});

function bootApp() {
  initBackgroundImage();
  initSidebarToggle();
  loadSettings();
  loadDayRanges();
  loadCustomActivities();
  loadDeletedActs();
  buildCalendar();
  buildWeekBody();
  buildLibrary();
  buildTagRows();
  initDayNav();
  initZoom();
  initNav();
  initBottomNavAdd();
  initPanelToggles();
  initDayRangePanel();
  loadTimes();
  loadBlocks();
  loadReminders();
  scrollToStartHour();
  initViewMode();
  updateActiveBlock();
  setInterval(updateActiveBlock, 60000);
  setInterval(updateWeekActiveBlock, 60000);
  initHabits();
  loadGoals();
  loadCountdowns();

  const _countdownsAddBtn = document.getElementById('countdownsAddBtn');
  if (_countdownsAddBtn) _countdownsAddBtn.addEventListener('click', () => openCountdownModal(null));

  const _countdownModal        = document.getElementById('countdownModal');
  const _countdownModalClose   = document.getElementById('countdownModalClose');
  const _countdownModalCancel  = document.getElementById('countdownModalCancel');
  const _countdownModalConfirm = document.getElementById('countdownModalConfirm');
  const _countdownModalDelete  = document.getElementById('countdownModalDelete');
  const _countdownNameInput    = document.getElementById('countdownNameInput');
  if (_countdownModalClose)   _countdownModalClose.addEventListener('click', closeCountdownModal);
  if (_countdownModalCancel)  _countdownModalCancel.addEventListener('click', closeCountdownModal);
  if (_countdownModal)        _countdownModal.addEventListener('click', e => { if (e.target === _countdownModal) closeCountdownModal(); });
  if (_countdownModalConfirm) _countdownModalConfirm.addEventListener('click', confirmCountdown);
  if (_countdownModalDelete)  _countdownModalDelete.addEventListener('click', () => {
    const id = _countdownModal?.dataset.editId;
    if (id) deleteCountdown(id);
  });
  if (_countdownNameInput)    _countdownNameInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); confirmCountdown(); }
  });

  const _bookLibraryBack = document.getElementById('bookLibraryBack');
  if (_bookLibraryBack) _bookLibraryBack.addEventListener('click', navigateToGoals);

  const _bookDetailBack = document.getElementById('bookDetailBack');
  if (_bookDetailBack) _bookDetailBack.addEventListener('click', () => {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById('bookLibrary').classList.add('active');
    renderBookLibrary();
  });

  const _goalsAddBtn = document.getElementById('goalsAddBtn');
  if (_goalsAddBtn) _goalsAddBtn.addEventListener('click', openNewGoalModal);

  const _newGoalModal = document.getElementById('newGoalModal');
  const _newGoalModalClose = document.getElementById('newGoalModalClose');
  const _newGoalModalCancel = document.getElementById('newGoalModalCancel');
  const _newGoalModalConfirm = document.getElementById('newGoalModalConfirm');
  if (_newGoalModalClose)   _newGoalModalClose.addEventListener('click', closeNewGoalModal);
  if (_newGoalModalCancel)  _newGoalModalCancel.addEventListener('click', closeNewGoalModal);
  if (_newGoalModal)        _newGoalModal.addEventListener('click', e => { if (e.target === _newGoalModal) closeNewGoalModal(); });
  if (_newGoalModalConfirm) _newGoalModalConfirm.addEventListener('click', confirmNewGoal);

  const _editGoalModal = document.getElementById('editGoalModal');
  const _editGoalModalClose = document.getElementById('editGoalModalClose');
  const _editGoalModalCancel = document.getElementById('editGoalModalCancel');
  const _editGoalModalConfirm = document.getElementById('editGoalModalConfirm');
  if (_editGoalModalClose)   _editGoalModalClose.addEventListener('click', closeEditGoalModal);
  if (_editGoalModalCancel)  _editGoalModalCancel.addEventListener('click', closeEditGoalModal);
  if (_editGoalModal)        _editGoalModal.addEventListener('click', e => { if (e.target === _editGoalModal) closeEditGoalModal(); });
  if (_editGoalModalConfirm) _editGoalModalConfirm.addEventListener('click', () => {
    const goalId = _editGoalModalConfirm.dataset.goalId;
    confirmEditGoal(goalId);
  });

  const _goalModal = document.getElementById('goalModal');
  const _goalModalClose = document.getElementById('goalModalClose');
  if (_goalModalClose) _goalModalClose.addEventListener('click', closeGoalModal);
  if (_goalModal)      _goalModal.addEventListener('click', e => { if (e.target === _goalModal) closeGoalModal(); });
  initSettings();
  initDataSettings();
  renderHomePage();
}
// The app is booted by auth.js (window.bootApp) after cloud data is hydrated.
window.bootApp = bootApp;

function loadBlocks() {
  loadBlocksForDay(dateKey(currentDate));
}

// ── Week view ─────────────────────────────────────────────────────────────────

function getWeekMonday(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function initViewMode() {
  weekViewAnchor = getWeekMonday(new Date());
  const saved = localStorage.getItem(VIEW_MODE_KEY);
  if (saved === 'week') currentViewMode = 'week';

  document.getElementById('viewModeSeg').addEventListener('click', e => {
    const btn = e.target.closest('.view-mode-btn');
    if (!btn) return;
    const mode = btn.dataset.mode;
    if (mode !== currentViewMode) setViewMode(mode);
  });

  setViewMode(currentViewMode, true);
}

function setViewMode(mode, initial = false) {
  currentViewMode = mode;
  localStorage.setItem(VIEW_MODE_KEY, mode);

  const calBody      = document.getElementById('calBody');
  const weekBody     = document.getElementById('weekBody');
  const calTagsTop   = document.getElementById('calTagsTop');
  const calTagsBot   = document.getElementById('calTagsBottom');

  document.querySelectorAll('.view-mode-btn').forEach(btn => {
    btn.classList.toggle('view-mode-btn--active', btn.dataset.mode === mode);
  });

  if (mode === 'week') {
    calBody.style.display    = 'none';
    calTagsTop.style.display = 'none';
    calTagsBot.style.display = 'none';
    weekBody.style.display   = 'flex';
    renderWeekView();
  } else {
    calBody.style.display    = '';
    calTagsTop.style.display = '';
    calTagsBot.style.display = '';
    weekBody.style.display   = 'none';
    if (!initial) {
      renderCurrentDay();
      scrollToStartHour();
    }
    updateWeekNavTitle();
  }
}

function updateWeekNavTitle() {
  const el = document.getElementById('dayNavTitle');
  if (!el) return;
  if (currentViewMode === 'day') {
    el.textContent = formatDateFull(currentDate);
    return;
  }
  const sunday = new Date(weekViewAnchor);
  sunday.setDate(sunday.getDate() + 6);
  const m1 = WEEK_MONTH_ABBR[weekViewAnchor.getMonth()];
  const m2 = WEEK_MONTH_ABBR[sunday.getMonth()];
  el.textContent = m1 === m2
    ? `${m1} ${weekViewAnchor.getDate()} – ${sunday.getDate()}`
    : `${m1} ${weekViewAnchor.getDate()} – ${m2} ${sunday.getDate()}`;
}

function navigateWeek(offset) {
  weekViewAnchor = new Date(weekViewAnchor);
  weekViewAnchor.setDate(weekViewAnchor.getDate() + offset * 7);
  renderWeekView();
}

// ── Build week DOM structure (called once on init) ────────────────────────────

function buildWeekBody() {
  const container = document.getElementById('weekBody');

  // Column headers row (sticky above scroll)
  const headersRow = document.createElement('div');
  headersRow.className = 'week-col-headers';

  const spacer = document.createElement('div');
  spacer.className = 'week-header-spacer';
  headersRow.appendChild(spacer);

  for (let i = 0; i < 7; i++) {
    const hdr = document.createElement('div');
    hdr.className = 'week-day-header';
    hdr.id = `wkHdr${i}`;
    headersRow.appendChild(hdr);
  }
  container.appendChild(headersRow);

  // Scrollable area
  const scroll = document.createElement('div');
  scroll.className = 'week-scroll';
  scroll.id = 'weekScroll';

  // Time axis labels
  const axis = document.createElement('div');
  axis.className = 'week-time-axis';
  axis.id = 'weekTimeAxis';
  scroll.appendChild(axis);

  // 7 columns
  const colsWrap = document.createElement('div');
  colsWrap.className = 'week-cols';
  for (let i = 0; i < 7; i++) {
    const col = document.createElement('div');
    col.className = 'week-col';
    col.id = `wkCol${i}`;

    const ind = document.createElement('div');
    ind.className = 'drop-indicator';
    col.appendChild(ind);

    // Library-chip → week-column drag-and-drop (attached once; persists across renders)
    col.addEventListener('dragover',  onWeekColDragOver);
    col.addEventListener('dragleave', onWeekColDragLeave);
    col.addEventListener('drop',      onWeekColDrop);

    colsWrap.appendChild(col);
  }
  scroll.appendChild(colsWrap);
  container.appendChild(scroll);

  rebuildWeekTimeAxis();
}

function rebuildWeekTimeAxis() {
  const axis = document.getElementById('weekTimeAxis');
  if (!axis) return;
  axis.innerHTML = '';

  const { interval, hourH } = ZOOM_LEVELS[zoomIdx];
  const cellH     = (interval / 60) * hourH;
  const totalMins = (WEEK_DISPLAY_END_H - WEEK_DISPLAY_START_H) * 60;
  const numCells  = Math.ceil(totalMins / interval);

  for (let i = 0; i < numCells; i++) {
    const m   = i * interval;
    const h   = WEEK_DISPLAY_START_H + Math.floor(m / 60);
    const min = m % 60;
    const lbl = document.createElement('div');
    lbl.className    = 'time-label';
    lbl.style.height = `${cellH}px`;
    if (cellH >= 14 && h < WEEK_DISPLAY_END_H) {
      lbl.textContent = min === 0 ? hourLabel(h) : formatSubHourTime(h, min);
    }
    axis.appendChild(lbl);
  }
}

// ── Render week view (called on navigation or mode switch) ────────────────────

function renderWeekView() {
  const todayStr  = todayKey();
  const now       = new Date();
  const nowHour   = now.getHours() + now.getMinutes() / 60;
  const totalPx   = (WEEK_DISPLAY_END_H - WEEK_DISPLAY_START_H) * HOUR_H;
  const { interval, hourH } = ZOOM_LEVELS[zoomIdx];
  const cellH     = (interval / 60) * hourH;
  const numCells  = Math.ceil((WEEK_DISPLAY_END_H - WEEK_DISPLAY_START_H) * 60 / interval);

  for (let i = 0; i < 7; i++) {
    const d      = new Date(weekViewAnchor);
    d.setDate(d.getDate() + i);
    const dayStr = dateKey(d);
    const isToday = dayStr === todayStr;

    // Update column header
    const hdr = document.getElementById(`wkHdr${i}`);
    if (hdr) {
      hdr.innerHTML = `<span class="wk-hdr-name">${WK_DAY_ABBRS[i]}</span><span class="wk-hdr-num">${d.getDate()}</span>`;
      hdr.classList.toggle('week-day-header--today', isToday);
    }

    // Rebuild column
    const col = document.getElementById(`wkCol${i}`);
    if (!col) continue;
    col.innerHTML    = '';
    col.dataset.day  = dayStr;
    col.style.height = `${totalPx}px`;
    col.classList.toggle('week-col--today', isToday);

    // Hour-cell grid lines
    const frag = document.createDocumentFragment();
    for (let j = 0; j < numCells; j++) {
      const cell = document.createElement('div');
      cell.className    = 'hour-cell' + ((j * interval) % 60 === 0 ? ' hour-boundary' : '');
      cell.style.height = `${cellH}px`;
      frag.appendChild(cell);
    }
    col.appendChild(frag);

    // Rise & Shine marker
    const riseStr = riseTimes[dayStr] || hhmm24ToTagFormat(appSettings.riseAndShine);
    const riseH   = parseTimeStr(riseStr);
    if (riseH >= WEEK_DISPLAY_START_H && riseH < WEEK_DISPLAY_END_H) {
      const mk = document.createElement('div');
      mk.className  = 'week-marker week-marker--rise';
      mk.style.top  = `${(riseH - WEEK_DISPLAY_START_H) * HOUR_H}px`;
      col.appendChild(mk);
    }

    // Lights Out marker
    const lightsStr = lightsTimes[dayStr] || hhmm24ToTagFormat(appSettings.lightsOut);
    const lightsH   = parseTimeStr(lightsStr);
    if (lightsH >= WEEK_DISPLAY_START_H && lightsH < WEEK_DISPLAY_END_H) {
      const mk = document.createElement('div');
      mk.className  = 'week-marker week-marker--lights';
      mk.style.top  = `${(lightsH - WEEK_DISPLAY_START_H) * HOUR_H}px`;
      col.appendChild(mk);
    }

    // Blocks for this day
    _loadWeekBlocksForCol(dayStr, col);
  }

  updateWeekActiveBlock();
  updateWeekNavTitle();

  // Scroll to calendar-start-hour setting
  const scroll = document.getElementById('weekScroll');
  if (scroll) {
    const target = Math.max(WEEK_DISPLAY_START_H,
      Math.min(WEEK_DISPLAY_END_H - 1, appSettings.calendarStartHour));
    scroll.scrollTop = (target - WEEK_DISPLAY_START_H) * HOUR_H;
  }
}

function _loadWeekBlocksForCol(day, col) {
  try {
    const raw = localStorage.getItem(BLOCKS_KEY);
    if (!raw) return;
    JSON.parse(raw)
      .filter(b => b.day === day)
      .forEach(b => _createWeekBlock(b, col));
  } catch (e) {}
}

function _createWeekBlock(data, col) {
  const dur   = Math.max(5 / 60, parseFloat(data.duration) || 1);
  const sHour = parseFloat(data.startHour) || WEEK_DISPLAY_START_H;
  const topPx = (sHour - WEEK_DISPLAY_START_H) * HOUR_H;
  const hPx   = dur * HOUR_H - 2;

  if (topPx >= (WEEK_DISPLAY_END_H - WEEK_DISPLAY_START_H) * HOUR_H) return;

  const label = data.label || '';
  const block = document.createElement('div');
  block.className        = `wk-block block-${data.cat}${data.actId ? ` block-act-${data.actId}` : ''}`;
  block.dataset.id       = data.id || '';
  block.dataset.day      = data.day;
  block.dataset.startHour = sHour;
  block.dataset.duration = dur;
  block.dataset.label    = label;
  block.dataset.cat      = data.cat;
  block.dataset.actId    = data.actId || '';

  block.style.top    = `${topPx}px`;
  block.style.height = `${hPx}px`;

  // Name only — columns are too narrow for time range text
  block.innerHTML = `<div class="block-time-tint" style="background:${getTimeTint(sHour)}"></div><div class="resize-handle-top"></div><span class="block-name">${label}</span><span class="block-dur">${timeRangeLabel(sHour, dur)}</span><span class="block-dur-badge">${durLabel(dur)}</span><div class="resize-handle"></div>`;

  if (hPx < 42) block.classList.add('block--compact');
  if (hPx < 30) block.classList.add('block--tiny');
  if (hPx < 36) block.classList.add('block--no-badge');

  block.querySelector('.resize-handle-top').addEventListener('pointerdown', e => {
    e.preventDefault();
    e.stopPropagation();
    _capturePointer(e.currentTarget, e.pointerId);
    block.style.transition = 'none';
    activeResize = {
      block,
      type: 'top',
      startY: e.clientY,
      startTop: parseFloat(block.style.top),
      startH: block.offsetHeight + 2,
      endHour: parseFloat(block.dataset.startHour) + parseFloat(block.dataset.duration),
    };
    document.body.classList.add('is-resizing');
  });

  block.querySelector('.resize-handle').addEventListener('pointerdown', e => {
    e.preventDefault();
    e.stopPropagation();
    _capturePointer(e.currentTarget, e.pointerId);
    block.style.transition = 'none';
    activeResize = { block, type: 'bottom', startY: e.clientY, startH: block.offsetHeight + 2 };
    document.body.classList.add('is-resizing');
  });

  block.addEventListener('contextmenu', e => _showWeekBlockCtxMenu(e, block));
  block.addEventListener('pointerdown', _onWkBlockPointerDown);
  col.appendChild(block);
}

// ── Library-chip → week-column drag-and-drop ──────────────────────────────────

// renderWeekView() clears each column's innerHTML on every render, which removes
// the .drop-indicator added in buildWeekBody(). Get-or-create it so the handlers
// work regardless of how many times the column has been re-rendered.
function _weekColIndicator(col) {
  let ind = col.querySelector('.drop-indicator');
  if (!ind) {
    ind = document.createElement('div');
    ind.className = 'drop-indicator';
    col.appendChild(ind);
  }
  return ind;
}

function onWeekColDragOver(e) {
  if (!activeDrag) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';

  const col  = e.currentTarget;
  const hour = _wkYToHour(col, e.clientY);
  const top  = (hour - WEEK_DISPLAY_START_H) * HOUR_H;

  const ind = _weekColIndicator(col);
  ind.className     = `drop-indicator ind-${activeDrag.cat}`;
  ind.style.top     = `${top}px`;
  ind.style.display = 'block';
  col.classList.add('drag-active');
}

function onWeekColDragLeave(e) {
  const col = e.currentTarget;
  if (col.contains(e.relatedTarget)) return;
  col.classList.remove('drag-active');
  const ind = col.querySelector('.drop-indicator');
  if (ind) ind.style.display = 'none';
}

function onWeekColDrop(e) {
  e.preventDefault();
  const col = e.currentTarget;
  col.classList.remove('drag-active');
  const ind = col.querySelector('.drop-indicator');
  if (ind) ind.style.display = 'none';

  const act = activeDrag;
  activeDrag = null;
  isDraggingFromLibrary = false;
  if (!act) return;

  const day  = col.dataset.day;
  const hour = _wkYToHour(col, e.clientY);

  if (act.popup) {
    pendingDrop = { day, hour };
    pendingAct  = act;
    openModal(act);
  } else {
    const newBlockData = {
      id:        uid(),
      day:       col.dataset.day,
      startHour: hour,
      duration:  appSettings.defaultBlockDuration / 60,
      label:     act.name,
      cat:       act.cat,
      actId:     act.id,
      items:     null,
    };

    // Persist manually — saveBlocks() rebuilds from the day view's DOM, which is
    // not what's on screen in week view, so it would clobber the new block.
    try {
      const raw = localStorage.getItem(BLOCKS_KEY);
      const all = raw ? JSON.parse(raw) : [];
      all.push(newBlockData);
      localStorage.setItem(BLOCKS_KEY, JSON.stringify(all));
    } catch (err) {}

    // Render just this one block — _loadWeekBlocksForCol would duplicate the
    // blocks already present in the column.
    _createWeekBlock(newBlockData, col);
  }

  document.querySelectorAll('.week-col.drag-active').forEach(c => {
    c.classList.remove('drag-active');
    const i = c.querySelector('.drop-indicator');
    if (i) i.style.display = 'none';
  });
}

// ── Week cross-column drag-to-copy ────────────────────────────────────────────

function _wkYToHour(col, clientY) {
  const rect = col.getBoundingClientRect();
  const raw  = (clientY - rect.top) / HOUR_H + WEEK_DISPLAY_START_H;
  return Math.max(WEEK_DISPLAY_START_H, Math.min(WEEK_DISPLAY_END_H, raw));
}

function _onWkBlockPointerDown(e) {
  if (e.target.closest('.block-name-input')) return;
  if (e.target.closest('.resize-handle') || e.target.closest('.resize-handle-top')) return;

  const block = e.currentTarget;

  if (e.pointerType === 'mouse') {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    _beginWkBlockDrag(block, e.clientX, e.clientY);
    return;
  }

  armTouchLongPress(e, (sx, sy, pid) => {
    _capturePointer(block, pid);
    _beginWkBlockDrag(block, sx, sy);
  });
}

function _beginWkBlockDrag(block, clientX, clientY) {
  const rect = block.getBoundingClientRect();

  activeWkCrossDrag = {
    block,
    sourceCol:    block.parentElement,
    startX:       clientX,
    startY:       clientY,
    startTime:    Date.now(),
    offsetX:      clientX - rect.left,
    offsetY:      clientY - rect.top,
    active:       false,
    ghost:        null,
    snapLine:     null,
    currentDestCol: null,
    modeDecided:  false,
  };
}

function _beginWkCrossDrag(drag, e) {
  drag.active = true;
  document.body.classList.add('is-wk-cross-dragging');

  const srcRect = drag.block.getBoundingClientRect();
  const ghost   = drag.block.cloneNode(true);
  ghost.style.position      = 'fixed';
  ghost.style.width         = `${srcRect.width}px`;
  ghost.style.height        = `${srcRect.height}px`;
  ghost.style.left          = `${e.clientX - drag.offsetX}px`;
  ghost.style.top           = `${e.clientY - drag.offsetY}px`;
  ghost.style.opacity       = '0.75';
  ghost.style.pointerEvents = 'none';
  ghost.style.zIndex        = '9999';
  document.body.appendChild(ghost);
  drag.ghost = ghost;
}

function _handleWkCrossDragMove(e) {
  const drag = activeWkCrossDrag;

  if (!drag.modeDecided) {
    const dx = Math.abs(e.clientX - drag.startX);
    const dy = Math.abs(e.clientY - drag.startY);
    if (Math.max(dx, dy) < 8) return;
    drag.modeDecided = true;
    if (dy > dx) {
      // Vertical → within-column move
      activeWkInColDrag = {
        block:       drag.block,
        col:         drag.sourceCol,
        offsetY:     drag.offsetY,
        originalTop: parseFloat(drag.block.style.top),
      };
      activeWkCrossDrag = null;
      document.body.classList.add('is-wk-incol-dragging');
      return;
    }
    // Horizontal → cross-column copy
    _beginWkCrossDrag(drag, e);
  }

  if (!drag.active) return;

  drag.ghost.style.left = `${e.clientX - drag.offsetX}px`;
  drag.ghost.style.top  = `${e.clientY - drag.offsetY}px`;

  const underEl   = document.elementFromPoint(e.clientX, e.clientY);
  const targetCol = underEl?.closest('.week-col') || null;

  // Clear all column highlights and previous snap line
  document.querySelectorAll('.week-col').forEach(c => c.style.background = '');
  if (drag.snapLine) { drag.snapLine.remove(); drag.snapLine = null; }

  if (targetCol && targetCol !== drag.sourceCol) {
    targetCol.style.background = 'rgba(155,114,207,0.08)';

    const colRect  = targetCol.getBoundingClientRect();
    const snapLine = document.createElement('div');
    snapLine.style.cssText =
      'position:absolute;left:0;right:0;height:1px;' +
      'background:rgba(155,114,207,0.5);pointer-events:none;z-index:100;' +
      `top:${e.clientY - colRect.top}px`;
    targetCol.appendChild(snapLine);
    drag.snapLine        = snapLine;
    drag.currentDestCol  = targetCol;
  } else {
    drag.currentDestCol = null;
  }

  if (drag.ghost && drag.currentDestCol) {
    const ghostDurEl = drag.ghost.querySelector('.block-dur');
    if (ghostDurEl) {
      const previewHour = _wkYToHour(drag.currentDestCol, e.clientY - drag.offsetY);
      const dur = parseFloat(drag.block.dataset.duration);
      ghostDurEl.textContent = timeRangeLabel(previewHour, dur);
    }
  }
}

function _handleWkCrossDragEnd(e) {
  const drag    = activeWkCrossDrag;
  activeWkCrossDrag = null;

  drag.block.style.touchAction = '';
  document.body.classList.remove('is-wk-cross-dragging');
  if (drag.ghost)    { drag.ghost.remove(); }
  if (drag.snapLine) { drag.snapLine.remove(); }
  document.querySelectorAll('.week-col').forEach(c => c.style.background = '');

  if (!drag.active) return;

  const underEl = document.elementFromPoint(e.clientX, e.clientY);
  const destCol = underEl?.closest('.week-col') || null;
  if (!destCol || destCol === drag.sourceCol) return;

  const startHour = _wkYToHour(destCol, e.clientY - drag.offsetY);
  const duration  = parseFloat(drag.block.dataset.duration);
  const destDay   = destCol.dataset.day;

  const newBlock = {
    id:        `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    day:       destDay,
    startHour,
    duration,
    label:     drag.block.dataset.label,
    cat:       drag.block.dataset.cat,
    actId:     drag.block.dataset.actId || '',
    items:     drag.block.dataset.items ? JSON.parse(drag.block.dataset.items) : null,
  };

  try {
    const raw = localStorage.getItem(BLOCKS_KEY);
    const all = raw ? JSON.parse(raw) : [];
    all.push(newBlock);
    localStorage.setItem(BLOCKS_KEY, JSON.stringify(all));
  } catch (ex) {}

  destCol.querySelectorAll('.wk-block').forEach(b => b.remove());
  _loadWeekBlocksForCol(destDay, destCol);
}

function _handleWkInColDragMove(e) {
  const { block, col, offsetY } = activeWkInColDrag;
  const rect   = col.getBoundingClientRect();
  const newTop = Math.max(0, Math.min(
    (WEEK_DISPLAY_END_H - WEEK_DISPLAY_START_H) * HOUR_H - block.offsetHeight,
    e.clientY - rect.top - offsetY
  ));
  block.style.top = `${newTop}px`;
  const newHour = newTop / HOUR_H + WEEK_DISPLAY_START_H;
  const dur = parseFloat(block.dataset.duration);
  const s = block.querySelector('.block-dur');
  if (s) s.textContent = timeRangeLabel(newHour, dur);
}

function _handleWkInColDragEnd(e) {
  const { block } = activeWkInColDrag;
  activeWkInColDrag = null;
  block.style.touchAction = '';
  document.body.classList.remove('is-wk-incol-dragging');
  const newTop  = parseFloat(block.style.top);
  const newHour = newTop / HOUR_H + WEEK_DISPLAY_START_H;
  block.dataset.startHour = newHour;
  updateBlockTimeTint(block);
  try {
    const raw = localStorage.getItem(BLOCKS_KEY);
    if (raw) {
      const all = JSON.parse(raw);
      const idx = all.findIndex(b => b.id === block.dataset.id);
      if (idx !== -1) {
        all[idx].startHour = newHour;
        localStorage.setItem(BLOCKS_KEY, JSON.stringify(all));
      }
    }
  } catch(ex) {}
}

function _cancelWkCrossDrag() {
  if (activeWkInColDrag) {
    const { block, originalTop } = activeWkInColDrag;
    activeWkInColDrag = null;
    document.body.classList.remove('is-wk-incol-dragging');
    block.style.top = `${originalTop}px`;
    return;
  }
  if (!activeWkCrossDrag) return;
  const drag    = activeWkCrossDrag;
  activeWkCrossDrag = null;
  document.body.classList.remove('is-wk-cross-dragging');
  if (drag.ghost)    { drag.ghost.remove(); }
  if (drag.snapLine) { drag.snapLine.remove(); }
  document.querySelectorAll('.week-col').forEach(c => c.style.background = '');
}

// ── Week block context menu ───────────────────────────────────────────────────

function _showWeekBlockCtxMenu(e, block) {
  e.preventDefault();
  e.stopPropagation();
  hideBlockContextMenu();

  const menu = document.createElement('div');
  menu.className  = 'block-ctx-menu';
  menu.style.left = `${e.clientX}px`;
  menu.style.top  = `${e.clientY}px`;

  const editItem = document.createElement('div');
  editItem.className   = 'block-ctx-item block-ctx-item--edit';
  editItem.textContent = 'Edit';
  editItem.addEventListener('mousedown', ev => ev.stopPropagation());
  editItem.addEventListener('click', () => {
    hideBlockContextMenu();
    _activateWeekBlockEdit(block);
  });

  const delItem = document.createElement('div');
  delItem.className   = 'block-ctx-item block-ctx-item--del';
  delItem.textContent = 'Delete';
  delItem.addEventListener('mousedown', ev => ev.stopPropagation());
  delItem.addEventListener('click', () => {
    const id = block.dataset.id;
    block.remove();
    try {
      const raw = localStorage.getItem(BLOCKS_KEY);
      if (raw) {
        localStorage.setItem(BLOCKS_KEY,
          JSON.stringify(JSON.parse(raw).filter(b => b.id !== id)));
      }
    } catch (ex) {}
    hideBlockContextMenu();
  });

  menu.appendChild(editItem);
  menu.appendChild(delItem);
  document.body.appendChild(menu);
  _ctxMenu = menu;

  requestAnimationFrame(() => {
    const r = menu.getBoundingClientRect();
    if (r.right  > window.innerWidth)  menu.style.left = `${e.clientX - r.width}px`;
    if (r.bottom > window.innerHeight) menu.style.top  = `${e.clientY - r.height}px`;
  });
}

function _activateWeekBlockEdit(block) {
  const nameSpan = block.querySelector('.block-name');
  if (!nameSpan) return;

  const original = block.dataset.label;
  let done = false;

  const input = document.createElement('input');
  input.className = 'block-name-input';
  input.value     = original;
  nameSpan.replaceWith(input);
  input.focus();
  input.select();

  const commit = () => {
    if (done) return;
    done = true;
    const newName = input.value.trim() || original;
    block.dataset.label = newName;
    const span = document.createElement('span');
    span.className   = 'block-name';
    span.textContent = newName;
    if (input.parentNode) input.replaceWith(span);
    try {
      const raw = localStorage.getItem(BLOCKS_KEY);
      if (raw) {
        const all = JSON.parse(raw);
        const idx = all.findIndex(b => b.id === block.dataset.id);
        if (idx !== -1) { all[idx].label = newName; localStorage.setItem(BLOCKS_KEY, JSON.stringify(all)); }
      }
    } catch (ex) {}
  };

  const cancel = () => {
    if (done) return;
    done = true;
    const span = document.createElement('span');
    span.className   = 'block-name';
    span.textContent = original;
    if (input.parentNode) input.replaceWith(span);
  };

  input.addEventListener('mousedown', ev => ev.stopPropagation());
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { cancel(); }
  });
  input.addEventListener('blur', commit);
}

// ── Week active-block highlighter ─────────────────────────────────────────────

function updateWeekActiveBlock() {
  const todayStr = todayKey();
  const now      = new Date();
  const nowHour  = now.getHours() + now.getMinutes() / 60;
  document.querySelectorAll('.wk-block').forEach(block => {
    const isToday = block.dataset.day === todayStr;
    const start   = parseFloat(block.dataset.startHour);
    const dur     = parseFloat(block.dataset.duration);
    const active  = isToday && nowHour >= start && nowHour < start + dur;
    block.classList.toggle('block--active', active);
  });
}
