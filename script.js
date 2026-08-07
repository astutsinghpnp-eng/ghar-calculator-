// This file does NOT calculate anything — it only collects the inputs
// listed on the page and sends them to /api/estimate, then renders
// whatever comes back. All BOQ logic lives in api/estimate.js.

const roomList = document.getElementById('room-list');

function addRoomRow(length, width) {
  const row = document.createElement('div');
  row.className = 'room-row';
  row.innerHTML =
    '<input class="room-length" type="number" min="1" value="' + length + '">' +
    '<input class="room-width" type="number" min="1" value="' + width + '">' +
    '<button type="button" class="remove-room" aria-label="Remove room">✕</button>';
  row.querySelector('.remove-room').addEventListener('click', function () { row.remove(); });
  roomList.appendChild(row);
}

document.getElementById('add-room').addEventListener('click', function () { addRoomRow(10, 10); });

// starter rooms
addRoomRow(12, 10);
addRoomRow(10, 8);
addRoomRow(14, 12);

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

const form = document.getElementById('estimate-form');
const statusEl = document.getElementById('form-status');
const resultPanel = document.getElementById('result-panel');
const summaryBody = document.querySelector('#summary-table tbody');
const resultBody = document.querySelector('#result-table tbody');
const totalCostEl = document.getElementById('total-cost');

function fmt(n) { return Math.round(n).toLocaleString('en-IN'); }
function money(n) { return '₹' + fmt(n); }
function val(id) { return Number(document.getElementById(id).value) || 0; }

form.addEventListener('submit', function (e) {
  e.preventDefault();
  statusEl.textContent = 'Calculating…';

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
    })
    .catch(function (err) {
      statusEl.textContent = 'Could not calculate: ' + err.message;
    });
});

function render(data) {
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
  });
  rows += '<tr class="subtotal-row"><td>Material subtotal</td><td></td><td>' + money(data.materialSubtotal) + '</td></tr>';
  rows += '<tr><td>Contingency (' + data.contingencyPercent + '%)</td><td></td><td>' + money(data.contingencyCost) + '</td></tr>';
  rows += '<tr><td>Transportation (' + data.transportPercent + '%)</td><td></td><td>' + money(data.transportCost) + '</td></tr>';
  if (data.laborIncluded) {
    rows += '<tr><td>Labor (' + data.laborPercent + '%)</td><td></td><td>' + money(data.laborCost) + '</td></tr>';
  }
  resultBody.innerHTML = rows;

  totalCostEl.textContent = 'Estimated total: ' + money(data.grandTotal);
  resultPanel.hidden = false;
  resultPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
