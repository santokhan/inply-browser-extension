import { useContext } from "react";
import { TenantAuthContext } from "../contexts/TenantAuthProvider";

export function useTenantAuth() {
  const context = useContext(TenantAuthContext);

  if (!context) {
    throw new Error("useTenantAuth must be used within a TenantAuthProvider");
  }

  return context;
}
