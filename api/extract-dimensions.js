// =========================================================================
// DIMENSION EXTRACTION — reads an uploaded site map / plot photo / PDF and
// asks Claude (vision) to identify the plot's length and width in feet.
//
// Requires ANTHROPIC_API_KEY to be set (locally via .env, see .env.example;
// on Vercel via the project's Environment Variables dashboard). Without it,
// this endpoint returns a clear 500 rather than pretending to work.
//
// This is a SUGGESTION, not an answer: OCR/vision on a hand-drawn or scanned
// site map can be wrong, so the result is always returned with a confidence
// level and is meant to be shown to the user for them to confirm or edit —
// never auto-applied to the form silently. See public/script.js for how the
// frontend handles that.
// =========================================================================

const https = require('https');

const ANTHROPIC_MODEL = 'claude-sonnet-5';
const MAX_BASE64_CHARS = 20 * 1024 * 1024; // ~15MB of actual file data
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

// Same plot-length bounds api/estimate.js enforces — a "reading" outside
// this range is more likely a misread than a real plot, so it's suppressed
// rather than suggested.
const PLOT_MIN_FT = 10;
const PLOT_MAX_FT = 500;

const EXTRACTION_PROMPT = 'This image or PDF is a site plan, plot map, or a photo of land/property markers ' +
  'for a construction project. Look for the plot\'s boundary dimensions — the length and width in feet. ' +
  'If dimensions are given in another unit (meters, yards), convert to feet. If there are multiple ' +
  'measurements, use the two that most likely represent the overall plot boundary rather than an individual ' +
  'room or structure. Respond with ONLY a single JSON object, no other text, no markdown formatting, in ' +
  'exactly this shape: {"lengthFt": number or null, "widthFt": number or null, "confidence": "high" or ' +
  '"medium" or "low", "notes": "one short sentence explaining what you read or why you could not read it"}. ' +
  'If you cannot find clear plot dimensions, return null for both numbers rather than guessing.';

function callAnthropic(imageBase64, mimeType) {
  return new Promise(function (resolve, reject) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      reject(new Error('ANTHROPIC_API_KEY is not set on the server — see .env.example.'));
      return;
    }

    const contentBlock = mimeType === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: mimeType, data: imageBase64 } }
      : { type: 'image', source: { type: 'base64', media_type: mimeType, data: imageBase64 } };

    const payload = JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: [contentBlock, { type: 'text', text: EXTRACTION_PROMPT }]
      }]
    });

    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      }
    }, function (res) {
      let data = '';
      res.on('data', function (chunk) { data += chunk; });
      res.on('end', function () {
        let parsed;
        try { parsed = JSON.parse(data); } catch (e) {
          reject(new Error('Could not parse the response from the vision service.'));
          return;
        }
        if (res.statusCode !== 200) {
          const msg = (parsed && parsed.error && parsed.error.message) || ('Vision service returned ' + res.statusCode + '.');
          reject(new Error(msg));
          return;
        }
        resolve(parsed);
      });
    });

    req.on('error', function (err) { reject(new Error('Could not reach the vision service: ' + err.message)); });
    req.write(payload);
    req.end();
  });
}

function parseModelReply(anthropicResponse) {
  const textBlock = (anthropicResponse.content || []).filter(function (b) { return b.type === 'text'; })[0];
  if (!textBlock) throw new Error('The vision service did not return a readable response.');

  // The model was asked for bare JSON, but strip a markdown fence defensively
  // in case one slips in anyway.
  const raw = textBlock.text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  let parsed;
  try { parsed = JSON.parse(raw); } catch (e) {
    throw new Error('Could not understand the vision service\'s response.');
  }

  const inRange = function (n) { return typeof n === 'number' && isFinite(n) && n >= PLOT_MIN_FT && n <= PLOT_MAX_FT; };
  let lengthFt = inRange(parsed.lengthFt) ? parsed.lengthFt : null;
  let widthFt = inRange(parsed.widthFt) ? parsed.widthFt : null;
  let confidence = ['high', 'medium', 'low'].indexOf(parsed.confidence) !== -1 ? parsed.confidence : 'low';
  let notes = typeof parsed.notes === 'string' ? parsed.notes.slice(0, 300) : '';

  if ((parsed.lengthFt !== null && !inRange(parsed.lengthFt)) || (parsed.widthFt !== null && !inRange(parsed.widthFt))) {
    confidence = 'low';
    notes = (notes ? notes + ' ' : '') + 'A reading fell outside a plausible plot size range (10–500 ft) and was discarded.';
  }

  return { lengthFt: lengthFt, widthFt: widthFt, confidence: confidence, notes: notes };
}

module.exports = function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Use POST with a JSON body.' });
    return;
  }

  const body = req.body || {};
  const mimeType = body.mimeType;
  const imageBase64 = body.imageBase64;

  if (!mimeType || ALLOWED_MIME_TYPES.indexOf(mimeType) === -1) {
    res.status(400).json({ error: 'Unsupported file type — upload a JPG, PNG, WEBP, GIF, or PDF.' });
    return;
  }
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    res.status(400).json({ error: 'No file data received.' });
    return;
  }
  if (imageBase64.length > MAX_BASE64_CHARS) {
    res.status(400).json({ error: 'File is too large — please upload something under 15MB.' });
    return;
  }

  callAnthropic(imageBase64, mimeType)
    .then(function (anthropicResponse) {
      const result = parseModelReply(anthropicResponse);
      res.status(200).json(result);
    })
    .catch(function (err) {
      res.status(502).json({ error: err.message });
    });
};

module.exports.parseModelReply = parseModelReply; // exported for local testing
