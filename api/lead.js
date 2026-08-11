// =========================================================================
// LEAD CAPTURE — stores contact details from the persona-intake gate so
// they can be followed up with later.
//
// Two paths, tried independently:
//  1. Local file (data/leads.jsonl) — best-effort, works for local dev.
//     Silently skipped if the filesystem is read-only (e.g. Vercel), since
//     that's expected there rather than an error.
//  2. Email notification via Resend — the durable path for production.
//     Requires RESEND_API_KEY (free tier, no domain verification needed —
//     see .env.example). If neither path is available, the request fails
//     loudly rather than pretending the lead was saved somewhere.
// =========================================================================

const fs = require('fs');
const path = require('path');
const https = require('https');

const DATA_DIR = path.join(__dirname, '..', 'data');
const LEADS_FILE = path.join(DATA_DIR, 'leads.jsonl');
const NOTIFY_EMAIL = process.env.LEAD_NOTIFY_EMAIL || 'abhisheksinghpnp@gmail.com';

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

// Best-effort — returns true if it actually wrote the file, false if the
// filesystem refused (expected on Vercel, not treated as an error there).
function appendLeadLocally(record) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.appendFileSync(LEADS_FILE, JSON.stringify(record) + '\n', 'utf8');
    return true;
  } catch (e) {
    return false;
  }
}

function sendLeadEmail(record) {
  return new Promise(function (resolve, reject) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      reject(new Error('RESEND_API_KEY is not set on the server — see .env.example.'));
      return;
    }

    const lines = [
      'New ' + record.persona + ' lead from Ghar Calculator',
      '',
      'Name: ' + record.name,
      'Contact: ' + record.contact
    ];
    if (record.persona === 'business') {
      lines.push('Company: ' + record.companyName);
      if (record.projectsPerYear) lines.push('Projects per year: ' + record.projectsPerYear);
    } else if (record.city) {
      lines.push('City: ' + record.city);
    }
    lines.push('', 'Submitted: ' + record.submittedAt);

    const payload = JSON.stringify({
      from: 'Ghar Calculator <onboarding@resend.dev>',
      to: [NOTIFY_EMAIL],
      subject: 'New lead: ' + record.name + ' (' + record.persona + ')',
      text: lines.join('\n')
    });

    const req = https.request({
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'Authorization': 'Bearer ' + apiKey
      }
    }, function (res) {
      let data = '';
      res.on('data', function (chunk) { data += chunk; });
      res.on('end', function () {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
          return;
        }
        let msg = 'Email service returned ' + res.statusCode + '.';
        try { const parsed = JSON.parse(data); if (parsed && parsed.message) msg = parsed.message; } catch (e) { /* keep default msg */ }
        reject(new Error(msg));
      });
    });

    req.on('error', function (err) { reject(new Error('Could not reach the email service: ' + err.message)); });
    req.write(payload);
    req.end();
  });
}

function buildRecord(input) {
  const persona = input.persona === 'business' ? 'business' : input.persona === 'individual' ? 'individual' : null;
  if (!persona) {
    throw new Error('Please choose whether you\'re building for yourself or for a business.');
  }

  const name = requireStr(input.name, 'Name', { maxLen: 100 });
  const contact = requireStr(input.contact, 'Email or phone number', { maxLen: 100 });

  const record = {
    submittedAt: new Date().toISOString(),
    persona: persona,
    name: name,
    contact: contact
  };

  if (persona === 'business') {
    record.companyName = requireStr(input.companyName, 'Company name', { maxLen: 150 });
    record.projectsPerYear = optionalStr(input.projectsPerYear, 20);
  } else {
    record.city = optionalStr(input.city, 100);
  }

  return record;
}

function captureLead(input) {
  const record = buildRecord(input);
  const savedLocally = appendLeadLocally(record);

  if (!process.env.RESEND_API_KEY) {
    if (savedLocally) return Promise.resolve({ ok: true });
    return Promise.reject(new Error('Lead notifications aren\'t configured on the server yet (RESEND_API_KEY missing) — see .env.example.'));
  }

  return sendLeadEmail(record).then(function () {
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
    // Synchronous validation errors (missing/invalid fields) throw directly.
    res.status(400).json({ error: err.message });
    return;
  }

  result
    .then(function (data) { res.status(200).json(data); })
    .catch(function (err) { res.status(502).json({ error: err.message }); });
};

module.exports.captureLead = captureLead; // exported for local testing
