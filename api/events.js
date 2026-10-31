const {
  getDashboardSnapshot,
  advanceRecoveryStep,
  retryFailedEvent
} = require('./_engine');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const snapshot = getDashboardSnapshot();
      return res.status(200).json(snapshot);
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const { action } = body;

      if (action === 'advance_recovery') {
        const result = advanceRecoveryStep(body);
        return res.status(result.status).json(result.body);
      }

      if (action === 'retry_event') {
        const result = await retryFailedEvent(body);
        return res.status(result.status).json(result.body);
      }

      return res.status(400).json({ error: 'Unknown action. Use advance_recovery or retry_event.' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};
