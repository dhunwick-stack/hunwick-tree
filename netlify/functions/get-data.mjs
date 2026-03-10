import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  const store = getStore("hunwick-family");

  const [people, photoIndex] = await Promise.all([
    store.get("people", { type: "json" }),
    store.get("photo-index", { type: "json" }),
  ]);

  return Response.json({
    people: people || null,   // null = not seeded yet
    photos: photoIndex || {},
  });
};

export const config = { path: "/api/data" };
