// AI Research function — uses Claude to research genealogical data
// Handles multi-turn tool use (web search) automatically

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const auth = req.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorised' }), { status: 401 });
  }

  const { key, person } = await req.json();
  if (!key || !person) {
    return new Response(JSON.stringify({ error: 'Missing key or person' }), { status: 400 });
  }

  const apiKey = Netlify.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'No API key configured — add ANTHROPIC_API_KEY in Netlify environment variables' }), { status: 500 });
  }

  // Build context from known fields
  const known = [];
  if (person.birth)      known.push(`born ${person.birth}`);
  if (person.death)      known.push(`died ${person.death}`);
  if (person.pob)        known.push(`place of birth: ${person.pob}`);
  if (person.pod)        known.push(`place of death: ${person.pod}`);
  if (person.occupation) known.push(`occupation: ${person.occupation}`);
  if (person.location)   known.push(`location: ${person.location}`);
  if (person.generation) known.push(`generation ${person.generation} of the Hunwick family`);
  if (person.notes)      known.push(`notes: ${person.notes}`);

  const systemPrompt = `You are a genealogical researcher specialising in British family history, particularly Essex and London families from the 1600s–2000s. You have deep knowledge of census records, parish registers, civil registration, and genealogical databases.

The Hunwick direct line: William (patriarch, Kelvedon Essex) → William (bap.1706) → William (bap.1732) → Francis (bap.1763) → John (b.1796, Hoxton) → James (b.1828, Hoxton, draper) → Owen (b.1865, Kelvedon) → Cyril Owen (b.1898, Gravesend) → John O. Hunwick (1936–2015, historian of Africa, Northwestern University) → Ann Clare (b.1971) + David (b.1973).

You MUST respond with ONLY a valid JSON object — no preamble, no markdown, no explanation. The JSON must match this exact structure:
{
  "suggestions": [
    { "field": "birth", "value": "1828", "confidence": "high", "source": "1841 England Census" }
  ],
  "summary": "One or two sentence summary of findings.",
  "sources_searched": ["England Census records", "Parish registers", "FreeBMD"]
}

Valid field names: birth, death, pob, pod, occupation, location, notes, marriage.
Confidence: "high" (strong evidence), "medium" (reasonable inference), "low" (speculation).
Only suggest values not already known. If nothing new found, return empty suggestions array.`;

  const userPrompt = `Research this person: ${key}
Known information: ${known.length ? known.join(', ') : 'none yet'}

Find any birth year/place, death year/place, occupation, location, or notable facts not already listed above.`;

  try {
    const messages = [{ role: 'user', content: userPrompt }];
    let finalText = null;
    let iterations = 0;
    const maxIterations = 5;

    while (!finalText && iterations < maxIterations) {
      iterations++;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1500,
          system: systemPrompt,
          tools: [{ type: 'web_search_20250305', name: 'web_search' }],
          messages,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`API error ${response.status}: ${err}`);
      }

      const data = await response.json();

      if (data.stop_reason === 'end_turn') {
        // Final response — extract text
        const textBlock = data.content?.find(b => b.type === 'text');
        if (textBlock) {
          finalText = textBlock.text;
        } else {
          throw new Error('No text in final response');
        }
      } else if (data.stop_reason === 'tool_use') {
        // Claude wants to use a tool — add its response to messages and continue
        messages.push({ role: 'assistant', content: data.content });

        // Build tool results for all tool_use blocks
        const toolResults = data.content
          .filter(b => b.type === 'tool_use')
          .map(b => ({
            type: 'tool_result',
            tool_use_id: b.id,
            content: b.type === 'web_search' ? '(search completed)' : '',
          }));

        if (toolResults.length > 0) {
          messages.push({ role: 'user', content: toolResults });
        } else {
          // No tool results to add — shouldn't happen, but break to avoid infinite loop
          break;
        }
      } else {
        // Unexpected stop reason
        const textBlock = data.content?.find(b => b.type === 'text');
        if (textBlock) finalText = textBlock.text;
        else throw new Error(`Unexpected stop_reason: ${data.stop_reason}`);
      }
    }

    if (!finalText) throw new Error('No response after tool use');

    // Parse JSON from response — strip any accidental markdown fences
    const cleaned = finalText.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error(`Response was not JSON: ${cleaned.slice(0, 200)}`);

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

export const config = {
  path: '/api/research-person',
};
