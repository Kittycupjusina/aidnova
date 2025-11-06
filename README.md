# AidNova (新星援助 DAO)

本目录包含两个子项目：
- `contracts`：Hardhat 合约工程（ReliefTreasury / CrisisCouncil / RecipientDirectory / ShieldedReliefVault）。
- `frontend`：Next.js 前端（全新深色霓虹 UI），支持本地 mock 与 Sepolia relayer-sdk 两种 FHEVM 交互模式。

## 一、合约 (action/contracts)

### 环境变量
创建 `.env`（或在命令行导出）
```
PRIVATE_KEY=<你的私钥>
ETHERSCAN_API_KEY=<你的EtherscanKey>
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
```

重要：请勿在仓库或提交记录中保存任何真实私钥或 API Key。以上变量请仅在本地 `.env` 中配置，并确保 `.env` 已加入 `.gitignore`。示例值请使用占位（如 `<YOUR_PRIVATE_KEY>`、`<YOUR_ETHERSCAN_KEY>`），切勿粘贴真实敏感数据。

### 安装与编译
```
cd contracts
npm i
npm run build
```

### 部署（Sepolia）
```
npm run deploy:sepolia
```
完成后会在 `contracts/` 目录生成 `deployments.json`，形如：
```
{
  "chainId": "11155111",
  "contracts": {
    "ReliefTreasury": "0x...",
    "CrisisCouncil": "0x...",
    "RecipientDirectory": "0x...",
    "ShieldedReliefVault": "0x..."
  }
}
```

可选：验证合约
```
npm run verify:sepolia -- --ReliefTreasury 0x... --CrisisCouncil 0x... --RecipientDirectory 0x... --ShieldedReliefVault 0x...
```

## 二、前端 (action/frontend)

### 安装与开发
```
cd ../frontend
npm i
```

- 本地 mock（使用 Hardhat FHEVM 节点）
  1) 启动 Hardhat 本地区块链（需 FHEVM Hardhat 节点）
  2) 确保在 `app/providers.tsx` 的 `initialMockChains` 包含 `{31337: "http://localhost:8545"}`
  3) 启动前端：
```
npm run dev
```

- Sepolia（使用 relayer-sdk）
  - 连接 MetaMask 到 Sepolia；前端将自动加载 relayer-sdk，并与合约交互。

### 生成前端地址映射
合约部署完成后运行：
```
npm run genabi
```
该脚本会读取 `../contracts/deployments.json` 并写入到 `contracts/contractsMap.ts` 中。

### Pinata（IPFS 上传）
前端提供 `pinata.ts` 工具方法，可直接在浏览器端以 JWT 上传文件至 Pinata：
```
const cid = await pinToIPFS(file, PINATA_JWT);
```
你提供的示例 `pinata_key` 可作为 JWT 使用（谨慎保存）。

## 三、FHEVM 两种模式
- 本地（mock）：检测到 31337 等本地链并能获取 `fhevm_relayer_metadata` 时，使用 `@fhevm/mock-utils` 创建本地实例，加密/解密均在本地执行。
- 测试网（relayer）：连接 Sepolia 时，通过 CDN 动态加载 relayer-sdk，初始化后创建 FHEVM 实例，前端执行 `createEncryptedInput`、`userDecrypt` 等流程。

## 四、前端页面
- Dashboard：TVL、Emergency 余额展示；包含 `FHEVault` 加密演示（加总与个人笔记）。
- Donate：ETH 捐赠（普通/紧急）。

> 后续可按需求补充 Propose/Vote 页面与 IPFS 提案上传。

## 五、注意
- FHE 合约使用 `@fhevm/solidity`，编译需网络安装依赖。
- Sepolia 环境下前端需可访问 Zama relayer SDK CDN。
- 私钥与 JWT 不要提交到代码仓库。


