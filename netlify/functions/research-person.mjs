// AI Research function — uses Claude with server-side web search
export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const auth = req.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorised' }), { status: 401 });
  }

  const body = await req.json();
  const key = body.key;
  const person = body.person || body; // support both formats

  if (!key) {
    return new Response(JSON.stringify({ error: 'Missing key' }), { status: 400 });
  }

  const apiKey = Netlify.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'No API key configured — add ANTHROPIC_API_KEY in Netlify environment variables' }), { status: 500 });
  }

  const known = [];
  if (person.born)       known.push(`born ${person.born}`);
  if (person.died)       known.push(`died ${person.died}`);
  if (person.pob)        known.push(`place of birth: ${person.pob}`);
  if (person.pod)        known.push(`place of death: ${person.pod}`);
  if (person.occupation) known.push(`occupation: ${person.occupation}`);
  if (person.location)   known.push(`location: ${person.location}`);
  if (person.generation) known.push(`generation: ${person.generation}`);
  if (person.notes)      known.push(`notes: ${person.notes}`);

  const systemPrompt = `You are a genealogical researcher specialising in British and African family history.

The Hunwick direct line: William (patriarch, Kelvedon Essex) → William (bap.1706) → William (bap.1732) → Francis (bap.1763) → John (b.1796, Hoxton) → James (b.1828, Hoxton, draper) → Owen (b.1865, Kelvedon) → Cyril Owen (b.1898, Gravesend) → John O. Hunwick (1936–2015, historian of Africa, Northwestern University) → Ann Clare (b.1971) + David (b.1973).

Use web search to find genealogical records, then respond with ONLY a valid JSON object — no preamble, no markdown, no explanation:
{
  "suggestions": [
    { "field": "born", "value": "1828", "confidence": "high", "source": "1841 England Census" }
  ],
  "summary": "One or two sentence summary of findings.",
  "sources_searched": ["England Census records", "Parish registers"]
}

Valid fields: born, died, pob, pod, occupation, location, notes, married.
Confidence: "high" (strong evidence), "medium" (reasonable inference), "low" (speculation).
Only suggest values not already known. If nothing new found, return empty suggestions array.`;

  const userPrompt = `Research this person from the Hunwick family tree: ${key}
Known information: ${known.length ? known.join(', ') : 'none yet'}

Search for birth records, death records, census entries, or other genealogical sources. Find anything not already listed above.`;

  try {
    // web_search_20250305 is a server-side tool — Anthropic runs the searches automatically.
    // We just make a single request; the API handles all tool iterations internally.
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 2000,
        system: systemPrompt,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`API error ${response.status}: ${err}`);
    }

    const data = await response.json();

    // Extract the final text block — get the last one (after any tool_use blocks)
    const textBlocks = data.content?.filter(b => b.type === 'text') || [];
    const textBlock = textBlocks[textBlocks.length - 1];
    if (!textBlock) {
      throw new Error(`No text response. stop_reason: ${data.stop_reason}, blocks: ${data.content?.map(b=>b.type).join(',')}`);
    }

    const cleaned = textBlock.text.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error(`Response was not JSON: ${cleaned.slice(0, 300)}`);

    const result = JSON.parse(jsonMatch[0]);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('Research error:', e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};

export const config = { path: '/api/research-person' };
