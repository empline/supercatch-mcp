# Install SuperCatch in Cline

SuperCatch is a hosted Streamable HTTP MCP server. Configure the existing remote endpoint in Cline; no backend build or local server process is needed.

1. Use Cline's MCP Servers → Remote Servers form.
2. Set the name to `supercatch` and URL to `https://supercatch.com/api/mcp`.
3. Select **Streamable HTTP** explicitly.
4. Keep automatic tool approval empty.
5. Confirm the server connects and the tools are listed. Test a public `supercatch_search_marketplace` request with a query such as `Pikachu`.

Cline CLI equivalent:

```sh
cline mcp add supercatch https://supercatch.com/api/mcp --transport http --yes
```

For the IDE JSON shape, use `type: "streamableHttp"`, `url: "https://supercatch.com/api/mcp"`, `disabled: false` and `autoApprove: []` under `mcpServers.supercatch`. Omitting the type can select legacy SSE in older clients.

Public marketplace and documentation searches do not require credentials. Account or seller operations require OAuth consent for their specific scopes. A discovered tool is not an execution grant. Use Cline's authorization flow when a protected tool returns an authentication challenge. Keep tokens, secrets and personal data out of public settings. Checkout, payments, refunds and shipping-label purchases are outside this integration.

Official setup and current capability guidance: https://supercatch.com/ai
Privacy: https://supercatch.com/privacy
Terms: https://supercatch.com/terms
