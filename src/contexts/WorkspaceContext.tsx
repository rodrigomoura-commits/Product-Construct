import React, { createContext, useContext } from "react";

const WorkspaceContext = createContext<any>(null);

export function WorkspaceProvider({
  children,
  product,
  role,
  permissions,
  currentStage
}: any) {
  return (
    <WorkspaceContext.Provider
      value={{
        product,
        role: role || "viewer",
        permissions,
        currentStage
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);

  if (!context) {
    throw new Error("useWorkspace deve ser usado dentro de WorkspaceProvider.");
  }

  return context;
}
