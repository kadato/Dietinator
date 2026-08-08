import React, { createContext, useContext, useEffect, useState } from "react"
import NetInfo from "@react-native-community/netinfo"

type NetworkContextValue = {
  /** Best-effort connectivity. Unknown/offline means the app is offline. */
  isOnline: boolean
}

const NetworkContext = createContext<NetworkContextValue>({ isOnline: true })

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected !== false)
    })
    return unsubscribe
  }, [])

  return <NetworkContext.Provider value={{ isOnline }}>{children}</NetworkContext.Provider>
}

export function useNetwork(): NetworkContextValue {
  return useContext(NetworkContext)
}
