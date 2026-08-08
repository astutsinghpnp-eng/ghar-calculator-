// =========================================================================
// LEAD CAPTURE — stores contact details from the persona-intake gate so
// they can be followed up with later.
//
// IMPORTANT DEPLOYMENT CAVEAT: this writes to a local file
// (data/leads.jsonl), which works for local dev and for a self-hosted
// server with a persistent disk. It will NOT persist on Vercel — Vercel's
// serverless functions run on a read-only, ephemeral filesystem, so writes
// here are silently lost between invocations in that environment. To
// capture real leads in production, replace appendLead() below with a call
// to a real service (a database, a Google Sheets API call, an email/CRM
// webhook, etc.) — there was no such service configured to wire up at the
// time this was written.
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

function appendLead(record) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.appendFileSync(LEADS_FILE, JSON.stringify(record) + '\n', 'utf8');
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

  appendLead(record);
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
