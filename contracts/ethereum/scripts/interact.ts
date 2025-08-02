import { ethers } from "hardhat";


// Replace with your deployed contract address
const CONTRACT_ADDRESS = "0x..."; // Update after deployment


async function main() {
  console.log("Interacting with HTLC contract...");


  // Get signers
  const [sender, receiver] = await ethers.getSigners();
  console.log("Sender address:", sender.address);
  console.log("Receiver address:", receiver.address);


  // Connect to deployed contract
  const HTLC = await ethers.getContractFactory("HTLC");
  const htlc = HTLC.attach(CONTRACT_ADDRESS);


  // Example: Create HTLC
  const secret = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
  const hashlock = ethers.keccak256(ethers.solidityPacked(["bytes32"], [secret]));
  const amount = ethers.parseEther("0.01"); // 0.01 ETH
  const safetyDeposit = ethers.parseEther("0.001"); // 0.001 ETH
  const timelock = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now


  console.log("\nCreating HTLC...");
  console.log("Amount:", ethers.formatEther(amount), "ETH");
  console.log("Safety Deposit:", ethers.formatEther(safetyDeposit), "ETH");
  console.log("Hashlock:", hashlock);
  console.log("Timelock:", new Date(timelock * 1000).toISOString());


  try {
    const tx = await htlc.connect(sender).createHTLC(
      receiver.address,
      amount,
      ethers.ZeroAddress, // ETH
      hashlock,
      timelock,
      safetyDeposit,
      { value: amount + safetyDeposit }
    );


    console.log("Transaction hash:", tx.hash);
    const receipt = await tx.wait();
    console.log("Transaction confirmed in block:", receipt?.blockNumber);


    // Get contract ID from event
    const event = receipt?.logs.find(log => {
      try {
        const parsed = htlc.interface.parseLog(log as any);
        return parsed?.name === "HTLCNew";
      } catch {
        return false;
      }
    });


    if (event) {
      const parsed = htlc.interface.parseLog(event as any);
      const contractId = parsed?.args[0];
      console.log("Contract ID:", contractId);


      // Get HTLC data
      const htlcData = await htlc.getHTLC(contractId);
      console.log("\nHTLC Data:");
      console.log("- Sender:", htlcData.sender);
      console.log("- Receiver:", htlcData.receiver);
      console.log("- Amount:", ethers.formatEther(htlcData.amount), "ETH");
      console.log("- Safety Deposit:", ethers.formatEther(htlcData.safetyDeposit), "ETH");
      console.log("- Status:", htlcData.status === 0n ? "Active" : htlcData.status === 1n ? "Withdrawn" : "Refunded");
      console.log("- Timelock:", new Date(Number(htlcData.timelock) * 1000).toISOString());


      // Example: Withdraw (uncomment to test)
      /*
      console.log("\nWithdrawing HTLC...");
      const withdrawTx = await htlc.connect(receiver).withdraw(contractId, secret);
      console.log("Withdraw transaction hash:", withdrawTx.hash);
      await withdrawTx.wait();
      console.log("Withdrawal successful!");
      */


      // Example: Check status after withdrawal
      /*
      const finalStatus = await htlc.getStatus(contractId);
      console.log("Final status:", finalStatus === 0n ? "Active" : finalStatus === 1n ? "Withdrawn" : "Refunded");
      */
    }


  } catch (error) {
    console.error("Error:", error);
  }
}


main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

