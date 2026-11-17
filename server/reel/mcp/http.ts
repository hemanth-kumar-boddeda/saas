// Streamable HTTP endpoint for remote MCP clients. Stateless: a fresh server per request, bound to the
// bearer token's principal. Cookies are NOT accepted here; only `Authorization: Bearer rf_...`.
// ponytail: no OAuth 2.1 yet. Claude's hosted connector flow needs it; until then use a client that
// can send a bearer header (Claude Code `--header`, Claude Desktop via mcp-remote, MCP Inspector).
import { Request, Response, Router } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { verifyApiToken } from "../apiTokens";
import { buildMcpServer, McpDeps } from "./server";
import { logger } from "../../utils/logger";

export const mcpRouter = (deps: McpDeps, ...limiters: any[]) => {
  const r = Router();
  r.post("/mcp", ...limiters, async (req: Request, res: Response) => {
    const h = req.headers.authorization;
    const principal = h?.startsWith("Bearer ") ? await verifyApiToken(h.slice(7)) : null;
    if (!principal) { res.setHeader("WWW-Authenticate", 'Bearer realm="reelflow"'); return void res.status(401).json({ jsonrpc: "2.0", error: { code: -32001, message: "Valid API token required" }, id: null }); }
    const server = buildMcpServer(principal, deps);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on("close", () => { void transport.close(); void server.close(); });
    try { await server.connect(transport); await transport.handleRequest(req, res, req.body); }
    catch (e: any) { logger.error("mcp_request_failed", { errorMessage: e?.message }); if (!res.headersSent) res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal error" }, id: null }); }
  });
  const no = (_q: Request, res: Response) => void res.status(405).set("Allow", "POST").json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed (stateless server)" }, id: null });
  r.get("/mcp", no); r.delete("/mcp", no);
  return r;
};
