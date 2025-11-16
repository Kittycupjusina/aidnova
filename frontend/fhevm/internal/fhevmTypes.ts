export type FhevmRelayerSDKType = {
  __initialized__?: boolean;
  initSDK: (options?: unknown) => Promise<boolean>;
  createInstance: (config: any) => Promise<any>;
  SepoliaConfig: any;
};

export type FhevmWindowType = Window & { relayerSDK: FhevmRelayerSDKType };


