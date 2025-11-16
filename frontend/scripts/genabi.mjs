import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

// Read deployments info from stdout captured JSON or from a file path
// For simplicity, this script looks for contracts artifacts and writes a
// lightweight address map for the frontend to consume.

async function main() {
  const root = resolve(process.cwd(), "..", "contracts");
  const artifactsPath = resolve(root, "artifacts", "contracts");
  // Expect a deployments.json file created externally (or redirect output of scripts/deploy.ts)
  const deploymentsFile = resolve(root, "deployments.json");
  let deployments;
  try {
    const raw = await readFile(deploymentsFile, "utf-8");
    deployments = JSON.parse(raw);
  } catch (e) {
    console.error("deployments.json not found. Skipping.");
    return;
  }

  const chainKey = deployments.chainId;
  const ADDRESSES = {};
  for (const [name, address] of Object.entries(deployments.contracts)) {
    ADDRESSES[`${chainKey}:${name}`] = { address, chainId: Number(chainKey), chainName: chainKey === "11155111" ? "sepolia" : chainKey === "31337" ? "hardhat" : "unknown" };
  }

  const target = resolve(process.cwd(), "contracts", "contractsMap.ts");
  let content = await readFile(target, "utf-8");
  content = content.replace(/const ADDRESSES: [\s\S]*?= {([\s\S]*?)};/m, `const ADDRESSES: Record<string, { address: \`0x\${string}\`; chainId: number; chainName: string }> = ${JSON.stringify(ADDRESSES, null, 2)};`);
  await writeFile(target, content, "utf-8");
  console.log("contractsMap updated.");
}

main().catch((e) => { console.error(e); process.exit(1); });


