import NetInfo from "@react-native-community/netinfo";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type NetworkContextValue = {
  isOnline: boolean;
};

const NetworkContext = createContext<NetworkContextValue>({ isOnline: true });

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setIsOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
    });
    return () => unsub();
  }, []);

  const value = useMemo(() => ({ isOnline }), [isOnline]);
  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useNetwork() {
  return useContext(NetworkContext);
}
