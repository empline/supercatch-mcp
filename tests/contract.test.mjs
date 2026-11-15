import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { inspectConnector, parseJson } from '../scripts/contract.mjs';

function copyFixture() {
  assert.deepEqual(inspectConnector(process.cwd()), [], 'source fixture must be valid before copying it');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'connector-contract-'));
  try {
    const entries = ['README.md', 'LICENSE', 'connector-policy.json', 'gemini-extension.json', 'package.json', 'package-lock.json', 'scripts', '.githooks', 'tests'];
    if (fs.existsSync(path.join(process.cwd(), 'generated-from.json'))) entries.push('generated-from.json');
    for (const entry of entries) fs.cpSync(path.join(process.cwd(), entry), path.join(root, entry), {recursive: true});
    if (fs.existsSync(path.join(process.cwd(), 'generated-from.json'))) {
      const receipt = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'generated-from.json'), 'utf8'));
      for (const file of Object.keys(receipt.files)) {
        if (fs.existsSync(path.join(root, file))) continue;
        fs.mkdirSync(path.dirname(path.join(root, file)), {recursive: true});
        fs.copyFileSync(path.join(process.cwd(), file), path.join(root, file));
      }
    }
    assert.deepEqual(inspectConnector(root), [], 'mutation fixture must be valid before changing it');
    return root;
  } catch (error) { fs.rmSync(root, {recursive: true, force: true}); throw error; }
}

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
  const root = copyFixture();
  try {
    const value = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
    mutate(value);
    fs.writeFileSync(path.join(root, file), JSON.stringify(value));
    assert.ok(inspectConnector(root).length > 0);
  } finally { fs.rmSync(root, {recursive: true, force: true}); }
});
for (const [file, value] of [['scripts/git-attribution.cjs', '// no guard'], ['scripts/validate-attribution.cjs', '// no guard'], ['.githooks/prepare-commit-msg', '#!/bin/sh\nexit 0'], ['.githooks/commit-msg', '#!/bin/sh\nexit 0'], ['scripts/validate.mjs', '// inspectConnector(process.cwd())'], ['.githooks/pre-push', '#!/bin/sh\nexit 0'], ['README.md', '# Missing sections'], ['tests/contract.test.mjs', '// no tests']]) test(`rejects bypass in ${file}`, () => {
  const root = copyFixture();
  try {
    fs.writeFileSync(path.join(root, file), value);
    assert.ok(inspectConnector(root).length > 0);
  } finally { fs.rmSync(root, {recursive: true, force: true}); }
});
