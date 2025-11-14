"use client";

import { useMemo, useState } from "react";
import { ethers } from "ethers";
import { useMetaMaskEthersSigner } from "@/hooks/metamask/useMetaMaskEthersSigner";
import { contractsMap } from "@/contracts/contractsMap";

export function ProposalForm() {
  const { chainId, ethersSigner, isConnected, connect } = useMetaMaskEthersSigner();
  const gov = useMemo(() => contractsMap.getContract("CrisisCouncil", chainId), [chainId]);

  const [beneficiary, setBeneficiary] = useState<string>("");
  const [amountEth, setAmountEth] = useState<string>("0.01");
  const [purposeCID, setPurposeCID] = useState<string>("");
  const [durationHours, setDurationHours] = useState<string>("24");
  const [emergency, setEmergency] = useState<boolean>(false);
  const [fromEmergency, setFromEmergency] = useState<boolean>(false);
  const [msg, setMsg] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const token = ethers.ZeroAddress;

  const submit = async () => {
    try {
      if (!ethersSigner) { setMsg("❌ Please connect wallet"); return; }
      if (!gov?.address) { setMsg("❌ CrisisCouncil not found"); return; }
      if (!ethers.isAddress(beneficiary)) { setMsg("❌ Invalid recipient address"); return; }

      setIsProcessing(true);
      const c = new ethers.Contract(gov.address, gov.abi, ethersSigner);
      const amount = ethers.parseEther(amountEth || "0");
      const duration = BigInt(Number(durationHours || "0") * 3600);

      const tx = await c.submitResolution(beneficiary, token, amount, purposeCID, duration, emergency, fromEmergency);
      setMsg(`⏳ Transaction: ${tx.hash.slice(0, 10)}...`);
      await tx.wait();
      setMsg("✅ Resolution created successfully!");
      setIsProcessing(false);
    } catch (e) {
      setMsg(`❌ Failed: ${String(e)}`);
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="glass-card rounded-3xl p-8 md:p-10 relative overflow-hidden">
        {/* 装饰背景 */}
        <div className="absolute -top-20 -left-20 w-64 h-64 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full blur-3xl" />
        
        <div className="relative z-10">
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/30 mb-4">
              <span className="text-xs font-semibold text-purple-200">📋 Governance</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black gradient-text mb-2">Create Resolution</h1>
            <p className="text-purple-200/70">Submit a proposal for community vote</p>
          </div>

          <div className="space-y-6">
            {/* Recipient Address */}
            <div>
              <label className="block text-sm font-semibold text-purple-200 mb-2 flex items-center gap-2">
                👤 Recipient Address
              </label>
              <input 
                className="w-full px-4 py-3 rounded-2xl glass-card text-white placeholder-purple-300/40 focus:outline-none focus:ring-2 focus:ring-purple-400/50 font-mono text-sm" 
                value={beneficiary} 
                onChange={(e) => setBeneficiary(e.target.value)} 
                placeholder="0x..."
              />
            </div>

            {/* Amount & Duration */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-purple-200 mb-2 flex items-center gap-2">
                  💰 Amount
                </label>
                <div className="relative">
                  <input 
                    type="number"
                    step="0.01"
                    className="w-full px-4 py-3 rounded-2xl glass-card text-white placeholder-purple-300/40 focus:outline-none focus:ring-2 focus:ring-purple-400/50" 
                    value={amountEth} 
                    onChange={(e) => setAmountEth(e.target.value)}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-purple-300">ETH</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-purple-200 mb-2 flex items-center gap-2">
                  ⏱️ Duration
                </label>
                <div className="relative">
                  <input 
                    type="number"
                    className="w-full px-4 py-3 rounded-2xl glass-card text-white placeholder-purple-300/40 focus:outline-none focus:ring-2 focus:ring-purple-400/50" 
                    value={durationHours} 
                    onChange={(e) => setDurationHours(e.target.value)}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-purple-300">hours</span>
                </div>
              </div>
            </div>

            {/* Purpose CID */}
            <div>
              <label className="block text-sm font-semibold text-purple-200 mb-2 flex items-center gap-2">
                📄 Evidence / Purpose (IPFS CID)
              </label>
              <input 
                className="w-full px-4 py-3 rounded-2xl glass-card text-white placeholder-purple-300/40 focus:outline-none focus:ring-2 focus:ring-purple-400/50 font-mono text-sm" 
                value={purposeCID} 
                onChange={(e) => setPurposeCID(e.target.value)} 
                placeholder="ipfs://..."
              />
            </div>

            {/* Options */}
            <div className="grid md:grid-cols-2 gap-4">
              <label className="flex items-center gap-3 p-4 rounded-2xl glass-card cursor-pointer hover:bg-purple-500/10 transition-colors">
                <input 
                  type="checkbox" 
                  checked={emergency} 
                  onChange={(e) => setEmergency(e.target.checked)}
                  className="w-5 h-5 rounded border-2 border-purple-400/50 bg-transparent checked:bg-purple-500"
                />
                <div>
                  <div className="text-sm font-semibold text-purple-100">⚡ Emergency Priority</div>
                  <div className="text-xs text-purple-300/70">Shorter voting period</div>
                </div>
              </label>
              <label className="flex items-center gap-3 p-4 rounded-2xl glass-card cursor-pointer hover:bg-purple-500/10 transition-colors">
                <input 
                  type="checkbox" 
                  checked={fromEmergency} 
                  onChange={(e) => setFromEmergency(e.target.checked)}
                  className="w-5 h-5 rounded border-2 border-purple-400/50 bg-transparent checked:bg-purple-500"
                />
                <div>
                  <div className="text-sm font-semibold text-purple-100">🚨 Use Crisis Pool</div>
                  <div className="text-xs text-purple-300/70">Disburse from emergency fund</div>
                </div>
              </label>
            </div>

            {/* Submit Button */}
            {!isConnected ? (
              <button 
                onClick={connect} 
                className="w-full py-4 rounded-2xl border-2 border-purple-400/40 text-purple-100 font-bold hover:bg-purple-500/10 transition-all"
              >
                🔗 Connect Wallet
              </button>
            ) : (
              <button 
                onClick={submit}
                disabled={isProcessing}
                className={`w-full py-4 rounded-2xl font-bold transition-all ${
                  isProcessing 
                    ? "bg-purple-500/30 cursor-not-allowed" 
                    : "bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 hover:scale-105"
                }`}
              >
                <span className="text-white flex items-center justify-center gap-2">
                  {isProcessing ? "⏳ Submitting..." : "📋 Submit Resolution"}
                </span>
              </button>
            )}

            {/* Status */}
            {msg && (
              <div className="p-4 rounded-2xl glass-card border border-purple-400/30">
                <p className="text-sm text-purple-100">{msg}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
