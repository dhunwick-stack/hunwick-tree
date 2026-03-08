import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  const store = getStore("hunwick-family");
  const [edits, photos] = await Promise.all([
    store.get("edits", { type: "json" }),
    store.get("photo-index", { type: "json" }),
  ]);
  return Response.json({ edits: edits || {}, photos: photos || {} });
};

export const config = { path: "/api/data" };
