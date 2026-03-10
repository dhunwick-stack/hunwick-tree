import { getStore } from "@netlify/blobs";
import { requireAuth } from "./auth-verify.mjs";

export default async (req) => {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  const store = getStore({ name: "hunwick-family", consistency: "strong" });
  const people = (await store.get("people", { type: "json" })) || {};

  const changes = [];

  // These are the STATIC HTML canonical keys — any blob entries with these
  // display names but DIFFERENT keys are rename artifacts that must be merged/deleted
  const canonicalKeys = {
    // blob key (wrong) → static HTML key (correct)
    "David C. Hunwick (b.1973)":    "David (b.1973)",
    "Yvette Hunwick (b.1969)":      "Yvette (b.1969)",
    "Laith Cameron-Hunwick (b.2000)": "Laith (b.2000)",
    "Cyril Owen Hunwick (b.1898)":  "Cyril Owen (b.1898)",
    "Muriel Westwater (b.1929)":    "Muriel (b.1929)",
    "Ann Clare Hunwick (b.1971)":   "Ann Clare (b.1971)",
    "John O. Hunwick (b.1936)":     "John O. Hunwick",
  };

  // 1. Merge wrongly-keyed blob entries into the canonical key, then delete the wrong key
  for (const [wrongKey, rightKey] of Object.entries(canonicalKeys)) {
    if (people[wrongKey]) {
      // Merge into canonical key (preserve good fields, don't overwrite with bad parents)
      const existing = people[rightKey] || {};
      const wrongData = people[wrongKey];
      // Only merge non-parent fields (parents in blob may be wrong)
      people[rightKey] = {
        ...existing,
        born: wrongData.born || existing.born,
        died: wrongData.died || existing.died,
        pob: wrongData.pob || existing.pob,
        notes: wrongData.notes || existing.notes,
        occupation: wrongData.occupation || existing.occupation,
        location: wrongData.location || existing.location,
        photo: wrongData.photo || existing.photo,
        _edited: wrongData._edited || existing._edited,
      };
      delete people[wrongKey];
      changes.push(`Merged "${wrongKey}" → "${rightKey}" and deleted wrong key`);

      // Fix all references to wrongKey throughout the tree
      for (const [k, p] of Object.entries(people)) {
        let changed = false;
        if (Array.isArray(p.children)) {
          const newC = p.children.map(c => c === wrongKey ? rightKey : c);
          if (JSON.stringify(newC) !== JSON.stringify(p.children)) { p.children = newC; changed = true; }
        }
        if (Array.isArray(p.parents)) {
          const newP = p.parents.map(c => c === wrongKey ? rightKey : c);
          if (JSON.stringify(newP) !== JSON.stringify(p.parents)) { p.parents = newP; changed = true; }
        }
        if (p.spouse === wrongKey) { p.spouse = rightKey; changed = true; }
        if (changed) changes.push(`  Updated references in "${k}"`);
      }
    }
  }

  // 2. Fix David (b.1973) — correct parents and children
  if (people["David (b.1973)"]) {
    people["David (b.1973)"].parents = ["John O. Hunwick", "Cara (b.1980)"];
    people["David (b.1973)"].spouse = "Cara (b.1980)";
    // His children per the tree
    people["David (b.1973)"].children = ["Johnny (b.2007)", "Sophia (b.2009)", "Sean (b.2013)"];
    changes.push("Fixed David (b.1973) parents, spouse, children");
  }

  // 3. Fix Cara (b.1980) — she's David's wife, not a child
  if (people["Cara (b.1980)"]) {
    people["Cara (b.1980)"].parents = [];
    people["Cara (b.1980)"].spouse = "David (b.1973)";
    people["Cara (b.1980)"].children = ["Johnny (b.2007)", "Sophia (b.2009)", "Sean (b.2013)"];
    changes.push("Fixed Cara (b.1980) — set as David's spouse, cleared bad parents");
  }

  // 4. Fix John O. Hunwick children — remove Mary, keep correct set
  if (people["John O. Hunwick"]) {
    people["John O. Hunwick"].children = [
      "Joseph (b.1959)", "Maryam (b.1960)",
      "Yvette (b.1969)", "Ann Clare (b.1971)", "David (b.1973)"
    ];
    changes.push("Fixed John O. Hunwick children");
  }

  // 5. Fix Mary (b.1938) parents
  if (people["Mary (b.1938)"]) {
    people["Mary (b.1938)"].parents = ["Cyril Owen (b.1898)", "Doris Miller (b.1900)"];
    changes.push("Fixed Mary (b.1938) parents");
  }

  // 6. Fix Cyril Owen (b.1898) children
  if (people["Cyril Owen (b.1898)"]) {
    people["Cyril Owen (b.1898)"].children = [
      "Muriel (b.1929)", "Peter (b.1931)", "John O. Hunwick", "Mary (b.1938)"
    ];
    changes.push("Fixed Cyril Owen (b.1898) children");
  }

  // 7. Fix Muriel (b.1929) — she's Cyril Owen's daughter
  if (people["Muriel (b.1929)"]) {
    people["Muriel (b.1929)"].parents = ["Cyril Owen (b.1898)", "Doris Miller (b.1900)"];
    changes.push("Fixed Muriel (b.1929) parents");
  }

  // 8. Fix Ann Clare (b.1971) parents
  if (people["Ann Clare (b.1971)"]) {
    people["Ann Clare (b.1971)"].parents = ["John O. Hunwick", "Uwa Uldensi"];
    changes.push("Fixed Ann Clare (b.1971) parents");
  }

  // 9. Fix Yvette (b.1969) parents and children
  if (people["Yvette (b.1969)"]) {
    people["Yvette (b.1969)"].parents = ["John O. Hunwick", "Uwa Uldensi"];
    people["Yvette (b.1969)"].children = ["Laith (b.2000)"];
    changes.push("Fixed Yvette (b.1969) parents and children");
  }

  // 10. Fix Laith (b.2000) parents
  if (people["Laith (b.2000)"]) {
    people["Laith (b.2000)"].parents = ["Yvette (b.1969)"];
    changes.push("Fixed Laith (b.2000) parents");
  }

  await store.setJSON("people", people);

  // Snapshot key relationships
  const snap = {};
  ["David (b.1973)", "Cara (b.1980)", "John O. Hunwick", "Cyril Owen (b.1898)",
   "Mary (b.1938)", "Yvette (b.1969)", "Laith (b.2000)", "Muriel (b.1929)"].forEach(k => {
    if (people[k]) snap[k] = { parents: people[k].parents, children: people[k].children, spouse: people[k].spouse };
  });

  // Also show any remaining "orphan" blob keys that don't match static HTML
  const staticKeys = new Set([
    "William (b.1680)","William (b.1706)","William (b.1732)","Francis (b.1763)",
    "John (b.1796)","James (b.1828)","Owen (b.1865)","Cyril Owen (b.1898)",
    "Doris Miller (b.1900)","John O. Hunwick","Uwa Uldensi","Audrey Najer-Grant",
    "Muriel (b.1929)","Peter (b.1931)","Mary (b.1938)",
    "Joseph (b.1959)","Maryam (b.1960)","Yvette (b.1969)",
    "Ann Clare (b.1971)","David (b.1973)","Laith (b.2000)",
    "Cara (b.1980)","Johnny (b.2007)","Sophia (b.2009)","Sean (b.2013)",
    "Jason (b.1990)","Jessica (b.1991)","Shawnine (b.1994)","Maia (b.1999)",
    "Kingston (b.2020)","Christian John (b.2014)",
    "Eliza Lucy Stevenson","Ben Hughes (b.1987)",
    "Zion","Galena","Rain","Summer","Akira (b.2018)",
  ]);
  const unknownKeys = Object.keys(people).filter(k => !staticKeys.has(k));

  return Response.json({ ok: true, changes, snapshot: snap, unknownKeys });
};

export const config = { path: "/api/fix-data" };
