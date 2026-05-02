// =====================================================================
// /api/scan-estimate — Vercel serverless function
// Accepts a base64 image of a handwritten Sentry Fence sales agreement,
// calls Gemini vision API, and returns structured fields the front-end
// uses to auto-fill a new job card in the Quote Sent column.
// =====================================================================

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'POST only' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      success: false,
      message: 'GEMINI_API_KEY not configured. Add it in Vercel project settings.',
    });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const imageBase64 = body.imageBase64 || body.image;
    if (!imageBase64) {
      return res.status(400).json({ success: false, message: 'imageBase64 required in body.' });
    }

    const base64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/i, '');

    const prompt = [
      'You are extracting structured data from a handwritten Sentry Fence Company sales agreement.',
      'The form has a printed letterhead at top with company name and Peabody MA address,',
      'then handwritten fields: NAME, ADDRESS, CITY/TOWN, ZIP, HOME PHONE, BUSINESS PHONE, FAX PHONE,',
      'a multi-line WORK DESCRIPTION area in the middle, and TOTAL / DEPOSIT / C.O.D. dollar amounts on the right.',
      'A grid layout area at the bottom often has hand-drawn diagrams.',
      '',
      'Extract these fields. For any field that is unclear, blank, or unreadable, return an empty string (or 0 for numeric fields):',
      '- customerName: handwritten NAME (e.g. "Fred Davidson")',
      '- address: street address only without city (e.g. "21 Pinecrest")',
      '- town: handwritten CITY/TOWN value (e.g. "Peabody", "Danvers", "Chelmsford")',
      '- phone: best phone number found, formatted like "(978) 555-1234"',
      '- email: email address if visible, otherwise empty string',
      '- description: full work description as plain text, multiple line items joined with semicolons',
      '- totalValue: the TOTAL dollar amount as an integer (e.g. 1050, 2320, 875)',
      '- depositAmount: the DEPOSIT amount as integer if filled, else 0',
      '- linearFeet: total linear feet if mentioned anywhere in description, else 0',
      '- gateCount: number of gates mentioned, else 0',
      '- serviceType: best match from this list — Cedar Spaced Picket, White Vinyl Privacy, Ornamental Aluminum, Black Vinyl Chain Link, Stockade Wood, Split Rail, Pool Code Aluminum, Custom Wrought Iron. If none match, use "Custom".',
      '- date: date in MM/DD/YY format if visible at top right of form, else empty string',
      '',
      'Return ONLY valid JSON matching the schema. No markdown, no commentary.'
    ].join('\n');

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;

    const reqBody = {
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: 'image/jpeg', data: base64 } }
        ]
      }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            customerName: { type: 'string' },
            address: { type: 'string' },
            town: { type: 'string' },
            phone: { type: 'string' },
            email: { type: 'string' },
            description: { type: 'string' },
            totalValue: { type: 'number' },
            depositAmount: { type: 'number' },
            linearFeet: { type: 'number' },
            gateCount: { type: 'number' },
            serviceType: { type: 'string' },
            date: { type: 'string' }
          },
          required: ['customerName', 'address', 'town', 'totalValue', 'serviceType']
        },
        temperature: 0.1
      }
    };

    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody),
      });
    } catch (e) {
      return res.status(502).json({ success: false, message: 'Gemini network error: ' + e.message });
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return res.status(response.status).json({
        success: false,
        message: 'Gemini API error (' + response.status + '): ' + text.slice(0, 300),
      });
    }

    const data = await response.json();
    const candidate = data?.candidates?.[0];
    const textOut = candidate?.content?.parts?.[0]?.text;
    if (!textOut) {
      return res.status(500).json({
        success: false,
        message: 'Gemini returned no content. Was the image readable?',
        raw: candidate,
      });
    }

    let parsed;
    try {
      parsed = JSON.parse(textOut);
    } catch (e) {
      return res.status(500).json({
        success: false,
        message: 'Gemini returned non-JSON: ' + textOut.slice(0, 200),
      });
    }

    return res.status(200).json({ success: true, data: parsed });
  } catch (e) {
    console.error('scan-estimate error:', e);
    return res.status(500).json({
      success: false,
      message: 'Server error: ' + (e.message || 'unknown'),
    });
  }
};
