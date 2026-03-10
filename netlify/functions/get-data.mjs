import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  // Strong consistency: always return the latest written data
  const store = getStore({ name: "hunwick-family", consistency: "strong" });

  const [people, photoIndex] = await Promise.all([
    store.get("people", { type: "json" }),
    store.get("photo-index", { type: "json" }),
  ]);

  return Response.json({
    people: people || null,
    photos: photoIndex || {},
  });
};

export const config = { path: "/api/data" };
