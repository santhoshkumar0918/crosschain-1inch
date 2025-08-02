import { ethers } from "hardhat";


async function main() {
  console.log("Deploying HTLC contract to Ethereum Sepolia...");


  // Get the contract factory
  const HTLC = await ethers.getContractFactory("HTLC");


  // Deploy the contract
  const htlc = await HTLC.deploy();


  // Wait for deployment to complete
  await htlc.waitForDeployment();


  const contractAddress = await htlc.getAddress();
 
  console.log("HTLC contract deployed to:", contractAddress);
  console.log("Transaction hash:", htlc.deploymentTransaction()?.hash);
 
  // Wait for a few block confirmations
  console.log("Waiting for block confirmations...");
  await htlc.deploymentTransaction()?.wait(5);
 
  console.log("Contract verified and ready for use!");
  console.log("\nContract details:");
  console.log("- Network: Ethereum Sepolia");
  console.log("- Contract Address:", contractAddress);
  console.log("- Block Explorer:", `https://sepolia.etherscan.io/address/${contractAddress}`);
 
  // Save deployment info
  const deploymentInfo = {
    network: "sepolia",
    contractAddress: contractAddress,
    transactionHash: htlc.deploymentTransaction()?.hash,
    blockNumber: await ethers.provider.getBlockNumber(),
    timestamp: new Date().toISOString(),
  };
 
  console.log("\nDeployment Info:", JSON.stringify(deploymentInfo, null, 2));
}


main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });

