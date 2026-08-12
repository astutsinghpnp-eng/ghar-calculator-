// =========================================================================
// LEAD CAPTURE — saves contact details from the persona-intake gate into
// Supabase (table: leads), so they're never lost — Vercel's filesystem
// can't store files permanently, which is why a database is required here.
//
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.example).
// Also best-effort writes to a local file for local dev convenience, but
// that's not relied on for durability — Supabase is the real store.
// =========================================================================

const https = require('https');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const LEADS_FILE = path.join(DATA_DIR, 'leads.jsonl');

function requireStr(v, label, opts) {
  opts = opts || {};
  const maxLen = opts.maxLen || 200;
  if (typeof v !== 'string' || v.trim() === '') {
    throw new Error(label + ' is required.');
  }
  const trimmed = v.trim();
  if (trimmed.length > maxLen) {
    throw new Error(label + ' is too long (max ' + maxLen + ' characters).');
  }
  return trimmed;
}

function optionalStr(v, maxLen) {
  if (v === undefined || v === null) return '';
  const trimmed = String(v).trim();
  return trimmed.slice(0, maxLen || 200);
}

// Best-effort only — never relied on for durability. Failures (e.g.
// Vercel's read-only filesystem) are swallowed on purpose.
function appendLeadLocally(record) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.appendFileSync(LEADS_FILE, JSON.stringify(record) + '\n', 'utf8');
  } catch (e) { /* no local filesystem available here — nothing to do */ }
}

function saveToSupabase(record) {
  return new Promise(function (resolve, reject) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      reject(new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set on the server — see .env.example.'));
      return;
    }

    const payload = JSON.stringify(record);
    const hostname = url.replace(/^https?:\/\//, '').replace(/\/$/, '');

    const req = https.request({
      hostname: hostname,
      path: '/rest/v1/leads',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'apikey': key,
        'Authorization': 'Bearer ' + key,
        'Prefer': 'return=minimal'
      }
    }, function (res) {
      let data = '';
      res.on('data', function (chunk) { data += chunk; });
      res.on('end', function () {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
          return;
        }
        let msg = 'Supabase returned ' + res.statusCode + '.';
        try { const parsed = JSON.parse(data); if (parsed && parsed.message) msg = parsed.message; } catch (e) { /* keep default msg */ }
        reject(new Error(msg));
      });
    });

    req.on('error', function (err) { reject(new Error('Could not reach Supabase: ' + err.message)); });
    req.write(payload);
    req.end();
  });
}

function captureLead(input) {
  const persona = input.persona === 'business' ? 'business' : input.persona === 'individual' ? 'individual' : null;
  if (!persona) {
    throw new Error('Please choose whether you\'re building for yourself or for a business.');
  }

  const name = requireStr(input.name, 'Name', { maxLen: 100 });
  const contact = requireStr(input.contact, 'Email or phone number', { maxLen: 100 });
  // Stable per-browser ID assigned client-side on first visit (see
  // getOrCreateUserId() in public/script.js) — carried through so this
  // Supabase row can be linked to the same identity Mixpanel uses.
  const userId = optionalStr(input.userId, 100) || null;

  // Column names use snake_case to match the "leads" table in Supabase.
  const record = {
    user_id: userId,
    persona: persona,
    name: name,
    contact: contact,
    city: persona === 'individual' ? (optionalStr(input.city, 100) || null) : null,
    company_name: persona === 'business' ? requireStr(input.companyName, 'Company name', { maxLen: 150 }) : null,
    projects_per_year: persona === 'business' ? (optionalStr(input.projectsPerYear, 20) || null) : null
  };

  appendLeadLocally(record);

  return saveToSupabase(record).then(function () {
    return { ok: true };
  });
}

module.exports = function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Use POST with a JSON body.' });
    return;
  }

  let result;
  try {
    result = captureLead(req.body || {});
  } catch (err) {
    res.status(400).json({ error: err.message });
    return;
  }

  result
    .then(function (data) { res.status(200).json(data); })
    .catch(function (err) { res.status(502).json({ error: err.message }); });
};

module.exports.captureLead = captureLead; // exported for local testing
