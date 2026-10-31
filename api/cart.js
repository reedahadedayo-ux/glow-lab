const { syncCart, getOrRecoverCart } = require('./_engine');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Idempotency-Key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const proto = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers.host || 'localhost:3000';
  const origin = `${proto}://${host}`;

  try {
    if (req.method === 'GET') {
      const url = new URL(req.url, origin);
      const cart_id = url.searchParams.get('cart_id');
      const recover_checkout = url.searchParams.get('recover_checkout') || url.searchParams.get('recovery_token');
      const result = getOrRecoverCart({ cart_id, recover_checkout }, origin);
      return res.status(result.status).json(result.body);
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const result = await syncCart(body, origin);
      return res.status(result.status).json(result.body);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};
