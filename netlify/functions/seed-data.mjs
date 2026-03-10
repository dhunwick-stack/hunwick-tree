import { getStore } from "@netlify/blobs";

// One-time seed: writes PEOPLE_DEFAULT into the Blob store.
// Safe to re-run — only seeds if "people" blob doesn't exist yet,
// unless ?force=true is passed to overwrite.
// Protected by a simple secret: ?secret=hunwick2025

const SEED = {
  "William (patriarch)": { born: null, died: null, spouse: "Mary", children: ["Mary (bap.1701)", "William (bap.1706)", "Francis (bap.1749)"], parents: [], notes: "", generation: "1st — Patriarch", isDirect: false },
  "Mary (bap.1701)": { born: "bap. 1701", died: null, parents: ["William (patriarch)", "Mary"], children: [], spouse: null, notes: "", generation: "2nd", isDirect: false },
  "William (bap.1706)": { born: "bap. 1706", died: "1744", spouse: "Ann Sullens", parents: ["William (patriarch)", "Mary"], children: ["William (bap.1732)", "Ann (bap.1735)", "Mary (bap.1738)", "Charles (bap.1749)", "Francis (bap.1749 ii)"], notes: "", generation: "2nd — Direct Line", isDirect: true },
  "Francis (bap.1749)": { born: "bap. 1749", died: null, parents: ["William (patriarch)", "Mary"], children: [], spouse: null, notes: "", generation: "2nd", isDirect: false },
  "William (bap.1732)": { born: "bap. 1732", died: null, spouse: "Elizabeth (m. 1753)", parents: ["William (bap.1706)", "Ann Sullens"], children: ["William (bap.1755)", "Francis (bap.1763)"], notes: "", generation: "3rd — Direct Line", isDirect: true },
  "Ann (bap.1735)": { born: "bap. 1735", died: null, parents: ["William (bap.1706)", "Ann Sullens"], children: [], spouse: null, notes: "", generation: "3rd", isDirect: false },
  "Mary (bap.1738)": { born: "bap. 1738", died: null, parents: ["William (bap.1706)", "Ann Sullens"], children: [], spouse: null, notes: "", generation: "3rd", isDirect: false },
  "Charles (bap.1749)": { born: "bap. 1749", died: null, parents: ["William (bap.1706)", "Ann Sullens"], children: [], spouse: null, notes: "", generation: "3rd", isDirect: false },
  "Francis (bap.1749 ii)": { born: "bap. 1749", died: null, parents: ["William (bap.1706)", "Ann Sullens"], children: [], spouse: null, notes: "", generation: "3rd", isDirect: false },
  "William (bap.1755)": { born: "bap. 1755", died: null, parents: ["William (bap.1732)", "Elizabeth"], children: [], spouse: null, notes: "", generation: "4th", isDirect: false },
  "Francis (bap.1763)": { born: "bap. 1763", died: "1804", spouse: "Lydia (m. 1787)", parents: ["William (bap.1732)", "Elizabeth"], children: ["Lydia (bap.1788)", "Francis (bap.1790)", "John (b.1796)", "Mary (b.1799)", "William (s/o Francis)"], notes: "", generation: "4th — Direct Line", isDirect: true },
  "Lydia (bap.1788)": { born: "bap. 1788", died: null, parents: ["Francis (bap.1763)", "Lydia"], children: [], spouse: null, notes: "", generation: "5th", isDirect: false },
  "Francis (bap.1790)": { born: "bap. 1790", died: null, parents: ["Francis (bap.1763)", "Lydia"], children: [], spouse: null, notes: "", generation: "5th", isDirect: false },
  "John (b.1796)": { born: "1796", died: "1860", pob: "Hoxton, Middlesex", spouse: "Mary Greenham", parents: ["Francis (bap.1763)", "Lydia"], children: ["James (b.1828)", "Sarah (b.1836)", "Ann (b.1839)", "Alfred (b.1842)"], notes: "", generation: "5th — Direct Line", isDirect: true },
  "Mary (b.1799)": { born: "1799", died: null, parents: ["Francis (bap.1763)", "Lydia"], children: [], spouse: null, notes: "", generation: "5th", isDirect: false },
  "William (s/o Francis)": { born: null, died: null, parents: ["Francis (bap.1763)", "Lydia"], children: [], spouse: null, notes: "", generation: "5th", isDirect: false },
  "James (b.1828)": { born: "1828", died: "9 Oct 1911", pob: "Hoxton, Middlesex", pod: "Braintree, Essex", spouse: "(1) Martha  (2) Esther (d.1911)", parents: ["John (b.1796)", "Mary Greenham"], children: ["Agnes (by Martha)", "James (b.1863)", "Ernest (b.1864)", "Owen (b.1865)", "Catherine (b.1868)", "Ella (b.1870)", "Cyril (b.1871)", "Bernard (b.1872)", "Clayton (b.1874)", "Gilbert (b.1876)", "Silas (b.1880)"], notes: "", generation: "6th — Direct Line", isDirect: true },
  "Sarah (b.1836)": { born: "1836", died: null, parents: ["John (b.1796)", "Mary Greenham"], children: [], spouse: null, notes: "", generation: "6th", isDirect: false },
  "Ann (b.1839)": { born: "1839", died: null, parents: ["John (b.1796)", "Mary Greenham"], children: [], spouse: null, notes: "", generation: "6th", isDirect: false },
  "Alfred (b.1842)": { born: "1842", died: null, parents: ["John (b.1796)", "Mary Greenham"], children: [], spouse: null, notes: "", generation: "6th", isDirect: false },
  "Agnes (by Martha)": { born: null, died: null, parents: ["James (b.1828)", "Martha"], children: [], spouse: null, notes: "Born to James's first wife Martha.", generation: "7th", isDirect: false },
  "James (b.1863)": { born: "1863", died: null, parents: ["James (b.1828)", "Esther"], children: [], spouse: null, notes: "", generation: "7th", isDirect: false },
  "Ernest (b.1864)": { born: "1864", died: null, parents: ["James (b.1828)", "Esther"], children: [], spouse: null, notes: "", generation: "7th", isDirect: false },
  "Owen (b.1865)": { born: "1865", died: null, pob: "Kelvedon, Essex", occupation: "Draper", spouse: "Eliza Lucy Stevenson", parents: ["James (b.1828)", "Esther"], children: ["Cyril Owen (b.1898)", "Lucy", "Ida", "Norman (b.1905)", "George Braden"], notes: "", generation: "7th — Direct Line", isDirect: true },
  "Catherine (b.1868)": { born: "1868", died: "1869", parents: ["James (b.1828)", "Esther"], children: [], spouse: null, notes: "Died in infancy.", generation: "7th", isDirect: false },
  "Ella (b.1870)": { born: "1870", died: null, parents: ["James (b.1828)", "Esther"], children: [], spouse: null, notes: "", generation: "7th", isDirect: false },
  "Cyril (b.1871)": { born: "1871", died: "1881", parents: ["James (b.1828)", "Esther"], children: [], spouse: null, notes: "", generation: "7th", isDirect: false },
  "Bernard (b.1872)": { born: "1872", died: null, parents: ["James (b.1828)", "Esther"], children: [], spouse: null, notes: "", generation: "7th", isDirect: false },
  "Clayton (b.1874)": { born: "1874", died: null, parents: ["James (b.1828)", "Esther"], children: [], spouse: null, notes: "", generation: "7th", isDirect: false },
  "Gilbert (b.1876)": { born: "1876", died: null, parents: ["James (b.1828)", "Esther"], children: [], spouse: null, notes: "", generation: "7th", isDirect: false },
  "Silas (b.1880)": { born: "1880", died: null, parents: ["James (b.1828)", "Esther"], children: [], spouse: null, notes: "", generation: "7th", isDirect: false },
  "Cyril Owen (b.1898)": { born: "1898", died: "14 Feb 1969", pob: "Gravesend, Kent", spouse: "Doris Miller (b.1900)", married: "1928", parents: ["Owen (b.1865)", "Eliza Lucy Stevenson"], children: ["Muriel (b.1929)", "Peter (b.1931)", "John O. Hunwick", "Mary (b.1938)"], notes: "", generation: "8th — Direct Line", isDirect: true },
  "Doris Miller (b.1900)": { born: "1900", died: "1993", pob: null, spouse: "Cyril Owen (b.1898)", married: "1928", parents: [], children: ["Muriel (b.1929)", "Peter (b.1931)", "John O. Hunwick", "Mary (b.1938)"], notes: "Married Cyril Owen Hunwick in 1928.", generation: "8th", isDirect: false },
  "Lucy": { born: null, died: null, parents: ["Owen (b.1865)", "Eliza Lucy Stevenson"], children: [], spouse: null, notes: "", generation: "8th", isDirect: false },
  "Ida": { born: null, died: null, parents: ["Owen (b.1865)", "Eliza Lucy Stevenson"], children: [], spouse: null, notes: "", generation: "8th", isDirect: false },
  "Norman (b.1905)": { born: "1905", died: "1979", spouse: "Doris Taylor", parents: ["Owen (b.1865)", "Eliza Lucy Stevenson"], children: ["Gillian (b.1936)", "Carola (b.1938)", "Nicholas (b.1947)"], notes: "", generation: "8th", isDirect: false },
  "George Braden": { born: null, died: null, parents: ["Owen (b.1865)", "Eliza Lucy Stevenson"], children: [], spouse: null, notes: "", generation: "8th", isDirect: false },
  "Gillian (b.1936)": { born: "1936", died: null, parents: ["Norman (b.1905)", "Doris Taylor"], children: [], spouse: null, notes: "", generation: "9th", isDirect: false },
  "Carola (b.1938)": { born: "1938", died: "1978", parents: ["Norman (b.1905)", "Doris Taylor"], children: [], spouse: null, notes: "", generation: "9th", isDirect: false },
  "Nicholas (b.1947)": { born: "1947", died: null, parents: ["Norman (b.1905)", "Doris Taylor"], children: [], spouse: null, notes: "", generation: "9th", isDirect: false },
  "Muriel (b.1929)": { born: "1929", died: null, parents: ["Cyril Owen (b.1898)", "Doris Miller (b.1900)"], children: [], spouse: null, notes: "Deceased.", generation: "9th", isDirect: false },
  "Peter (b.1931)": { born: "1931", died: null, parents: ["Cyril Owen (b.1898)", "Doris Miller (b.1900)"], children: [], spouse: null, notes: "Deceased.", generation: "9th", isDirect: false },
  "John O. Hunwick": { born: "1936", died: "1 April 2015", pob: "Bristol, England, UK", spouse: "(1) Audrey Najer-Grant (m.1957)  (2) Uwa Uldensi (m.1966)", parents: ["Cyril Owen (b.1898)", "Doris Miller (b.1900)"], children: ["Joseph (b.1959)", "Maryam (b.1960)", "Yvette (b.1969)", "Ann Clare (b.1971)", "David (b.1973)"], notes: "Pioneering British scholar of Islam in sub-Saharan Africa. Professor Emeritus, Northwestern University.", generation: "9th — Direct Line", isDirect: true },
  "Mary (b.1938)": { born: "1938", died: null, parents: ["Cyril Owen (b.1898)", "Doris Miller (b.1900)"], children: [], spouse: null, notes: "", generation: "9th", isDirect: false },
  "Joseph (b.1959)": { born: "1959", died: null, parents: ["John O. Hunwick", "Audrey Najer-Grant"], children: ["Sapphire"], spouse: null, notes: "", generation: "10th", isDirect: false },
  "Maryam (b.1960)": { born: "1960", died: null, parents: ["John O. Hunwick", "Audrey Najer-Grant"], children: ["Natasha", "Ben"], spouse: null, notes: "", generation: "10th", isDirect: false },
  "Yvette (b.1969)": { born: "1969", died: null, pob: "Islington, London, UK", parents: ["John O. Hunwick", "Uwa Uldensi"], children: ["Laith (b.2000)"], spouse: null, notes: "", generation: "10th", isDirect: false },
  "Ann Clare (b.1971)": { born: "1971", died: null, pob: "Islington, London, UK", parents: ["John O. Hunwick", "Uwa Uldensi"], children: ["Jason (b.1990)", "Jessica (b.1991)", "Shawnine (b.1994)", "Maia (b.1999)", "Kingston (b.2020)", "Christian John (b.2014)"], spouse: null, notes: "", generation: "10th — Direct Line", isDirect: true },
  "David (b.1973)": { born: "1973", died: null, pob: "Islington, London, UK", parents: ["John O. Hunwick", "Uwa Uldensi"], children: ["Johnny (b.2007)", "Sophia (b.2009)", "Sean (b.2013)"], spouse: "Cara (b.1980)", notes: "Dave Hunwick — Apple ecosystem consultant, photographer, DJ.", generation: "10th — Direct Line", location: "Evanston, IL, USA", occupation: "Apple Consultant, Photographer, DJ", url: "https://dhcs.online", isDirect: true },
  "Cara (b.1980)": { born: "1 November 1980", died: null, parents: [], children: ["Johnny (b.2007)", "Sophia (b.2009)", "Sean (b.2013)"], spouse: "David (b.1973)", notes: "", generation: "10th", isDirect: false },
  "Laith (b.2000)": { born: "25 January 2000", died: null, pob: "Chicago, IL, USA", parents: ["Yvette (b.1969)"], children: [], spouse: null, notes: "", generation: "11th", isDirect: false },
  "Jason (b.1990)": { born: "1990", died: null, pob: "England, UK", parents: ["Ann Clare (b.1971)"], children: [], spouse: null, notes: "", generation: "11th", isDirect: false },
  "Jessica (b.1991)": { born: "1991", died: null, pob: "England, UK", parents: ["Ann Clare (b.1971)"], children: [], spouse: null, notes: "", generation: "11th", isDirect: false },
  "Shawnine (b.1994)": { born: "1994", died: null, pob: "England, UK", parents: ["Ann Clare (b.1971)"], children: [], spouse: null, notes: "", generation: "11th", isDirect: false },
  "Maia (b.1999)": { born: "1999", died: null, pob: "England, UK", parents: ["Ann Clare (b.1971)"], children: [], spouse: null, notes: "", generation: "11th", isDirect: false },
  "Kingston (b.2020)": { born: "14 October 2020", died: null, parents: ["Ann Clare (b.1971)"], children: [], spouse: null, notes: "", generation: "11th", isDirect: false },
  "Christian John (b.2014)": { born: "11 September 2014", died: null, parents: ["Ann Clare (b.1971)"], children: [], spouse: null, notes: "", generation: "11th", isDirect: false },
  "Johnny (b.2007)": { born: "27 January 2007", died: null, pob: "Skokie, IL, USA", parents: ["David (b.1973)", "Cara (b.1980)"], children: [], spouse: null, notes: "", generation: "11th", location: "Prague, Czech Republic", occupation: "Footballer, Bohemians U19", isDirect: false },
  "Sophia (b.2009)": { born: "28 April 2009", died: null, pob: "Evanston, IL, USA", parents: ["David (b.1973)", "Cara (b.1980)"], children: [], spouse: null, notes: "", generation: "11th", isDirect: false },
  "Sean (b.2013)": { born: "8 February 2013", died: null, pob: "Evanston, IL, USA", parents: ["David (b.1973)", "Cara (b.1980)"], children: [], spouse: null, notes: "", generation: "11th", isDirect: false },
  "Sapphire": { born: null, died: null, parents: ["Joseph (b.1959)"], children: [], spouse: null, notes: "", generation: "11th", isDirect: false },
  "Natasha": { born: null, died: null, parents: ["Maryam (b.1960)"], children: [], spouse: null, notes: "", generation: "11th", isDirect: false },
  "Ben": { born: null, died: null, parents: ["Maryam (b.1960)"], children: [], spouse: null, notes: "", generation: "11th", isDirect: false }
};

export default async (req, context) => {
  const url = new URL(req.url);
  if (url.searchParams.get("secret") !== "hunwick2025") {
    return new Response("Unauthorized", { status: 401 });
  }

  const store = getStore("hunwick-family");
  const existing = await store.get("people", { type: "json" });

  if (existing && url.searchParams.get("force") !== "true") {
    return Response.json({ ok: false, message: "Already seeded. Pass ?force=true to overwrite.", count: Object.keys(existing).length });
  }

  await store.setJSON("people", SEED);
  return Response.json({ ok: true, seeded: Object.keys(SEED).length });
};

export const config = { path: "/api/seed" };
