export type EIP712Type = { domain: any; primaryType: string; types: Record<string, any>; message: any };

export type FhevmDecryptionSignatureType = {
  publicKey: string;
  privateKey: string;
  signature: string;
  startTimestamp: number;
  durationDays: number;
  userAddress: `0x${string}`;
  contractAddresses: `0x${string}`[];
  eip712: EIP712Type;
};

export type FhevmInstance = {
  createEncryptedInput: (contractAddress: string, userAddress: string) => {
    add32: (v: number) => void;
    add64: (v: number | bigint) => void;
    encrypt: () => Promise<{ handles: string[]; inputProof: string }>;
  };
  createEIP712: (publicKey: string, contractAddresses: string[], startTimestamp: number, durationDays: number) => EIP712Type & { types: { UserDecryptRequestVerification: any } };
  userDecrypt: (
    reqs: { handle: string; contractAddress: string }[],
    privateKey: string,
    publicKey: string,
    signature: string,
    contractAddresses: string[],
    userAddress: string,
    startTimestamp: number,
    durationDays: number
  ) => Promise<Record<string, bigint>>;
  generateKeypair: () => { publicKey: string; privateKey: string };
  getPublicKey: () => any;
  getPublicParams: (size: number) => any;
};


