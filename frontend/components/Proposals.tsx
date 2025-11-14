"use client";

import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { useMetaMaskEthersSigner } from "@/hooks/metamask/useMetaMaskEthersSigner";
import { contractsMap } from "@/contracts/contractsMap";
import { useFhevm } from "@/fhevm/useFhevm";
import { FhevmDecryptionSignature } from "@/fhevm/FhevmDecryptionSignature";
import { useInMemoryStorage } from "@/hooks/useInMemoryStorage";

type UiProposal = {
  id: number;
  proposer: string;
  beneficiary: string;
  token: string;
  amountWei: bigint;
  purposeCID: string;
  startTime: number;
  endTime: number;
  status: number;
  emergency: boolean;
  fromEmergencyPool: boolean;
  support: bigint;
  against: bigint;
};

export function Proposals() {
  const { chainId, isConnected, connect, ethersSigner, ethersReadonlyProvider, provider } = useMetaMaskEthersSigner();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [proposals, setProposals] = useState<UiProposal[]>([]);
  const [ownerAddr, setOwnerAddr] = useState<string>("");
  const [dec, setDec] = useState<Record<number, { support?: string; against?: string }>>({});

  const governance = useMemo(() => contractsMap.getContract("CrisisCouncil", chainId), [chainId]);
  const { instance } = useFhevm({ provider, chainId, enabled: true, initialMockChains: { 31337: "http://localhost:8545" } });
  const { storage } = useInMemoryStorage();

  const load = async () => {
    try {
      setLoading(true); setError("");
      if (!ethersReadonlyProvider) return;
      if (!governance?.address) { setError("CrisisCouncil not deployed"); return; }
      const c = new ethers.Contract(governance.address, governance.abi, ethersReadonlyProvider);
      try { const owner: string = await c.owner(); setOwnerAddr(owner); } catch {}
      const nextId: bigint = await c.nextResolutionId();
      const out: UiProposal[] = [];
      for (let i = Number(nextId) - 1; i >= 1 && out.length < 50; i--) {
        const p = await c.resolutions(i);
        const support: bigint = await c.supportWeight(i);
        const against: bigint = await c.againstWeight(i);
        out.push({
          id: Number(p.id),
          proposer: p.proposer as string,
          beneficiary: (p.recipient as string),
          token: p.token as string,
          amountWei: p.amount as bigint,
          purposeCID: p.purposeCID as string,
          startTime: Number(p.startTime),
          endTime: Number(p.endTime),
          status: Number(p.status),
          emergency: Boolean(p.emergency),
          fromEmergencyPool: Boolean(p.fromCrisisPool),
          support,
          against,
        });
      }
      setProposals(out);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [ethersReadonlyProvider, governance?.address]);

  const vote = async (proposalId: number, support: boolean) => {
    try {
      if (!ethersSigner) { connect(); return; }
      if (!governance?.address) return;
      const c = new ethers.Contract(governance.address, governance.abi, ethersSigner);
      if (!instance) { setError("FHEVM instance not ready"); return; }
      const input = instance.createEncryptedInput(governance.address!, ethersSigner.address);
      input.add32(1);
      const enc = await input.encrypt();
      const tx = await c.castVote(proposalId, support, enc.handles[0], enc.inputProof);
      await tx.wait();
      await load();
    } catch (e) {
      setError(String(e));
    }
  };

  const decrypt = async (proposalId: number) => {
    try {
      if (!instance || !ethersSigner || !governance?.address) { setError("FHEVM not ready"); return; }
      const c = new ethers.Contract(governance.address, governance.abi, ethersReadonlyProvider ?? ethersSigner);
      const res = await c.getEncryptedTallies(proposalId);
      const hSupport: string = res[0];
      const hAgainst: string = res[1];
      if (!hSupport || hSupport === ethers.ZeroHash) {
        setDec((m) => ({ ...m, [proposalId]: { support: "0", against: m[proposalId]?.against } }));
      }
      if (!hAgainst || hAgainst === ethers.ZeroHash) {
        setDec((m) => ({ ...m, [proposalId]: { support: m[proposalId]?.support, against: "0" } }));
      }
      const sig = await FhevmDecryptionSignature.loadOrSign(instance, [governance.address as `0x${string}`], ethersSigner, storage);
      if (!sig) { setError("Cannot build decryption signature"); return; }
      const out = await instance.userDecrypt([
        ...(hSupport && hSupport !== ethers.ZeroHash ? [{ handle: hSupport, contractAddress: governance.address! }] : []),
        ...(hAgainst && hAgainst !== ethers.ZeroHash ? [{ handle: hAgainst, contractAddress: governance.address! }] : []),
      ], sig.privateKey, sig.publicKey, sig.signature, sig.contractAddresses, sig.userAddress, sig.startTimestamp, sig.durationDays);
      if (hSupport && hSupport !== ethers.ZeroHash) {
        const v = out[hSupport];
        setDec((m) => ({ ...m, [proposalId]: { support: String(v), against: m[proposalId]?.against } }));
      }
      if (hAgainst && hAgainst !== ethers.ZeroHash) {
        const v = out[hAgainst];
        setDec((m) => ({ ...m, [proposalId]: { support: m[proposalId]?.support, against: String(v) } }));
      }
    } catch (e) {
      setError(`Decrypt failed: ${String(e)}`);
    }
  };

  const tally = async (proposalId: number) => {
    try {
      if (!ethersSigner || !governance?.address) return;
      const c = new ethers.Contract(governance.address, governance.abi, ethersSigner);
      const tx = await c.finalizeOutcome(proposalId);
      await tx.wait();
      await load();
    } catch (e) { setError(String(e)); }
  };

  const execute = async (proposalId: number) => {
    try {
      if (!ethersSigner || !governance?.address) return;
      const c = new ethers.Contract(governance.address, governance.abi, ethersSigner);
      const tx = await c.executeResolution(proposalId);
      await tx.wait();
      await load();
    } catch (e) { setError(String(e)); }
  };

  const statusLabels = ["Active", "Passed", "Rejected", "Executed", "Cancelled"];
  const statusColors = {
    0: "from-blue-500/20 to-cyan-500/20 border-blue-400/30 text-blue-200",
    1: "from-emerald-500/20 to-green-500/20 border-emerald-400/30 text-emerald-200",
    2: "from-red-500/20 to-rose-500/20 border-red-400/30 text-red-200",
    3: "from-purple-500/20 to-violet-500/20 border-purple-400/30 text-purple-200",
    4: "from-gray-500/20 to-slate-500/20 border-gray-400/30 text-gray-200",
  };

  return (
    <div className="glass-card rounded-2xl p-6 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold gradient-text mb-1">🗳️ Resolutions</h2>
          <p className="text-sm text-purple-300/70">Community governance proposals</p>
        </div>
        <button 
          onClick={load} 
          className="px-4 py-2 rounded-full glass-card border border-purple-400/30 text-purple-200 text-sm font-semibold hover:bg-purple-500/10 transition-colors"
        >
          🔄 Refresh
        </button>
      </div>

      {loading && <p className="text-purple-300/70 text-center py-8">⏳ Loading...</p>}
      {error && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-400/30 mb-4">
          <p className="text-red-200 text-sm">❌ {error}</p>
        </div>
      )}
      {!loading && proposals.length === 0 && (
        <div className="text-center py-12">
          <div className="text-5xl mb-3">📋</div>
          <p className="text-purple-300/70">No resolutions yet</p>
        </div>
      )}

      <div className="space-y-4">
        {proposals.map((p) => {
          const now = Math.floor(Date.now() / 1000);
          const ended = now > p.endTime;
          const statusLabel = statusLabels[p.status] ?? String(p.status);
          const statusColor = statusColors[p.status as keyof typeof statusColors] ?? statusColors[4];

          return (
            <div key={p.id} className="glass-card rounded-2xl p-6 hover:bg-white/10 transition-colors">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-2xl">{p.emergency ? "⚡" : "📄"}</span>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg font-bold text-white">Resolution #{p.id}</span>
                      {p.fromEmergencyPool && <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 border border-orange-400/30 text-orange-200">🚨 Crisis</span>}
                    </div>
                    <div className="text-xs text-purple-300/70 font-mono">
                      {p.beneficiary.slice(0, 6)}...{p.beneficiary.slice(-4)}
                    </div>
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full bg-gradient-to-r ${statusColor} border text-xs font-semibold`}>
                  {statusLabel}
                </div>
              </div>

              {/* Details */}
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-purple-300/70">💰 Amount:</span>
                    <span className="font-semibold text-white">{ethers.formatEther(p.amountWei)} ETH</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-purple-300/70">⏱️ Ends:</span>
                    <span className="font-semibold text-white">{new Date(p.endTime * 1000).toLocaleString()}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-purple-300/70">👍 Support:</span>
                    <span className="font-mono text-emerald-300 font-semibold">{dec[p.id]?.support ?? "🔒"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-purple-300/70">👎 Against:</span>
                    <span className="font-mono text-red-300 font-semibold">{dec[p.id]?.against ?? "🔒"}</span>
                  </div>
                </div>
              </div>

              {p.purposeCID && (
                <div className="mb-4 p-3 rounded-xl bg-purple-500/10 border border-purple-400/20">
                  <p className="text-xs text-purple-300/70 mb-1">📄 Evidence:</p>
                  <p className="text-xs font-mono text-purple-200 break-all">{p.purposeCID}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                {!ended && p.status === 0 && (
                  <>
                    <button 
                      onClick={() => vote(p.id, true)} 
                      className="px-4 py-2 rounded-full bg-gradient-to-r from-emerald-500 to-green-500 text-white text-sm font-semibold hover:scale-105 transition-transform"
                    >
                      👍 Support
                    </button>
                    <button 
                      onClick={() => vote(p.id, false)} 
                      className="px-4 py-2 rounded-full glass-card border border-red-400/30 text-red-200 text-sm font-semibold hover:bg-red-500/10 transition-colors"
                    >
                      👎 Reject
                    </button>
                  </>
                )}
                {ended && p.status === 0 && (
                  <button 
                    onClick={() => tally(p.id)} 
                    className="px-4 py-2 rounded-full glass-card border border-purple-400/30 text-purple-200 text-sm font-semibold hover:bg-purple-500/10"
                  >
                    ✅ Finalize
                  </button>
                )}
                {p.status === 1 && (
                  <button 
                    onClick={() => execute(p.id)} 
                    className="px-4 py-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold hover:scale-105 transition-transform"
                  >
                    💸 Execute
                  </button>
                )}
                <button 
                  onClick={() => decrypt(p.id)} 
                  className="px-4 py-2 rounded-full glass-card border border-purple-400/30 text-purple-200 text-sm font-semibold hover:bg-purple-500/10"
                >
                  🔓 Decrypt
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {!isConnected && proposals.length > 0 && (
        <div className="mt-6 p-4 rounded-2xl bg-purple-500/10 border border-purple-400/20 text-center">
          <p className="text-sm text-purple-200">🔗 Connect wallet to vote on proposals</p>
        </div>
      )}
    </div>
  );
}
