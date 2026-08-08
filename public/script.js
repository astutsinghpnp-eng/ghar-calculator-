// This file does NOT calculate anything — it only collects the inputs
// listed on the page and sends them to /api/estimate, then renders
// whatever comes back. All BOQ logic lives in api/estimate.js.

const roomList = document.getElementById('room-list');

function addRoomRow(length, width) {
  const row = document.createElement('div');
  row.className = 'room-row';
  row.innerHTML =
    '<input class="room-length" type="number" min="1" max="100" value="' + length + '">' +
    '<input class="room-width" type="number" min="1" max="100" value="' + width + '">' +
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

form.addEventListener('submit', function (e) {
  e.preventDefault();
  statusEl.textContent = 'Calculating…';
  statusEl.classList.remove('error');
  submitBtn.disabled = true;

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
      statusEl.textContent = 'Could not calculate: ' + err.message;
      statusEl.classList.add('error');
    })
    .finally(function () {
      submitBtn.disabled = false;
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

  totalCostEl.textContent = 'Estimated total: ' + money(data.grandTotalLow) + ' – ' + money(data.grandTotalHigh);
  totalRefEl.textContent = 'Reference midpoint: ' + money(data.grandTotal) + ' (range reflects ±' + data.estimateRangePercent + '% regional rate variance)';
  resultPanel.hidden = false;
  resultPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
