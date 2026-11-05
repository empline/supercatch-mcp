# SuperCatch for Gemini CLI

Connect [Gemini CLI](https://geminicli.com/docs/get-started/installation/) to
[SuperCatch](https://supercatch.com) to search trading cards and collectibles,
inspect product prices and availability, find seller stores, and read public
documentation through its existing MCP integration.

## Install

```sh
gemini extensions install https://github.com/empline/supercatch-gemini
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
SuperCatch website; the MCP tools do not purchase or edit anything.

## Available tools

| Public tool | Purpose |
| --- | --- |
| `search_marketplace` | Find card and collectibles listings. |
| `get_product` | Read a product's current facts, price, and availability. |
| `get_storefront` | Find a public seller storefront. |
| `get_help_resource` | Find public help and agent documentation. |
| `search_public_docs` | Read public documentation summaries and citations. |
| `get_api_catalog` | Find API catalog and OpenAPI discovery links. |

| Account tool | Consent required |
| --- | --- |
| `list_account_orders`, `list_account_watchlist` | `account:read` for your own purchases and watchlist. |
| `search_account_docs` | `docs:read`; private staff guides also require current staff permissions. |
| `list_store_listings`, `get_store_inventory`, `list_store_orders` | `store:read` and current ownership of an eligible store. |

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
It does not request the write scopes offered by the broader SuperCatch OAuth
authorization server.

All listed tools are read-only. The explicit `includeTools` list prevents new
remote tools from appearing without a reviewed manifest update. This list does
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

The root `gemini-extension.json` is the complete integration. Its version is
independent of the remote MCP server version. Version 1.0.2 adopts the canonical
`get_*`, `list_*` and `search_public_docs` names without adding tools or scopes.
Release it after the endpoint advertises those names; the endpoint keeps its
previous names callable for older clients. Before releasing:

1. Compare the allowlist with live `tools/list`; require every listed tool to
   advertise `readOnlyHint: true`.
2. Verify initialization, public search, and a returned product lookup with an
   MCP SDK client.
3. Verify all account tools return HTTP 401 anonymously with an OAuth challenge,
   and verify the public OAuth discovery documents.
4. Install from the public repository in a fresh `GEMINI_CLI_HOME` and require
   `gemini mcp list` to report Connected.
5. Confirm the public root manifest matches the tested file and that GitHub's
   `gemini-cli-extension` topic is present.

These checks do not certify signed-in Gemini CLI account reads. That separate
end-to-end proof requires a consenting user account and scope/isolation checks;
do not claim it from discovery or anonymous refusal checks alone.

Google's [gallery](https://geminicli.com/extensions/) discovers public tagged
repositories on a documented daily crawl and lists extensions that pass
validation. Publishing here does not establish inclusion or endorsement.
[Release requirements](https://geminicli.com/docs/extensions/releasing/#list-your-extension-in-the-gallery).
