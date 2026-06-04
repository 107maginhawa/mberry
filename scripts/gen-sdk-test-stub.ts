#!/usr/bin/env bun
/**
 * Generate a test-stub file mirroring all exports of the real generated
 * @monobase/sdk-ts/generated/react-query module, but with no-op implementations
 * that return benign query/mutation options objects. The stub satisfies bun's
 * static named-import resolution so frontend test files can rely on a uniform
 * mock without each one having to maintain its own export list.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const SRC = resolve(ROOT, 'packages/sdk-ts/src/generated/@tanstack/react-query.gen.ts');
const OUT = resolve(ROOT, 'packages/sdk-ts/src/generated/__test-stub__react-query.ts');

const src = readFileSync(SRC, 'utf8');
const exports = new Set<string>();
const re = /^export\s+(?:const|function)\s+([A-Za-z_$][A-Za-z0-9_$]*)/gm;
let m: RegExpExecArray | null;
while ((m = re.exec(src)) !== null) exports.add(m[1]);

const stubs: string[] = [
  '// AUTO-GENERATED test stub. DO NOT EDIT.',
  '// Run scripts/gen-sdk-test-stub.ts to regenerate.',
  '/* eslint-disable @typescript-eslint/no-explicit-any */',
  '',
  "import { jest } from 'bun:test';",
  '',
  'function makeStub() {',
  '  return jest.fn((..._args: any[]) => ({',
  "    queryKey: ['__sdk_stub__'],",
  '    queryFn: async () => ({ data: [], items: [], pagination: { totalCount: 0 } }),',
  '    mutationFn: async () => ({}),',
  '  }));',
  '}',
  '',
];
for (const name of Array.from(exports).sort()) {
  stubs.push(`export const ${name} = makeStub();`);
}
stubs.push('');
writeFileSync(OUT, stubs.join('\n'));
console.log(`Wrote stub: ${OUT} (${exports.size} exports)`);
