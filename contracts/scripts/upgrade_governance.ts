import { ethers } from "hardhat";

/**
 * Deploy a new CrisisCouncil contract reusing an existing ReliefTreasury address,
 * and set the Treasury's council to the new contract.
 *
 * USAGE (Sepolia):
 *  PRIVATE_KEY=... SEPOLIA_RPC_URL=... npx hardhat run --network sepolia scripts/upgrade_governance.ts \
 *    --treasury 0xYourReliefTreasuryAddress
 */

async function main() {
  const args = process.argv.slice(2);
  const i = args.indexOf("--treasury");
  if (i === -1 || !args[i + 1]) throw new Error("Missing --treasury <address>");
  const treasuryAddress = args[i + 1];

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Treasury:", treasuryAddress);

  const CrisisCouncil = await ethers.getContractFactory("CrisisCouncil");
  const governance = await CrisisCouncil.deploy(treasuryAddress);
  await governance.waitForDeployment();
  const governanceAddress = await governance.getAddress();
  console.log("New CrisisCouncil:", governanceAddress);

  const ReliefTreasury = await ethers.getContractFactory("ReliefTreasury");
  const treasury = ReliefTreasury.attach(treasuryAddress);
  const tx = await treasury.setCouncil(governanceAddress);
  await tx.wait();
  console.log("ReliefTreasury.setCouncil done");
}

main().catch((e) => { console.error(e); process.exit(1); });


