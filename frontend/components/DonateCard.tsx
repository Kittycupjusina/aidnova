"use client";

import { useMemo, useState } from "react";
import { ethers } from "ethers";
import { useMetaMaskEthersSigner } from "@/hooks/metamask/useMetaMaskEthersSigner";
import { contractsMap } from "@/contracts/contractsMap";
import { useFhevm } from "@/fhevm/useFhevm";

export function DonateCard() {
  const { provider, chainId, isConnected, connect, ethersSigner } = useMetaMaskEthersSigner();
  const treasury = useMemo(() => contractsMap.getContract("ReliefTreasury", chainId), [chainId]);
  const fheVault = useMemo(() => contractsMap.getContract("ShieldedReliefVault", chainId), [chainId]);
  const { instance } = useFhevm({ provider, chainId, enabled: true, initialMockChains: { 31337: "http://localhost:8545" } });
  
  const [amount, setAmount] = useState<string>("0.05");
  const [isEmergency, setIsEmergency] = useState<boolean>(false);
  const [msg, setMsg] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  const quickAmounts = ["0.01", "0.05", "0.1", "0.5"];

  const donate = async () => {
    try {
      if (!ethersSigner) { setMsg("❌ Please connect wallet first"); return; }
      if (!treasury?.address) { setMsg("❌ Treasury not deployed"); return; }
      setIsProcessing(true); setIsCompleted(false);
      
      const c = new ethers.Contract(treasury.address, treasury.abi, ethersSigner);
      const tx = await c.contribute(ethers.ZeroAddress, 0, isEmergency, { value: ethers.parseEther(amount || "0") });
      setMsg(`⏳ Transaction submitted: ${tx.hash.slice(0, 10)}...`);
      await tx.wait();
      setMsg("✅ Thank you for your contribution!");
      
      // Sync to FHEVault
      try {
        if (instance && fheVault?.address) {
          const vault = new ethers.Contract(
            fheVault.address,
            ["function accumulateStandard(bytes32, bytes)", "function accumulateCrisis(bytes32, bytes)"],
            ethersSigner
          );
          const input = instance.createEncryptedInput(fheVault.address, ethersSigner.address);
          const wei = ethers.parseEther(amount || "0");
          input.add64(wei);
          const enc = await input.encrypt();
          const tx2 = isEmergency
            ? await vault.accumulateCrisis(enc.handles[0], enc.inputProof)
            : await vault.accumulateStandard(enc.handles[0], enc.inputProof);
          await tx2.wait();
          setMsg((m) => m + " 🔐 Encrypted total synced.");
        }
      } catch (e) {
        setMsg((m) => m + ` (FHE sync failed: ${String(e)})`);
      }
      setIsProcessing(false); setIsCompleted(true);
      setTimeout(() => setIsCompleted(false), 3000);
    } catch (e) { 
      setMsg(`❌ Donation failed: ${String(e)}`); 
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="glass-card rounded-3xl p-8 md:p-10 relative overflow-hidden">
        {/* 装饰背景 */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-pink-500/20 to-orange-500/20 rounded-full blur-3xl" />
        
        <div className="relative z-10">
          <div className="mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/30 mb-4">
              <span className="text-xs font-semibold text-purple-200">💝 Support Relief</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black gradient-text mb-2">Make a Donation</h1>
            <p className="text-purple-200/70">Every contribution makes a difference</p>
          </div>

          <div className="space-y-6">
            {/* Amount Input */}
            <div>
              <label className="block text-sm font-semibold text-purple-200 mb-2">Amount (ETH)</label>
              <div className="relative">
                <input 
                  type="number"
                  step="0.01"
                  className="w-full px-4 py-4 rounded-2xl glass-card text-white text-lg font-semibold placeholder-purple-300/40 focus:outline-none focus:ring-2 focus:ring-purple-400/50" 
                  value={amount} 
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.05"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1 rounded-full bg-purple-500/30 text-xs font-bold text-purple-100">
                  ETH
                </div>
              </div>
              
              {/* Quick amounts */}
              <div className="flex gap-2 mt-3">
                {quickAmounts.map(amt => (
                  <button
                    key={amt}
                    onClick={() => setAmount(amt)}
                    className={`flex-1 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
                      amount === amt 
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' 
                        : 'glass-card text-purple-200 hover:bg-purple-500/20'
                    }`}
                  >
                    {amt}
                  </button>
                ))}
              </div>
            </div>

            {/* Pool Selection */}
            <div>
              <label className="block text-sm font-semibold text-purple-200 mb-3">Destination Pool</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setIsEmergency(false)}
                  className={`p-4 rounded-2xl transition-all ${
                    !isEmergency 
                      ? 'bg-gradient-to-br from-purple-500/30 to-pink-500/30 border-2 border-purple-400/50 glow-shadow' 
                      : 'glass-card border border-purple-400/20 hover:border-purple-400/40'
                  }`}
                >
                  <div className="text-2xl mb-2">💎</div>
                  <div className="text-sm font-bold text-purple-100">Standard Pool</div>
                  <div className="text-xs text-purple-300/70 mt-1">Regular relief fund</div>
                </button>
                <button
                  onClick={() => setIsEmergency(true)}
                  className={`p-4 rounded-2xl transition-all ${
                    isEmergency 
                      ? 'bg-gradient-to-br from-pink-500/30 to-orange-500/30 border-2 border-pink-400/50 glow-shadow' 
                      : 'glass-card border border-purple-400/20 hover:border-purple-400/40'
                  }`}
                >
                  <div className="text-2xl mb-2">🚨</div>
                  <div className="text-sm font-bold text-purple-100">Crisis Pool</div>
                  <div className="text-xs text-purple-300/70 mt-1">Emergency response</div>
                </button>
              </div>
            </div>

            {/* Action Button */}
            {!isConnected ? (
              <button 
                onClick={connect} 
                className="w-full py-4 rounded-2xl border-2 border-purple-400/40 text-purple-100 font-bold hover:bg-purple-500/10 transition-all"
              >
                🔗 Connect Wallet to Donate
              </button>
            ) : (
              <button
                onClick={donate}
                disabled={isProcessing}
                className={`w-full py-4 rounded-2xl font-bold transition-all ${
                  isProcessing 
                    ? "bg-purple-500/30 cursor-not-allowed" 
                    : isCompleted 
                    ? "bg-gradient-to-r from-emerald-500 to-green-500 glow-shadow scale-105" 
                    : "bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 hover:scale-105"
                }`}
              >
                <span className="text-white flex items-center justify-center gap-2">
                  {isProcessing ? "⏳ Processing..." : isCompleted ? "✅ Donation Complete!" : "💝 Donate Now"}
                </span>
              </button>
            )}

            {/* Status Message */}
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
