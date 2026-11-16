import { collectCobb } from "../src/server/collectors/cobb";
import { collectDekalb } from "../src/server/collectors/dekalb";
import { collectFulton } from "../src/server/collectors/fulton";
import { collectHenry } from "../src/server/collectors/henry";

async function main() {
  const fast = await Promise.all([collectDekalb(), collectHenry(), collectFulton()]);
  for (const r of fast) {
    console.log(r.county, r.status, r.opportunities.length, r.message);
    if (r.opportunities[0]) console.log(" ", r.opportunities[0]);
  }

  if (process.argv.includes("--cobb")) {
    console.log("Collecting Cobb (large PDF)…");
    const cobb = await collectCobb();
    console.log(cobb.county, cobb.status, cobb.opportunities.length, cobb.message);
    if (cobb.opportunities[0]) console.log(" ", cobb.opportunities[0]);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
