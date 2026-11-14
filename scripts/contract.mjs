/** Canonical portable connector guard. Run via npm test; no network or writes. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import ts from 'typescript';

export const runner = "import { inspectConnector } from './contract.mjs';\nconst findings = inspectConnector(process.cwd());\nif (findings.length) { console.error(findings.join('\\n')); process.exitCode = 1; }\nelse console.log('MCP connector contract passed.');\n";
export const hook = '#!/bin/sh\nset -eu\nnpm test\n';
export const installer = "import { execFileSync } from 'node:child_process';\nimport fs from 'node:fs';\nconst root = execFileSync('git', ['rev-parse', '--show-toplevel'], {encoding: 'utf8'}).trim();\nif (fs.realpathSync(root) !== fs.realpathSync(process.cwd())) throw new Error('Install connector hooks from its Git root');\nexecFileSync('git', ['config', '--local', 'core.hooksPath', '.githooks']);\n";
export const headings = ['Install in Cline', 'Install in Gemini CLI', 'Capabilities and access', 'Tool exposure', 'Update or uninstall', 'Verification', 'Links'];
export const license = 'Copyright (c) Empline. All rights reserved.\n\nThe hosted service is governed by its published Terms and Privacy Policy.\nNo open-source license is granted for this repository.\n';
export const publicPayloadFile = file => ['README.md', 'llms-install.md', 'cline-installation-proof.json', 'plugin.json', 'mcp.json'].includes(file) || /^assets\/[a-zA-Z0-9_./-]+\.(png|jpg|jpeg|webp|mp4)$/.test(file);
export const testSuiteSha256 = '9815d1d20e306b2605459a68847bb50c5da7a43288a5910c4d5518de0e7ca9e1';

/** JSON AST inspection rejects duplicate keys before JSON.parse can erase them. */
export function parseJson(file, text) {
  const ast = ts.parseJsonText(file, text);
  if (ast.parseDiagnostics.length) throw new Error(`${file}: invalid JSON syntax`);
  function visit(node) {
    if (ts.isObjectLiteralExpression(node)) {
      const keys = new Set();
      for (const prop of node.properties) {
        if (!ts.isPropertyAssignment(prop) || !ts.isStringLiteral(prop.name)) throw new Error(`${file}: literal JSON keys required`);
        if (keys.has(prop.name.text)) throw new Error(`${file}: duplicate key ${prop.name.text}`);
        keys.add(prop.name.text);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return JSON.parse(text);
}

export function inspectConnector(root) {
  const readBinary = file => {
    const real = fs.realpathSync(path.join(root, file));
    if (!real.startsWith(fs.realpathSync(root) + path.sep)) throw new Error(`${file}: external symlink refused`);
    if (fs.statSync(real).size > 32 * 1048576) throw new Error(`${file}: exceeds 32 MiB`);
    return fs.readFileSync(real);
  };
  const files = () => {
    const result = [];
    const walk = (dir, prefix = '') => {
      for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
        if (!prefix && ['.git', 'node_modules'].includes(entry.name)) continue;
        if (entry.isSymbolicLink()) throw new Error('Generated distributions cannot contain symlinks');
        if (entry.isDirectory()) walk(path.join(dir, entry.name), prefix + entry.name + '/');
        else if (entry.isFile()) result.push(prefix + entry.name);
        else throw new Error('Generated distributions must contain regular files');
      }
    };
    walk(root);
    return result.sort();
  };
  return inspectConnectorContents({files, read: file => {
    const bytes = readBinary(file);
    if (bytes.length > 1048576) throw new Error(`${file}: metadata exceeds 1 MiB`);
    return bytes.toString('utf8');
  }, readBinary,
    exists: file => fs.existsSync(path.join(root, file)),
    executable: file => Boolean(fs.statSync(path.join(root, file)).mode & 0o111),
  });
}

/** The app exporter validates the same contract in memory before writing any files. */
export function inspectConnectorContents({read, readBinary, exists, executable, files}) {
  const findings = [];
  const fail = message => findings.push(message);
  const json = file => parseJson(file, read(file));
  const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => keys.includes(key));
  const strings = value => Array.isArray(value) && value.length > 0 && value.every(item => typeof item === 'string' && item.trim() === item && item.length > 0) && new Set(value).size === value.length;
  try {
    const policy = json('connector-policy.json');
    if (!exact(policy, ['schemaVersion', 'name', 'title', 'domain', 'auth', 'toolExposure', 'distribution']) || policy.schemaVersion !== 1 ||
        policy.distribution !== undefined && policy.distribution !== 'app-owned' ||
        !/^[a-z][a-z0-9]*$/.test(policy.name) || typeof policy.title !== 'string' || !policy.title.trim() ||
        policy.domain !== `${policy.name}.com` || !['none', 'discovery', 'oauth'].includes(policy.auth) ||
        !['runtime-discovery', 'reviewed-allowlist'].includes(policy.toolExposure)) throw new Error('Invalid connector policy');
    const manifest = json('gemini-extension.json');
    const pkg = json('package.json');
    const endpoint = `https://${policy.domain}/api/mcp`;
    if (!exact(manifest, ['name', 'version', 'description', 'mcpServers']) || manifest.name !== policy.name ||
        !/^\d+\.\d+\.\d+$/.test(manifest.version) || typeof manifest.description !== 'string' || !manifest.description.trim()) fail('Manifest identity/version/description drift');
    if (!exact(manifest.mcpServers, [policy.name]) || Object.keys(manifest.mcpServers).length !== 1) throw new Error('Exactly one canonical MCP server required');
    const server = manifest.mcpServers[policy.name];
    if (!exact(server, ['httpUrl', 'includeTools', 'oauth']) || server.httpUrl !== endpoint) fail('Only canonical HTTPS transport and reviewed configuration allowed; credentials, local commands and auto-approval refused');
    if (policy.toolExposure === 'reviewed-allowlist') {
      if (!strings(server.includeTools) || server.includeTools.some(tool => !tool.startsWith(`${policy.name}_`))) fail('Reviewed tools must be unique, nonempty and app-prefixed');
    } else if ('includeTools' in server) fail('Runtime discovery must not carry a stale allowlist');
    if (policy.auth === 'oauth') {
      if (!exact(server.oauth, ['enabled', 'scopes']) || server.oauth.enabled !== true || !strings(server.oauth.scopes) ||
          server.oauth.scopes.some(scope => !scope.endsWith(':read'))) fail('Explicit initial OAuth scopes must be read-only; escalation stays separate');
    } else if ('oauth' in server) fail('Public/discovery authentication cannot carry OAuth overrides');
    if (pkg.name !== `${policy.name}-mcp` || pkg.version !== manifest.version || pkg.private !== true || pkg.type !== 'module' ||
        pkg.license !== 'UNLICENSED' || pkg.repository?.url !== `https://github.com/empline/${policy.name}-mcp.git` ||
        pkg.scripts?.test !== 'node scripts/validate.mjs && node --test tests/contract.test.mjs' || pkg.scripts.prepare !== 'node scripts/install-hooks.mjs' ||
        JSON.stringify(pkg.devDependencies) !== JSON.stringify({typescript: '6.0.3'}) || pkg.dependencies !== undefined) fail('Package identity, version, license, dependency pin or mandatory test wiring drift');
    if (json('package-lock.json').packages?.['']?.version !== pkg.version) fail('Lockfile version drift');
    if (read('scripts/validate.mjs') !== runner) fail('Executable validation runner must match canonical template');
    if (createHash('sha256').update(read('tests/contract.test.mjs')).digest('hex') !== testSuiteSha256) fail('Required mutation suite drift');
    if (read('scripts/install-hooks.mjs') !== installer) fail('Hook installer drift');
    for (const name of ['pre-commit', 'pre-push']) {
      if (read(`.githooks/${name}`) !== hook || !executable(`.githooks/${name}`)) fail('Mandatory executable Git hook drift');
    }
    if (exists('.github/workflows')) fail('GitHub Actions are retired; verification runs on the workstation');
    if (read('LICENSE') !== license) fail('Explicit proprietary license notice required');
    if (policy.distribution === 'app-owned' || exists('generated-from.json')) {
      const provenance = json('generated-from.json');
      if (provenance.schemaVersion !== 1 || !/^https:\/\/github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(provenance.sourceRepository) ||
          provenance.sourceDirectory !== 'integrations/mcp' || !/^[a-f0-9]{64}$/.test(provenance.sourceSha256) ||
          !/^[a-f0-9]{64}$/.test(provenance.toolingSha256) || !exact(provenance.files, Object.keys(provenance.files ?? {})) || !Object.keys(provenance.files).length)
        throw new Error('App-owned distribution needs complete source provenance');
      const expected = [...Object.keys(provenance.files), 'generated-from.json'].sort();
      if (JSON.stringify(files()) !== JSON.stringify(expected)) fail('Generated distribution has undeclared or missing files');
      for (const [file, value] of Object.entries(provenance.files)) {
        if (!/^[a-zA-Z0-9_./-]+$/.test(file) || file.split('/').some(part => !part || part === '.' || part === '..' || part === '.git' || part.startsWith('.env')) ||
            !publicPayloadFile(file) && !['.gitignore', '.githooks/pre-commit', '.githooks/pre-push', 'LICENSE', 'connector-policy.json', 'gemini-extension.json', 'package.json', 'package-lock.json', 'scripts/contract.mjs', 'scripts/install-hooks.mjs', 'scripts/validate.mjs', 'tests/contract.test.mjs'].includes(file) ||
            !/^[a-f0-9]{64}$/.test(value.sha256) || ![0o100644, 0o100755].includes(value.mode) ||
            createHash('sha256').update(readBinary(file)).digest('hex') !== value.sha256 || executable(file) !== Boolean(value.mode & 0o111)) fail('Generated distribution differs from its source receipt: ' + file);
      }
    }
    const readme = read('README.md');
    if (!readme.startsWith(`# ${policy.title} MCP connector\n`)) fail('README title drift');
    const actual = [...readme.matchAll(/^## (.+)$/gm)].map(match => match[1]);
    if (JSON.stringify(actual) !== JSON.stringify(headings)) fail('README section structure drift');
    for (const text of [endpoint, `support@${policy.domain}`, `https://${policy.domain}/privacy`, `https://${policy.domain}/terms`,
      `gemini extensions install https://github.com/empline/${policy.name}-mcp`, `gemini extensions update ${policy.name}`, `gemini extensions uninstall ${policy.name}`, policy.toolExposure]) {
      if (!readme.includes(text)) fail(`README missing ${text}`);
    }
  } catch (error) { fail(error.message); }
  return findings;
}
