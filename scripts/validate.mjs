import fs from 'node:fs';
import { inspectConnector, inspectGitIndex, inspectGitRefs } from './contract.mjs';
const mode = process.argv[2] ?? '--working';
if (process.argv.length > 3 || !['--working', '--index', '--refs'].includes(mode)) throw new Error('Invalid connector validation mode');
const findings = mode === '--index' ? inspectGitIndex(process.cwd()) : mode === '--refs' ? inspectGitRefs(process.cwd(), fs.readFileSync(0, 'utf8')) : inspectConnector(process.cwd());
if (findings.length) { console.error(findings.join('\n')); process.exitCode = 1; }
else console.log('MCP connector contract passed.');
