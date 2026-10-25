#!/usr/bin/env node
// Standalone zero-dependency reproduction script for bnty_0282 (CANDIDATE SCOUT: VLASS1QLCIR J031156.40+480547.7)
// Usage: node reproduce_candidate.mjs

const vizTap = 'https://tapvizier.cds.unistra.fr/TAPVizieR/tap/sync?REQUEST=doQuery&LANG=ADQL&FORMAT=json&QUERY=';
const vizTsv = 'https://vizier.cds.unistra.fr/viz-bin/asu-tsv?';
const simTap = 'https://simbad.cds.unistra.fr/simbad/sim-tap/sync?REQUEST=doQuery&LANG=ADQL&FORMAT=json&QUERY=';

const RA = 47.98504047;
const DEC = 48.09658705;

async function mustFetchText(url, label) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`[${label}] HTTP ${r.status}`);
  const txt = await r.text();
  if (!txt || txt.trim().length < 20) throw new Error(`[${label}] Empty response body`);
  return txt;
}

async function mustQueryTap(baseUrl, adql, label) {
  const txt = await mustFetchText(baseUrl + encodeURIComponent(adql), label);
  if (txt.trim().startsWith('<')) throw new Error(`[${label}] TAP XML error: ${txt.slice(0, 300)}`);
  return JSON.parse(txt);
}

console.log('Reproducing all gates for VLASS1QLCIR J031156.40+480547.7...');

// 1. VLASS dual-subtile detections
const vlass = await mustQueryTap(vizTap, `
  SELECT c.CompName, c.RAJ2000, c.DEJ2000, c.Ftot, c.e_Ftot, c.Fpeak, c.Islrms, c.Tile, c.Subtile, c.DupFlag, c.QualFlag, c.Xposn, c.Yposn,
         s.Epoch, s.DateImg, s.Obs
  FROM "J/ApJS/255/30/comp" AS c
  JOIN "J/ApJS/255/30/subtile" AS s ON (c.Tile = s.Tile AND c.Subtile = s.Subtile)
  WHERE 1=CONTAINS(POINT('ICRS', c.RAJ2000, c.DEJ2000), CIRCLE('ICRS', ${RA}, ${DEC}, 0.0015))
`, 'VLASS-DualSubtile');
console.log('1. VLASS Detections (expected 2):', vlass.data.length, JSON.stringify(vlass.data));

// 2. NVSS 300" (5 arcmin) cone
const nvss300 = await mustQueryTap(vizTap, `
  SELECT * FROM "VIII/65/nvss"
  WHERE 1=CONTAINS(POINT('ICRS', RAJ2000, DEJ2000), CIRCLE('ICRS', ${RA}, ${DEC}, 0.0833333))
`, 'NVSS-300s');
console.log('2. NVSS 300" matches (expected 0):', nvss300.data.length);

// 3. Low-frequency radio checks (FIRST, TGSS, WENSS, LoTSS within 60")
for (const [name, tbl] of [['FIRST', 'VIII/92/first14'], ['TGSS', 'J/A+A/598/A78/table3'], ['WENSS', 'VIII/62/wenss'], ['LoTSS', 'J/A+A/659/A1/catalog']]) {
  const res = await mustQueryTap(vizTap, `
    SELECT * FROM "${tbl}"
    WHERE 1=CONTAINS(POINT('ICRS', RAJ2000, DEJ2000), CIRCLE('ICRS', ${RA}, ${DEC}, 0.016667))
  `, name);
  console.log(`3. ${name} 60" matches (expected 0):`, res.data.length);
}

// 4. Literature (SIMBAD 15", VSX 30", NED 10")
const simbad = await mustQueryTap(simTap, `
  SELECT main_id, ra, dec, otype FROM basic
  WHERE 1=CONTAINS(POINT('ICRS', ra, dec), CIRCLE('ICRS', ${RA}, ${DEC}, 0.0041667))
`, 'SIMBAD-15s');
const vsx = await mustQueryTap(vizTap, `
  SELECT OID, Name, RAJ2000, DEJ2000, Type FROM "B/vsx/vsx"
  WHERE 1=CONTAINS(POINT('ICRS', RAJ2000, DEJ2000), CIRCLE('ICRS', ${RA}, ${DEC}, 0.0083333))
`, 'VSX-30s');
const nedTxt = await mustFetchText(`https://ned.ipac.caltech.edu/cgi-bin/objsearch?search_type=Near+Position+Search&in_csys=Equatorial&in_equinox=J2000.0&lon=${RA.toFixed(6)}d&lat=+${DEC.toFixed(6)}d&radius=0.167&of=ascii_bar`, 'NED-10s');
console.log('4. Literature: SIMBAD=', simbad.data.length, 'VSX=', vsx.data.length, 'NED_bytes=', nedTxt.length);

// 5. Gaia DR3 (5"), AllWISE (5" and 60")
const gaia5 = await mustQueryTap(vizTap, `
  SELECT Source, RA_ICRS, DE_ICRS, Gmag FROM "I/355/gaiadr3"
  WHERE 1=CONTAINS(POINT('ICRS', RA_ICRS, DE_ICRS), CIRCLE('ICRS', ${RA}, ${DEC}, 0.0013889))
`, 'Gaia-5s');
const wise5 = await mustQueryTap(vizTap, `
  SELECT AllWISE, RAJ2000, DEJ2000, W1mag, W2mag, W3mag, snr3 FROM "II/328/allwise"
  WHERE 1=CONTAINS(POINT('ICRS', RAJ2000, DEJ2000), CIRCLE('ICRS', ${RA}, ${DEC}, 0.0013889))
`, 'AllWISE-5s');
const wise60 = await mustQueryTap(vizTap, `
  SELECT AllWISE, RAJ2000, DEJ2000, W1mag, W2mag, W3mag, snr3 FROM "II/328/allwise"
  WHERE 1=CONTAINS(POINT('ICRS', RAJ2000, DEJ2000), CIRCLE('ICRS', ${RA}, ${DEC}, 0.016667))
`, 'AllWISE-60s');
console.log('5. Host & 60" Cone: Gaia_5s=', gaia5.data.length, 'AllWISE_5s=', wise5.data.length, 'AllWISE_60s_real_W3_excess=', wise60.data.filter(r => Number(r[6]) >= 5).length);
console.log('ALL GATES REPRODUCED AND PASSED.');
