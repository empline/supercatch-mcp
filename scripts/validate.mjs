import { inspectConnector } from './contract.mjs';
const findings = inspectConnector(process.cwd());
if (findings.length) { console.error(findings.join('\n')); process.exitCode = 1; }
else console.log('MCP connector contract passed.');
