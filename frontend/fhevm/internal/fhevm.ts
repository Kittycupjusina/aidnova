import { isAddress, Eip1193Provider, JsonRpcProvider } from "ethers";
import { RelayerSDKLoader } from "./RelayerSDKLoader";
import { publicKeyStorageGet, publicKeyStorageSet } from "./PublicKeyStorage";
import type { FhevmWindowType } from "./fhevmTypes";
import type { FhevmInstance } from "../fhevmTypes";

export class FhevmAbortError extends Error { constructor(message = "FHEVM operation was cancelled") { super(message); this.name = "FhevmAbortError"; } }

type FhevmRelayerStatusType = "sdk-loading" | "sdk-loaded" | "sdk-initializing" | "sdk-initialized" | "creating";

async function getChainId(providerOrUrl: Eip1193Provider | string): Promise<number> {
  if (typeof providerOrUrl === "string") { const provider = new JsonRpcProvider(providerOrUrl); return Number((await provider.getNetwork()).chainId); }
  const chainId = await providerOrUrl.request({ method: "eth_chainId" });
  return Number.parseInt(chainId as string, 16);
}

async function getWeb3Client(rpcUrl: string) { const rpc = new JsonRpcProvider(rpcUrl); try { return await rpc.send("web3_clientVersion", []); } finally { rpc.destroy(); } }

async function tryFetchFHEVMHardhatNodeRelayerMetadata(rpcUrl: string): Promise<{ ACLAddress: `0x${string}`; InputVerifierAddress: `0x${string}`; KMSVerifierAddress: `0x${string}`; } | undefined> {
  const version = await getWeb3Client(rpcUrl);
  if (typeof version !== "string" || !version.toLowerCase().includes("hardhat")) return undefined;
  try {
    const rpc = new JsonRpcProvider(rpcUrl);
    const meta = await rpc.send("fhevm_relayer_metadata", []);
    rpc.destroy();
    if (!meta || typeof meta !== "object") return undefined;
    if (!meta.ACLAddress || !meta.InputVerifierAddress || !meta.KMSVerifierAddress) return undefined;
    return meta as any;
  } catch { return undefined; }
}

type MockResolveResult = { isMock: true; chainId: number; rpcUrl: string };
type GenericResolveResult = { isMock: false; chainId: number; rpcUrl?: string };
type ResolveResult = MockResolveResult | GenericResolveResult;

// Ensure relayer SDK is initialized only once even if multiple components call createFhevmInstance in parallel
let _relayerInitPromise: Promise<void> | null = null;

async function resolve(providerOrUrl: Eip1193Provider | string, mockChains?: Record<number, string>): Promise<ResolveResult> {
  const chainId = await getChainId(providerOrUrl);
  let rpcUrl = typeof providerOrUrl === "string" ? providerOrUrl : undefined;
  const _mockChains: Record<number, string> = { 31337: "http://localhost:8545", ...(mockChains ?? {}) };
  if (Object.hasOwn(_mockChains, chainId)) { if (!rpcUrl) rpcUrl = _mockChains[chainId]; return { isMock: true, chainId, rpcUrl }; }
  return { isMock: false, chainId, rpcUrl };
}

export const createFhevmInstance = async (parameters: { provider: Eip1193Provider | string; mockChains?: Record<number, string>; signal: AbortSignal; onStatusChange?: (status: FhevmRelayerStatusType) => void; }): Promise<FhevmInstance> => {
  const { provider: providerOrUrl, mockChains, signal, onStatusChange } = parameters;
  const notify = (s: FhevmRelayerStatusType) => onStatusChange?.(s);
  const throwIfAborted = () => { if (signal.aborted) throw new FhevmAbortError(); };

  const { isMock, rpcUrl, chainId } = await resolve(providerOrUrl, mockChains);

  // Mock mode disabled: always use relayer SDK even for local chains
  // if (isMock) {
  //   const meta = await tryFetchFHEVMHardhatNodeRelayerMetadata(rpcUrl);
  //   if (meta) {
  //     notify("creating");
  //     const { fhevmMockCreateInstance } = await import("./mock/fhevmMock");
  //     const mockInstance = await fhevmMockCreateInstance({ rpcUrl, chainId, metadata: meta });
  //     throwIfAborted();
  //     return mockInstance as unknown as FhevmInstance;
  //   }
  // }

  throwIfAborted();

  notify("sdk-loading");
  const loader = new RelayerSDKLoader({ trace: console.log });
  const relayerSDK = await loader.load();
  throwIfAborted();
  notify("sdk-loaded");

  if (!(relayerSDK as any).__initialized__) {
    notify("sdk-initializing");
    if (!_relayerInitPromise) {
      _relayerInitPromise = (async () => {
        try {
          console.log("[FHEVM] Initializing relayer SDK...");
          await relayerSDK.initSDK();
          (relayerSDK as any).__initialized__ = true;
          console.log("[FHEVM] SDK initialized successfully");
        } catch (e) {
          console.error("[FHEVM] SDK initialization failed:", e);
          // Reset init promise so further retries are possible
          _relayerInitPromise = null;
          throw e;
        }
      })();
    }
    try { await _relayerInitPromise; } catch (e) { throw new Error(`SDK initialization failed: ${e instanceof Error ? e.message : String(e)}`); }
    throwIfAborted();
    notify("sdk-initialized");
  }

  // For local Hardhat chains, try to fetch dynamic relayer metadata
  let configBase = relayerSDK.SepoliaConfig;
  if (isMock && rpcUrl) {
    const meta = await tryFetchFHEVMHardhatNodeRelayerMetadata(rpcUrl);
    if (meta) {
      configBase = {
        ...relayerSDK.SepoliaConfig,
        aclContractAddress: meta.ACLAddress,
        kmsVerifierContractAddress: meta.KMSVerifierAddress,
        inputVerifierContractAddress: meta.InputVerifierAddress,
      };
    }
  }

  // Optional manual overrides via env (useful if SDK's SepoliaConfig is outdated)
  const envAcl = (process.env.NEXT_PUBLIC_FHEVM_ACL as string | undefined)?.trim();
  const envKms = (process.env.NEXT_PUBLIC_FHEVM_KMS_VERIFIER as string | undefined)?.trim();
  const envInput = (process.env.NEXT_PUBLIC_FHEVM_INPUT_VERIFIER as string | undefined)?.trim();
  if (envAcl && envAcl.startsWith("0x") && envAcl.length === 42) configBase.aclContractAddress = envAcl;
  if (envKms && envKms.startsWith("0x") && envKms.length === 42) configBase.kmsVerifierContractAddress = envKms;
  if (envInput && envInput.startsWith("0x") && envInput.length === 42) configBase.inputVerifierContractAddress = envInput;

  const aclAddress = configBase.aclContractAddress as `0x${string}`;
  if (!(typeof aclAddress === "string" && aclAddress.startsWith("0x"))) throw new Error(`Invalid address: ${aclAddress}`);

  const pub = await publicKeyStorageGet(aclAddress);
  throwIfAborted();

  const config = { ...configBase, network: providerOrUrl, publicKey: pub.publicKey, publicParams: pub.publicParams };
  notify("creating");
  console.log("[FHEVM] Creating instance with config:", {
    chainId,
    aclAddress,
    kmsVerifier: configBase.kmsVerifierContractAddress,
    inputVerifier: configBase.inputVerifierContractAddress,
    hasPublicKey: !!pub.publicKey,
  });
  try {
    const instance = await relayerSDK.createInstance(config);
    console.log("[FHEVM] Instance created successfully");
    await publicKeyStorageSet(aclAddress, instance.getPublicKey(), instance.getPublicParams(2048));
    throwIfAborted();
    return instance as FhevmInstance;
  } catch (e) {
    console.error("[FHEVM] Failed to create instance:", e);
    throw new Error(`Failed to create FHEVM instance: ${e instanceof Error ? e.message : String(e)}`);
  }
};


