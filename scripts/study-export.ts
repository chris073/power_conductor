// Exports the sample project (or a project JSON) as PSS/E RAW v33 + SEQ + DYR, then runs the
// ANDES check (scripts/andes-check.py) in the study venv. Used by `npm run study:check`.
//
//   npx tsx scripts/study-export.ts [project.conductor.json] [--out study-out] [--no-check]

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseProject } from '../src/domain/serialization/projectFile';
import { buildStudyCase, persistBusNumbers, writeDyr, writeRaw, writeSeq } from '../src/domain/study';
import { buildSampleProject } from '../src/state/sample';

const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const outDir = resolve(outIdx >= 0 ? args[outIdx + 1]! : 'study-out');
const noCheck = args.includes('--no-check');
const input = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--out');

let doc = input ? parseProject(readFileSync(input, 'utf8')) : buildSampleProject();
// First build assigns bus numbers; persist them and rebuild so the files match a saved project.
doc = persistBusNumbers(doc, buildStudyCase(doc));
const sc = buildStudyCase(doc);
const base = (input ? doc.name : 'sample').replace(/[^\w.-]+/g, '_');
mkdirSync(outDir, { recursive: true });
const meta = { app: 'Conductor study:check', date: new Date().toISOString().slice(0, 10) };
const files = { raw: join(outDir, `${base}.raw`), seq: join(outDir, `${base}.seq`), dyr: join(outDir, `${base}.dyr`) };
writeFileSync(files.raw, writeRaw(sc, meta));
writeFileSync(files.seq, writeSeq(sc));
writeFileSync(files.dyr, writeDyr(sc));

const count = (s: string) => sc.issues.filter((i) => i.severity === s).length;
console.log(`Study case "${doc.name}": ${sc.buses.length} buses, ${sc.branches.length} branches, ${sc.xfmr2.length + sc.xfmr3.length} transformers, ${sc.gens.length} machines, ${sc.loads.length} loads.`);
console.log(`Readiness: ${count('error')} errors, ${count('warning')} warnings, ${count('info')} notes.`);
for (const i of sc.issues.filter((x) => x.severity !== 'info')) console.log(`  [${i.severity}] ${i.message}`);
console.log(`Wrote ${Object.values(files).join('\n      ')}`);

if (noCheck) process.exit(count('error') ? 1 : 0);
const py = process.platform === 'win32' ? join('.venv-study', 'Scripts', 'python.exe') : join('.venv-study', 'bin', 'python');
if (!existsSync(py)) {
  console.error(`\nNo study venv at ${py}. Create it:  py -3 -m venv .venv-study  then  .venv-study/Scripts/python -m pip install andes`);
  process.exit(2);
}
const r = spawnSync(py, ['scripts/andes-check.py', ...Object.values(files).filter((f) => !f.endsWith('.seq'))], { stdio: 'inherit' });
process.exit(r.status ?? 1);
