import { agenticOrgStatus } from "@/lib/agenticorg.mjs";

export const dynamic = "force-dynamic";

// Mock/Live panel: {connected, mode, baseUrl, agents:[{role,name,id}], lastRuns:[{at,agent,ms,ok,runId,hitl,error}], error}
export async function GET() {
  return Response.json(await agenticOrgStatus());
}
