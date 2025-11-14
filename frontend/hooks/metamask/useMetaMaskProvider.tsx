import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Eip1193Provider, ethers } from "ethers";

interface ProviderConnectInfo { readonly chainId: string; }
interface ProviderRpcError extends Error { message: string; code: number; data?: unknown; }
type ConnectListenerFn = (connectInfo: ProviderConnectInfo) => void;
type DisconnectListenerFn = (error: ProviderRpcError) => void;
type ChainChangedListenerFn = (chainId: string) => void;
type AccountsChangedListenerFn = (accounts: string[]) => void;
type Eip1193EventMap = { connect: ConnectListenerFn; chainChanged: ChainChangedListenerFn; accountsChanged: AccountsChangedListenerFn; disconnect: DisconnectListenerFn; };
type Eip1193EventFn = <E extends keyof Eip1193EventMap>(event: E, fn: Eip1193EventMap[E]) => void;
interface Eip1193ProviderWithEvent extends ethers.Eip1193Provider { on?: Eip1193EventFn; off?: Eip1193EventFn; addListener?: Eip1193EventFn; removeListener?: Eip1193EventFn; }

export interface UseMetaMaskState {
  provider: Eip1193Provider | undefined;
  chainId: number | undefined;
  accounts: string[] | undefined;
  isConnected: boolean;
  error: Error | undefined;
  connect: () => void;
}

function useMetaMaskInternal(): UseMetaMaskState {
  const [current, setCurrent] = useState<Eip1193ProviderWithEvent | undefined>(undefined);
  const [chainId, setChainId] = useState<number | undefined>(undefined);
  const [accounts, setAccounts] = useState<string[] | undefined>(undefined);

  const providerRef = useRef<Eip1193ProviderWithEvent | undefined>(undefined);
  const connectListenerRef = useRef<ConnectListenerFn | undefined>(undefined);
  const disconnectListenerRef = useRef<DisconnectListenerFn | undefined>(undefined);
  const chainChangedListenerRef = useRef<ChainChangedListenerFn | undefined>(undefined);
  const accountsChangedListenerRef = useRef<AccountsChangedListenerFn | undefined>(undefined);

  const isConnected = Boolean(current) && (accounts?.length ?? 0) > 0 && typeof chainId === "number";

  const connect = useCallback(() => {
    if (!current) return;
    if (accounts && accounts.length > 0) return;
    current.request({ method: "eth_requestAccounts" });
  }, [current, accounts]);

  useEffect(() => {
    // EIP-6963 minimal: prefer window.ethereum if exists (MetaMask)
    const anyWin = window as any;
    let next: Eip1193ProviderWithEvent | undefined = undefined;
    if (anyWin?.ethereum) {
      const isMetaMask = !!anyWin.ethereum.isMetaMask;
      next = isMetaMask ? anyWin.ethereum : anyWin.ethereum;
    }

    const prev = providerRef.current;
    if (prev === next) return;

    // clear prev listeners
    if (prev) {
      if (connectListenerRef.current) {
        prev.off?.("connect", connectListenerRef.current);
        prev.removeListener?.("connect", connectListenerRef.current);
      }
      if (disconnectListenerRef.current) {
        prev.off?.("disconnect", disconnectListenerRef.current);
        prev.removeListener?.("disconnect", disconnectListenerRef.current);
      }
      if (chainChangedListenerRef.current) {
        prev.off?.("chainChanged", chainChangedListenerRef.current);
        prev.removeListener?.("chainChanged", chainChangedListenerRef.current);
      }
      if (accountsChangedListenerRef.current) {
        prev.off?.("accountsChanged", accountsChangedListenerRef.current);
        prev.removeListener?.("accountsChanged", accountsChangedListenerRef.current);
      }
    }

    setCurrent(undefined);
    setChainId(undefined);
    setAccounts(undefined);
    providerRef.current = next;

    if (!next) return;

    const onConnect: ConnectListenerFn = (info) => {
      if (next !== providerRef.current) return;
      setCurrent(next);
      setChainId(Number.parseInt(info.chainId, 16));
    };
    const onDisconnect: DisconnectListenerFn = () => {
      if (next !== providerRef.current) return;
      setCurrent(undefined); setChainId(undefined); setAccounts(undefined);
    };
    const onChainChanged: ChainChangedListenerFn = (cid) => {
      if (next !== providerRef.current) return;
      setCurrent(next); setChainId(Number.parseInt(cid, 16));
    };
    const onAccountsChanged: AccountsChangedListenerFn = (a) => {
      if (next !== providerRef.current) return;
      setCurrent(next); setAccounts(a);
    };

    connectListenerRef.current = onConnect;
    disconnectListenerRef.current = onDisconnect;
    chainChangedListenerRef.current = onChainChanged;
    accountsChangedListenerRef.current = onAccountsChanged;

    if (next.on) {
      next.on("connect", onConnect);
      next.on("disconnect", onDisconnect);
      next.on("chainChanged", onChainChanged);
      next.on("accountsChanged", onAccountsChanged);
    } else {
      next.addListener?.("connect", onConnect);
      next.addListener?.("disconnect", onDisconnect);
      next.addListener?.("chainChanged", onChainChanged);
      next.addListener?.("accountsChanged", onAccountsChanged);
    }

    (async () => {
      try {
        const [cid, acc] = await Promise.all([
          next.request({ method: "eth_chainId" }),
          next.request({ method: "eth_accounts" })
        ]);
        setCurrent(next);
        setChainId(Number.parseInt(cid as string, 16));
        setAccounts(acc as string[]);
      } catch {
        setCurrent(next);
        setChainId(undefined);
        setAccounts(undefined);
      }
    })();
  }, []);

  return { provider: current, chainId, accounts, isConnected, error: undefined, connect };
}

interface MetaMaskProviderProps { children: ReactNode; }
const MetaMaskContext = createContext<UseMetaMaskState | undefined>(undefined);

export const MetaMaskProvider: React.FC<MetaMaskProviderProps> = ({ children }) => {
  const state = useMetaMaskInternal();
  return <MetaMaskContext.Provider value={state}>{children}</MetaMaskContext.Provider>;
};

export function useMetaMask() {
  const ctx = useContext(MetaMaskContext);
  if (!ctx) throw new Error("useMetaMask must be used within a MetaMaskProvider");
  return ctx;
}


