"use client";

import { useMetaMask } from "@/hooks/metamask/useMetaMaskProvider";

function formatAddress(addr?: string) {
  if (!addr) return "";
  return `${addr.slice(0, 4)}...${addr.slice(-3)}`;
}

export function WalletButton() {
  const { isConnected, connect, accounts, chainId } = useMetaMask();

  if (!isConnected) {
    return (
      <button
        className="group relative px-5 py-2.5 rounded-full overflow-hidden border border-purple-400/30 font-semibold transition-all hover:border-purple-400/60"
        onClick={connect}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-pink-600/20 opacity-0 group-hover:opacity-100 transition-opacity" />
        <span className="relative text-purple-200 text-sm">🔗 Connect</span>
      </button>
    );
  }

  return (
    <div className="glass-card rounded-full px-4 py-2 flex items-center gap-3">
      <div className="relative">
        <div className="absolute inset-0 bg-emerald-400 blur-md opacity-60" />
        <div className="relative h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
      </div>
      <div className="flex flex-col">
        <span className="font-mono text-xs text-purple-100 font-semibold">
          {formatAddress(accounts?.[0])}
        </span>
        <span className="text-[10px] text-purple-300/60">Chain {chainId}</span>
      </div>
    </div>
  );
}


