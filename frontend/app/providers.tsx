"use client";

import type { ReactNode } from "react";

import { MetaMaskProvider } from "@/hooks/metamask/useMetaMaskProvider";
import { InMemoryStorageProvider } from "@/hooks/useInMemoryStorage";
import { MetaMaskEthersSignerProvider } from "@/hooks/metamask/useMetaMaskEthersSigner";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <MetaMaskProvider>
      <MetaMaskEthersSignerProvider initialMockChains={{ 31337: "http://localhost:8545" }}>
        <InMemoryStorageProvider>{children}</InMemoryStorageProvider>
      </MetaMaskEthersSignerProvider>
    </MetaMaskProvider>
  );
}


