import { getStore } from "@netlify/blobs";
import { requireAuth } from "./auth-verify.mjs";

// Rename a person — changes their key throughout the entire dataset.
// Updates all references: parent.children[], child.parents[], spouse links.
export default async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  let body;
  try { body = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }

  const { oldKey, newKey } = body;
  if (!oldKey || !newKey || oldKey === newKey) {
    return new Response(JSON.stringify({ error: "Missing or identical keys" }), { status: 400 });
  }

  const store = getStore({ name: "hunwick-family", consistency: "strong" });
  const people = (await store.get("people", { type: "json" })) || {};

  // Exact match first, then fuzzy match by display name
  let resolvedOldKey = oldKey;
  if (!people[oldKey]) {
    const oldDisplay = oldKey.split(' (')[0].toLowerCase().trim();
    resolvedOldKey = Object.keys(people).find(k =>
      k.toLowerCase().split(' (')[0].trim() === oldDisplay
    );
    if (!resolvedOldKey) {
      // Try even fuzzier match — first word only
      const firstWord = oldKey.split(' ')[0].toLowerCase();
      const fuzzyMatches = Object.keys(people).filter(k =>
        k.toLowerCase().startsWith(firstWord)
      );
      return new Response(JSON.stringify({
        error: `Person not found: "${oldKey}"`,
        hint: `Keys starting with "${firstWord}": ${fuzzyMatches.join(', ') || 'none'}`
      }), { status: 404 });
    }
  }
  if (people[newKey]) {
    return new Response(JSON.stringify({ error: "A person with that name/key already exists" }), { status: 409 });
  }

  // Copy record to new key, update the name field to match
  oldKey = resolvedOldKey; // use resolved key from here on
  const record = { ...people[oldKey] };
  const newDisplayName = newKey.split(' (')[0].trim();
  record.name = newDisplayName;
  people[newKey] = record;
  delete people[oldKey];

  // Update all references throughout the tree
  for (const [k, p] of Object.entries(people)) {
    if (k === newKey) continue;

    if (Array.isArray(p.children)) {
      p.children = p.children.map(c => c === oldKey ? newKey : c);
    }
    if (Array.isArray(p.parents)) {
      p.parents = p.parents.map(c => c === oldKey ? newKey : c);
    }
    if (typeof p.spouse === 'string' && p.spouse === oldKey) p.spouse = newKey;
  }

  // Also rename the photo index key if one exists
  const photoIndex = (await store.get("photo-index", { type: "json" })) || {};
  if (photoIndex[oldKey]) {
    photoIndex[newKey] = photoIndex[oldKey];
    delete photoIndex[oldKey];
    await store.setJSON("photo-index", photoIndex);
  }

  await store.setJSON("people", people);
  return Response.json({ ok: true, oldKey, newKey });
};

export const config = { path: "/api/rename-person" };
