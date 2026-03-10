import { getStore } from "@netlify/blobs";
import { requireAuth } from "./auth-verify.mjs";

// Unified save endpoint — strong consistency to avoid race conditions.
export default async (req, context) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  let body;
  try { body = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }

  const { key, data, parentKey, relType } = body;
  if (!key || typeof data !== "object") {
    return new Response("Missing key or data", { status: 400 });
  }

  // Strong consistency: guarantees we read the latest write before updating
  const store = getStore({ name: "hunwick-family", consistency: "strong" });
  const people = (await store.get("people", { type: "json" })) || {};

  // Strip null/undefined/empty-string values from the incoming patch
  // so that empty form fields never overwrite real stored data.
  // Exception: "notes", "died", "pod", "cod" CAN be explicitly cleared.
  const CLEARABLE = new Set(["notes", "died", "pod", "cod"]);
  const patch = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== null && v !== undefined && v !== "") {
      patch[k] = v;
    } else if (CLEARABLE.has(k)) {
      patch[k] = v || null;
    }
    // All other null/empty fields: skip
  }

  // Merge patch into existing person record
  people[key] = { ...(people[key] || {}), ...patch };

  // Update parent's children[] atomically if adding a new child
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

  // Update spouse link atomically
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
