// Mock 模式占位：未安装 @fhevm/mock-utils 时避免构建失败
export async function fhevmMockCreateInstance(_parameters: { rpcUrl: string; chainId: number; metadata: { ACLAddress: `0x${string}`; InputVerifierAddress: `0x${string}`; KMSVerifierAddress: `0x${string}`; } }) {
  throw new Error("FHEVM mock mode is disabled (missing @fhevm/mock-utils). Please run on Sepolia or install the mock package.");
}


