"use client";

import { useCallback, useMemo, useState } from "react";
import { ethers } from "ethers";
import type { FhevmInstance } from "@/fhevm/fhevmTypes";
import { useMetaMaskEthersSigner } from "@/hooks/metamask/useMetaMaskEthersSigner";
import { contractsMap } from "@/contracts/contractsMap";
import { FhevmDecryptionSignature } from "@/fhevm/FhevmDecryptionSignature";
import { useInMemoryStorage } from "@/hooks/useInMemoryStorage";

export function FHEVaultWidget({ instance }: { instance: FhevmInstance | undefined }) {
  const { storage } = useInMemoryStorage();
  const { chainId, ethersSigner, ethersReadonlyProvider } = useMetaMaskEthersSigner();
  const info = useMemo(() => contractsMap.getContract("ShieldedReliefVault", chainId), [chainId]);
  const [totalHandle, setTotalHandle] = useState<string | undefined>(undefined);
  const [totalClear, setTotalClear] = useState<bigint | undefined>(undefined);
  const [noteHandle, setNoteHandle] = useState<string | undefined>(undefined);
  const [noteClear, setNoteClear] = useState<bigint | undefined>(undefined);
  const [value, setValue] = useState<string>("0");
  const [note, setNote] = useState<string>("0");
  const [msg, setMsg] = useState<string>("");

  const refresh = useCallback(async () => {
    try {
      if (!ethersReadonlyProvider || !info?.address) return;
      const abi = [
        "function viewEncryptedStandardTotal() view returns (bytes32)",
        "function viewEncryptedUserMemo(address) view returns (bytes32)",
      ];
      const c = new ethers.Contract(info.address, abi, ethersReadonlyProvider);
      const t = await c.viewEncryptedStandardTotal();
      const n = await c.viewEncryptedUserMemo(await ethersSigner?.getAddress());
      setTotalHandle(t); setNoteHandle(n);
    } catch (e) { setMsg(`❌ Refresh failed: ${String(e)}`); }
  }, [ethersReadonlyProvider, info?.address, ethersSigner]);

  const decrypt = useCallback(async () => {
    try {
      if (!instance || !ethersSigner || !info?.address) return;
      const sig = await FhevmDecryptionSignature.loadOrSign(instance, [info.address as `0x${string}`], ethersSigner, storage);
      if (!sig) { setMsg("❌ Cannot build signature"); return; }
      const res = await instance.userDecrypt(
        [
          ...(totalHandle ? [{ handle: totalHandle, contractAddress: info.address }] : []),
          ...(noteHandle ? [{ handle: noteHandle, contractAddress: info.address }] : []),
        ],
        sig.privateKey, sig.publicKey, sig.signature, sig.contractAddresses, sig.userAddress, sig.startTimestamp, sig.durationDays
      );
      if (totalHandle) setTotalClear(res[totalHandle]);
      if (noteHandle) setNoteClear(res[noteHandle]);
      setMsg("✅ Decrypted");
    } catch (e) { setMsg(`❌ Decrypt failed: ${String(e)}`); }
  }, [instance, ethersSigner, info?.address, storage, totalHandle, noteHandle]);

  const addTotal = useCallback(async () => {
    try {
      if (!instance || !ethersSigner || !info?.address) return;
      const c = new ethers.Contract(info.address, ["function accumulateStandard(bytes32, bytes)"] , ethersSigner);
      const input = instance.createEncryptedInput(info.address, ethersSigner.address);
      input.add64(BigInt(value));
      const enc = await input.encrypt();
      const tx = await c.accumulateStandard(enc.handles[0], enc.inputProof);
      await tx.wait();
      setMsg("✅ Added to total");
      refresh();
    } catch (e) { setMsg(`❌ Failed: ${String(e)}`); }
  }, [instance, ethersSigner, info?.address, value, refresh]);

  const setMyNote = useCallback(async () => {
    try {
      if (!instance || !ethersSigner || !info?.address) return;
      const c = new ethers.Contract(info.address, ["function saveMyEncryptedMemo(bytes32, bytes)"] , ethersSigner);
      const input = instance.createEncryptedInput(info.address, ethersSigner.address);
      input.add32(Number(note));
      const enc = await input.encrypt();
      const tx = await c.saveMyEncryptedMemo(enc.handles[0], enc.inputProof);
      await tx.wait();
      setMsg("✅ Memo saved");
      refresh();
    } catch (e) { setMsg(`❌ Failed: ${String(e)}`); }
  }, [instance, ethersSigner, info?.address, note, refresh]);

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        {/* Standard Total */}
        <div className="glass-card rounded-2xl p-6 hover:bg-white/10 transition-colors">
          <div className="flex items-center gap-3 mb-4">
            <div className="text-3xl">📊</div>
            <div>
              <h3 className="text-sm font-semibold text-purple-200">Standard Total</h3>
              <p className="text-xs text-purple-300/70">Encrypted handle</p>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-400/20 mb-3">
            <p className="font-mono text-xs text-purple-200 break-all">{totalHandle ?? "—"}</p>
          </div>
          <div className="mb-4">
            <p className="text-xs text-purple-300/70 mb-1">Decrypted value:</p>
            <p className="text-2xl font-bold text-white">{totalClear?.toString() ?? "🔒"}</p>
          </div>
          <div className="flex gap-2">
            <input 
              value={value} 
              onChange={(e) => setValue(e.target.value)} 
              placeholder="Value (uint64)" 
              className="flex-1 px-3 py-2 rounded-xl glass-card text-white placeholder-purple-300/40 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/50"
            />
            <button 
              onClick={addTotal} 
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold hover:scale-105 transition-transform"
            >
              ➕
            </button>
          </div>
        </div>

        {/* User Memo */}
        <div className="glass-card rounded-2xl p-6 hover:bg-white/10 transition-colors">
          <div className="flex items-center gap-3 mb-4">
            <div className="text-3xl">📝</div>
            <div>
              <h3 className="text-sm font-semibold text-purple-200">My Encrypted Memo</h3>
              <p className="text-xs text-purple-300/70">Personal note</p>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-400/20 mb-3">
            <p className="font-mono text-xs text-purple-200 break-all">{noteHandle ?? "—"}</p>
          </div>
          <div className="mb-4">
            <p className="text-xs text-purple-300/70 mb-1">Decrypted value:</p>
            <p className="text-2xl font-bold text-white">{noteClear?.toString() ?? "🔒"}</p>
          </div>
          <div className="flex gap-2">
            <input 
              value={note} 
              onChange={(e) => setNote(e.target.value)} 
              placeholder="Note (uint32)" 
              className="flex-1 px-3 py-2 rounded-xl glass-card text-white placeholder-purple-300/40 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/50"
            />
            <button 
              onClick={setMyNote} 
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-orange-500 text-white text-sm font-semibold hover:scale-105 transition-transform"
            >
              💾
            </button>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <button 
          onClick={refresh} 
          className="px-4 py-2 rounded-full glass-card border border-purple-400/30 text-purple-200 text-sm font-semibold hover:bg-purple-500/10"
        >
          🔄 Refresh
        </button>
        <button 
          onClick={decrypt} 
          className="px-4 py-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold hover:scale-105 transition-transform"
        >
          🔓 Decrypt
        </button>
        {msg && (
          <div className="flex-1 px-4 py-2 rounded-full glass-card border border-purple-400/30">
            <p className="text-xs text-purple-200">{msg}</p>
          </div>
        )}
      </div>
    </div>
  );
}
