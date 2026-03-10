import { getStore } from "@netlify/blobs";
import { requireAuth } from "./auth-verify.mjs";

export default async (req) => {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  const store = getStore({ name: "hunwick-family", consistency: "strong" });
  const people = (await store.get("people", { type: "json" })) || {};

  const changes = [];

  // Find keys by fuzzy match
  const findKey = (pattern) => Object.keys(people).find(k => pattern.test(k));

  const maryKey   = findKey(/^Mary.*1938/i);
  const johKey    = findKey(/john o\. hunwick/i);
  const cyrKey    = findKey(/cyril owen/i);
  const yvetteKey = findKey(/^Yvette/i);

  // 1. Fix Mary's parents
  if (maryKey) {
    people[maryKey].parents = ["Cyril Owen (b.1898)", "Doris Miller (b.1900)"];
    people[maryKey].generation = "9th";
    changes.push(`Fixed ${maryKey} parents`);
  }

  // 2. Fix John O. Hunwick's children — force to correct list
  if (johKey) {
    const correctChildren = ["Joseph (b.1959)", "Maryam (b.1960)", "Yvette (b.1969)", "Ann Clare (b.1971)", "David (b.1973)"];
    // Keep any extra children that were manually added (not Mary)
    const extras = (people[johKey].children || []).filter(c =>
      !correctChildren.includes(c) && !/^Mary.*1938/i.test(c)
    );
    people[johKey].children = [...correctChildren, ...extras];
    changes.push(`Set ${johKey} children to: ${people[johKey].children.join(', ')}`);
  }

  // 3. Ensure Cyril Owen has Mary in children
  if (cyrKey && maryKey) {
    const children = people[cyrKey].children || [];
    if (!children.includes(maryKey)) {
      people[cyrKey].children = [...children, maryKey];
      changes.push(`Added ${maryKey} to ${cyrKey} children`);
    }
  }

  // 4. Fix Yvette's parents if needed
  if (yvetteKey && johKey) {
    if (!people[yvetteKey].parents?.includes(johKey)) {
      people[yvetteKey].parents = [johKey, "Uwa Uldensi"];
      changes.push(`Fixed ${yvetteKey} parents`);
    }
  }

  await store.setJSON("people", people);

  // Return current state for verification
  const snapshot = {};
  [maryKey, johKey, cyrKey, yvetteKey].filter(Boolean).forEach(k => {
    snapshot[k] = { parents: people[k].parents, children: people[k].children };
  });

  return Response.json({ ok: true, changes, snapshot });
};

export const config = { path: "/api/fix-data" };
