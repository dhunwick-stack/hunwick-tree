import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  let body;
  try { body = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }

  const { name, dataUrl } = body;
  if (!name || !dataUrl?.startsWith("data:image/")) return new Response("Invalid payload", { status: 400 });

  const store = getStore("hunwick-family");
  const blobKey = "photo-" + name.replace(/[^a-zA-Z0-9]/g, "_");

  await store.set(blobKey, dataUrl);

  const index = (await store.get("photo-index", { type: "json" })) || {};
  index[name] = blobKey;
  await store.setJSON("photo-index", index);

  return Response.json({ ok: true });
};

export const config = { path: "/api/photo" };
