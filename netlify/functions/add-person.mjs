import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  let body;
  try { body = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }

  const { key, data } = body;
  if (!key || typeof data !== "object") return new Response("Missing key or data", { status: 400 });

  const store = getStore("hunwick-family");

  // Save into edits blob (same store the rest of the app uses)
  const edits = (await store.get("edits", { type: "json" })) || {};
  edits[key] = { ...(edits[key] || {}), ...data };
  await store.setJSON("edits", edits);

  // Also maintain a separate index of added people (so get-data can return them)
  const added = (await store.get("added-people", { type: "json" })) || {};
  added[key] = data;
  await store.setJSON("added-people", added);

  return Response.json({ ok: true, key });
};

export const config = { path: "/api/add-person" };
