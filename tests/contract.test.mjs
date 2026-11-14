import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { inspectConnector, parseJson } from '../scripts/contract.mjs';

test('checked-in connector satisfies canonical contract', () => {
  assert.deepEqual(inspectConnector(process.cwd()), []);
});
test('JSON AST rejects nested duplicate keys and comment decoys', () => {
  assert.throws(() => parseJson('manifest.json', '{"mcpServers":{"app":{},"app":{}}}'), /duplicate key/);
  assert.throws(() => parseJson('manifest.json', '{"name":"app" /* ignored */}'));
});
const cases = [
  ['server alias', 'gemini-extension.json', value => { value.mcpServers.alias = {}; }],
  ['credential injection', 'gemini-extension.json', value => { Object.values(value.mcpServers)[0].headers = {Authorization: 'forbidden'}; }],
  ['local command', 'gemini-extension.json', value => { Object.values(value.mcpServers)[0].command = 'node'; }],
  ['automatic approval', 'gemini-extension.json', value => { Object.values(value.mcpServers)[0].trust = true; }],
  ['endpoint drift', 'gemini-extension.json', value => { Object.values(value.mcpServers)[0].httpUrl += '/old'; }],
  ['version drift', 'package.json', value => { value.version = '99.0.0'; }],
  ['test bypass', 'package.json', value => { value.scripts.test = 'echo passed'; }],
  ['dependency drift', 'package.json', value => { value.devDependencies.typescript = '*'; }],
  ['missing policy', 'connector-policy.json', value => { delete value.toolExposure; }],
  ['invalid tool exposure', 'gemini-extension.json', value => { Object.values(value.mcpServers)[0].includeTools = []; }],
  ['write scope escalation', 'gemini-extension.json', value => { Object.values(value.mcpServers)[0].oauth = {enabled: true, scopes: ['account:write']}; }],
];
for (const [name, file, mutate] of cases) test(`rejects ${name}`, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'connector-contract-'));
  try {
    for (const entry of ['README.md', 'LICENSE', 'connector-policy.json', 'gemini-extension.json', 'package.json', 'package-lock.json', 'scripts', '.github', 'tests'])
      fs.cpSync(path.join(process.cwd(), entry), path.join(root, entry), {recursive: true});
    const value = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
    mutate(value);
    fs.writeFileSync(path.join(root, file), JSON.stringify(value));
    assert.ok(inspectConnector(root).length > 0);
  } finally { fs.rmSync(root, {recursive: true, force: true}); }
});
for (const [file, value] of [['scripts/validate.mjs', '// inspectConnector(process.cwd())'], ['.github/workflows/connector.yml', 'name: bypass'], ['README.md', '# Missing sections'], ['tests/contract.test.mjs', '// no tests']]) test(`rejects bypass in ${file}`, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'connector-contract-'));
  try {
    for (const entry of ['README.md', 'LICENSE', 'connector-policy.json', 'gemini-extension.json', 'package.json', 'package-lock.json', 'scripts', '.github', 'tests'])
      fs.cpSync(path.join(process.cwd(), entry), path.join(root, entry), {recursive: true});
    fs.writeFileSync(path.join(root, file), value);
    assert.ok(inspectConnector(root).length > 0);
  } finally { fs.rmSync(root, {recursive: true, force: true}); }
});
