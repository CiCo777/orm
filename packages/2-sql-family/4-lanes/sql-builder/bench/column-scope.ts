import assert from 'node:assert/strict';
import { AndExpr, ColumnRef, SelectAst, TableSource } from '@internal/sql-relational-core/ast';
import { assertColumnsInScope } from '../src/runtime/column-scope';

type Width = 512 | 1024 | 2048;

const WIDTHS: readonly Width[] = [512, 1024, 2048];
const TABLE_NAME = 'benchmark_table';
const WARMUP_CALLS = 20;
const MEASURED_BATCHES = 15;
const CALLS_PER_BATCH = 200;

interface Workload {
  readonly width: Width;
  readonly ast: SelectAst;
}

function parseWidths(args: readonly string[]): readonly Width[] {
  if (args.length === 0) return WIDTHS;
  assert(
    args.length === 2 && args[0] === '--width',
    'Usage: column-scope.ts [--width 512|1024|2048]',
  );

  const width = Number(args[1]);
  assert(width === 512 || width === 1024 || width === 2048, `Unsupported width: ${args[1]}`);
  return [width];
}

function createWorkload(width: Width): Workload {
  const columns = Array.from({ length: width }, (_, index) =>
    ColumnRef.of(TABLE_NAME, `column_${index}`),
  );
  const ast = SelectAst.from(TableSource.named(TABLE_NAME)).withWhere(AndExpr.of(columns));
  return { width, ast };
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? Number.NaN;
}

const workloads = parseWidths(process.argv.slice(2)).map(createWorkload);
let checksum = 0;

for (const { ast, width } of workloads) {
  for (let iteration = 0; iteration < WARMUP_CALLS; iteration += 1) {
    assertColumnsInScope(ast);
    checksum += width;
  }
}

console.log('SQL column-scope benchmark');
console.log(`warmup calls per width: ${WARMUP_CALLS}`);
console.log(`measured batches: ${MEASURED_BATCHES}`);
console.log(`calls per batch: ${CALLS_PER_BATCH}`);

for (const { ast, width } of workloads) {
  const cpuMicrosecondsPerCall: number[] = [];
  for (let batch = 0; batch < MEASURED_BATCHES; batch += 1) {
    const before = process.cpuUsage();
    for (let iteration = 0; iteration < CALLS_PER_BATCH; iteration += 1) {
      assertColumnsInScope(ast);
      checksum += width;
    }
    const elapsed = process.cpuUsage(before);
    cpuMicrosecondsPerCall.push((elapsed.user + elapsed.system) / CALLS_PER_BATCH);
  }

  console.log(
    `width=${width} median_cpu_microseconds_per_call=${median(cpuMicrosecondsPerCall).toFixed(2)}`,
  );
}

console.log(`checksum=${checksum}`);
