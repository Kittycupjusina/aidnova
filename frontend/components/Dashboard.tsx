"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { useMetaMaskEthersSigner } from "@/hooks/metamask/useMetaMaskEthersSigner";
import { useFhevm } from "@/fhevm/useFhevm";
import { FHEVaultWidget } from "@/components/FHEVaultWidget";
import { contractsMap } from "@/contracts/contractsMap";
import { FhevmDecryptionSignature } from "@/fhevm/FhevmDecryptionSignature";
import { Proposals } from "@/components/Proposals";

export function Dashboard() {
  const { provider, chainId, isConnected, connect, ethersReadonlyProvider, ethersSigner } = useMetaMaskEthersSigner();
  const { instance, status, error } = useFhevm({ provider, chainId, initialMockChains: { 31337: "http://localhost:8545" }, enabled: true });

  const [tvl, setTvl] = useState<string>("🔒");
  const [emergency, setEmergency] = useState<string>("🔒");
  const [tvlHandle, setTvlHandle] = useState<string | undefined>(undefined);
  const [emergencyHandle, setEmergencyHandle] = useState<string | undefined>(undefined);
  const [statusMsg, setStatusMsg] = useState<string>("");
  const [decryptStatus, setDecryptStatus] = useState<"idle" | "running" | "done">("idle");

  const fheVaultInfo = useMemo(() => contractsMap.getContract("ShieldedReliefVault", chainId), [chainId]);

  useEffect(() => {
    const run = async () => {
      if (!ethersReadonlyProvider || !fheVaultInfo?.address) return;
      const abi = [
        "function viewEncryptedStandardTotal() view returns (bytes32)",
        "function viewEncryptedCrisisTotal() view returns (bytes32)",
      ];
      const c = new ethers.Contract(fheVaultInfo.address, abi, ethersReadonlyProvider);
      const h1 = await c.viewEncryptedStandardTotal();
      const h2 = await c.viewEncryptedCrisisTotal();
      setTvlHandle(h1); setEmergencyHandle(h2);
    };
    run();
  }, [ethersReadonlyProvider, fheVaultInfo?.address, ethersSigner]);

  const decrypt = useCallback(async (): Promise<{ tvl?: string; emergency?: string; message: string }> => {
    try {
      if (!instance || !ethersSigner || !fheVaultInfo?.address) return { message: "FHEVM 未就绪" };
      const sig = await FhevmDecryptionSignature.loadOrSign(
        instance,
        [fheVaultInfo.address as `0x${string}`],
        ethersSigner,
        { getItem: () => null, setItem: () => {}, removeItem: () => {} } as any,
      );
      if (!sig) { return { message: "无法构建解密签名" }; }
      const reqs: { handle: string; contractAddress: string }[] = [];
      const validTvl = tvlHandle && tvlHandle !== ethers.ZeroHash;
      const validEmerg = emergencyHandle && emergencyHandle !== ethers.ZeroHash;
      if (validTvl) reqs.push({ handle: tvlHandle as string, contractAddress: fheVaultInfo.address! });
      if (validEmerg) reqs.push({ handle: emergencyHandle as string, contractAddress: fheVaultInfo.address! });
      if (reqs.length === 0) {
        return { tvl: "0", emergency: "0", message: "无可解密数据" };
      }
      const res = await instance.userDecrypt(
        reqs,
        sig.privateKey,
        sig.publicKey,
        sig.signature,
        sig.contractAddresses,
        sig.userAddress,
        sig.startTimestamp,
        sig.durationDays,
      );
      const out: { tvl?: string; emergency?: string } = {};
      if (validTvl) out.tvl = ethers.formatEther(res[tvlHandle as string]); else out.tvl = "0";
      if (validEmerg) out.emergency = ethers.formatEther(res[emergencyHandle as string]); else out.emergency = "0";
      return { ...out, message: "✅ 解密完成" };
    } catch (e) {
      return { message: `❌ 解密失败: ${String(e)}` };
    }
  }, [instance, ethersSigner, fheVaultInfo?.address, tvlHandle, emergencyHandle]);

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="relative">
        <div className="glass-card rounded-3xl p-8 md:p-12 overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full blur-3xl" />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/20 border border-purple-400/30 mb-4">
              <span className="text-xs font-semibold text-purple-200">🌟 Powered by FHEVM</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-black mb-4">
              <span className="gradient-text">AidNova</span>
            </h1>
            <p className="text-xl text-purple-100/80 mb-6 max-w-2xl">
              Decentralized relief platform with encrypted privacy protection
            </p>
            
            {/* 状态指示器 */}
            <div className="flex flex-wrap gap-3 mb-8">
              <StatusPill label={`FHEVM: ${status ?? "idle"}`} color={status === "ready" ? "green" : status === "error" ? "red" : "gray"} />
              <StatusPill label={`Network: ${chainId ?? "-"}`} color="purple" />
              <StatusPill label={`Mode: ${chainId === 31337 ? "Mock" : "Relayer"}`} color={chainId === 31337 ? "orange" : "blue"} />
            </div>

            {/* CTA 按钮 */}
            <div className="flex flex-wrap gap-4">
              <a href="/donate" className="group relative px-8 py-3.5 font-bold rounded-full overflow-hidden transition-transform hover:scale-105">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500" />
                <span className="relative text-white flex items-center gap-2">
                  💝 Donate Now
                  <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              </a>
              <a href="/propose" className="px-8 py-3.5 rounded-full border-2 border-purple-400/40 text-purple-100 font-bold hover:bg-purple-500/10 transition-colors">
                📋 Create Proposal
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        <StatsCard 
          title="💎 Standard Pool" 
          value={tvl}
          icon="📊"
          gradient="from-purple-500/20 to-pink-500/20"
        />
        <StatsCard 
          title="🚨 Crisis Pool" 
          value={emergency}
          icon="⚡"
          gradient="from-pink-500/20 to-orange-500/20"
        />
      </div>

      {/* Decrypt Button */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-purple-100 mb-1">🔓 Decrypt Pool Values</h3>
            <p className="text-sm text-purple-300/70">Click to reveal encrypted balances using FHE</p>
          </div>
          <button
            onClick={async () => {
              setDecryptStatus("running"); setStatusMsg("⏳ Processing...");
              const r = await decrypt();
              if (r.tvl !== undefined) setTvl(r.tvl);
              if (r.emergency !== undefined) setEmergency(r.emergency);
              setStatusMsg(r.message);
              setDecryptStatus("done");
              setTimeout(() => setDecryptStatus("idle"), 2000);
            }}
            disabled={decryptStatus === "running"}
            className={`px-6 py-3 rounded-full font-semibold transition-all ${
              decryptStatus === "running" 
                ? "bg-purple-500/30 cursor-not-allowed" 
                : decryptStatus === "done"
                ? "bg-gradient-to-r from-emerald-500 to-green-500 glow-shadow"
                : "bg-gradient-to-r from-purple-500 to-pink-500 hover:scale-105"
            }`}
          >
            <span className="text-white flex items-center gap-2">
              {decryptStatus === "running" ? "🔄 Decrypting..." : decryptStatus === "done" ? "✅ Complete" : "🔓 Decrypt"}
            </span>
          </button>
        </div>
        {statusMsg && (
          <div className="mt-4 px-4 py-2 rounded-lg bg-purple-500/10 border border-purple-400/20">
            <p className="text-sm text-purple-200">{statusMsg}</p>
          </div>
        )}
      </div>

      {/* Proposals Section */}
      <Proposals />

      {/* FHE Demo */}
      <div className="glass-card rounded-2xl p-8">
        <h2 className="text-2xl font-bold mb-2 gradient-text">🔐 FHE Encryption Demo</h2>
        <p className="text-purple-200/70 mb-6">Test encrypted operations on the ShieldedReliefVault</p>
        <FHEVaultWidget instance={instance} />
      </div>
    </div>
  );
}

function StatsCard({ title, value, icon, gradient }: { title: string; value: string; icon: string; gradient: string }) {
  return (
    <div className="glass-card rounded-2xl p-6 group hover:scale-[1.02] transition-transform cursor-default">
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl`} />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <span className="text-4xl">{icon}</span>
          <div className="px-3 py-1 rounded-full bg-purple-500/20 text-xs font-semibold text-purple-200">
            ETH
          </div>
        </div>
        <p className="text-purple-300/80 text-sm font-medium mb-2">{title}</p>
        <p className="text-3xl font-black text-white">{value}</p>
      </div>
    </div>
  );
}

function StatusPill({ label, color }: { label: string; color: "green" | "red" | "gray" | "orange" | "blue" | "purple" }) {
  const colorClasses = {
    green: "bg-emerald-500/20 text-emerald-300 border-emerald-400/30",
    red: "bg-red-500/20 text-red-300 border-red-400/30",
    orange: "bg-orange-500/20 text-orange-300 border-orange-400/30",
    blue: "bg-blue-500/20 text-blue-300 border-blue-400/30",
    purple: "bg-purple-500/20 text-purple-300 border-purple-400/30",
    gray: "bg-gray-500/20 text-gray-300 border-gray-400/30",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${colorClasses[color]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${color === 'green' ? 'bg-emerald-400' : color === 'red' ? 'bg-red-400' : color === 'orange' ? 'bg-orange-400' : color === 'blue' ? 'bg-blue-400' : color === 'purple' ? 'bg-purple-400' : 'bg-gray-400'} animate-pulse`} />
      {label}
    </span>
  );
}
