// =====================================================================
// /api/login — Vercel serverless function
// Verifies a role + password against env vars, mints a Firebase custom
// token with a role claim, and returns it to the browser.
// =====================================================================

const admin = require('firebase-admin');

// Initialize Firebase Admin once per warm container
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      }),
    });
  } catch (e) {
    console.error('Firebase Admin init failed:', e.message);
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { role, password } = body;

    if (!role || !password) {
      return res.status(400).json({ success: false, message: 'Role and password required.' });
    }

    let validPassword;
    let displayRole;
    if (role === 'admin') {
      validPassword = process.env.ADMIN_PASSWORD;
      displayRole = 'Admin';
    } else if (role === 'sales') {
      validPassword = process.env.SALES_PASSWORD;
      displayRole = 'Sales Team';
    } else {
      return res.status(400).json({ success: false, message: 'Invalid role.' });
    }

    if (!validPassword) {
      console.error(`Missing env var for role: ${role}`);
      return res.status(500).json({
        success: false,
        message: 'Server not configured. Set ADMIN_PASSWORD and SALES_PASSWORD env vars in Vercel.',
      });
    }

    if (password !== validPassword) {
      await new Promise(r => setTimeout(r, 400));
      return res.status(401).json({ success: false, message: 'Incorrect password for selected role.' });
    }

    const uid = `${role}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const claims = {
      role: displayRole,
      roleKey: role,
      issuedAt: Date.now(),
    };

    const customToken = await admin.auth().createCustomToken(uid, claims);

    return res.status(200).json({
      success: true,
      customToken,
      role: displayRole,
      roleKey: role,
      uid,
    });
  } catch (e) {
    console.error('Login error:', e);
    return res.status(500).json({
      success: false,
      message: 'Authentication service error: ' + (e.message || 'unknown'),
    });
  }
};
