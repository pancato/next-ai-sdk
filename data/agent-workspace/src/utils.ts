export interface DataResult {
  sum: number;
  average: number;
  count: number;
}

// TODO: add input validation for empty arrays
export function processData(items: number[]): DataResult {
  const sum = items.reduce((a, b) => a + b, 0);
  const average = sum / items.length;

  return { sum, average, count: items.length };
}

// TODO: write unit tests for this
export function formatResult(result: DataResult): string {
  return `Sum: ${result.sum}, Average: ${result.average.toFixed(2)}, Count: ${result.count}`;
}

// BUG: this function doesn't handle the case where b is 0
export function divide(a: number, b: number): number {
  return a / b;
}
