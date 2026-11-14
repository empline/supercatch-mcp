import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const root = execFileSync('git', ['rev-parse', '--show-toplevel'], {encoding: 'utf8'}).trim();
if (fs.realpathSync(root) !== fs.realpathSync(process.cwd())) throw new Error('Install connector hooks from its Git root');
execFileSync('git', ['config', '--local', 'core.hooksPath', '.githooks']);
