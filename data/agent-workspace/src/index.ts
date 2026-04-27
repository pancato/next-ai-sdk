import { processData, formatResult } from "./utils";
import { CONFIG } from "./config";

// TODO: add proper error handling
function main() {
  console.log(`Starting ${CONFIG.appName} v${CONFIG.version}...`);

  const data = fetchData();
  const result = processData(data);

  // FIXME: this might fail for empty arrays
  console.log(`Average: ${result.average}`);

  // TODO: implement structured logging instead of console.log
  console.log(formatResult(result));
  console.log("Done");
}

function fetchData(): number[] {
  // Hardcoded sample data for now
  return [1, 2, 3, 4, 5];
}

// Deprecated: use processData from utils instead
function calculateSum(items: number[]) {
  return items.reduce((a, b) => a + b, 0);
}

main();
