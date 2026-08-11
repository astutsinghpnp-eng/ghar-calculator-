// This file does NOT calculate anything — it only collects the inputs
// listed on the page and sends them to /api/estimate, then renders
// whatever comes back. All BOQ logic lives in api/estimate.js.

// =========================================================================
// App-level user ID — generated once on a visitor's first page load ever,
// persisted in localStorage, and used as the one stable identity across
// Mixpanel *and* any backend database added later (e.g. Supabase) —
// independent of whether/when they submit their name/email via the
// persona gate, and independent of any one analytics vendor's own ID
// scheme. Sent to /api/lead so a future database can key off it directly.
// =========================================================================
const USER_ID_KEY = 'gharUserId.v1';
function getOrCreateUserId() {
  let id = null;
  try { id = localStorage.getItem(USER_ID_KEY); } catch (e) { id = null; }
  if (id) return id;
  id = (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : ('u-' + Date.now() + '-' + Math.random().toString(36).slice(2));
  try { localStorage.setItem(USER_ID_KEY, id); } catch (e) { /* storage unavailable — id still usable for this page load */ }
  return id;
}
const USER_ID = getOrCreateUserId();

// =========================================================================
// Analytics (Mixpanel) — the loader snippet lives in index.html and defines
// window.mixpanel synchronously (even before the real library finishes
// loading async), so it's safe to call from here on page load. The project
// token is a public, write-only identifier — safe to hardcode client-side,
// unlike the backend API keys used elsewhere in this app. Get one from
// mixpanel.com → your project → Settings → Project Token, and paste it in
// below. Every track() call is guarded so a missing/blocked SDK (ad-
// blockers commonly block Mixpanel) never breaks the app.
//
// USER_ID (not Mixpanel's own device ID, and not email/phone) is the
// identity every event is tied to via identify(), from the very first
// page load — so even anonymous, pre-persona-gate activity is already
// attached to the same ID a submitted lead (and later, a database record)
// will use.
// =========================================================================
const MIXPANEL_TOKEN = '01053d385990b06546e663f83925eb4a';
if (window.mixpanel && MIXPANEL_TOKEN.indexOf('YOUR_') !== 0) {
  window.mixpanel.init(MIXPANEL_TOKEN, { track_pageview: true, persistence: 'localStorage' });
  window.mixpanel.identify(USER_ID);
  window.mixpanel.register({ userId: USER_ID });
}
function track(event, props) {
  try { if (window.mixpanel && window.mixpanel.track) window.mixpanel.track(event, props || {}); } catch (e) { /* analytics must never break the app */ }
}

// Attaches the name/email/etc a visitor actually submitted (via the
// persona-gate form) to their Mixpanel profile — as properties on the
// existing USER_ID identity, not as a new identity. Only call this with
// real submitted contact info; never with guessed/inferred data.
function identifyLead(persona, fields) {
  try {
    if (!window.mixpanel || !window.mixpanel.people || !window.mixpanel.people.set) return;
    const profile = { persona: persona, userId: USER_ID };
    if (fields.name) profile['$name'] = fields.name;
    if (fields.contact) {
      if (fields.contact.indexOf('@') !== -1) profile['$email'] = fields.contact;
      else profile['$phone'] = fields.contact;
    }
    if (fields.city) profile.city = fields.city;
    if (fields.companyName) profile.companyName = fields.companyName;
    if (fields.projectsPerYear) profile.projectsPerYear = fields.projectsPerYear;
    window.mixpanel.people.set(profile);
  } catch (e) { /* analytics must never break the app */ }
}

// =========================================================================
// Screen switching — the app is a small set of full-screen "views" inside
// #app-shell: simpleUpload (individual persona only), form, results, compare.
// =========================================================================
const screens = {
  simpleUpload: document.getElementById('screen-simple-upload'),
  form: document.getElementById('screen-form'),
  results: document.getElementById('screen-results'),
  compare: document.getElementById('screen-compare')
};
const navCalculatorLink = document.getElementById('nav-calculator');
const navCompareLink = document.getElementById('nav-compare');
let currentScreen = null;
// Which data-entry screen the "Calculator" nav link should return to —
// simpleUpload for a fresh individual visitor, form for business or once
// someone has used the "enter manually" escape hatch.
let lastEntryScreen = 'form';

function showScreen(name, opts) {
  opts = opts || {};
  Object.keys(screens).forEach(function (key) { screens[key].hidden = key !== name; });
  currentScreen = name;
  if (name === 'simpleUpload' || name === 'form') lastEntryScreen = name;

  const el = screens[name];
  // Restart the fade-up entrance animation every time a screen is shown,
  // not just on first paint — a class already present won't re-trigger.
  el.classList.remove('fade-up');
  void el.offsetWidth;
  el.classList.add('fade-up');

  navCalculatorLink.classList.toggle('active', name === 'form' || name === 'results' || name === 'simpleUpload');
  navCompareLink.classList.toggle('active', name === 'compare');

  if (!opts.preserveScroll) window.scrollTo({ top: 0, behavior: 'smooth' });
  if (opts.focus) el.focus({ preventScroll: true });

  track('Screen Viewed', { screen: name });
  if (name === 'form') track('Ghar Cost & Steel Estimator Viewed');
}

navCalculatorLink.addEventListener('click', function (e) {
  e.preventDefault();
  showScreen(lastEntryScreen);
});
navCompareLink.addEventListener('click', function (e) {
  e.preventDefault();
  renderCompare();
  showScreen('compare');
});

// =========================================================================
// Dust click effect — purely decorative. Clicking any button or link spawns
// a handful of small square particles that fly outward and fade.
// =========================================================================
const dustLayer = document.getElementById('dust-layer');

function spawnDust(x, y) {
  for (let i = 0; i < 9; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 18 + Math.random() * 42;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist;
    const rot = Math.round(Math.random() * 180 - 90) + 'deg';
    const duration = Math.round(450 + Math.random() * 250);
    const p = document.createElement('span');
    p.style.cssText = 'position:fixed;left:' + x + 'px;top:' + y + 'px;width:5px;height:5px;' +
      'background:' + (i % 2 ? 'var(--color-accent)' : 'var(--color-text)') + ';pointer-events:none;' +
      '--dx:' + dx + 'px;--dy:' + dy + 'px;--rot:' + rot + ';' +
      'animation:dustPop ' + duration + 'ms ease forwards;';
    dustLayer.appendChild(p);
    p.addEventListener('animationend', function () { p.remove(); });
  }
}

document.addEventListener('click', function (e) {
  const target = e.target.closest('button, a');
  if (!target) return;
  spawnDust(e.clientX, e.clientY);
});

// =========================================================================
// Persona intake gate — first-visit-required (persisted to localStorage
// after that): asks who the visitor is, captures contact details via
// /api/lead, then routes into the persona-appropriate screen.
// =========================================================================
const PERSONA_KEY = 'gharPersona.v1';
const gate = document.getElementById('persona-gate');
const stepChoose = document.getElementById('step-choose');
const stepIndividual = document.getElementById('step-details-individual');
const stepBusiness = document.getElementById('step-details-business');
const appShell = document.getElementById('app-shell');
const modeSwitchBtn = document.getElementById('mode-switch-btn');
const personaTag = document.getElementById('persona-tag');
const businessProjectBlock = document.getElementById('business-project-block');
let gateDismissible = false;

function showStep(step) {
  [stepChoose, stepIndividual, stepBusiness].forEach(function (s) { s.hidden = (s !== step); });
  const firstField = step.querySelector('input, button');
  if (firstField) firstField.focus();
}

function openGate(dismissible) {
  gateDismissible = !!dismissible;
  gate.hidden = false;
  // Hide the app underneath — otherwise a screen's own roof-triangle card
  // (e.g. the simple-upload screen) keeps rendering behind the gate's
  // roof-triangle backdrop and the two overlap into a double-roof glitch.
  appShell.hidden = true;
  showStep(stepChoose);
}

function closeGate() {
  gate.hidden = true;
  appShell.hidden = false;
}

function applyPersonaUI(persona) {
  const isBusiness = persona === 'business';
  personaTag.textContent = isBusiness ? 'Business' : 'Individual';
  personaTag.className = 'tag ' + (isBusiness ? 'tag-accent-2' : 'tag-accent');
  businessProjectBlock.hidden = !isBusiness;
  appShell.hidden = false;
}

function submitLead(persona, fields, statusEl, submitBtn, onDone) {
  statusEl.hidden = true;
  statusEl.textContent = '';
  submitBtn.disabled = true;
  const payload = Object.assign({ persona: persona, userId: USER_ID }, fields);
  fetch('/api/lead', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
    .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
    .then(function (result) {
      if (!result.ok) { throw new Error(result.data.error || 'Something went wrong.'); }
      try { localStorage.setItem(PERSONA_KEY, persona); } catch (e) { /* storage unavailable */ }
      identifyLead(persona, fields);
      track('Lead Submitted', { persona: persona });
      onDone();
    })
    .catch(function (err) {
      statusEl.hidden = false;
      statusEl.textContent = err.message + ' You can try again, or continue without saving your details.';
      track('Lead Submit Failed', { persona: persona });
      // A backend hiccup shouldn't permanently lock a real visitor out —
      // offer a way through after the first failed attempt, without ever
      // silently skipping the ask on a clean run.
      let continueBtn = statusEl.nextElementSibling;
      if (!continueBtn || !continueBtn.classList || !continueBtn.classList.contains('persona-continue-anyway')) {
        continueBtn = document.createElement('button');
        continueBtn.type = 'button';
        continueBtn.className = 'btn btn-ghost persona-continue-anyway';
        continueBtn.textContent = 'Continue without saving details';
        continueBtn.addEventListener('click', function () {
          try { localStorage.setItem(PERSONA_KEY, persona); } catch (e) { /* storage unavailable */ }
          identifyLead(persona, fields);
          track('Lead Skipped', { persona: persona });
          onDone();
        });
        statusEl.insertAdjacentElement('afterend', continueBtn);
      }
    })
    .finally(function () {
      submitBtn.disabled = false;
    });
}

function routeAfterGate(persona) {
  track('Persona Selected', { persona: persona });
  applyPersonaUI(persona);
  closeGate();
  if (persona === 'individual') {
    showScreen('simpleUpload');
  } else {
    showScreen('form');
  }
}

document.getElementById('choose-individual').addEventListener('click', function () { track('Persona Choice Clicked', { choice: 'individual' }); showStep(stepIndividual); });
document.getElementById('choose-business').addEventListener('click', function () { track('Persona Choice Clicked', { choice: 'business' }); showStep(stepBusiness); });
document.querySelectorAll('.persona-back').forEach(function (btn) {
  btn.addEventListener('click', function () { showStep(stepChoose); });
});

stepIndividual.addEventListener('submit', function (e) {
  e.preventDefault();
  track('Continue To Calculator Clicked', { persona: 'individual' });
  const fields = {
    name: document.getElementById('lead-name-i').value,
    contact: document.getElementById('lead-contact-i').value,
    city: document.getElementById('lead-city-i').value
  };
  submitLead('individual', fields, document.getElementById('persona-gate-status-i'), stepIndividual.querySelector('button[type="submit"]'), function () { routeAfterGate('individual'); });
});

stepBusiness.addEventListener('submit', function (e) {
  e.preventDefault();
  track('Continue To Calculator Clicked', { persona: 'business' });
  const fields = {
    name: document.getElementById('lead-name-b').value,
    contact: document.getElementById('lead-contact-b').value,
    companyName: document.getElementById('lead-company').value,
    projectsPerYear: document.getElementById('lead-projects').value
  };
  submitLead('business', fields, document.getElementById('persona-gate-status-b'), stepBusiness.querySelector('button[type="submit"]'), function () { routeAfterGate('business'); });
});

modeSwitchBtn.addEventListener('click', function () { track('Gate Reopened'); openGate(true); });

gate.addEventListener('click', function (e) {
  if (e.target === gate && gateDismissible) closeGate();
});
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && !gate.hidden && gateDismissible) closeGate();
});

// Boot: skip the gate entirely for a returning visitor who already chose,
// landing them straight on their persona's home screen.
(function () {
  let savedPersona = null;
  try { savedPersona = localStorage.getItem(PERSONA_KEY); } catch (e) { savedPersona = null; }
  track('App Loaded', { returning_visitor: !!savedPersona, persona: savedPersona || null });
  if (savedPersona === 'individual' || savedPersona === 'business') {
    applyPersonaUI(savedPersona);
    closeGate();
    showScreen(savedPersona === 'individual' ? 'simpleUpload' : 'form', { preserveScroll: true });
  } else {
    openGate(false);
  }
})();

document.getElementById('prefer-manual-btn').addEventListener('click', function () {
  track('Enter Manually Clicked');
  showScreen('form');
});

// =========================================================================
// Rooms list — the full-form screen's dynamic list of room length/width
// pairs. A row can always be added; the last remaining row can't be removed
// (the design always keeps at least one room row on screen).
// =========================================================================
const roomList = document.getElementById('room-list');
let roomIdCounter = 0;

function updateRemoveButtons() {
  const rows = roomList.querySelectorAll('.room-row');
  const onlyOne = rows.length <= 1;
  Array.prototype.forEach.call(rows, function (row) {
    row.querySelector('.remove-room').disabled = onlyOne;
  });
}

function addRoomRow(length, width) {
  roomIdCounter += 1;
  const n = roomIdCounter;
  const row = document.createElement('div');
  row.className = 'room-row';
  row.innerHTML =
    '<input class="input room-length" id="room-' + n + '-length" type="number" min="4" max="100" value="' + length + '" aria-label="Room length (ft)">' +
    '<input class="input room-width" id="room-' + n + '-width" type="number" min="4" max="100" value="' + width + '" aria-label="Room width (ft)">' +
    '<button type="button" class="btn btn-icon remove-room" aria-label="Remove room">✕</button>';
  row.querySelector('.remove-room').addEventListener('click', function () {
    if (roomList.querySelectorAll('.room-row').length <= 1) return;
    row.remove();
    saveForm();
    updateRemoveButtons();
    updateCalculateButtonState();
  });
  roomList.appendChild(row);
}

document.getElementById('add-room').addEventListener('click', function () {
  addRoomRow(10, 10);
  saveForm();
  updateRemoveButtons();
  updateCalculateButtonState();
});

function readRooms() {
  return Array.prototype.map.call(roomList.querySelectorAll('.room-row'), function (row) {
    return {
      length: Number(row.querySelector('.room-length').value) || 0,
      width: Number(row.querySelector('.room-width').value) || 0
    };
  });
}

function sizeFromPreset(preset) {
  const parts = preset.split('x').map(Number);
  return { width: parts[0], height: parts[1] };
}

// =========================================================================
// Inline field validation — mirrors the limits api/estimate.js enforces
// server-side, so a mistake gets caught right next to the field that has it
// instead of only as one banner at the top after a round trip to the server.
// =========================================================================
const FIELD_RULES = {
  plotLength: { label: 'Plot length', min: 10, max: 500 },
  plotWidth: { label: 'Plot width', min: 10, max: 500 },
  totalDoors: { label: 'Number of doors', min: 0, max: 60 },
  totalWindows: { label: 'Number of windows', min: 0, max: 60 },
  washrooms: { label: 'Washrooms', min: 0, max: 20 },
  bathrooms: { label: 'Bathrooms', min: 0, max: 20 },
  kitchens: { label: 'Kitchens', min: 0, max: 20 },
  parking: { label: 'Parking bays', min: 0, max: 100 }
};

function showFieldError(id, message) {
  const el = document.getElementById(id);
  if (!el) return;
  let err = document.getElementById(id + '-error');
  if (!err) {
    err = document.createElement('p');
    err.className = 'field-error';
    err.id = id + '-error';
    el.insertAdjacentElement('afterend', err);
  }
  err.textContent = message;
  el.setAttribute('aria-invalid', 'true');
  el.setAttribute('aria-describedby', id + '-error');
}

function clearFieldError(id) {
  const el = document.getElementById(id);
  const err = document.getElementById(id + '-error');
  if (err) err.remove();
  if (el) {
    el.removeAttribute('aria-invalid');
    el.removeAttribute('aria-describedby');
  }
}

function validateField(id) {
  const rule = FIELD_RULES[id];
  if (!rule) return true;
  const el = document.getElementById(id);
  const n = Number(el.value);
  if (el.value === '' || !isFinite(n)) {
    showFieldError(id, rule.label + ' is required.');
    return false;
  }
  if (n < rule.min || n > rule.max) {
    showFieldError(id, rule.label + ' must be between ' + rule.min + ' and ' + rule.max + '.');
    return false;
  }
  clearFieldError(id);
  return true;
}

// A room row with one side blank is treated as "not filled in yet" and
// silently dropped — same rule api/estimate.js uses. Only rows where both
// sides have a value get held to the 4-100 ft range.
function validateRoomRow(row) {
  const lengthEl = row.querySelector('.room-length');
  const widthEl = row.querySelector('.room-width');
  if (!lengthEl || !widthEl) return true;
  const lengthNum = Number(lengthEl.value);
  const widthNum = Number(widthEl.value);
  const bothFilled = lengthEl.value !== '' && lengthNum !== 0 && widthEl.value !== '' && widthNum !== 0;
  if (!bothFilled) {
    clearFieldError(lengthEl.id);
    clearFieldError(widthEl.id);
    return true;
  }
  let ok = true;
  if (!isFinite(lengthNum) || lengthNum < 4 || lengthNum > 100) {
    showFieldError(lengthEl.id, 'Room length must be between 4 and 100 ft.');
    ok = false;
  } else {
    clearFieldError(lengthEl.id);
  }
  if (!isFinite(widthNum) || widthNum < 4 || widthNum > 100) {
    showFieldError(widthEl.id, 'Room width must be between 4 and 100 ft.');
    ok = false;
  } else {
    clearFieldError(widthEl.id);
  }
  return ok;
}

function validateWholeForm() {
  let ok = true;
  Object.keys(FIELD_RULES).forEach(function (id) { if (!validateField(id)) ok = false; });
  Array.prototype.forEach.call(roomList.querySelectorAll('.room-row'), function (row) {
    if (!validateRoomRow(row)) ok = false;
  });
  return ok;
}

// Calculate button is only "live" (solid, enabled) when the form is actually
// fillable — a deliberate design requirement, distinct from the fuller
// range validation that runs on submit.
function isFormFillable() {
  const plotLength = Number(document.getElementById('plotLength').value);
  const plotWidth = Number(document.getElementById('plotWidth').value);
  const floors = Number(document.getElementById('floors').value);
  if (!(plotLength > 0 && plotWidth > 0 && floors > 0)) return false;
  const rows = roomList.querySelectorAll('.room-row');
  if (rows.length === 0) return false;
  return Array.prototype.every.call(rows, function (row) {
    const l = Number(row.querySelector('.room-length').value);
    const w = Number(row.querySelector('.room-width').value);
    return l > 0 && w > 0;
  });
}

function updateCalculateButtonState() {
  const fillable = isFormFillable();
  calculateBtn.disabled = !fillable;
  calculateBtn.classList.toggle('btn-primary', fillable);
  calculateBtn.classList.toggle('btn-secondary', !fillable);
}

// =========================================================================
// Autosave — remember the visitor's last session in this browser, so an
// accidental reload doesn't mean redoing a 15+ field form from scratch.
// =========================================================================
const STORAGE_KEY = 'gharCalculatorForm.v2';

function serializeForm() {
  return {
    plotLength: document.getElementById('plotLength').value,
    plotWidth: document.getElementById('plotWidth').value,
    floors: document.getElementById('floors').value,
    rooms: readRooms(),
    totalDoors: document.getElementById('totalDoors').value,
    totalWindows: document.getElementById('totalWindows').value,
    doorSize: document.getElementById('doorSize').value,
    windowSize: document.getElementById('windowSize').value,
    washrooms: document.getElementById('washrooms').value,
    bathrooms: document.getElementById('bathrooms').value,
    kitchens: document.getElementById('kitchens').value,
    parking: document.getElementById('parking').value
  };
}

function saveForm() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeForm())); } catch (e) { /* storage unavailable */ }
}

function restoreForm() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) { saved = null; }
  if (!saved) return false;

  ['plotLength', 'plotWidth', 'floors', 'totalDoors', 'totalWindows', 'doorSize', 'windowSize', 'washrooms', 'bathrooms', 'kitchens', 'parking']
    .forEach(function (id) { if (saved[id] !== undefined) document.getElementById(id).value = saved[id]; });

  roomList.innerHTML = '';
  (saved.rooms || []).forEach(function (r) { addRoomRow(r.length, r.width); });

  return true;
}

// Restore the visitor's last session if there is one; otherwise show starter rooms.
if (!restoreForm()) {
  addRoomRow(12, 10);
  addRoomRow(10, 8);
  addRoomRow(14, 12);
}
updateRemoveButtons();

// =========================================================================
// Form submit → /api/estimate → render results
// =========================================================================
const form = document.getElementById('estimate-form');
const statusEl = document.getElementById('form-status');
const calculateBtn = document.getElementById('calculate-btn');
const summaryBody = document.querySelector('#summary-table tbody');
const resultBody = document.querySelector('#result-table tbody');
const totalCostEl = document.getElementById('total-cost');
const totalRefEl = document.getElementById('total-ref');
let lastRenderedData = null;

function fmt(n) { return Math.round(n).toLocaleString('en-IN'); }
function money(n) { return '₹' + fmt(n); }
function val(id) { return Number(document.getElementById(id).value) || 0; }

// Autosave on every change — inputs/selects fire these; room add/remove call
// saveForm() directly since clicking a button doesn't trigger either event.
form.addEventListener('input', saveForm);
form.addEventListener('change', saveForm);

// Re-validate a field / re-check button state the moment it's edited.
form.addEventListener('input', function (e) {
  const id = e.target.id;
  if (FIELD_RULES[id]) validateField(id);
  if (e.target.classList && (e.target.classList.contains('room-length') || e.target.classList.contains('room-width'))) {
    validateRoomRow(e.target.closest('.room-row'));
  }
  updateCalculateButtonState();
});
form.addEventListener('change', updateCalculateButtonState);

updateCalculateButtonState();

const TAG_CLASS_BY_SECTION = {
  'Structure': 'tag-accent',
  'Walls & finishes': 'tag-accent-2',
  'Openings & MEP': 'tag-neutral'
};

function submitEstimate() {
  track('Calculate Estimate Clicked');
  statusEl.classList.remove('error');

  if (!validateWholeForm()) {
    if (screens.form.hidden) showScreen('form');
    statusEl.hidden = false;
    statusEl.textContent = 'Please fix the highlighted fields below.';
    statusEl.classList.add('error');
    const firstInvalid = form.querySelector('[aria-invalid="true"]');
    if (firstInvalid) firstInvalid.focus();
    return;
  }

  statusEl.hidden = false;
  statusEl.classList.remove('error');
  statusEl.textContent = 'Calculating…';
  calculateBtn.disabled = true;
  calculateBtn.classList.add('loading');

  const door = sizeFromPreset(document.getElementById('doorSize').value);
  const win = sizeFromPreset(document.getElementById('windowSize').value);

  const payload = {
    plotLength: val('plotLength'),
    plotWidth: val('plotWidth'),
    floors: val('floors'),
    rooms: readRooms(),
    totalDoors: val('totalDoors'),
    totalWindows: val('totalWindows'),
    doorWidth: door.width, doorHeight: door.height,
    windowWidth: win.width, windowHeight: win.height,
    washrooms: val('washrooms'),
    bathrooms: val('bathrooms'),
    kitchens: val('kitchens'),
    parking: val('parking')
  };

  fetch('/api/estimate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
    .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
    .then(function (result) {
      if (!result.ok) { throw new Error(result.data.error || 'Something went wrong.'); }
      render(result.data);
      statusEl.hidden = true;
      statusEl.classList.remove('error');
    })
    .catch(function (err) {
      if (screens.form.hidden) showScreen('form');
      statusEl.hidden = false;
      statusEl.textContent = 'Could not calculate: ' + err.message;
      statusEl.classList.add('error');
    })
    .finally(function () {
      calculateBtn.classList.remove('loading');
      updateCalculateButtonState();
    });
}

form.addEventListener('submit', function (e) {
  e.preventDefault();
  submitEstimate();
});

document.getElementById('edit-inputs-btn').addEventListener('click', function () {
  showScreen('form');
});

function render(data) {
  lastRenderedData = data;

  let personaForTracking = null;
  try { personaForTracking = localStorage.getItem(PERSONA_KEY); } catch (e) { personaForTracking = null; }
  track('Estimate Calculated', {
    persona: personaForTracking,
    floors: val('floors'),
    room_count: readRooms().length,
    total_low: data.grandTotalLow,
    total_high: data.grandTotalHigh
  });

  summaryBody.innerHTML = [
    ['Built-up area (total)', fmt(data.summary.builtUpAreaTotal) + ' sqft'],
    ['Slab thickness', data.summary.slabThicknessMm + ' mm'],
    ['Beam size', data.summary.beamSizeMm + ' mm'],
    ['Column size', data.summary.columnSize],
    ['Footing size', data.summary.footingSizeM + ' m']
  ].map(function (r) { return '<tr><td>' + r[0] + '</td><td colspan="2">' + r[1] + '</td></tr>'; }).join('');

  let lastSection = null;
  let rows = '';
  data.items.forEach(function (item) {
    if (item.section !== lastSection) {
      const tagClass = TAG_CLASS_BY_SECTION[item.section] || 'tag-neutral';
      rows += '<tr><td colspan="3" style="padding-top:var(--space-4)"><span class="tag ' + tagClass + '">' + item.section + '</span></td></tr>';
      lastSection = item.section;
    }
    rows += '<tr><td>' + item.label + '</td><td>' + item.qty + '</td><td>' +
      (item.cost === null ? '—' : money(item.cost)) + '</td></tr>';
    if (item.label === 'Brickwork' && data.summary.bricksPerSqft) {
      const perSqft = data.summary.bricksPerSqft;
      const normal = perSqft >= 30 && perSqft <= 40;
      rows += '<tr><td colspan="3" class="text-muted" style="font-size:11.5px">~' + perSqft + ' bricks/sqft — typical range is 30–40, so this looks ' +
        (normal ? 'normal.' : 'outside the usual range. Worth double-checking your room sizes and wall inputs.') + '</td></tr>';
    }
  });
  rows += '<tr style="border-top:2px solid var(--color-divider)"><td style="font-weight:700">Material subtotal</td><td></td><td style="font-weight:700">' + money(data.materialSubtotal) + '</td></tr>';
  rows += '<tr><td style="font-weight:700">Contingency (' + data.contingencyPercent + '%)</td><td></td><td style="font-weight:700">' + money(data.contingencyCost) + '</td></tr>';
  rows += '<tr><td style="font-weight:700">Transportation (' + data.transportPercent + '%)</td><td></td><td style="font-weight:700">' + money(data.transportCost) + '</td></tr>';
  if (data.laborIncluded) {
    rows += '<tr><td style="font-weight:700">Labor (' + data.laborPercent + '%)</td><td></td><td style="font-weight:700">' + money(data.laborCost) + '</td></tr>';
  }
  resultBody.innerHTML = rows;

  const totalText = 'Estimated total: ' + money(data.grandTotalLow) + ' – ' + money(data.grandTotalHigh);
  totalCostEl.textContent = totalText;
  document.getElementById('total-cost-repeat').textContent = totalText;
  totalRefEl.textContent = 'Reference midpoint: ' + money(data.grandTotal) + ' (range reflects ±' + data.estimateRangePercent + '% regional rate variance)';

  showScreen('results', { focus: true });
}

function buildSummaryText(data) {
  const lines = ['Ghar Calculator — Estimate Summary', ''];
  const clientField = document.getElementById('projectClient');
  if (clientField && !businessProjectBlock.hidden && clientField.value.trim()) {
    lines.push('Client / project: ' + clientField.value.trim());
    lines.push('');
  }
  lines.push('Built-up area: ' + fmt(data.summary.builtUpAreaTotal) + ' sqft');
  lines.push('Slab thickness: ' + data.summary.slabThicknessMm + ' mm');
  lines.push('Beam size: ' + data.summary.beamSizeMm + ' mm');
  lines.push('Column size: ' + data.summary.columnSize);
  lines.push('Footing size: ' + data.summary.footingSizeM + ' m');
  lines.push('');

  let lastSection = null;
  data.items.forEach(function (item) {
    if (item.section !== lastSection) { lines.push(item.section.toUpperCase()); lastSection = item.section; }
    lines.push('  ' + item.label + ': ' + item.qty + (item.cost === null ? '' : ' — ' + money(item.cost)));
  });

  lines.push('');
  lines.push('Material subtotal: ' + money(data.materialSubtotal));
  lines.push('Contingency (' + data.contingencyPercent + '%): ' + money(data.contingencyCost));
  lines.push('Transportation (' + data.transportPercent + '%): ' + money(data.transportCost));
  if (data.laborIncluded) { lines.push('Labor (' + data.laborPercent + '%): ' + money(data.laborCost)); }
  lines.push('');
  lines.push('Estimated total: ' + money(data.grandTotalLow) + ' – ' + money(data.grandTotalHigh) +
    ' (reference midpoint: ' + money(data.grandTotal) + ')');
  return lines.join('\n');
}

document.getElementById('copy-summary').addEventListener('click', function () {
  if (!lastRenderedData) return;
  const btn = this;
  const original = btn.innerHTML;
  navigator.clipboard.writeText(buildSummaryText(lastRenderedData))
    .then(function () {
      btn.textContent = 'Copied!';
      setTimeout(function () { btn.innerHTML = original; }, 1500);
      track('Summary Copied');
    })
    .catch(function () {
      statusEl.hidden = false;
      statusEl.textContent = 'Could not copy — your browser may be blocking clipboard access. Try selecting the text manually.';
      statusEl.classList.add('error');
    });
});

document.getElementById('print-summary').addEventListener('click', function () { track('Print Clicked'); window.print(); });

// =========================================================================
// Compare scenarios — save the current result into slot A or B so two
// options (e.g. 2 floors vs 3 floors) can be looked at side by side.
// =========================================================================
const SCENARIO_KEY = 'gharCalculatorScenarios.v1';

function loadScenarios() {
  try { return JSON.parse(localStorage.getItem(SCENARIO_KEY)) || {}; } catch (e) { return {}; }
}

function saveScenarios(scenarios) {
  try { localStorage.setItem(SCENARIO_KEY, JSON.stringify(scenarios)); } catch (e) { /* storage unavailable */ }
}

function findItem(data, label) {
  return (data.items || []).filter(function (i) { return i.label === label; })[0];
}

function compareCell(scenario, fn) { return scenario ? fn(scenario) : '—'; }

function renderCompare() {
  const scenarios = loadScenarios();
  const a = scenarios.A;
  const b = scenarios.B;
  const empty = document.getElementById('compare-empty');
  const wrap = document.getElementById('compare-wrap');
  const body = document.getElementById('compare-body');

  if (!a && !b) { empty.hidden = false; wrap.hidden = true; return; }
  empty.hidden = true;
  wrap.hidden = false;

  const rows = [
    ['Floors', compareCell(a, function (s) { return s.inputs.floors; }), compareCell(b, function (s) { return s.inputs.floors; })],
    ['Room count', compareCell(a, function (s) { return s.inputs.rooms.length; }), compareCell(b, function (s) { return s.inputs.rooms.length; })],
    ['Built-up area', compareCell(a, function (s) { return fmt(s.data.summary.builtUpAreaTotal) + ' sqft'; }), compareCell(b, function (s) { return fmt(s.data.summary.builtUpAreaTotal) + ' sqft'; })],
    ['Cement', compareCell(a, function (s) { const i = findItem(s.data, 'Cement (incl. PCC)'); return i ? i.qty : '—'; }), compareCell(b, function (s) { const i = findItem(s.data, 'Cement (incl. PCC)'); return i ? i.qty : '—'; })],
    ['TMT steel', compareCell(a, function (s) { const i = findItem(s.data, 'TMT steel'); return i ? i.qty : '—'; }), compareCell(b, function (s) { const i = findItem(s.data, 'TMT steel'); return i ? i.qty : '—'; })],
    ['Bricks', compareCell(a, function (s) { const i = findItem(s.data, 'Brickwork'); return i ? i.qty : '—'; }), compareCell(b, function (s) { const i = findItem(s.data, 'Brickwork'); return i ? i.qty : '—'; })],
    ['Estimated total', compareCell(a, function (s) { return money(s.data.grandTotalLow) + '–' + money(s.data.grandTotalHigh); }), compareCell(b, function (s) { return money(s.data.grandTotalLow) + '–' + money(s.data.grandTotalHigh); })]
  ];

  body.innerHTML = rows.map(function (r) {
    return '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td></tr>';
  }).join('');
}

function saveScenario(slot, btn) {
  if (!lastRenderedData) return;
  const scenarios = loadScenarios();
  scenarios[slot] = { savedAt: Date.now(), data: lastRenderedData, inputs: serializeForm() };
  saveScenarios(scenarios);
  renderCompare();
  track('Scenario Saved', { slot: slot });
  if (btn) {
    const original = btn.innerHTML;
    btn.textContent = 'Saved!';
    setTimeout(function () { btn.innerHTML = original; }, 1200);
  }
}

document.getElementById('save-scenario-a').addEventListener('click', function () { saveScenario('A', this); });
document.getElementById('save-scenario-b').addEventListener('click', function () { saveScenario('B', this); });
document.getElementById('clear-scenarios').addEventListener('click', function () {
  try { localStorage.removeItem(SCENARIO_KEY); } catch (e) { /* storage unavailable */ }
  renderCompare();
  track('Scenarios Cleared');
});

renderCompare(); // restore any scenarios saved in a previous session

// =========================================================================
// Map/photo upload → dimension + room suggestion. Shared by the simple-flow
// screen (individual persona) and the "Have a site map?" card on the full
// form. Uploads to /api/extract-dimensions (Claude vision on the backend)
// and shows whatever it reads as a suggestion the visitor has to explicitly
// apply — never auto-filled, since a misread here would be exactly the kind
// of confidently-wrong number this app has spent a lot of effort avoiding
// elsewhere. On the individual "simple" flow only, applying the suggestion
// also runs the calculation immediately and jumps to Results — the whole
// point of that path is to skip manual form entry.
// =========================================================================
const MAP_MAX_BYTES = 15 * 1024 * 1024;
const mapUploadInput = document.getElementById('map-upload-input');
const uploadModal = document.getElementById('upload-modal');
const uploadPreviewWrap = document.getElementById('upload-preview-wrap');
const uploadPreviewImg = document.getElementById('upload-preview-img');
const uploadPreviewEmbed = document.getElementById('upload-preview-embed');
const uploadFileName = document.getElementById('upload-file-name');
const uploadProcessing = document.getElementById('upload-processing');
const uploadDone = document.getElementById('upload-done');
const uploadError = document.getElementById('upload-error');
const uploadErrorText = document.getElementById('upload-error-text');
let pendingUploadResult = null;
let uploadSource = 'form'; // 'form' | 'simple' — which screen triggered the upload
let uploadObjectUrl = null;

function fileToBase64(file) {
  return new Promise(function (resolve, reject) {
    const reader = new FileReader();
    reader.onload = function () {
      const commaIndex = reader.result.indexOf(',');
      resolve(reader.result.slice(commaIndex + 1));
    };
    reader.onerror = function () { reject(new Error('Could not read that file.')); };
    reader.readAsDataURL(file);
  });
}

function resetUploadModal() {
  uploadPreviewWrap.hidden = true;
  uploadPreviewImg.hidden = true;
  uploadPreviewEmbed.hidden = true;
  uploadProcessing.hidden = true;
  uploadDone.hidden = true;
  uploadError.hidden = true;
  pendingUploadResult = null;
  if (uploadObjectUrl) { URL.revokeObjectURL(uploadObjectUrl); uploadObjectUrl = null; }
}

function closeUploadModal() {
  uploadModal.hidden = true;
  resetUploadModal();
}

function showUploadError(message) {
  uploadProcessing.hidden = true;
  uploadDone.hidden = true;
  uploadError.hidden = false;
  uploadErrorText.textContent = message;
}

function renderUploadDone(r) {
  uploadDone.hidden = false;
  const tag = document.getElementById('upload-confidence-tag');
  tag.textContent = r.confidence.charAt(0).toUpperCase() + r.confidence.slice(1) + ' confidence';
  tag.className = 'tag ' + (r.confidence === 'high' ? 'tag-accent' : 'tag-neutral');
  document.getElementById('upload-notes').textContent = r.notes || '';
  document.getElementById('upload-length-val').textContent = r.lengthFt !== null ? r.lengthFt + ' ft' : 'Not detected';
  document.getElementById('upload-width-val').textContent = r.widthFt !== null ? r.widthFt + ' ft' : 'Not detected';

  const roomsLabel = document.getElementById('upload-rooms-label');
  const roomsListEl = document.getElementById('upload-rooms-list');
  roomsListEl.innerHTML = '';
  if (r.rooms && r.rooms.length) {
    roomsLabel.hidden = false;
    r.rooms.forEach(function (room) {
      const row = document.createElement('div');
      row.className = 'detected-room-row';
      row.innerHTML = '<span>' + room.label + '</span><span>' + room.length + ' ft x ' + room.width + ' ft</span>';
      roomsListEl.appendChild(row);
    });
  } else {
    roomsLabel.hidden = true;
  }
}

function openModalWithFile(file) {
  resetUploadModal();
  uploadModal.hidden = false;
  track('Upload Started', { source: uploadSource, file_type: file.type });

  if (file.size > MAP_MAX_BYTES) {
    showUploadError('That file is too large — please upload something under 15MB.');
    return;
  }

  uploadObjectUrl = URL.createObjectURL(file);
  uploadPreviewWrap.hidden = false;
  if (file.type === 'application/pdf') {
    uploadPreviewEmbed.hidden = false;
    uploadPreviewEmbed.src = uploadObjectUrl;
  } else {
    uploadPreviewImg.hidden = false;
    uploadPreviewImg.src = uploadObjectUrl;
  }
  uploadFileName.textContent = file.name;
  uploadProcessing.hidden = false;

  fileToBase64(file)
    .then(function (base64) {
      return fetch('/api/extract-dimensions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: file.type, fileName: file.name })
      });
    })
    .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
    .then(function (result) {
      if (!result.ok) throw new Error(result.data.error || 'Something went wrong reading that file.');
      const r = result.data;
      if (r.lengthFt === null && r.widthFt === null && (!r.rooms || r.rooms.length === 0)) {
        throw new Error('Could not read plot dimensions or rooms from that file' + (r.notes ? ': ' + r.notes : '.'));
      }
      uploadProcessing.hidden = true;
      pendingUploadResult = r;
      track('Upload Succeeded', {
        source: uploadSource,
        confidence: r.confidence,
        rooms_detected: (r.rooms || []).length,
        plot_detected: r.lengthFt !== null && r.widthFt !== null
      });
      renderUploadDone(r);
    })
    .catch(function (err) {
      track('Upload Failed', { source: uploadSource, error: String(err.message).slice(0, 120) });
      showUploadError(err.message);
    });
}

function triggerUpload(source) {
  track('Upload Plan Clicked', { source: source });
  uploadSource = source;
  mapUploadInput.value = '';
  mapUploadInput.click();
}

document.getElementById('simple-upload-btn').addEventListener('click', function () { triggerUpload('simple'); });
document.getElementById('simple-upload-btn-2').addEventListener('click', function () { triggerUpload('simple'); });
document.getElementById('map-upload-btn').addEventListener('click', function () { triggerUpload('form'); });

mapUploadInput.addEventListener('change', function () {
  const file = mapUploadInput.files[0];
  if (!file) return;
  openModalWithFile(file);
});

document.getElementById('upload-dismiss').addEventListener('click', closeUploadModal);
document.getElementById('upload-error-dismiss').addEventListener('click', closeUploadModal);
uploadModal.addEventListener('click', function (e) { if (e.target === uploadModal) closeUploadModal(); });
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && !uploadModal.hidden) closeUploadModal();
});

function setInputValue(id, v) {
  const el = document.getElementById(id);
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(el, v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

document.getElementById('upload-apply').addEventListener('click', function () {
  if (!pendingUploadResult) return;
  const r = pendingUploadResult;
  const wasSimpleFlow = uploadSource === 'simple';
  track('Upload Applied', { source: uploadSource });

  if (r.lengthFt !== null) setInputValue('plotLength', r.lengthFt);
  if (r.widthFt !== null) setInputValue('plotWidth', r.widthFt);
  if (r.rooms && r.rooms.length) {
    roomList.innerHTML = '';
    r.rooms.forEach(function (room) { addRoomRow(room.length, room.width); });
    updateRemoveButtons();
  }
  saveForm();
  updateCalculateButtonState();
  closeUploadModal();

  if (wasSimpleFlow) {
    submitEstimate();
  } else {
    showScreen('form');
  }
});

// Icons: static markup already has data-lucide attributes; run once on load.
if (window.lucide) window.lucide.createIcons();
