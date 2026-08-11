// =========================================================================
// LEAD CAPTURE — stores contact details from the persona-intake gate so
// they can be followed up with later.
//
// Best-effort local file write (data/leads.jsonl) only — works for local
// dev, silently does nothing on a read-only filesystem (e.g. Vercel). No
// external service is required; this always reports success back to the
// visitor even when nothing was actually persisted, by design (the
// alternative — requiring an email/API key — was removed at the project
// owner's request). If real durable lead capture is needed later, this is
// the file to revisit.
// =========================================================================

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

// Best-effort — failures (e.g. read-only filesystem on Vercel) are swallowed
// on purpose rather than surfaced to the visitor.
function appendLeadLocally(record) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.appendFileSync(LEADS_FILE, JSON.stringify(record) + '\n', 'utf8');
  } catch (e) { /* no durable storage available here — nothing to do */ }
}

function captureLead(input) {
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

  appendLeadLocally(record);
  return { ok: true };
}

module.exports = function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Use POST with a JSON body.' });
    return;
  }
  try {
    const result = captureLead(req.body || {});
    res.status(200).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

module.exports.captureLead = captureLead; // exported for local testing
