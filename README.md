# SuperCatch MCP connector

SuperCatch's hosted MCP endpoint is `https://supercatch.com/api/mcp` (Streamable HTTP). This public repository contains connector metadata and setup documentation.

## Cline

In Cline, open **MCP Servers → Remote Servers**, enter the endpoint above, and choose **Streamable HTTP**. For Cline CLI:

```sh
cline mcp add supercatch https://supercatch.com/api/mcp --transport http --yes
```

For the IDE extension's `cline_mcp_settings.json`:

```json
{
  "mcpServers": {
    "supercatch": {
      "type": "streamableHttp",
      "url": "https://supercatch.com/api/mcp",
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

Public searches need no account or API key. Cline discovers the current tools from the hosted server. Account and seller tools require their own OAuth scopes and documented confirmations or native approvals. Review each grant and tool call; no automatic tool approval is included here.

The clean-profile Cline CLI installation and public marketplace search were tested on 2026-11-08. This does not certify signed-in account or write workflows. See [installation guidance](llms-install.md) and [the recorded client check](cline-installation-proof.json).

## Gemini CLI

Connect [Gemini CLI](https://geminicli.com/docs/get-started/installation/) to
[SuperCatch](https://supercatch.com) to search trading cards and collectibles,
inspect product prices and availability, find seller stores, read public
documentation, and use separately consented account and seller workflows through
its existing MCP integration.

## Install

```sh
gemini extensions install https://github.com/empline/supercatch-mcp
```

Restart an existing Gemini CLI session after installation. Run `/mcp` inside
Gemini CLI to inspect the connection. Public searches need no SuperCatch account
or API key. The extension connects over Streamable HTTP to
`https://supercatch.com/api/mcp`; it installs no local server or extra dependencies.

## Try it

- "Use SuperCatch to find Pikachu cards. Show listing prices and source links."
- "Use SuperCatch to look up the current product details for a search result."
- "Use SuperCatch to find public help about buying or selling cards."

Search prices are labeled list prices or market values. Look up a product for
its current price and availability, including sales. Results link to the
SuperCatch website. Write tools require their own OAuth scopes and the
confirmation or native SuperCatch approval required by that workflow. Checkout,
payments, refunds, and shipping-label purchases are outside this integration.

## Available tools

The manifest explicitly includes all 81 canonical tools advertised by SuperCatch
MCP 1.26.0. Tool names use the `supercatch_` prefix. The extension uses the same
remote server, schemas, account isolation, and approval flows as other clients.

| Capability | Examples |
| --- | --- |
| Public marketplace and docs | `supercatch_search_marketplace`, `supercatch_get_product`, `supercatch_search_public_docs` |
| Account reads | Orders, saved searches, watchlist, collection and support cases. |
| Seller reads | Listings, images, inventory, sales, stock aging, imports, integrations and orders. |
| Account writes | Saved searches, watchlist changes and reviewed support cases/replies. |
| Seller writes | Draft listing edits, prices, inventory and stock receipts, submission, publication, import resume, first shipments and tracking corrections. |
| Recovery | Context, capabilities, connection health, operation plans, status and durable receipts. |

See the [live tool catalog](https://supercatch.com/.well-known/mcp/server-card.json)
and `gemini-extension.json` for exact names. Discovery does not grant execution
permission. Native approvals apply only to workflows that require them; other
writes retain their documented exact-confirmation and consent requirements.

## Optional account access

Account tools use the same endpoint with SuperCatch's existing OAuth flow. They
refuse anonymous requests with HTTP 401. Public tools remain available without
sign-in. In an interactive Gemini CLI session, use:

```text
/mcp auth supercatch
```

[Gemini CLI supports OAuth discovery and dynamic client registration](https://geminicli.com/docs/tools/mcp-server/#automatic-oauth-discovery).
Authentication needs a local browser and loopback callback support. Read the
SuperCatch consent screen before granting access. The extension contains no
client secret or preconfigured account token. Revoke access in SuperCatch's
Connected Apps settings when no longer needed.

The manifest requests only `account:read`, `store:read`, and `docs:read`.
These are the initial read scopes; discovering write tools does not grant their
write scopes. A write without its separate consent is refused. Follow the
returned scope challenge and review the SuperCatch consent screen before
re-authorizing for that workflow. Signed-in Gemini scope escalation and native
write completion require separate client acceptance testing.

The explicit `includeTools` list prevents new remote tools from appearing
without a reviewed manifest update. This list does
not replace server authorization. No automatic approval, local commands, hooks,
or additional model instructions are configured.

Tool arguments are sent to SuperCatch over HTTPS. See the
[agent guide](https://supercatch.com/ai), [Privacy](https://supercatch.com/privacy),
and [Terms](https://supercatch.com/terms).

## Update or uninstall

```sh
gemini extensions update supercatch
gemini extensions uninstall supercatch
```

For a reproducible installation, append `--ref <full-commit-sha>` to the install
command. Review changes before updating an installed extension.

## Maintainers

The root `gemini-extension.json` is the Gemini CLI integration. Its version is
independent of the remote MCP server version. Version 1.1.0 adopts the prefixed
canonical names and the full current tool catalog while retaining read-only
initial OAuth scopes and client confirmation prompts. Before releasing:

1. Require exact allowlist equality with live `tools/list` and the app snapshot
   at `integrations/gemini/gemini-extension.json`. Run the app's
   `tests/unit/mcp-tool-names.test.ts` and `tests/unit/mcp-conformance.test.ts`.
2. Verify initialization, public search, and a returned product lookup with an
   MCP SDK client.
3. Verify protected tools return HTTP 401 anonymously with an OAuth challenge,
   and verify the public OAuth discovery documents.
4. Install from the public repository in a fresh `GEMINI_CLI_HOME` and require
   `gemini mcp list` to report Connected.
5. Confirm the public root manifest matches the tested file and that GitHub's
   `gemini-cli-extension` topic is present.

These checks do not certify signed-in Gemini CLI account reads. That separate
end-to-end proof requires a consenting user account, scope escalation, native
approval/recovery and isolation checks; do not claim it from discovery or
anonymous refusal checks alone.

Google's [gallery](https://geminicli.com/extensions/) discovers public tagged
repositories on a documented daily crawl and lists extensions that pass
validation. Publishing here does not establish inclusion or endorsement.
[Release requirements](https://geminicli.com/docs/extensions/releasing/#list-your-extension-in-the-gallery).
