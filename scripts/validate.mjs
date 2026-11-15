import fs from 'node:fs';
import { inspectConnector, inspectGitIndex, inspectGitRefs } from './contract.mjs';
import attribution from './git-attribution.cjs';
const mode = process.argv[2] ?? '--working';
if (process.argv.length > 3 || !['--working', '--index', '--refs'].includes(mode)) throw new Error('Invalid connector validation mode');
const input = mode === '--refs' ? fs.readFileSync(0, 'utf8') : '';
const findings = mode === '--index' ? inspectGitIndex(process.cwd()) : mode === '--refs' ? [...inspectGitRefs(process.cwd(), input), ...attribution.inspectAttributionPush(process.cwd(), input)] : inspectConnector(process.cwd());
if (findings.length) { console.error(findings.join('\n')); process.exitCode = 1; }
else console.log('MCP connector contract passed.');
