import { run } from "hardhat";

// Usage: yarn verify:sepolia --ReliefTreasury 0x... --CrisisCouncil 0x... --RecipientDirectory 0x... --ShieldedReliefVault 0x...
async function main() {
  const args = process.argv.slice(2);
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 2) {
    flags[args[i].replace(/^--/, "")] = args[i + 1];
  }

  for (const [name, address] of Object.entries(flags)) {
    console.log("Verifying", name, address);
    try {
      await run("verify:verify", { address });
    } catch (e) {
      console.log("Verify error", e);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


