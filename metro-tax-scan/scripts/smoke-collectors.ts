import { collectCounty } from "../src/server/collectors";
import { collectGenericCounty } from "../src/server/collectors/generic";
import { GEORGIA_COUNTY_BY_ID } from "../src/server/georgia/counties";

async function main() {
  const ids = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const wantCobb = process.argv.includes("--cobb");
  const targets = ids.length
    ? ids
    : wantCobb
      ? ["dekalb", "henry", "fulton", "cobb"]
      : ["dekalb", "henry", "fulton", "richmond", "camden"];

  for (const id of targets) {
    const county = GEORGIA_COUNTY_BY_ID[id];
    if (!county) {
      console.log(id, "UNKNOWN");
      continue;
    }
    console.log("Collecting", county.label, `(${county.collector})…`);
    const result =
      county.collector === "specialized"
        ? await collectCounty(county)
        : await collectGenericCounty(county);
    console.log(result.county, result.status, result.opportunities.length, result.message);
    if (result.opportunities[0]) console.log(" ", result.opportunities[0]);
  }

  console.log("Registry size", Object.keys(GEORGIA_COUNTY_BY_ID).length);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
