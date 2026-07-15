// auth.js — Firebase authentication + cross-device data sync for Productive.
//
// Strategy (see plan): the app boots from window.bootApp() and reads all state
// from localStorage. We gate the app behind a login screen, hydrate localStorage
// from the user's Firestore doc BEFORE booting, and mirror every localStorage
// write back to Firestore (debounced) so all devices stay in sync.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signOut,
  GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  signInWithEmailAndPassword, createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, onSnapshot, runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── The localStorage keys we sync (must match the keys used in app.js) ────────
const SYNC_KEYS = [
  'productive-v3-blocks',
  'productive-v2-reminders',
  'productive-v3-rise-times',
  'productive-v3-lights-times',
  'productive-v1-custom-acts',
  'productive-v1-deleted-acts',
  'simsi-v1-day-ranges',
  'simsi-goals',
  'simsi-countdowns',
  'simsi-habits',
  'simsi-settings',
  'simsi-view-mode',
  'simsi-bg-index',
  'simsi-sidebar-collapsed',
  'simsi-library-open'
];

// localStorage key that tracks when local data was last changed (a Date.now()
// millisecond number). Used for timestamp-based conflict resolution so stale
// data can never overwrite newer data in Firestore.
const LAST_MODIFIED_KEY = 'simsi-last-modified';

function getLocalLastModified() {
  const v = Number(localStorage.getItem(LAST_MODIFIED_KEY));
  return Number.isFinite(v) && v > 0 ? v : 0;
}

const app  = initializeApp(window.__FIREBASE_CONFIG__);
const auth = getAuth(app);
const db   = getFirestore(app);

const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

let currentUid = null;
let booted     = false;
let hydrating  = false;   // suppress write-mirroring while we load cloud data
let pushTimer  = null;
let unsubSnapshot = null;  // onSnapshot() cleanup fn for the real-time listener

// ── Write mirroring: wrap localStorage.setItem so every tracked write pushes ──
// to Firestore (debounced). Installed once, before the app boots.
const _setItem = Storage.prototype.setItem;
Storage.prototype.setItem = function (key, value) {
  _setItem.call(this, key, value);
  if (this === window.localStorage && !hydrating && currentUid && SYNC_KEYS.includes(key)) {
    // Record when local data changed so the sync transaction can tell whether
    // our data is newer than the cloud's. Written via _setItem so it doesn't
    // recurse through this wrapper.
    _setItem.call(window.localStorage, LAST_MODIFIED_KEY, String(Date.now()));
    schedulePush();
  }
};

function schedulePush() {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(pushToCloud, 1500);
}

async function pushToCloud() {
  if (!currentUid) return;
  const payload = {};
  for (const key of SYNC_KEYS) {
    const v = localStorage.getItem(key);
    if (v !== null) payload[key] = v;
  }
  // The timestamp of our local data (set whenever the user changes something).
  const localLM = getLocalLastModified() || Date.now();
  const ref = doc(db, 'users', currentUid);

  // Run the write inside a transaction with timestamp-based conflict resolution
  // so a device holding stale data can never clobber newer cloud data. We only
  // decide inside the transaction (it may be retried on contention); any UI /
  // localStorage side effects happen afterwards.
  let staleRemote = null;
  try {
    await runTransaction(db, async (tx) => {
      staleRemote = null;
      const snap = await tx.get(ref);
      const remote = snap.exists() ? (snap.data() || {}) : {};
      const remoteLM = Number(remote.lastModified) || 0;
      if (localLM >= remoteLM) {
        // Local is newer or equal → write local data (plus its timestamp).
        tx.set(ref, { ...payload, lastModified: localLM }, { merge: true });
      } else {
        // Cloud is newer → abort our write and pull the cloud data down instead.
        staleRemote = remote;
      }
    });
    if (staleRemote) applyCloudData(staleRemote);
  } catch (err) {
    console.error('[sync] push failed', err);
  }
}

// Pull a Firestore document into localStorage key by key, sync the local
// last-modified marker to the cloud's, and re-render the affected UI without a
// page reload. Used when a push aborts because the cloud held newer data.
function applyCloudData(data) {
  const changed = new Set();
  // Suppress write-mirroring while we copy (reusing the hydrate guard); we also
  // write via _setItem so these copies never bounce back to the cloud.
  hydrating = true;
  try {
    for (const key of SYNC_KEYS) {
      const incoming = data[key];
      if (typeof incoming !== 'string') continue;
      if (localStorage.getItem(key) !== incoming) {
        _setItem.call(window.localStorage, key, incoming);
        changed.add(key);
      }
    }
    const remoteLM = Number(data.lastModified) || 0;
    _setItem.call(window.localStorage, LAST_MODIFIED_KEY, String(remoteLM));
  } finally {
    hydrating = false;
  }
  if (changed.size) applyRemoteChanges(changed);
}

// Immediate (non-debounced) flush of localStorage to Firestore. Used by the
// Import Backup flow so imported data reaches the cloud before the page reloads
// (otherwise the reload's hydrate would overwrite it). No-ops when signed out.
window.__syncPushNow = pushToCloud;

// ── Hydrate localStorage from the user's Firestore doc ────────────────────────
async function hydrateFromCloud(uid) {
  const ref  = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  hydrating = true;
  try {
    if (snap.exists()) {
      const data = snap.data() || {};
      for (const key of SYNC_KEYS) {
        if (typeof data[key] === 'string') {
          localStorage.setItem(key, data[key]);
        } else {
          // Key absent in cloud → clear any stale local-only value so devices converge.
          localStorage.removeItem(key);
        }
      }
      // Match the local marker to whatever timestamp the cloud carried, so the
      // first post-load sync compares against a truthful baseline.
      const remoteLM = Number(data.lastModified);
      _setItem.call(window.localStorage, LAST_MODIFIED_KEY,
        String(Number.isFinite(remoteLM) ? remoteLM : Date.now()));
    } else {
      // First-ever login for this account: seed the cloud doc from whatever is
      // already in localStorage (migrates existing local data into the cloud).
      const payload = {};
      for (const key of SYNC_KEYS) {
        const v = localStorage.getItem(key);
        if (v !== null) payload[key] = v;
      }
      const seedLM = getLocalLastModified() || Date.now();
      payload.lastModified = seedLM;
      await setDoc(ref, payload, { merge: true });
      _setItem.call(window.localStorage, LAST_MODIFIED_KEY, String(seedLM));
    }
  } finally {
    hydrating = false;
  }
}

// ── Real-time sync: apply REMOTE changes pushed from other devices ────────────
// After boot we listen on the user's Firestore doc with onSnapshot. When another
// device writes, we copy the changed values into localStorage and re-render only
// the affected sections. The app.js render functions read from in-memory copies
// of the data, so we first reload that in-memory state via the existing load*()
// functions, then call the exact render functions. All of these are global
// functions declared in app.js (loaded as a classic <script>).

// Keys that feed the day/week schedule view.
const SCHEDULE_KEYS = new Set([
  'productive-v3-blocks',
  'productive-v2-reminders',
  'productive-v3-rise-times',
  'productive-v3-lights-times',
  'productive-v1-custom-acts',
  'productive-v1-deleted-acts',
  'simsi-v1-day-ranges',
  'simsi-view-mode'
]);

function applyRemoteChanges(changed) {
  // Reload in-memory state from localStorage for whatever changed, then
  // re-render only the sections whose data actually changed.
  let scheduleChanged = false;
  for (const key of changed) {
    if (SCHEDULE_KEYS.has(key)) { scheduleChanged = true; break; }
  }

  if (scheduleChanged) {
    window.loadDayRanges?.();
    window.loadCustomActivities?.();
    window.loadDeletedActs?.();
    window.loadTimes?.();
    window.loadReminders?.();
    window.loadBlocks?.();
    // Re-render whichever view is currently active (day or week).
    const weekActive =
      document.querySelector('.view-mode-btn--active')?.dataset.mode === 'week';
    if (weekActive) window.renderWeekView?.();
    else            window.renderCurrentDay?.();
  }

  if (changed.has('simsi-habits')) {
    window.loadHabits?.();
    window.renderHabitsGrid?.();
  }

  if (changed.has('simsi-goals')) {
    window.loadGoals?.();
    window.renderGoalsGrid?.();
  }

  if (changed.has('simsi-countdowns')) {
    window.loadCountdowns?.();       // reloads countdownsData and re-renders the widget
    window.renderCountdownsWidget?.();
  }

  if (changed.has('simsi-settings')) {
    window.loadSettings?.();   // loadSettings() reloads appSettings and calls applySettings()
  }
}

function startRealtimeSync(uid) {
  if (unsubSnapshot) return;   // already listening
  unsubSnapshot = onSnapshot(
    doc(db, 'users', uid),
    (snapshot) => {
      // ECHO PREVENTION: skip snapshots caused by this device's own writes.
      if (snapshot.metadata.hasPendingWrites) return;
      if (!snapshot.exists()) return;

      const data = snapshot.data() || {};

      // TIMESTAMP CONFLICT RESOLUTION (read path). pushToCloud() already refuses
      // to overwrite newer cloud data; we must apply the mirror rule here or the
      // two paths disagree. A local edit bumps LAST_MODIFIED immediately but only
      // pushes after a 1.5s debounce, so during that window the cloud still holds
      // the PRE-edit data. A snapshot carrying that stale data (the server-ack of
      // an in-flight earlier/auto-save push, or another device) would otherwise
      // clobber the fresh local edit and visibly revert it. Apply a snapshot only
      // when the cloud is strictly newer than our local data; ties favour local,
      // exactly as the write path does (localLM >= remoteLM lets local win).
      const remoteLM = Number(data.lastModified) || 0;
      if (remoteLM <= getLocalLastModified()) return;

      const changed = new Set();

      // Copy changed values into localStorage. Suppress write-mirroring while we
      // do so (reusing the hydrate guard) to avoid pushing the data straight back.
      hydrating = true;
      try {
        for (const key of Object.keys(data)) {
          const incoming = data[key];
          if (typeof incoming !== 'string') continue;
          if (localStorage.getItem(key) !== incoming) {
            localStorage.setItem(key, incoming);
            changed.add(key);
          }
        }
        // Keep the local marker in step with the cloud's timestamp so this
        // device won't later mistake its data for being newer than it is.
        // (remoteLM is guaranteed finite and > local by the guard above.)
        _setItem.call(window.localStorage, LAST_MODIFIED_KEY, String(remoteLM));
      } finally {
        hydrating = false;
      }

      if (changed.size) applyRemoteChanges(changed);
    },
    (err) => {
      console.error('[sync] realtime listener failed', err);
    }
  );
}

function stopRealtimeSync() {
  if (unsubSnapshot) {
    unsubSnapshot();
    unsubSnapshot = null;
  }
}

// ── Auto-save (background) + Canva-style status indicator ─────────────────────
// Every AUTOSAVE_INTERVAL ms while signed in, we push localStorage to Firestore
// via the existing pushToCloud() and reflect progress in a subtle indicator that
// sits just above the Reminders section. This is purely additive: it reuses the
// existing sync path and never touches the conflict-resolution logic.
const AUTOSAVE_INTERVAL = 180000;   // 3 minutes
let autoSaveTimer     = null;
let saveStatusEl      = null;
let saveStatusHideTimer = null;

// Inject the indicator once, just above the Reminders section in the sidebar.
function mountSaveStatus() {
  if (saveStatusEl) return;
  const anchor = document.querySelector('.sidebar-bottom .reminders-section');
  if (!anchor) return;
  saveStatusEl = document.createElement('div');
  saveStatusEl.id = 'autoSaveStatus';
  saveStatusEl.className = 'autosave-status';
  anchor.parentNode.insertBefore(saveStatusEl, anchor);
}

function unmountSaveStatus() {
  if (saveStatusHideTimer) { clearTimeout(saveStatusHideTimer); saveStatusHideTimer = null; }
  if (saveStatusEl) { saveStatusEl.remove(); saveStatusEl = null; }
}

// state: 'saving' | 'saved' | 'failed'
function showSaveStatus(state) {
  if (!saveStatusEl) return;
  if (saveStatusHideTimer) { clearTimeout(saveStatusHideTimer); saveStatusHideTimer = null; }

  if (state === 'saving') {
    saveStatusEl.textContent = 'Saving...';
    saveStatusEl.classList.remove('is-failed');
    saveStatusEl.classList.add('is-visible');
  } else if (state === 'saved') {
    saveStatusEl.textContent = 'Saved ✓';
    saveStatusEl.classList.remove('is-failed');
    saveStatusEl.classList.add('is-visible');
    // After 3s, fade out (opacity transition) and stay hidden until next cycle.
    saveStatusHideTimer = setTimeout(() => {
      if (saveStatusEl) saveStatusEl.classList.remove('is-visible');
      saveStatusHideTimer = null;
    }, 3000);
  } else if (state === 'failed') {
    saveStatusEl.textContent = 'Save failed';
    saveStatusEl.classList.add('is-failed', 'is-visible');
  }
}

async function autoSave() {
  if (!currentUid) return;   // not signed in → skip silently
  showSaveStatus('saving');
  try {
    if (navigator.onLine === false) throw new Error('offline');
    await pushToCloud();
    showSaveStatus('saved');
  } catch (_) {
    showSaveStatus('failed');
  }
}

function startAutoSave() {
  if (autoSaveTimer) return;   // already running
  mountSaveStatus();
  autoSaveTimer = setInterval(autoSave, AUTOSAVE_INTERVAL);
}

function stopAutoSave() {
  if (autoSaveTimer) { clearInterval(autoSaveTimer); autoSaveTimer = null; }
  unmountSaveStatus();
}

// ── UI helpers ────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

function showGate(show) {
  // auth-ready marks that Firebase has resolved the auth state; only then does
  // CSS reveal either the gate or the app (prevents a flash on reload).
  document.body.classList.add('auth-ready');
  document.body.classList.toggle('authed', !show);
}

function setAuthError(msg) {
  const el = $('authError');
  if (el) el.textContent = msg || '';
}

// Mode: 'signin' | 'signup'
let authMode = 'signin';
function applyAuthMode() {
  const title  = $('authTitle');
  const submit = $('authSubmitBtn');
  const toggle = $('authToggle');
  if (authMode === 'signin') {
    if (title)  title.textContent  = 'Sign in';
    if (submit) submit.textContent = 'Sign in';
    if (toggle) toggle.textContent = "Don't have an account? Create one";
  } else {
    if (title)  title.textContent  = 'Create account';
    if (submit) submit.textContent = 'Create account';
    if (toggle) toggle.textContent = 'Already have an account? Sign in';
  }
  setAuthError('');
}

function friendlyError(err) {
  const code = (err && err.code) || '';
  switch (code) {
    case 'auth/invalid-email':          return 'That email address looks invalid.';
    case 'auth/missing-password':       return 'Please enter a password.';
    case 'auth/weak-password':          return 'Password should be at least 6 characters.';
    case 'auth/email-already-in-use':   return 'An account already exists for that email.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':         return 'Incorrect email or password.';
    case 'auth/popup-closed-by-user':   return 'Sign-in was cancelled.';
    default:                            return (err && err.message) || 'Something went wrong.';
  }
}

// ── Wire up the login gate ────────────────────────────────────────────────────
function wireGate() {
  const googleBtn = $('authGoogleBtn');
  if (googleBtn) {
    googleBtn.addEventListener('click', async () => {
      setAuthError('');
      const provider = new GoogleAuthProvider();
      try {
        if (isMobile) {
          await signInWithRedirect(auth, provider);
        } else {
          await signInWithPopup(auth, provider);
        }
      } catch (err) {
        setAuthError(friendlyError(err));
      }
    });
  }

  const form = $('authForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      setAuthError('');
      const email = $('authEmail').value.trim();
      const pw    = $('authPassword').value;
      try {
        if (authMode === 'signin') {
          await signInWithEmailAndPassword(auth, email, pw);
        } else {
          await createUserWithEmailAndPassword(auth, email, pw);
        }
      } catch (err) {
        setAuthError(friendlyError(err));
      }
    });
  }

  const toggle = $('authToggle');
  if (toggle) {
    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      authMode = authMode === 'signin' ? 'signup' : 'signin';
      applyAuthMode();
    });
  }

  const signOutBtn = $('signOutBtn');
  if (signOutBtn) {
    signOutBtn.addEventListener('click', async () => {
      stopRealtimeSync();
      stopAutoSave();
      try { await signOut(auth); } catch (_) {}
      for (const key of SYNC_KEYS) localStorage.removeItem(key);
      location.reload();
    });
  }

  applyAuthMode();
}

// Surface any error returned from a mobile redirect sign-in.
getRedirectResult(auth).catch((err) => setAuthError(friendlyError(err)));

// ── Auth state → gate the app ─────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    currentUid = null;
    stopRealtimeSync();
    stopAutoSave();
    showGate(true);
    return;
  }

  currentUid = user.uid;
  try {
    await hydrateFromCloud(user.uid);
  } catch (err) {
    console.error('[sync] hydrate failed', err);
    setAuthError('Could not load your data. Check your connection and try again.');
    // Fall through and still boot so the app is usable offline.
  }

  const emailEl = $('accountEmail');
  if (emailEl) emailEl.textContent = user.email || user.displayName || 'Signed in';

  // Boot the app only after hydrateFromCloud() above has fully written the
  // user's cloud data into localStorage. Guard on bootApp being defined so we
  // don't mark booted before it can actually run.
  if (!booted && typeof window.bootApp === 'function') {
    booted = true;
    window.bootApp();
  }
  showGate(false);

  // Now that the app is booted, listen for changes made on other devices and
  // apply them live. Guarded so we only subscribe once per session.
  startRealtimeSync(user.uid);

  // Kick off the 3-minute background auto-save loop + mount the status indicator.
  startAutoSave();
});

// Wire the gate as soon as the DOM is ready.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', wireGate);
} else {
  wireGate();
}
