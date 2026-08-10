// =========================================================================
// DIMENSION EXTRACTION — reads an uploaded site map / plot photo / PDF and
// asks Google's Gemini (vision) to identify the plot's length/width, and
// any individual rooms it can make out, in feet.
//
// Requires GEMINI_API_KEY to be set (locally via .env, see .env.example; on
// Vercel via the project's Environment Variables dashboard). Get a free key
// at https://aistudio.google.com/apikey — no billing required for the
// free tier this endpoint uses. Without the key, this endpoint returns a
// clear 500 rather than pretending to work.
//
// This is a SUGGESTION, not an answer: OCR/vision on a hand-drawn or scanned
// site map can be wrong, so the result is always returned with a confidence
// level and is meant to be shown to the user for them to confirm or edit —
// never auto-applied to the form silently. See public/script.js for how the
// frontend handles that.
// =========================================================================

const https = require('https');

const GEMINI_MODEL = 'gemini-2.0-flash';
const MAX_BASE64_CHARS = 20 * 1024 * 1024; // ~15MB of actual file data
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

// Same bounds api/estimate.js enforces on these fields — a "reading" outside
// this range is more likely a misread than a real measurement, so it's
// suppressed rather than suggested.
const PLOT_MIN_FT = 10;
const PLOT_MAX_FT = 500;
const ROOM_MIN_FT = 4;
const ROOM_MAX_FT = 100;
const MAX_ROOMS_RETURNED = 20;

const EXTRACTION_PROMPT = 'This image or PDF is a site plan, plot map, or a photo of land/property markers ' +
  'for a construction project. Look for two things: (1) the plot\'s overall boundary dimensions — length ' +
  'and width in feet, and (2) any individual rooms marked or labeled inside the boundary, with their own ' +
  'length and width in feet and a short label (e.g. "Bedroom", "Living room", "Kitchen") if one is given, ' +
  'or a generic "Room" label if not. If dimensions are given in another unit (meters, yards), convert to ' +
  'feet. For the plot boundary, use the two measurements that most likely represent the overall plot rather ' +
  'than an individual room. Respond with ONLY a single JSON object, no other text, no markdown formatting, ' +
  'in exactly this shape: {"lengthFt": number or null, "widthFt": number or null, "confidence": "high" or ' +
  '"medium" or "low", "notes": "one short sentence explaining what you read or why you could not read it", ' +
  '"rooms": [{"length": number, "width": number, "label": string}, ...]}. "rooms" should be an empty array ' +
  'if none are legible. If you cannot find clear plot dimensions, return null for both plot numbers rather ' +
  'than guessing — do the same per-room (omit a room you are not reasonably confident about instead of ' +
  'guessing its size).';

function callGemini(imageBase64, mimeType) {
  return new Promise(function (resolve, reject) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      reject(new Error('GEMINI_API_KEY is not set on the server — see .env.example.'));
      return;
    }

    const payload = JSON.stringify({
      contents: [{
        parts: [
          { inline_data: { mime_type: mimeType, data: imageBase64 } },
          { text: EXTRACTION_PROMPT }
        ]
      }],
      generationConfig: { temperature: 0, maxOutputTokens: 500 }
    });

    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: '/v1beta/models/' + GEMINI_MODEL + ':generateContent?key=' + encodeURIComponent(apiKey),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
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

function parseModelReply(geminiResponse) {
  const candidate = (geminiResponse.candidates || [])[0];
  const textPart = candidate && candidate.content && (candidate.content.parts || []).filter(function (p) { return typeof p.text === 'string'; })[0];
  if (!textPart) {
    const blockReason = geminiResponse.promptFeedback && geminiResponse.promptFeedback.blockReason;
    throw new Error(blockReason ? 'The vision service declined to read this file (' + blockReason + ').' : 'The vision service did not return a readable response.');
  }

  // The model was asked for bare JSON, but strip a markdown fence defensively
  // in case one slips in anyway.
  const raw = textPart.text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  let parsed;
  try { parsed = JSON.parse(raw); } catch (e) {
    throw new Error('Could not understand the vision service\'s response.');
  }

  const inRange = function (n, min, max) { return typeof n === 'number' && isFinite(n) && n >= min && n <= max; };
  let lengthFt = inRange(parsed.lengthFt, PLOT_MIN_FT, PLOT_MAX_FT) ? parsed.lengthFt : null;
  let widthFt = inRange(parsed.widthFt, PLOT_MIN_FT, PLOT_MAX_FT) ? parsed.widthFt : null;
  let confidence = ['high', 'medium', 'low'].indexOf(parsed.confidence) !== -1 ? parsed.confidence : 'low';
  let notes = typeof parsed.notes === 'string' ? parsed.notes.slice(0, 300) : '';

  if ((parsed.lengthFt !== null && !inRange(parsed.lengthFt, PLOT_MIN_FT, PLOT_MAX_FT)) ||
      (parsed.widthFt !== null && !inRange(parsed.widthFt, PLOT_MIN_FT, PLOT_MAX_FT))) {
    confidence = 'low';
    notes = (notes ? notes + ' ' : '') + 'A plot reading fell outside a plausible size range (10–500 ft) and was discarded.';
  }

  // Same discipline as the plot dimensions: a room reading outside the
  // bounds api/estimate.js enforces is dropped rather than suggested, and
  // the whole list is capped so a bad read can't hand back hundreds of
  // fabricated rows.
  const rawRooms = Array.isArray(parsed.rooms) ? parsed.rooms.slice(0, MAX_ROOMS_RETURNED) : [];
  let roomsDiscarded = 0;
  const rooms = rawRooms.reduce(function (acc, r) {
    if (r && inRange(r.length, ROOM_MIN_FT, ROOM_MAX_FT) && inRange(r.width, ROOM_MIN_FT, ROOM_MAX_FT)) {
      const label = typeof r.label === 'string' && r.label.trim() ? r.label.trim().slice(0, 40) : 'Room';
      acc.push({ length: r.length, width: r.width, label: label });
    } else {
      roomsDiscarded++;
    }
    return acc;
  }, []);
  if (roomsDiscarded > 0) {
    notes = (notes ? notes + ' ' : '') + roomsDiscarded + ' detected room reading(s) fell outside a plausible size (4–100 ft) and were discarded.';
  }

  return { lengthFt: lengthFt, widthFt: widthFt, confidence: confidence, notes: notes, rooms: rooms };
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

  callGemini(imageBase64, mimeType)
    .then(function (geminiResponse) {
      const result = parseModelReply(geminiResponse);
      res.status(200).json(result);
    })
    .catch(function (err) {
      res.status(502).json({ error: err.message });
    });
};

module.exports.parseModelReply = parseModelReply; // exported for local testing
