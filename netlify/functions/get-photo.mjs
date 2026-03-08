import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  const key = new URL(req.url).searchParams.get("key");
  if (!key) return new Response("Missing key", { status: 400 });

  const store = getStore("hunwick-family");
  const dataUrl = await store.get(key);
  if (!dataUrl) return new Response("Not found", { status: 404 });

  return Response.json({ dataUrl });
};

export const config = { path: "/api/photo" };
