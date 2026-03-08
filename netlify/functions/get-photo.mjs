import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  const key = new URL(req.url).searchParams.get("key");
  if (!key) return new Response("Missing key", { status: 400 });

  const store = getStore("hunwick-family");
  const buffer = await store.get(key, { type: "arrayBuffer" });
  if (!buffer) return new Response("Not found", { status: 404 });

  // Detect image type from first bytes
  const bytes = new Uint8Array(buffer);
  let contentType = "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50) contentType = "image/png";
  else if (bytes[0] === 0x47 && bytes[1] === 0x49) contentType = "image/gif";
  else if (bytes[0] === 0x52 && bytes[1] === 0x49) contentType = "image/webp";

  return new Response(buffer, { headers: { "Content-Type": contentType } });
};

export const config = { path: "/api/photo-get" };
