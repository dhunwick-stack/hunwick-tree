import { getStore } from "@netlify/blobs";

// One-time cleanup: removes dynamically-added entries for people
// who already exist in the static PEOPLE_DEFAULT data.
// Also removes entries where parents point to the wrong person.
// GET /api/cleanup-added?key=Ben          → removes "Ben" from added-people
// GET /api/cleanup-added?key=Ben&dry=1    → preview only, no write
export default async (req, context) => {
  const url = new URL(req.url);
  const keyToRemove = url.searchParams.get("key");
  const dry = url.searchParams.get("dry") === "1";

  if (!keyToRemove) {
    return Response.json({ error: "Missing ?key= param" }, { status: 400 });
  }

  const store = getStore("hunwick-family");
  const added = (await store.get("added-people", { type: "json" })) || {};

  if (!(keyToRemove in added)) {
    return Response.json({ ok: true, message: `"${keyToRemove}" not found in added-people`, added });
  }

  const removed = added[keyToRemove];
  if (!dry) {
    delete added[keyToRemove];
    await store.setJSON("added-people", added);
  }

  return Response.json({
    ok: true,
    dry,
    removed,
    remaining: Object.keys(added)
  });
};

export const config = { path: "/api/cleanup-added" };
