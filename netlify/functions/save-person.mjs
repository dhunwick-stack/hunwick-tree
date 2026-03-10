import { getStore } from "@netlify/blobs";

// Unified save endpoint: handles both new people and edits to existing ones.
// Also keeps parent children[] arrays in sync atomically.
export default async (req, context) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  let body;
  try { body = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }

  const { key, data, parentKey, relType } = body;
  // key       = pkey of the person being saved
  // data      = full or partial person object to merge in
  // parentKey = (optional) pkey of parent/spouse to link to
  // relType   = "child" | "spouse" — how to link
  if (!key || typeof data !== "object") {
    return new Response("Missing key or data", { status: 400 });
  }

  const store = getStore("hunwick-family");

  // Read current people (strong consistency so we don't clobber concurrent writes)
  const people = (await store.get("people", { type: "json" })) || {};

  // Merge new data into existing person record
  people[key] = { ...(people[key] || {}), ...data };

  // If a parent relationship is specified, update the parent record too
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
