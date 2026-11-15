const {inspectPendingAttribution} = require('./git-attribution.cjs');
if (process.argv.length !== 3) throw new Error('Expected a Git commit message path');
const findings = inspectPendingAttribution(process.cwd(), process.argv[2]);
if (findings.length) { console.error(findings.join('\n')); process.exitCode = 1; }
