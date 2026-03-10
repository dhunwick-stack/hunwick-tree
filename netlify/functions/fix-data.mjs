import { getStore } from "@netlify/blobs";
import { requireAuth } from "./auth-verify.mjs";

export default async (req) => {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  const store = getStore({ name: "hunwick-family", consistency: "strong" });
  const people = (await store.get("people", { type: "json" })) || {};
  const changes = [];

  // ── STEP 1: Merge rename artifacts into canonical static keys ──────────────
  // These were created by rename but conflict with static HTML data-pkey values
  const mergeMap = {
    "Laith Cameron-Hunwick (b.2000)": "Laith (b.2000)",
    "David C. Hunwick (b.1973)":      "David (b.1973)",
  };

  for (const [wrongKey, rightKey] of Object.entries(mergeMap)) {
    if (!people[wrongKey]) continue;
    const good = people[wrongKey];
    const existing = people[rightKey] || {};
    // Merge good fields from the renamed entry into the canonical key
    people[rightKey] = {
      ...existing,
      ...(good.born      && { born: good.born }),
      ...(good.died      && { died: good.died }),
      ...(good.pob       && { pob: good.pob }),
      ...(good.pod       && { pod: good.pod }),
      ...(good.notes     && { notes: good.notes }),
      ...(good.occupation && { occupation: good.occupation }),
      ...(good.location  && { location: good.location }),
      ...(good.married   && { married: good.married }),
      ...(good.generation && { generation: good.generation }),
    };
    delete people[wrongKey];
    changes.push(`Merged "${wrongKey}" → "${rightKey}"`);

    // Rewrite all references from wrongKey → rightKey
    for (const p of Object.values(people)) {
      if (Array.isArray(p.children)) p.children = p.children.map(c => c === wrongKey ? rightKey : c);
      if (Array.isArray(p.parents))  p.parents  = p.parents.map(c => c === wrongKey ? rightKey : c);
      if (p.spouse === wrongKey)     p.spouse    = rightKey;
    }
  }

  // ── STEP 2: Set correct relationships for key people ──────────────────────

  // David (b.1973) — son of John O. Hunwick & Uwa Uldensi, married Cara
  if (people["David (b.1973)"]) {
    people["David (b.1973)"].parents  = ["John O. Hunwick", "Uwa Uldensi"];
    people["David (b.1973)"].spouse   = "Cara (b.1980)";
    people["David (b.1973)"].children = ["Johnny (b.2007)", "Sophia (b.2009)", "Sean (b.2013)"];
    changes.push("Fixed David (b.1973) parents/spouse/children");
  }

  // Cara (b.1980) — David's wife, NOT his child, has no parents in the tree
  if (people["Cara (b.1980)"]) {
    people["Cara (b.1980)"].parents  = [];
    people["Cara (b.1980)"].spouse   = "David (b.1973)";
    people["Cara (b.1980)"].children = ["Johnny (b.2007)", "Sophia (b.2009)", "Sean (b.2013)"];
    changes.push("Fixed Cara (b.1980) — spouse of David, not his child");
  }

  // John O. Hunwick — children should NOT include Mary
  if (people["John O. Hunwick"]) {
    people["John O. Hunwick"].children = [
      "Joseph (b.1959)", "Maryam (b.1960)",
      "Yvette (b.1969)", "Ann Clare (b.1971)", "David (b.1973)"
    ];
    changes.push("Fixed John O. Hunwick children (removed Mary, ensured correct list)");
  }

  // Mary (b.1938) — sister of John O. Hunwick, child of Cyril Owen
  if (people["Mary (b.1938)"]) {
    people["Mary (b.1938)"].parents = ["Cyril Owen (b.1898)", "Doris Miller (b.1900)"];
    changes.push("Fixed Mary (b.1938) parents");
  }

  // Cyril Owen (b.1898) — children include Mary but NOT Laith/David etc
  if (people["Cyril Owen (b.1898)"]) {
    people["Cyril Owen (b.1898)"].children = [
      "Muriel (b.1929)", "Peter (b.1931)", "John O. Hunwick", "Mary (b.1938)"
    ];
    changes.push("Fixed Cyril Owen (b.1898) children");
  }

  // Muriel (b.1929) — Cyril Owen's daughter
  if (people["Muriel (b.1929)"]) {
    people["Muriel (b.1929)"].parents = ["Cyril Owen (b.1898)", "Doris Miller (b.1900)"];
    changes.push("Fixed Muriel (b.1929) parents");
  }

  // Yvette (b.1969) — daughter of John O. Hunwick & Uwa Uldensi
  if (people["Yvette (b.1969)"]) {
    people["Yvette (b.1969)"].parents  = ["John O. Hunwick", "Uwa Uldensi"];
    people["Yvette (b.1969)"].children = ["Laith (b.2000)"];
    changes.push("Fixed Yvette (b.1969) parents/children");
  }

  // Laith (b.2000) — son of Yvette
  if (people["Laith (b.2000)"]) {
    people["Laith (b.2000)"].parents = ["Yvette (b.1969)"];
    changes.push("Fixed Laith (b.2000) parents");
  }

  // Ann Clare (b.1971) — daughter of John O. Hunwick & Uwa Uldensi
  if (people["Ann Clare (b.1971)"]) {
    people["Ann Clare (b.1971)"].parents = ["John O. Hunwick", "Uwa Uldensi"];
    changes.push("Fixed Ann Clare (b.1971) parents");
  }

  // Kingston and Christian John belong to Ann Clare, not David
  for (const k of ["Kingston (b.2020)", "Christian John (b.2014)"]) {
    if (people[k]) {
      people[k].parents = ["Ann Clare (b.1971)"];
      changes.push(`Fixed ${k} parents → Ann Clare`);
    }
  }

  await store.setJSON("people", people);

  // Snapshot for verification
  const verify = {};
  ["David (b.1973)", "Cara (b.1980)", "John O. Hunwick", "Cyril Owen (b.1898)",
   "Mary (b.1938)", "Yvette (b.1969)", "Laith (b.2000)", "Ann Clare (b.1971)"].forEach(k => {
    if (people[k]) verify[k] = {
      parents: people[k].parents,
      children: people[k].children,
      spouse: people[k].spouse
    };
  });

  return Response.json({ ok: true, changes, verify });
};

export const config = { path: "/api/fix-data" };
