import { getStore } from "@netlify/blobs";

// Cleans up bad dynamic entries and fixes parent children arrays.
// GET /api/cleanup-added   → runs full cleanup automatically
export default async (req, context) => {
  const store = getStore("hunwick-family");

  const [added, edits] = await Promise.all([
    store.get("added-people", { type: "json" }),
    store.get("edits", { type: "json" }),
  ]);

  const addedData = added || {};
  const editsData = edits || {};
  const report = { removed: [], editsFixed: [] };

  // People who exist in static PEOPLE_DEFAULT — remove any dynamic duplicates.
  // Keys and common name variants to clean up:
  const staticPeople = [
    "Ben", "Ben Hughes", "Natasha", "Sapphire",
    "Joseph (b.1959)", "Maryam (b.1960)",
    "Laith (b.2000)", "Johnny (b.2007)", "Sophia (b.2009)", "Sean (b.2013)",
  ];
  const staticBaseNames = new Set(staticPeople.map(k => k.split(' (')[0].toLowerCase().trim()));

  for (const key of Object.keys(addedData)) {
    const baseName = (addedData[key]?.name || key.split(' (')[0]).toLowerCase().trim();
    if (staticBaseNames.has(baseName)) {
      report.removed.push(key);
      delete addedData[key];
    }
  }

  // Fix edits: remove Ben/static people from any children arrays
  for (const [personKey, patch] of Object.entries(editsData)) {
    if (Array.isArray(patch.children)) {
      const cleaned = patch.children.filter(c => {
        const base = c.split(' (')[0].toLowerCase().trim();
        return !staticBaseNames.has(base) || c === personKey; // keep if it's their own legit child
      });
      if (cleaned.length !== patch.children.length) {
        editsData[personKey].children = cleaned;
        report.editsFixed.push({ person: personKey, before: patch.children, after: cleaned });
      }
    }
  }

  // Write back both blobs
  await Promise.all([
    store.setJSON("added-people", addedData),
    store.setJSON("edits", editsData),
  ]);

  return Response.json({ ok: true, report, remaining: Object.keys(addedData) });
};

export const config = { path: "/api/cleanup-added" };
