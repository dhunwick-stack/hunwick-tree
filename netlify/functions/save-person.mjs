import { getStore } from "@netlify/blobs";

// Unified save endpoint: handles both edits to existing people and new additions.
// Merges patch into existing record — null/undefined values in patch are IGNORED
// so empty form fields never clobber real data already stored.
export default async (req, context) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  let body;
  try { body = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }

  const { key, data, parentKey, relType } = body;
  if (!key || typeof data !== "object") {
    return new Response("Missing key or data", { status: 400 });
  }

  const store = getStore("hunwick-family");
  const people = (await store.get("people", { type: "json" })) || {};

  // Strip null/undefined/empty-string values from the incoming patch
  // so that empty form fields never overwrite real stored data.
  // Exception: "notes" and "died" and "pod" and "cod" CAN be explicitly cleared.
  const CLEARABLE = new Set(["notes", "died", "pod", "cod"]);
  const patch = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== null && v !== undefined && v !== "") {
      patch[k] = v;
    } else if (CLEARABLE.has(k)) {
      // Allow explicit clearing of these fields (null → store null)
      patch[k] = v || null;
    }
    // All other null/empty fields: skip — don't clobber existing data
  }

  // Merge patch into existing person record
  people[key] = { ...(people[key] || {}), ...patch };

  // If a parent relationship is specified, update the parent's children[] too
  if (parentKey && relType === "child") {
    const parent = people[parentKey];
    if (parent) {
      const children = parent.children || [];
      if (!children.includes(key)) {
        parent.children = [...children, key];
        people[parentKey] = parent;
      }
    }
  }

  if (parentKey && relType === "spouse") {
    const existing = people[parentKey];
    if (existing) {
      people[parentKey] = { ...existing, spouse: key };
    }
  }

  await store.setJSON("people", people);
  return Response.json({ ok: true, key });
};

export const config = { path: "/api/save-person" };
