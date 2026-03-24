import { cookies } from "next/headers";
import { getGlobalWorkspaceId, isWorkspaceGlobal } from "./workspaces";

/**
 * Get the active workspace ID for server components.
 * Reads from the pauseai_workspace cookie, falls back to Global.
 */
export async function getServerWorkspaceId(): Promise<string> {
  const cookieStore = await cookies();
  const wsId = cookieStore.get("pauseai_workspace")?.value;
  if (wsId) return wsId;
  return getGlobalWorkspaceId();
}

/**
 * Check if the active workspace is the global workspace.
 */
export async function isServerWorkspaceGlobal(): Promise<boolean> {
  const wsId = await getServerWorkspaceId();
  return isWorkspaceGlobal(wsId);
}
