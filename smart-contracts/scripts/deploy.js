const hre = require("hardhat");

async function main() {
  console.log("Starting deployment of ProjectEscrowImproved...");

  const ProjectEscrow = await hre.ethers.getContractFactory("ProjectEscrowImproved");
  
  console.log("Deploying contract...");
  
  const escrow = await ProjectEscrow.deploy();
  await escrow.waitForDeployment();
  
  const address = await escrow.getAddress();
  
  console.log("✅ ProjectEscrowImproved deployed to:", address);
  console.log("📝 SAVE THIS ADDRESS!");
  
  console.log("\nWaiting for confirmations...");
  await escrow.deploymentTransaction().wait(5);
  
  console.log("✅ Confirmed!");
  console.log("\n🔗 View on PolygonScan:");
  console.log(`https://www.oklink.com/amoy/address/${address}`);
  
  // Log admin info
  console.log("\n👤 Contract deployer (first admin):", (await hre.ethers.getSigners())[0].address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });