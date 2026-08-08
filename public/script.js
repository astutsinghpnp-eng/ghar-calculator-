// This file does NOT calculate anything — it only collects the inputs
// listed on the page and sends them to /api/estimate, then renders
// whatever comes back. All BOQ logic lives in api/estimate.js.

const roomList = document.getElementById('room-list');

// Each room row gets a unique, stable id (independent of its position, so it
// survives other rows being removed) — used for the aria-label announced to
// screen readers and for wiring up inline field errors below.
let roomIdCounter = 0;

function addRoomRow(length, width) {
  roomIdCounter += 1;
  const n = roomIdCounter;
  const row = document.createElement('div');
  row.className = 'room-row';
  row.innerHTML =
    '<input class="room-length" id="room-' + n + '-length" type="number" min="4" max="100" value="' + length + '" aria-label="Room length (ft)">' +
    '<input class="room-width" id="room-' + n + '-width" type="number" min="4" max="100" value="' + width + '" aria-label="Room width (ft)">' +
    '<button type="button" class="remove-room" aria-label="Remove room">✕</button>';
  row.querySelector('.remove-room').addEventListener('click', function () { row.remove(); saveForm(); });
  roomList.appendChild(row);
}

document.getElementById('add-room').addEventListener('click', function () {
  addRoomRow(10, 10);
  saveForm();
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

// --- Inline field validation. Mirrors the limits api/estimate.js enforces
// server-side, so a mistake gets caught right next to the field that has it
// instead of only as one banner at the top after a round trip to the server. ---
const FIELD_RULES = {
  plotLength: { label: 'Plot length', min: 10, max: 500 },
  plotWidth: { label: 'Plot width', min: 10, max: 500 },
  totalDoors: { label: 'Number of doors', min: 0, max: 60 },
  totalWindows: { label: 'Number of windows', min: 0, max: 60 },
  washrooms: { label: 'Washrooms', min: 0, max: 20 },
  bathrooms: { label: 'Bathrooms', min: 0, max: 20 },
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

// --- Autosave: remember the visitor's last session in this browser, so an
// accidental reload doesn't mean redoing a 15+ field form from scratch. ---
const STORAGE_KEY = 'gharCalculatorForm.v1';

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
    parking: document.getElementById('parking').value
  };
}

function saveForm() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeForm())); } catch (e) { /* storage unavailable — nothing to do */ }
}

function restoreForm() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) { saved = null; }
  if (!saved) return false;

  ['plotLength', 'plotWidth', 'floors', 'totalDoors', 'totalWindows', 'doorSize', 'windowSize', 'washrooms', 'bathrooms', 'parking']
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

const form = document.getElementById('estimate-form');
const statusEl = document.getElementById('form-status');
const resultPanel = document.getElementById('result-panel');
const summaryBody = document.querySelector('#summary-table tbody');
const resultBody = document.querySelector('#result-table tbody');
const totalCostEl = document.getElementById('total-cost');
const totalRefEl = document.getElementById('total-ref');
const submitBtn = form.querySelector('button[type="submit"]');
let lastRenderedData = null;

function fmt(n) { return Math.round(n).toLocaleString('en-IN'); }
function money(n) { return '₹' + fmt(n); }
function val(id) { return Number(document.getElementById(id).value) || 0; }

// Autosave on every change — inputs/selects fire these; room add/remove call
// saveForm() directly since clicking a button doesn't trigger either event.
form.addEventListener('input', saveForm);
form.addEventListener('change', saveForm);

// Re-validate a field the moment it's edited, so a corrected value clears its
// error immediately instead of waiting for the next submit attempt.
form.addEventListener('input', function (e) {
  const id = e.target.id;
  if (FIELD_RULES[id]) { validateField(id); return; }
  if (e.target.classList && (e.target.classList.contains('room-length') || e.target.classList.contains('room-width'))) {
    validateRoomRow(e.target.closest('.room-row'));
  }
});

function validateWholeForm() {
  let ok = true;
  Object.keys(FIELD_RULES).forEach(function (id) { if (!validateField(id)) ok = false; });
  Array.prototype.forEach.call(roomList.querySelectorAll('.room-row'), function (row) {
    if (!validateRoomRow(row)) ok = false;
  });
  return ok;
}

form.addEventListener('submit', function (e) {
  e.preventDefault();
  statusEl.classList.remove('error');

  if (!validateWholeForm()) {
    statusEl.textContent = 'Please fix the highlighted fields below.';
    statusEl.classList.add('error');
    const firstInvalid = form.querySelector('[aria-invalid="true"]');
    if (firstInvalid) firstInvalid.focus();
    return;
  }

  statusEl.textContent = 'Calculating…';
  submitBtn.disabled = true;
  submitBtn.classList.add('loading');

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
      statusEl.textContent = '';
      statusEl.classList.remove('error');
    })
    .catch(function (err) {
      // A rejected submission must not leave the previous result looking current.
      resultPanel.hidden = true;
      document.getElementById('sticky-total').hidden = true;
      statusEl.textContent = 'Could not calculate: ' + err.message;
      statusEl.classList.add('error');
    })
    .finally(function () {
      submitBtn.disabled = false;
      submitBtn.classList.remove('loading');
    });
});

function render(data) {
  lastRenderedData = data;

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
      rows += '<tr class="section-row"><td colspan="3">' + item.section + '</td></tr>';
      lastSection = item.section;
    }
    rows += '<tr><td>' + item.label + '</td><td>' + item.qty + '</td><td>' +
      (item.cost === null ? '—' : money(item.cost)) + '</td></tr>';
    if (item.label === 'Brickwork' && data.summary.bricksPerSqft) {
      const perSqft = data.summary.bricksPerSqft;
      const normal = perSqft >= 30 && perSqft <= 40;
      rows += '<tr><td colspan="3" class="benchmark-note">~' + perSqft + ' bricks/sqft — typical range is 30–40, so this looks ' +
        (normal ? 'normal.' : 'outside the usual range. Worth double-checking your room sizes and wall inputs.') + '</td></tr>';
    }
  });
  rows += '<tr class="subtotal-row"><td>Material subtotal</td><td></td><td>' + money(data.materialSubtotal) + '</td></tr>';
  rows += '<tr><td>Contingency (' + data.contingencyPercent + '%)</td><td></td><td>' + money(data.contingencyCost) + '</td></tr>';
  rows += '<tr><td>Transportation (' + data.transportPercent + '%)</td><td></td><td>' + money(data.transportCost) + '</td></tr>';
  if (data.laborIncluded) {
    rows += '<tr><td>Labor (' + data.laborPercent + '%)</td><td></td><td>' + money(data.laborCost) + '</td></tr>';
  }
  resultBody.innerHTML = rows;

  const totalText = 'Estimated total: ' + money(data.grandTotalLow) + ' – ' + money(data.grandTotalHigh);
  totalCostEl.textContent = totalText;
  totalRefEl.textContent = 'Reference midpoint: ' + money(data.grandTotal) + ' (range reflects ±' + data.estimateRangePercent + '% regional rate variance)';
  document.getElementById('sticky-total-text').textContent = totalText;
  document.getElementById('total-preview').innerHTML = totalText + '<span class="caption">Full breakdown below ↓</span>';

  resultPanel.hidden = false;
  resultPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  // Move focus to the result so keyboard and screen-reader users land on the
  // new content instead of just seeing the page scroll underneath them.
  resultPanel.focus({ preventScroll: true });

  watchStickyTotal();
}

function buildSummaryText(data) {
  const lines = ['Ghar Calculator — Estimate Summary', ''];
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
  const original = btn.textContent;
  navigator.clipboard.writeText(buildSummaryText(lastRenderedData))
    .then(function () {
      btn.textContent = 'Copied!';
      setTimeout(function () { btn.textContent = original; }, 1500);
    })
    .catch(function () {
      statusEl.textContent = 'Could not copy — your browser may be blocking clipboard access. Try selecting the text manually.';
      statusEl.classList.add('error');
    });
});

document.getElementById('print-summary').addEventListener('click', function () { window.print(); });

// --- Sticky total: once the main total scrolls out of view, pin a compact
// copy of it to the bottom of the screen so the number that matters is
// never more than a glance away on a long itemized table. ---
const stickyTotalEl = document.getElementById('sticky-total');
let stickyObserver = null;

function watchStickyTotal() {
  if (stickyObserver) stickyObserver.disconnect();
  stickyObserver = new IntersectionObserver(function (entries) {
    const mainTotalVisible = entries[0].isIntersecting;
    stickyTotalEl.hidden = mainTotalVisible || resultPanel.hidden;
  }, { threshold: 0 });
  stickyObserver.observe(totalCostEl);
}

// --- Compare scenarios: save the current result into slot A or B so two
// options (e.g. 2 floors vs 3 floors) can be looked at side by side instead
// of re-entering the whole form to check one against the other. ---
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
  const panel = document.getElementById('compare-panel');
  const grid = document.getElementById('compare-grid');

  if (!a && !b) { panel.hidden = true; return; }
  panel.hidden = false;

  const rows = [
    ['', 'Scenario A', 'Scenario B'],
    ['Floors', compareCell(a, function (s) { return s.inputs.floors; }), compareCell(b, function (s) { return s.inputs.floors; })],
    ['Built-up area', compareCell(a, function (s) { return fmt(s.data.summary.builtUpAreaTotal) + ' sqft'; }), compareCell(b, function (s) { return fmt(s.data.summary.builtUpAreaTotal) + ' sqft'; })],
    ['Cement', compareCell(a, function (s) { const i = findItem(s.data, 'Cement (incl. PCC)'); return i ? i.qty : '—'; }), compareCell(b, function (s) { const i = findItem(s.data, 'Cement (incl. PCC)'); return i ? i.qty : '—'; })],
    ['TMT steel', compareCell(a, function (s) { const i = findItem(s.data, 'TMT steel'); return i ? i.qty : '—'; }), compareCell(b, function (s) { const i = findItem(s.data, 'TMT steel'); return i ? i.qty : '—'; })],
    ['Bricks', compareCell(a, function (s) { const i = findItem(s.data, 'Brickwork'); return i ? i.qty : '—'; }), compareCell(b, function (s) { const i = findItem(s.data, 'Brickwork'); return i ? i.qty : '—'; })],
    ['Estimated total', compareCell(a, function (s) { return money(s.data.grandTotalLow) + '–' + money(s.data.grandTotalHigh); }), compareCell(b, function (s) { return money(s.data.grandTotalLow) + '–' + money(s.data.grandTotalHigh); })]
  ];

  grid.innerHTML = rows.map(function (r, i) {
    const cls = i === 0 ? 'compare-row compare-head' : 'compare-row';
    return '<div class="' + cls + '"><span class="compare-label">' + r[0] + '</span><span class="compare-val">' + r[1] + '</span><span class="compare-val">' + r[2] + '</span></div>';
  }).join('');
}

function saveScenario(slot, btn) {
  if (!lastRenderedData) return;
  const scenarios = loadScenarios();
  scenarios[slot] = { savedAt: Date.now(), data: lastRenderedData, inputs: serializeForm() };
  saveScenarios(scenarios);
  renderCompare();
  if (btn) {
    const original = btn.textContent;
    btn.textContent = 'Saved!';
    setTimeout(function () { btn.textContent = original; }, 1200);
  }
}

document.getElementById('save-scenario-a').addEventListener('click', function () { saveScenario('A', this); });
document.getElementById('save-scenario-b').addEventListener('click', function () { saveScenario('B', this); });
document.getElementById('clear-scenarios').addEventListener('click', function () {
  try { localStorage.removeItem(SCENARIO_KEY); } catch (e) { /* storage unavailable */ }
  renderCompare();
});

renderCompare(); // restore any scenarios saved in a previous session
