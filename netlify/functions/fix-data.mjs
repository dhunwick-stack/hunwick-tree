// One-time data fix endpoint — corrects Mary (b.1938) parents and ensures
// Yvette (b.1969) is in John O. Hunwick's children list.
// Delete this file after running once.
import { getStore } from "@netlify/blobs";
import { requireAuth } from "./auth-verify.mjs";

export default async (req) => {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  const store = getStore({ name: "hunwick-family", consistency: "strong" });
  const people = (await store.get("people", { type: "json" })) || {};

  const changes = [];

  // Fix 1: Mary (b.1938) — ensure parents are Cyril Owen and Doris, NOT John O. Hunwick
  if (people["Mary (b.1938)"]) {
    people["Mary (b.1938)"].parents = ["Cyril Owen (b.1898)", "Doris Miller (b.1900)"];
    people["Mary (b.1938)"].generation = "9th";
    changes.push("Fixed Mary (b.1938) parents → Cyril Owen & Doris");
  }

  // Fix 2: Remove Mary from John O. Hunwick's children if present
  if (people["John O. Hunwick"]) {
    const before = people["John O. Hunwick"].children || [];
    people["John O. Hunwick"].children = before.filter(c => c !== "Mary (b.1938)");
    if (before.length !== people["John O. Hunwick"].children.length) {
      changes.push("Removed Mary (b.1938) from John O. Hunwick children");
    }
    // Fix 3: Ensure Yvette is in John O. Hunwick's children
    if (!people["John O. Hunwick"].children.includes("Yvette (b.1969)")) {
      people["John O. Hunwick"].children.push("Yvette (b.1969)");
      changes.push("Added Yvette (b.1969) to John O. Hunwick children");
    }
  }

  // Fix 4: Ensure Cyril Owen has Mary in his children
  if (people["Cyril Owen (b.1898)"]) {
    if (!people["Cyril Owen (b.1898)"].children.includes("Mary (b.1938)")) {
      people["Cyril Owen (b.1898)"].children.push("Mary (b.1938)");
      changes.push("Added Mary (b.1938) to Cyril Owen children");
    }
  }

  // Fix 5: Ensure Yvette exists with correct parents
  if (!people["Yvette (b.1969)"]) {
    people["Yvette (b.1969)"] = {
      born: "7/5/1969", died: null, pob: "Islington, London, UK",
      parents: ["John O. Hunwick", "Uwa Uldensi"],
      children: ["Laith (b.2000)"], spouse: null, notes: "",
      generation: "10th", isDirect: false
    };
    changes.push("Created Yvette (b.1969)");
  } else {
    if (!people["Yvette (b.1969)"].parents?.includes("John O. Hunwick")) {
      people["Yvette (b.1969)"].parents = ["John O. Hunwick", "Uwa Uldensi"];
      changes.push("Fixed Yvette (b.1969) parents");
    }
  }

  await store.setJSON("people", people);
  return Response.json({ ok: true, changes });
};

export const config = { path: "/api/fix-data" };
