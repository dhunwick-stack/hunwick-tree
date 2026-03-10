import { getStore } from "@netlify/blobs";
import { requireAuth } from "./auth-verify.mjs";

// Batch save: accepts an array of { key, patch } objects.
export default async (req, context) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  let body;
  try { body = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }

  const { updates } = body; // [{ key, patch }, ...]
  if (!Array.isArray(updates) || updates.length === 0) {
    return new Response("Missing or empty updates array", { status: 400 });
  }

  const store = getStore({ name: "hunwick-family", consistency: "strong" });
  const people = (await store.get("people", { type: "json" })) || {};

  const CLEARABLE = new Set(["notes", "died", "pod", "cod"]);

  for (const { key, patch } of updates) {
    if (!key || typeof patch !== "object") continue;
    const cleaned = {};
    for (const [k, v] of Object.entries(patch)) {
      if (v !== null && v !== undefined && v !== "") {
        cleaned[k] = v;
      } else if (CLEARABLE.has(k)) {
        cleaned[k] = v || null;
      }
    }
    people[key] = { ...(people[key] || {}), ...cleaned };
  }

  await store.setJSON("people", people);
  return Response.json({ ok: true, updated: updates.length });
};

export const config = { path: "/api/save-many" };
