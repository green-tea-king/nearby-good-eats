function normalizeText(value) {
  return String(value || "").trim().replace(/台/g, "臺").replace(/\s+/g, "");
}

function normalizeName(value) {
  return normalizeText(value)
    .replace(/[·・‧,，。'’"“”\-—_]/g, "")
    .toLowerCase();
}

function isPending(value) {
  const text = String(value || "").trim();
  return !text || text.includes("待確認");
}

function isWeakDistrict(value) {
  const text = String(value || "").trim();
  return isPending(text) || !/(區|鄉|鎮|市)$/.test(text);
}

function isWeakAddress(value, city) {
  if (isPending(value)) return true;
  const text = normalizeText(value);
  const normalizedCity = normalizeText(city);
  return text === normalizedCity || text.length <= normalizedCity.length + 1;
}

function districtFromAddress(address, city = "") {
  let text = String(address || "").trim().replace(/^\d{3,5}/, "");
  const cityText = String(city || "").trim();
  if (normalizeText(text).startsWith(normalizeText(cityText))) text = text.slice(cityText.length);
  return text.match(/^(.{1,6}?(?:區|鄉|鎮|市))/)?.[1] || "";
}

function composeAddress(city, address) {
  const text = String(address || "").trim();
  if (!text) return "";
  return normalizeText(text).startsWith(normalizeText(city)) ? text : `${city}${text}`;
}

function enrichAwardsFromDirectory(input, directory = [], options = {}) {
  const data = JSON.parse(JSON.stringify(input || {}));
  const fetchedAt = options.fetchedAt || new Date().toISOString().slice(0, 10);
  const sourceLabel = "Taiwan Tourism Administration Michelin directory";
  const byKey = new Map();
  for (const row of directory) {
    const key = `${normalizeName(row.name)}@@${normalizeText(row.city)}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(row);
  }
  const report = {
    generatedAt:new Date().toISOString(), fetchedAt,
    targetRows:0, matchedRows:0, updatedRows:0,
    unmatchedRows:[], ambiguousRows:[], updated:[],
  };
  for (const row of data.restaurants || []) {
    const needs = isWeakDistrict(row.district) || isWeakAddress(row.address, row.city) || isPending(row.cuisine);
    if (!needs) continue;
    report.targetRows += 1;
    const before = { district:row.district || "", address:row.address || "", cuisine:row.cuisine || "" };
    const existingDistrict = !isWeakAddress(row.address, row.city) ? districtFromAddress(row.address, row.city) : "";
    if (existingDistrict && isWeakDistrict(row.district)) row.district = existingDistrict;
    const candidates = byKey.get(`${normalizeName(row.name)}@@${normalizeText(row.city)}`) || [];
    const unique = [...new Map(candidates.map(candidate => [
      `${normalizeName(candidate.name)}@@${normalizeText(candidate.city)}@@${normalizeText(candidate.address)}`,
      candidate,
    ])).values()];
    if (!unique.length) {
      const after = { district:row.district || "", address:row.address || "", cuisine:row.cuisine || "" };
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        row.notes = [String(row.notes || "").trim(), `行政區由既有地址解析 ${fetchedAt}`].filter(Boolean).join(" | ");
        report.updatedRows += 1;
        report.updated.push({ name:row.name, city:row.city, before, after, sourceUrl:"", website:"" });
      } else {
        report.unmatchedRows.push({ name:row.name, city:row.city });
      }
      continue;
    }
    if (unique.length > 1) {
      report.ambiguousRows.push({
        name:row.name, city:row.city,
        candidates:unique.map(item => ({ name:item.name, address:item.address, website:item.website || "" })),
      });
      continue;
    }
    report.matchedRows += 1;
    const candidate = unique[0];
    const district = districtFromAddress(candidate.address, row.city);
    const address = composeAddress(row.city, candidate.address);
    const cuisine = String(candidate.cuisine || "").trim();
    if (district && isWeakDistrict(row.district)) row.district = district;
    if (address && isWeakAddress(row.address, row.city)) row.address = address;
    if (cuisine && isPending(row.cuisine)) row.cuisine = cuisine;
    for (const award of row.awards || []) {
      if (!["michelin", "michelin_selected", "bib"].includes(award.guide)) continue;
      if (candidate.website && !String(award.sourceUrl || award.url || "").includes("/restaurant/")) {
        award.sourceUrl = candidate.website;
        award.url = candidate.website;
      }
    }
    const after = { district:row.district || "", address:row.address || "", cuisine:row.cuisine || "" };
    if (JSON.stringify(before) === JSON.stringify(after)) continue;
    const note = `${sourceLabel} ${fetchedAt} ${candidate.sourceUrl || ""}`.trim();
    row.notes = [String(row.notes || "").trim(), note].filter(Boolean).join(" | ");
    report.updatedRows += 1;
    report.updated.push({ name:row.name, city:row.city, before, after, sourceUrl:candidate.sourceUrl || "", website:candidate.website || "" });
  }
  data.updated = fetchedAt;
  return { data, report };
}

module.exports = {
  enrichAwardsFromDirectory,
  isWeakAddress,
  isWeakDistrict,
  normalizeName,
};
