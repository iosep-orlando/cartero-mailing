"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../fetcher";
import type { MeDTO } from "../types";

// Estado global del panel: quién soy y en qué organización estoy. Lo leen la
// cabecera, los ajustes y cualquier pantalla que lo necesite, sin pedirlo
// cada una por su cuenta.

interface GlobalState {
  me: MeDTO | null;
  refresh: () => Promise<void>;
}

const GlobalContext = createContext<GlobalState>({ me: null, refresh: async () => {} });

export function GlobalProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<MeDTO | null>(null);
  const refresh = useCallback(async () => {
    try {
      setMe(await api<MeDTO>("/api/auth/me"));
    } catch {
      setMe(null);
    }
  }, []);
  useEffect(() => {
    let cancelled = false;
    api<MeDTO>("/api/auth/me")
      .then((data) => !cancelled && setMe(data))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return <GlobalContext.Provider value={{ me, refresh }}>{children}</GlobalContext.Provider>;
}

export const useGlobal = () => useContext(GlobalContext);
