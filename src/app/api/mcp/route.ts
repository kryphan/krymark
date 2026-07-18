import { NextRequest, NextResponse } from "next/server";
import { orgFromApiKey, callTool, TOOL_DEFS } from "@/lib/mcp-tools";

// MCP remote server (Streamable HTTP, JSON-RPC 2.0) — AI client (Claude Code/Cursor)
// trỏ thẳng vào đây với Authorization: Bearer km_live_…  Không cần cài gì.
// Hỗ trợ: initialize · notifications/initialized · ping · tools/list · tools/call.
export const runtime = "nodejs";

const PROTOCOL = "2025-06-18";

type RpcReq = { jsonrpc: "2.0"; id?: number | string | null; method: string; params?: Record<string, unknown> };
const rpcOk = (id: RpcReq["id"], result: unknown) => ({ jsonrpc: "2.0", id, result });
const rpcErr = (id: RpcReq["id"], code: number, message: string) => ({ jsonrpc: "2.0", id, error: { code, message } });

export async function POST(req: NextRequest) {
  const authz = req.headers.get("authorization") ?? "";
  const key = authz.replace(/^Bearer\s+/i, "").trim();
  const org = await orgFromApiKey(key);
  if (!org) return NextResponse.json({ error: "invalid or missing API key" }, { status: 401 });

  let body: RpcReq | RpcReq[];
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(rpcErr(null, -32700, "Parse error"), { status: 400 });
  }

  const handle = async (r: RpcReq): Promise<unknown | null> => {
    if (!r || r.jsonrpc !== "2.0" || typeof r.method !== "string") return rpcErr(r?.id ?? null, -32600, "Invalid request");
    // notifications (không id) → không trả kết quả
    if (r.method.startsWith("notifications/")) return null;
    switch (r.method) {
      case "initialize":
        return rpcOk(r.id, {
          protocolVersion: typeof r.params?.protocolVersion === "string" ? r.params.protocolVersion : PROTOCOL,
          capabilities: { tools: {} },
          serverInfo: { name: "krymark", version: "0.13.0" },
          instructions:
            "KryMark = end-user feedback on live websites, anchored to DOM elements. Typical flow: list_notes (status=new) → get_fix_prompt(note_ids) → apply fixes in the codebase → resolve_notes(note_ids). Screenshots are public URLs — view them when reasoning about visual feedback.",
        });
      case "ping":
        return rpcOk(r.id, {});
      case "tools/list":
        return rpcOk(r.id, { tools: TOOL_DEFS });
      case "tools/call": {
        const name = String(r.params?.name ?? "");
        const args = (r.params?.arguments ?? {}) as Record<string, unknown>;
        try {
          const text = await callTool(org, name, args);
          return rpcOk(r.id, { content: [{ type: "text", text }], isError: false });
        } catch (err) {
          return rpcOk(r.id, {
            content: [{ type: "text", text: `Tool error: ${err instanceof Error ? err.message : "unknown"}` }],
            isError: true,
          });
        }
      }
      default:
        return rpcErr(r.id ?? null, -32601, `Method not found: ${r.method}`);
    }
  };

  if (Array.isArray(body)) {
    const results = (await Promise.all(body.map(handle))).filter((x) => x !== null);
    return NextResponse.json(results);
  }
  const result = await handle(body);
  if (result === null) return new NextResponse(null, { status: 202 }); // notification
  return NextResponse.json(result);
}

export async function GET() {
  // Không hỗ trợ SSE stream — client Streamable HTTP thuần POST vẫn chạy đủ
  return NextResponse.json({ ok: true, transport: "streamable-http (POST only)", docs: "/docs" });
}
