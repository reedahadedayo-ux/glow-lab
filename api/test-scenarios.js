const { runScenarioTest, getDashboardSnapshot } = require('./_engine');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const proto = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers.host || 'localhost:3000';
  const origin = `${proto}://${host}`;

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { scenario } = body;

    if (scenario === 'all') {
      const results = [];
      for (let i = 1; i <= 6; i++) {
        const r = await runScenarioTest(i, origin);
        results.push(r.body);
      }
      const allPassed = results.every(r => r.passed);
      return res.status(200).json({
        ok: true,
        all_passed: allPassed,
        results,
        snapshot: getDashboardSnapshot()
      });
    }

    const result = await runScenarioTest(scenario, origin);
    return res.status(result.status).json({
      ...result.body,
      snapshot: getDashboardSnapshot()
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};
