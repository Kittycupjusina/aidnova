import { FhevmRelayerSDKType, FhevmWindowType } from "./fhevmTypes";
import { SDK_CDN_URL, SDK_LOCAL_PKG_PRIMARY, SDK_LOCAL_PKG_FALLBACK } from "./constants";

type TraceType = (message?: unknown, ...optionalParams: unknown[]) => void;

export class RelayerSDKLoader {
  private _trace?: TraceType;
  constructor(options: { trace?: TraceType }) { this._trace = options.trace; }

  private async loadFromLocal(): Promise<FhevmRelayerSDKType | null> {
    this._trace?.("[RelayerSDK] Trying to load from local package...");
    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - runtime dynamic import
      const mod: any = await import(/* webpackIgnore: true */ SDK_LOCAL_PKG_PRIMARY);
      const sdk = mod?.default ?? mod;
      if (isFhevmRelayerSDKType(sdk, this._trace)) {
        this._trace?.("[RelayerSDK] Loaded from local package (primary)");
        return sdk;
      }
    } catch (e) {
      this._trace?.("[RelayerSDK] Primary local package failed:", e);
    }
    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const mod: any = await import(/* webpackIgnore: true */ SDK_LOCAL_PKG_FALLBACK);
      const sdk = mod?.default ?? mod;
      if (isFhevmRelayerSDKType(sdk, this._trace)) {
        this._trace?.("[RelayerSDK] Loaded from local package (fallback)");
        return sdk;
      }
    } catch (e) {
      this._trace?.("[RelayerSDK] Fallback local package failed:", e);
    }
    this._trace?.("[RelayerSDK] Local packages not available, will try CDN");
    return null;
  }

  private loadFromCDN(): Promise<FhevmRelayerSDKType> {
    if (typeof window === "undefined") return Promise.reject(new Error("RelayerSDKLoader: browser only"));
    if ("relayerSDK" in window) {
      if (!isFhevmRelayerSDKType((window as any).relayerSDK, this._trace)) throw new Error("RelayerSDKLoader: invalid relayerSDK");
      return Promise.resolve((window as any).relayerSDK);
    }
    return new Promise((resolve, reject) => {
      const existingScript = document.querySelector(`script[src="${SDK_CDN_URL}"]`) as HTMLScriptElement | null;
      const handleResolveIfReady = () => {
        if (isFhevmWindowType(window, this._trace)) {
          resolve((window as any).relayerSDK);
          return true;
        }
        return false;
      };

      // If a script tag already exists, wait for it to finish loading instead of failing immediately
      if (existingScript) {
        // If it's already ready, resolve immediately
        if (handleResolveIfReady()) return;

        const onLoad = () => {
          if (!handleResolveIfReady()) {
            reject(new Error("RelayerSDKLoader: loaded but invalid relayerSDK"));
          }
          existingScript.removeEventListener("load", onLoad);
          existingScript.removeEventListener("error", onError);
        };
        const onError = () => {
          reject(new Error(`RelayerSDKLoader: failed to load ${SDK_CDN_URL}`));
          existingScript.removeEventListener("load", onLoad);
          existingScript.removeEventListener("error", onError);
        };
        existingScript.addEventListener("load", onLoad);
        existingScript.addEventListener("error", onError);
        return;
      }

      const script = document.createElement("script");
      script.src = SDK_CDN_URL; script.type = "text/javascript"; script.async = true;
      script.onload = () => {
        if (!handleResolveIfReady()) {
          reject(new Error("RelayerSDKLoader: loaded but invalid relayerSDK"));
        }
      };
      script.onerror = () => reject(new Error(`RelayerSDKLoader: failed to load ${SDK_CDN_URL}`));
      document.head.appendChild(script);
    });
  }

  public async load(): Promise<FhevmRelayerSDKType> {
    const local = await this.loadFromLocal();
    if (local) return local;
    return this.loadFromCDN();
  }
}

function isFhevmRelayerSDKType(o: unknown, trace?: TraceType): o is FhevmRelayerSDKType {
  if (!o || typeof o !== "object") { trace?.("relayerSDK invalid"); return false; }
  const obj = o as any;
  if (typeof obj.initSDK !== "function") return false;
  if (typeof obj.createInstance !== "function") return false;
  if (typeof obj.SepoliaConfig !== "object") return false;
  return true;
}

export function isFhevmWindowType(win: unknown, trace?: TraceType): win is FhevmWindowType {
  if (!win || typeof win !== "object") { trace?.("window invalid"); return false; }
  if (!("relayerSDK" in (win as any))) { trace?.("window.relayerSDK missing"); return false; }
  return isFhevmRelayerSDKType((win as any).relayerSDK, trace);
}


