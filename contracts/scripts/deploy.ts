import { ethers } from "hardhat";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const ReliefTreasury = await ethers.getContractFactory("ReliefTreasury");
  const treasury = await ReliefTreasury.deploy(deployer.address);
  await treasury.waitForDeployment();
  const treasuryAddress = await treasury.getAddress();
  console.log("ReliefTreasury:", treasuryAddress);

  const CrisisCouncil = await ethers.getContractFactory("CrisisCouncil");
  const governance = await CrisisCouncil.deploy(treasuryAddress);
  await governance.waitForDeployment();
  const governanceAddress = await governance.getAddress();
  console.log("CrisisCouncil:", governanceAddress);

  const RecipientDirectory = await ethers.getContractFactory("RecipientDirectory");
  const registry = await RecipientDirectory.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("RecipientDirectory:", registryAddress);

  const ShieldedReliefVault = await ethers.getContractFactory("ShieldedReliefVault");
  const fheVault = await ShieldedReliefVault.deploy();
  await fheVault.waitForDeployment();
  const fheVaultAddress = await fheVault.getAddress();
  console.log("ShieldedReliefVault:", fheVaultAddress);

  // wire governance to treasury
  const tx = await treasury.setCouncil(governanceAddress);
  await tx.wait();
  console.log("ReliefTreasury council set.");

  // Output JSON for frontend abi mapping & write to deployments.json
  const chainId = (await ethers.provider.getNetwork()).chainId.toString();
  const artifact = {
    chainId,
    contracts: {
      ReliefTreasury: treasuryAddress,
      CrisisCouncil: governanceAddress,
      RecipientDirectory: registryAddress,
      ShieldedReliefVault: fheVaultAddress,
    },
  };
  console.log("__DEPLOYMENTS__\n" + JSON.stringify(artifact, null, 2));
  const out = resolve(process.cwd(), "deployments.json");
  await writeFile(out, JSON.stringify(artifact, null, 2), "utf-8");
  console.log("deployments.json written");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


