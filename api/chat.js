export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const {
      model = 'gpt-4o-mini',
      temperature = 0.7,
      messages = [],
      provider = 'openai',
      useCustom = false,
      customEndpoint,
      customApiKey
    } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages is required' });
    }

    // Decide endpoint and apiKey
    let endpoint = '';
    let apiKey = '';
    if (useCustom) {
      if (!customEndpoint || !customApiKey) {
        return res.status(400).json({ error: 'customEndpoint and customApiKey are required when useCustom=true' });
      }
      endpoint = String(customEndpoint);
      apiKey = String(customApiKey);
    } else {
      if (provider === 'openai') {
        endpoint = 'https://api.openai.com/v1/chat/completions';
        apiKey = process.env.OPENAI_API_KEY || '';
      } else if (provider === 'openrouter') {
        endpoint = 'https://openrouter.ai/api/v1/chat/completions';
        apiKey = process.env.OPENROUTER_API_KEY || '';
      } else if (provider === 'together') {
        endpoint = 'https://api.together.xyz/v1/chat/completions';
        apiKey = process.env.TOGETHER_API_KEY || '';
      } else {
        return res.status(400).json({ error: `Unknown provider: ${provider}` });
      }
      if (!apiKey) {
        return res.status(500).json({ error: `Missing server API key for provider: ${provider}` });
      }
    }

    const payload = { model, temperature, messages };

    const r = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).json({ error: text });
    }
    const data = await r.json();
    const content = data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? '';
    return res.status(200).json({ content });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Server error' });
  }
}


