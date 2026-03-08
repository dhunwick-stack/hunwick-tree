import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  const store = getStore("hunwick-family");
  const [edits, photos, added] = await Promise.all([
    store.get("edits", { type: "json" }),
    store.get("photo-index", { type: "json" }),
    store.get("added-people", { type: "json" }),
  ]);
  return Response.json({ edits: edits || {}, photos: photos || {}, added: added || {} });
};

export const config = { path: "/api/data" };
