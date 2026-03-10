// GEDCOM import function — parses a .ged file and maps it to Hunwick tree format
import { getStore } from '@netlify/blobs';

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const auth = req.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorised' }), { status: 401 });
  }

  const body = await req.json();
  const { gedcomText, mode = 'preview' } = body; // mode: 'preview' or 'import'

  if (!gedcomText) {
    return new Response(JSON.stringify({ error: 'No GEDCOM data provided' }), { status: 400 });
  }

  try {
    const parsed = parseGedcom(gedcomText);

    if (mode === 'preview') {
      return new Response(JSON.stringify({ people: parsed, count: parsed.length }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // mode === 'import' — merge into existing blob store
    const store = getStore({ name: 'hunwick-family', consistency: 'strong' });
    const existing = await store.get('people', { type: 'json' }) || {};

    let added = 0, updated = 0, skipped = 0;
    const changes = [];

    for (const person of parsed) {
      const key = person.key;
      if (!key) { skipped++; continue; }

      if (!existing[key]) {
        existing[key] = person.data;
        added++;
        changes.push({ action: 'added', key });
      } else {
        // Merge — only fill in missing fields, never overwrite existing data
        let changed = false;
        for (const [field, value] of Object.entries(person.data)) {
          if (value && !existing[key][field]) {
            existing[key][field] = value;
            changed = true;
          }
        }
        if (changed) { updated++; changes.push({ action: 'updated', key }); }
        else skipped++;
      }
    }

    await store.setJSON('people', existing);

    return new Response(JSON.stringify({ added, updated, skipped, changes }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('GEDCOM import error:', e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};

// ── GEDCOM parser ────────────────────────────────────────────────────────────

function parseGedcom(text) {
  const lines = text.split(/\r?\n/);
  const individuals = {};
  const families = {};

  let currentTag = null;
  let currentId = null;
  let currentRecord = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const match = line.match(/^(\d+)\s+(@\S+@|\w+)(?:\s+(.*))?$/);
    if (!match) continue;

    const level = parseInt(match[1]);
    const tag = match[2];
    const value = (match[3] || '').trim();

    if (level === 0) {
      // New record
      if (tag.startsWith('@') && value === 'INDI') {
        currentId = tag.replace(/@/g, '');
        currentRecord = { id: currentId, name: '', birth: '', death: '', sex: '', pob: '', pod: '', occupation: '', notes: '' };
        individuals[currentId] = currentRecord;
        currentTag = 'INDI';
      } else if (tag.startsWith('@') && value === 'FAM') {
        currentId = tag.replace(/@/g, '');
        currentRecord = { id: currentId, husb: '', wife: '', children: [] };
        families[currentId] = currentRecord;
        currentTag = 'FAM';
      } else {
        currentTag = null;
        currentRecord = null;
      }
      continue;
    }

    if (!currentRecord) continue;

    if (currentTag === 'INDI') {
      if (level === 1 && tag === 'NAME') {
        currentRecord.name = value.replace(/\//g, '').trim();
      } else if (level === 1 && tag === 'SEX') {
        currentRecord.sex = value;
      } else if (level === 1 && tag === 'OCCU') {
        currentRecord.occupation = value;
      } else if (level === 1 && tag === 'NOTE') {
        currentRecord.notes = value;
      } else if (level === 1 && (tag === 'BIRT' || tag === '_BIRT')) {
        currentRecord._inBirt = true; currentRecord._inDeat = false;
      } else if (level === 1 && (tag === 'DEAT' || tag === '_DEAT')) {
        currentRecord._inDeat = true; currentRecord._inBirt = false;
      } else if (level === 1) {
        currentRecord._inBirt = false; currentRecord._inDeat = false;
      } else if (level === 2 && tag === 'DATE') {
        if (currentRecord._inBirt) currentRecord.birth = normaliseDate(value);
        if (currentRecord._inDeat) currentRecord.death = normaliseDate(value);
      } else if (level === 2 && tag === 'PLAC') {
        if (currentRecord._inBirt) currentRecord.pob = value;
        if (currentRecord._inDeat) currentRecord.pod = value;
      }
    }

    if (currentTag === 'FAM') {
      if (level === 1 && tag === 'HUSB') families[currentId].husb = value.replace(/@/g, '');
      if (level === 1 && tag === 'WIFE') families[currentId].wife = value.replace(/@/g, '');
      if (level === 1 && tag === 'CHIL') families[currentId].children.push(value.replace(/@/g, ''));
    }
  }

  // Build parent lookups from families
  const childToFamily = {};
  const parentToChildren = {};
  for (const fam of Object.values(families)) {
    for (const childId of fam.children) {
      childToFamily[childId] = fam;
    }
    const parents = [fam.husb, fam.wife].filter(Boolean);
    for (const p of parents) {
      parentToChildren[p] = parentToChildren[p] || [];
      parentToChildren[p].push(...fam.children);
    }
  }

  // Convert to Hunwick format
  const results = [];
  for (const [id, indi] of Object.entries(individuals)) {
    if (!indi.name) continue;

    // Build key: "Firstname (b.YYYY)" or "Firstname Surname (b.YYYY)"
    const birthYear = indi.birth ? indi.birth.match(/\d{4}/)?.[0] : null;
    const key = birthYear
      ? `${indi.name} (b.${birthYear})`
      : indi.name;

    // Find parent key
    const fam = childToFamily[id];
    let parentKey = null;
    if (fam) {
      const parentId = fam.husb || fam.wife;
      if (parentId && individuals[parentId]) {
        const p = individuals[parentId];
        const pYear = p.birth ? p.birth.match(/\d{4}/)?.[0] : null;
        parentKey = pYear ? `${p.name} (b.${pYear})` : p.name;
      }
    }

    results.push({
      key,
      gedcomId: id,
      parentKey,
      data: {
        name: indi.name,
        birth: indi.birth || '',
        death: indi.death || '',
        pob: indi.pob || '',
        pod: indi.pod || '',
        occupation: indi.occupation || '',
        notes: indi.notes || '',
        sex: indi.sex || '',
      },
    });
  }

  return results;
}

function normaliseDate(value) {
  if (!value) return '';
  // GEDCOM dates: "14 FEB 1969", "ABT 1865", "BEF 1900" etc.
  const months = { JAN:'Jan',FEB:'Feb',MAR:'Mar',APR:'Apr',MAY:'May',JUN:'Jun',
                   JUL:'Jul',AUG:'Aug',SEP:'Sep',OCT:'Oct',NOV:'Nov',DEC:'Dec' };
  return value.replace(/\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\b/g,
    m => months[m] || m);
}

export const config = {
  path: '/api/gedcom-import',
};
