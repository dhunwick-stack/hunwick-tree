// One-time data fix + diagnostics endpoint
import { getStore } from "@netlify/blobs";
import { requireAuth } from "./auth-verify.mjs";

export default async (req) => {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  const store = getStore({ name: "hunwick-family", consistency: "strong" });
  const people = (await store.get("people", { type: "json" })) || {};

  // Return all keys containing "Laith", "Mary", "Yvette", "John O" for diagnosis
  const relevant = Object.keys(people).filter(k =>
    /laith|mary.*193|yvette|john o\./i.test(k)
  );

  const changes = [];

  // Fix: Mary (b.1938) parents → Cyril Owen, not John O. Hunwick
  const maryKey = Object.keys(people).find(k => /^Mary.*1938/i.test(k));
  if (maryKey) {
    people[maryKey].parents = ["Cyril Owen (b.1898)", "Doris Miller (b.1900)"];
    people[maryKey].generation = "9th";
    changes.push(`Fixed ${maryKey} parents → Cyril Owen & Doris`);
  }

  // Fix: Remove Mary from John O. Hunwick's children
  const johKey = Object.keys(people).find(k => /john o\. hunwick/i.test(k));
  if (johKey) {
    const before = people[johKey].children || [];
    people[johKey].children = before.filter(c => !/^Mary.*1938/i.test(c));
    if (before.length !== people[johKey].children.length) {
      changes.push(`Removed Mary from ${johKey} children`);
    }
    // Ensure Yvette is in children
    const yvetteKey = Object.keys(people).find(k => /^Yvette/i.test(k));
    if (yvetteKey && !people[johKey].children.includes(yvetteKey)) {
      people[johKey].children.push(yvetteKey);
      changes.push(`Added ${yvetteKey} to ${johKey} children`);
    }
  }

  // Fix: Ensure Cyril Owen has Mary in children
  const cyrKey = Object.keys(people).find(k => /cyril owen/i.test(k));
  if (cyrKey && maryKey && !people[cyrKey].children?.includes(maryKey)) {
    people[cyrKey].children = [...(people[cyrKey].children || []), maryKey];
    changes.push(`Added ${maryKey} to ${cyrKey} children`);
  }

  await store.setJSON("people", people);

  return Response.json({ ok: true, changes, relevantKeys: relevant });
};

export const config = { path: "/api/fix-data" };
