const hre = require("hardhat");

async function main() {
  console.log("Starting deployment...");

  const ProjectEscrow = await hre.ethers.getContractFactory("ProjectEscrow");
  
  console.log("Deploying ProjectEscrow contract...");
  
  const escrow = await ProjectEscrow.deploy();
  await escrow.waitForDeployment();
  
  const address = await escrow.getAddress();
  
  console.log("✅ ProjectEscrow deployed to:", address);
  console.log("📝 Save this address - you'll need it for the frontend!");
  
  console.log("\nWaiting for block confirmations...");
  await escrow.deploymentTransaction().wait(5);
  
  console.log("✅ Deployment confirmed!");
  console.log("\n🔗 View your contract on Amoy PolygonScan:");
  console.log(`https://www.oklink.com/amoy/address/${address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });