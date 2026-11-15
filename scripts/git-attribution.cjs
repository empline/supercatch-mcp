"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tags = exports.description = exports.blocking = exports.category = exports.name = exports.id = void 0;
exports.isAiIdentity = isAiIdentity;
exports.inspectAttributionMessage = inspectAttributionMessage;
exports.inspectCommitAttribution = inspectCommitAttribution;
exports.inspectAttributionObjects = inspectAttributionObjects;
exports.inspectAttributionPush = inspectAttributionPush;
exports.inspectPendingAttribution = inspectPendingAttribution;
exports.run = run;
/** Human Git attribution; inspect real identities and trailers, never product mentions. */
const node_child_process_1 = require("node:child_process");
const fs = require("node:fs");
exports.id = "governance/no-ai-commit-attribution";
exports.name = "No AI commit attribution";
exports.category = "governance";
exports.blocking = true;
exports.description = "Reject AI author/committer identities and AI credit trailers in pending messages and proposed Git objects; human coauthors and ordinary product mentions remain valid.";
exports.tags = ["git", "governance", "authorship", "commit", "attribution"];
const OID = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const AI_NAME = /^(?:claude(?:\s+(?:code|opus|sonnet|haiku)(?:\s+[\w.-]+)*)?|codex(?:\s+.*)?|chatgpt|openai(?:\s+codex)?|github\s+copilot|copilot(?:\s+.*)?|gemini(?:\s+(?:cli|code|pro|flash)(?:\s+[\w.-]+)*)?|cursor(?:\s+(?:agent|ai))?|grok|kimi(?:\s+code)?|aider|devin|ai(?:\s+(?:assistant|agent))?)(?:\[bot\])?$/i;
const AI_EMAIL = /^(?:(?:no-?reply|claude|codex|gemini|copilot)@(?:anthropic|openai|cursor)\.com|(?:\d+\+)?(?:claude(?:-code)?|codex|copilot|github-copilot|gemini-code-assist)\[bot\]@users\.noreply\.github\.com)$/i;
function isAiIdentity(identity) {
    const normalized = identity.normalize("NFKC").trim();
    const match = /^(.*?)\s*<([^<>]+)>/.exec(normalized);
    const name = (match?.[1] ?? normalized).trim().replace(/\s+/g, " ");
    return AI_NAME.test(name) || Boolean(match && AI_EMAIL.test(match[2].trim()));
}
function inspectAttributionMessage(message) {
    return message.split(/\r?\n/).flatMap(line => {
        const trailer = /^\s*(co-authored-by|signed-off-by|authored-by|generated-by|assisted-by)\s*:\s*(.+)$/i.exec(line);
        const generated = /^\s*(?:[\p{So}\p{Sk}]\s*)?generated\s+(?:with|by)\s+(.+)$/iu.exec(line);
        const identity = trailer?.[2] ?? generated?.[1];
        return identity && isAiIdentity(identity.replace(/^\[([^\]]+)\]\([^)]*\)$/, "$1")) ? ["AI attribution is forbidden: " + line.trim()] : [];
    });
}
function inspectCommitAttribution(commit) {
    return [
        ...(isAiIdentity(commit.author) ? ["AI Git author is forbidden: " + commit.author] : []),
        ...(isAiIdentity(commit.committer) ? ["AI Git committer is forbidden: " + commit.committer] : []),
        ...inspectAttributionMessage(commit.message),
    ].map(finding => commit.oid + ": " + finding);
}
function git(root, args) {
    const env = { ...process.env, GIT_NO_REPLACE_OBJECTS: "1" };
    for (const key of ["GIT_DIR", "GIT_COMMON_DIR", "GIT_WORK_TREE", "GIT_OBJECT_DIRECTORY", "GIT_ALTERNATE_OBJECT_DIRECTORIES", "GIT_NAMESPACE"])
        delete env[key];
    return (0, node_child_process_1.execFileSync)("git", ["-C", root, ...args], { env, encoding: "utf8", timeout: 30_000, maxBuffer: 16 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
}
/** Literal object IDs only; inspect Git data without checking out or executing pushed code. */
function inspectAttributionObjects(root, tips, excluded = []) {
    if (![...tips, ...excluded].every(value => OID.test(value)))
        throw new Error("Invalid attribution object ID");
    if (!tips.length)
        return [];
    const ids = git(root, ["rev-list", ...tips, ...(excluded.length ? ["--not", ...excluded] : [])]).trim().split("\n").filter(Boolean);
    if (ids.length > 10_000)
        throw new Error("Attribution scan exceeds 10,000 commits; split the proposed publication");
    return ids.flatMap(oid => {
        if (!OID.test(oid))
            throw new Error("Invalid commit from Git revision walk");
        const raw = git(root, ["cat-file", "commit", oid]);
        const split = raw.indexOf("\n\n");
        const header = raw.slice(0, split);
        const author = /^author (.+ <[^<>\n]+>) \d+ [+-]\d{4}$/m.exec(header)?.[1];
        const committer = /^committer (.+ <[^<>\n]+>) \d+ [+-]\d{4}$/m.exec(header)?.[1];
        if (split < 0 || !author || !committer)
            throw new Error("Malformed Git commit attribution: " + oid);
        return inspectCommitAttribution({ oid, author, committer, message: raw.slice(split + 2) });
    });
}
function inspectAttributionPush(root, input) {
    if (input.length > 65536)
        throw new Error("Attribution push input exceeds 64 KiB");
    const findings = [];
    for (const line of input.trim().split("\n").filter(Boolean)) {
        const parts = line.trim().split(/\s+/);
        if (parts.length !== 4 || !OID.test(parts[1]) || !OID.test(parts[3]))
            throw new Error("Malformed attribution push input");
        if (/^0+$/.test(parts[1]))
            continue;
        // A rewritten history is walked from its proposed tip; old shared ancestors are excluded.
        const tip = git(root, ["rev-parse", "--verify", parts[1] + "^{commit}"]).trim();
        const old = /^0+$/.test(parts[3]) ? [] : [git(root, ["rev-parse", "--verify", parts[3] + "^{commit}"]).trim()];
        findings.push(...inspectAttributionObjects(root, [tip], old));
    }
    return findings;
}
/** prepare-commit-msg is intentionally also used: Git --no-verify cannot skip it. */
function inspectPendingAttribution(root, messageFile) {
    const author = git(root, ["var", "GIT_AUTHOR_IDENT"]).trim();
    const committer = git(root, ["var", "GIT_COMMITTER_IDENT"]).trim();
    const message = messageFile ? fs.readFileSync(messageFile, "utf8") : "";
    return inspectCommitAttribution({ oid: "pending commit", author, committer, message });
}
async function run(root = process.cwd()) {
    const start = Date.now();
    const head = git(root, ["rev-parse", "--verify", "HEAD"]).trim();
    const remotes = git(root, ["for-each-ref", "--format=%(objectname)", "refs/remotes"]).trim().split("\n").filter(Boolean);
    const messages = [...inspectPendingAttribution(root), ...inspectAttributionObjects(root, [head], remotes)];
    return { passed: !messages.length, findings: messages.map(message => ({ level: "error", ruleId: exports.id, file: ".git", message })), duration: Date.now() - start };
}
