import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  let body;
  try { body = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }

  const { key, patch } = body;
  if (!key || typeof patch !== "object") return new Response("Missing key or patch", { status: 400 });

  const store = getStore("hunwick-family");
  const existing = (await store.get("edits", { type: "json" })) || {};
  existing[key] = { ...(existing[key] || {}), ...patch };
  await store.setJSON("edits", existing);

  return Response.json({ ok: true });
};

export const config = { path: "/api/edit" };
