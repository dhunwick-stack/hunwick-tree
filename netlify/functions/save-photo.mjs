import { getStore } from "@netlify/blobs";
import { requireAuth } from "./auth-verify.mjs";

export default async (req, context) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const name = url.searchParams.get("name");
  if (!name) return new Response("Missing name param", { status: 400 });

  // Read raw bytes from body
  const buffer = await req.arrayBuffer();
  if (!buffer || buffer.byteLength === 0) return new Response("Empty body", { status: 400 });

  const store = getStore("hunwick-family");
  const blobKey = "photo-" + name.replace(/[^a-zA-Z0-9]/g, "_");

  // Store raw image bytes
  await store.set(blobKey, buffer);

  // Update photo index
  const index = (await store.get("photo-index", { type: "json" })) || {};
  index[name] = blobKey;
  await store.setJSON("photo-index", index);

  return Response.json({ ok: true });
};

export const config = { path: "/api/photo" };
