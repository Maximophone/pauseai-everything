"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export type WorkspaceInfo = {
  id: string;
  name: string;
  slug: string;
  type: "global" | "chapter";
  defaultLanguage: string;
  workspaceRole?: string;
};

type WorkspaceContextType = {
  workspaces: WorkspaceInfo[];
  activeWorkspace: WorkspaceInfo | null;
  setActiveWorkspace: (ws: WorkspaceInfo) => void;
  isLoading: boolean;
};

const WorkspaceContext = createContext<WorkspaceContextType>({
  workspaces: [],
  activeWorkspace: null,
  setActiveWorkspace: () => {},
  isLoading: true,
});

export function useWorkspace() {
  return useContext(WorkspaceContext);
}

export function useWorkspaceId(): string | undefined {
  const { activeWorkspace } = useWorkspace();
  return activeWorkspace?.id;
}

/**
 * Custom fetch that injects the X-Workspace-Id header.
 * Use this for all API calls from the client.
 */
export function useWorkspaceFetch() {
  const { activeWorkspace } = useWorkspace();

  return useCallback(
    (url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (activeWorkspace?.id) {
        headers.set("X-Workspace-Id", activeWorkspace.id);
      }
      return fetch(url, { ...init, headers });
    },
    [activeWorkspace?.id]
  );
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? match[2] : null;
}

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=${365 * 24 * 60 * 60}; samesite=strict`;
}

function resolveActiveWorkspace(wsList: WorkspaceInfo[]): WorkspaceInfo | null {
  if (wsList.length === 0) return null;
  if (typeof document === "undefined") return wsList[0];
  const savedId = getCookie("pauseai_workspace");
  return wsList.find((ws) => ws.id === savedId) ?? wsList[0];
}

export function WorkspaceProvider({
  initialWorkspaces,
  children,
}: {
  initialWorkspaces?: WorkspaceInfo[];
  children: React.ReactNode;
}) {
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>(
    initialWorkspaces ?? []
  );
  // Initialize activeWorkspace synchronously to avoid "Loading..." flash
  const [activeWorkspace, setActiveWorkspaceState] =
    useState<WorkspaceInfo | null>(() =>
      initialWorkspaces && initialWorkspaces.length > 0
        ? resolveActiveWorkspace(initialWorkspaces)
        : null
    );
  const [isLoading, setIsLoading] = useState(
    !initialWorkspaces || initialWorkspaces.length === 0
  );

  // Ensure cookie is set on mount (covers first login / missing cookie)
  useEffect(() => {
    if (activeWorkspace) {
      const savedId = getCookie("pauseai_workspace");
      if (savedId !== activeWorkspace.id) {
        setCookie("pauseai_workspace", activeWorkspace.id);
      }
    }
  }, [activeWorkspace]);

  // Fetch workspaces on mount only if not provided
  useEffect(() => {
    if (initialWorkspaces && initialWorkspaces.length > 0) {
      // Already initialized synchronously
      return;
    }

    fetch("/api/workspaces")
      .then((res) => res.json())
      .then((data: WorkspaceInfo[]) => {
        setWorkspaces(data);
        setActiveWorkspaceState(resolveActiveWorkspace(data));
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [initialWorkspaces]);

  const setActiveWorkspace = useCallback((ws: WorkspaceInfo) => {
    setActiveWorkspaceState(ws);
    setCookie("pauseai_workspace", ws.id);
    // Trigger page reload to refetch data with new workspace context
    window.location.reload();
  }, []);

  return (
    <WorkspaceContext.Provider
      value={{ workspaces, activeWorkspace, setActiveWorkspace, isLoading }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}
