import { expect } from "chai";
import { ethers } from "hardhat";
import { HTLC, MockERC20 } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";


describe("HTLC Contract - Complete Test Suite", function () {
  let htlc: HTLC;
  let sender: SignerWithAddress;
  let receiver: SignerWithAddress;
  let other: SignerWithAddress;
  let mockToken: MockERC20;


  const secret = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
  const hashlock = ethers.sha256(ethers.solidityPacked(["bytes32"], [secret]));
  const amount = ethers.parseEther("1.0");
  const safetyDeposit = ethers.parseEther("0.1");


  let timelock: number;


  beforeEach(async function () {
    [sender, receiver, other] = await ethers.getSigners();


    // Deploy HTLC contract
    const HTLCFactory = await ethers.getContractFactory("HTLC");
    htlc = await HTLCFactory.deploy();
    await htlc.waitForDeployment();


    // Deploy mock ERC20 token for testing
    const MockTokenFactory = await ethers.getContractFactory("MockERC20");
    mockToken = await MockTokenFactory.deploy("Mock Token", "MTK", ethers.parseEther("1000000"));
    await mockToken.waitForDeployment();


    // Transfer tokens to sender and approve HTLC contract
    await mockToken.transfer(sender.address, ethers.parseEther("10000"));
    await mockToken.connect(sender).approve(await htlc.getAddress(), ethers.parseEther("10000"));


    // Set timelock dynamically
    const currentBlock = await ethers.provider.getBlock('latest');
    timelock = currentBlock!.timestamp + 3600; // 1 hour from now
  });


  describe("createHTLC", function () {
    it("Should create HTLC with ETH successfully", async function () {
      const totalAmount = amount + safetyDeposit;


      const tx = await htlc.connect(sender).createHTLC(
        receiver.address,
        amount,
        ethers.ZeroAddress, // ETH
        hashlock,
        timelock,
        safetyDeposit,
        false, // No partial fills
        0,
        { value: totalAmount }
      );


      const receipt = await tx.wait();
      const event = receipt?.logs.find(log => {
        try {
          return htlc.interface.parseLog(log as any)?.name === "HTLCNew";
        } catch {
          return false;
        }
      });


      expect(event).to.not.be.undefined;


      // Check contract balance
      expect(await ethers.provider.getBalance(await htlc.getAddress())).to.equal(totalAmount);
    });


    it("Should create HTLC with ERC20 tokens successfully", async function () {
      const tokenAmount = ethers.parseEther("100");
      const tokenSafetyDeposit = ethers.parseEther("10");


      const tx = await htlc.connect(sender).createHTLC(
        receiver.address,
        tokenAmount,
        await mockToken.getAddress(),
        hashlock,
        timelock,
        tokenSafetyDeposit,
        false,
        0
      );


      const receipt = await tx.wait();
      const event = receipt?.logs.find(log => {
        try {
          return htlc.interface.parseLog(log as any)?.name === "HTLCNew";
        } catch {
          return false;
        }
      });


      expect(event).to.not.be.undefined;


      // Check token balance
      const contractBalance = await mockToken.balanceOf(await htlc.getAddress());
      expect(contractBalance).to.equal(tokenAmount + tokenSafetyDeposit);
    });


    it("Should fail with invalid amount", async function () {
      await expect(
        htlc.connect(sender).createHTLC(
          receiver.address,
          0,
          ethers.ZeroAddress,
          hashlock,
          timelock,
          safetyDeposit,
          false,
          0,
          { value: safetyDeposit }
        )
      ).to.be.revertedWithCustomError(htlc, "InvalidAmount");
    });


    it("Should fail with expired timelock", async function () {
      const pastTimelock = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago


      await expect(
        htlc.connect(sender).createHTLC(
          receiver.address,
          amount,
          ethers.ZeroAddress,
          hashlock,
          pastTimelock,
          safetyDeposit,
          false,
          0,
          { value: amount + safetyDeposit }
        )
      ).to.be.revertedWithCustomError(htlc, "InvalidTimelock");
    });


    it("Should fail with insufficient ETH", async function () {
      await expect(
        htlc.connect(sender).createHTLC(
          receiver.address,
          amount,
          ethers.ZeroAddress,
          hashlock,
          timelock,
          safetyDeposit,
          false,
          0,
          { value: amount } // Missing safety deposit
        )
      ).to.be.revertedWithCustomError(htlc, "InsufficientBalance");
    });


    it("Should create HTLC with partial fills enabled", async function () {
      const totalAmount = amount + safetyDeposit;
      const minFillAmount = ethers.parseEther("0.1");


      const tx = await htlc.connect(sender).createHTLC(
        receiver.address,
        amount,
        ethers.ZeroAddress,
        hashlock,
        timelock,
        safetyDeposit,
        true, // Allow partial fills
        minFillAmount,
        { value: totalAmount }
      );


      const receipt = await tx.wait();
      const event = receipt?.logs.find(log => {
        try {
          return htlc.interface.parseLog(log as any)?.name === "HTLCNew";
        } catch {
          return false;
        }
      });


      const parsed = htlc.interface.parseLog(event as any);
      const contractId = parsed?.args[0];


      const htlcData = await htlc.getHTLC(contractId);
      expect(htlcData.allowPartialFills).to.be.true;
      expect(htlcData.minFillAmount).to.equal(minFillAmount);
    });
  });


  describe("withdraw", function () {
    let contractId: string;


    beforeEach(async function () {
      const totalAmount = amount + safetyDeposit;
      const tx = await htlc.connect(sender).createHTLC(
        receiver.address,
        amount,
        ethers.ZeroAddress,
        hashlock,
        timelock,
        safetyDeposit,
        false,
        0,
        { value: totalAmount }
      );


      const receipt = await tx.wait();
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
        contractId = parsed?.args[0];
      }
    });


    it("Should withdraw successfully with correct preimage", async function () {
      const receiverBalanceBefore = await ethers.provider.getBalance(receiver.address);
      const senderBalanceBefore = await ethers.provider.getBalance(sender.address);


      const tx = await htlc.connect(receiver).withdraw(contractId, secret, 0);
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;


      const receiverBalanceAfter = await ethers.provider.getBalance(receiver.address);
      const senderBalanceAfter = await ethers.provider.getBalance(sender.address);


      // Receiver should receive the amount minus gas costs
      expect(receiverBalanceAfter).to.be.closeTo(
        receiverBalanceBefore + amount - gasUsed,
        ethers.parseEther("0.01") // Allow for gas estimation differences
      );


      // Sender should receive safety deposit back
      expect(senderBalanceAfter).to.equal(senderBalanceBefore + safetyDeposit);


      // Check HTLC status
      const htlcData = await htlc.getHTLC(contractId);
      expect(htlcData.status).to.equal(1); // Withdrawn
    });


    it("Should fail with wrong preimage", async function () {
      const wrongSecret = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";


      await expect(
        htlc.connect(receiver).withdraw(contractId, wrongSecret, 0)
      ).to.be.revertedWithCustomError(htlc, "InvalidPreimage");
    });


    it("Should fail if not called by receiver", async function () {
      await expect(
        htlc.connect(other).withdraw(contractId, secret, 0)
      ).to.be.revertedWithCustomError(htlc, "Unauthorized");
    });


    it("Should fail after timelock expiry", async function () {
      // Fast forward time past timelock
      await ethers.provider.send("evm_increaseTime", [3700]); // 1 hour + 100 seconds
      await ethers.provider.send("evm_mine", []);


      await expect(
        htlc.connect(receiver).withdraw(contractId, secret, 0)
      ).to.be.revertedWithCustomError(htlc, "TimelockExpired");
    });
  });


  describe("Partial Withdrawals", function () {
    let contractId: string;


    beforeEach(async function () {
      const totalAmount = amount + safetyDeposit;
      const minFillAmount = ethers.parseEther("0.1");


      const tx = await htlc.connect(sender).createHTLC(
        receiver.address,
        amount,
        ethers.ZeroAddress,
        hashlock,
        timelock,
        safetyDeposit,
        true, // Allow partial fills
        minFillAmount,
        { value: totalAmount }
      );


      const receipt = await tx.wait();
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
        contractId = parsed?.args[0];
      }
    });


    it("Should handle partial withdrawal successfully", async function () {
      const partialAmount = ethers.parseEther("0.4");


      const receiverBalanceBefore = await ethers.provider.getBalance(receiver.address);


      const tx = await htlc.connect(receiver).withdraw(contractId, secret, partialAmount);
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;


      const receiverBalanceAfter = await ethers.provider.getBalance(receiver.address);


      // Receiver should receive partial amount minus gas costs
      expect(receiverBalanceAfter).to.be.closeTo(
        receiverBalanceBefore + partialAmount - gasUsed,
        ethers.parseEther("0.01")
      );


      // Check HTLC state
      const htlcData = await htlc.getHTLC(contractId);
      expect(htlcData.status).to.equal(3); // PartiallyFilled
      expect(htlcData.filledAmount).to.equal(partialAmount);
      expect(htlcData.remainingAmount).to.equal(amount - partialAmount);
    });


    it("Should complete partial withdrawal", async function () {
      const partialAmount = ethers.parseEther("0.4");


      // First partial withdrawal
      await htlc.connect(receiver).withdraw(contractId, secret, partialAmount);


      // Complete the withdrawal (withdrawAmount = 0 means withdraw remaining)
      await htlc.connect(receiver).withdraw(contractId, secret, 0);


      // Check final state
      const htlcData = await htlc.getHTLC(contractId);
      expect(htlcData.status).to.equal(1); // Withdrawn
      expect(htlcData.filledAmount).to.equal(amount);
      expect(htlcData.remainingAmount).to.equal(0);
    });


    it("Should fail partial withdrawal when not allowed", async function () {
      // Create HTLC without partial fills
      const totalAmount = amount + safetyDeposit;
      const tx = await htlc.connect(sender).createHTLC(
        receiver.address,
        amount,
        ethers.ZeroAddress,
        hashlock,
        timelock,
        safetyDeposit,
        false, // No partial fills
        0,
        { value: totalAmount }
      );


      const receipt = await tx.wait();
      const event = receipt?.logs.find(log => {
        try {
          const parsed = htlc.interface.parseLog(log as any);
          return parsed?.name === "HTLCNew";
        } catch {
          return false;
        }
      });


      const parsed = htlc.interface.parseLog(event as any);
      const noPartialContractId = parsed?.args[0];


      const partialAmount = ethers.parseEther("0.3");


      await expect(
        htlc.connect(receiver).withdraw(noPartialContractId, secret, partialAmount)
      ).to.be.revertedWithCustomError(htlc, "PartialFillsNotAllowed");
    });


    it("Should fail withdrawal below minimum fill amount", async function () {
      const tooSmallAmount = ethers.parseEther("0.05"); // Below 0.1 minimum


      await expect(
        htlc.connect(receiver).withdraw(contractId, secret, tooSmallAmount)
      ).to.be.revertedWithCustomError(htlc, "BelowMinimumFill");
    });


    it("Should prevent withdrawal of more than remaining amount", async function () {
      const partialAmount = ethers.parseEther("0.6");
      const excessiveAmount = ethers.parseEther("0.8");


      // First partial withdrawal
      await htlc.connect(receiver).withdraw(contractId, secret, partialAmount);


      // Try to withdraw more than remaining - should fail
      await expect(
        htlc.connect(receiver).withdraw(contractId, secret, excessiveAmount)
      ).to.be.revertedWithCustomError(htlc, "InsufficientRemainingAmount");
    });
  });


  describe("refund", function () {
    let contractId: string;


    beforeEach(async function () {
      const totalAmount = amount + safetyDeposit;
      const tx = await htlc.connect(sender).createHTLC(
        receiver.address,
        amount,
        ethers.ZeroAddress,
        hashlock,
        timelock,
        safetyDeposit,
        false,
        0,
        { value: totalAmount }
      );


      const receipt = await tx.wait();
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
        contractId = parsed?.args[0];
      }
    });


    it("Should refund successfully after timelock expiry", async function () {
      // Fast forward time past timelock
      await ethers.provider.send("evm_increaseTime", [3700]); // 1 hour + 100 seconds
      await ethers.provider.send("evm_mine", []);


      const senderBalanceBefore = await ethers.provider.getBalance(sender.address);


      const tx = await htlc.connect(sender).refund(contractId);
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;


      const senderBalanceAfter = await ethers.provider.getBalance(sender.address);
      const totalRefund = amount + safetyDeposit;


      // Sender should receive full refund minus gas costs
      expect(senderBalanceAfter).to.be.closeTo(
        senderBalanceBefore + totalRefund - gasUsed,
        ethers.parseEther("0.01") // Allow for gas estimation differences
      );


      // Check HTLC status
      const htlcData = await htlc.getHTLC(contractId);
      expect(htlcData.status).to.equal(2); // Refunded
    });


    it("Should fail before timelock expiry", async function () {
      await expect(
        htlc.connect(sender).refund(contractId)
      ).to.be.revertedWithCustomError(htlc, "TimelockNotExpired");
    });


    it("Should fail if not called by sender", async function () {
      // Fast forward time past timelock
      await ethers.provider.send("evm_increaseTime", [3700]);
      await ethers.provider.send("evm_mine", []);


      await expect(
        htlc.connect(other).refund(contractId)
      ).to.be.revertedWithCustomError(htlc, "Unauthorized");
    });
  });


  describe("View functions", function () {
    let contractId: string;


    beforeEach(async function () {
      const totalAmount = amount + safetyDeposit;
      const tx = await htlc.connect(sender).createHTLC(
        receiver.address,
        amount,
        ethers.ZeroAddress,
        hashlock,
        timelock,
        safetyDeposit,
        true, // Allow partial fills
        ethers.parseEther("0.1"),
        { value: totalAmount }
      );


      const receipt = await tx.wait();
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
        contractId = parsed?.args[0];
      }
    });


    it("Should return correct HTLC data", async function () {
      const htlcData = await htlc.getHTLC(contractId);


      expect(htlcData.sender).to.equal(sender.address);
      expect(htlcData.receiver).to.equal(receiver.address);
      expect(htlcData.amount).to.equal(amount);
      expect(htlcData.remainingAmount).to.equal(amount);
      expect(htlcData.filledAmount).to.equal(0);
      expect(htlcData.tokenAddress).to.equal(ethers.ZeroAddress);
      expect(htlcData.hashlock).to.equal(hashlock);
      expect(htlcData.timelock).to.equal(timelock);
      expect(htlcData.safetyDeposit).to.equal(safetyDeposit);
      expect(htlcData.status).to.equal(0); // Active
      expect(htlcData.allowPartialFills).to.be.true;
      expect(htlcData.minFillAmount).to.equal(ethers.parseEther("0.1"));
    });


    it("Should return true for existing contract", async function () {
      expect(await htlc.contractExists(contractId)).to.be.true;
    });


    it("Should return false for non-existing contract", async function () {
      const fakeId = ethers.keccak256(ethers.toUtf8Bytes("fake"));
      expect(await htlc.contractExists(fakeId)).to.be.false;
    });


    it("Should return correct status", async function () {
      expect(await htlc.getStatus(contractId)).to.equal(0); // Active
    });


    it("Should return correct remaining and filled amounts", async function () {
      expect(await htlc.getRemainingAmount(contractId)).to.equal(amount);
      expect(await htlc.getFilledAmount(contractId)).to.equal(0);


      // After partial withdrawal
      const partialAmount = ethers.parseEther("0.3");
      await htlc.connect(receiver).withdraw(contractId, secret, partialAmount);


      expect(await htlc.getRemainingAmount(contractId)).to.equal(amount - partialAmount);
      expect(await htlc.getFilledAmount(contractId)).to.equal(partialAmount);
    });


    it("Should return correct contract balance", async function () {
      const balance = await htlc.getContractBalance(ethers.ZeroAddress);
      expect(balance).to.equal(amount + safetyDeposit);
    });
  });


  describe("Helper functions", function () {
    it("Should create correct hashlock", async function () {
      const testSecret = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
      const expectedHashlock = ethers.sha256(ethers.solidityPacked(["bytes32"], [testSecret]));
      const createdHashlock = await htlc.createHashlock(testSecret);
      expect(createdHashlock).to.equal(expectedHashlock);
    });


    it("Should verify preimage correctly", async function () {
      const testSecret = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
      const testHashlock = ethers.sha256(ethers.solidityPacked(["bytes32"], [testSecret]));


      expect(await htlc.verifyPreimage(testSecret, testHashlock)).to.be.true;
      expect(await htlc.verifyPreimage(secret, testHashlock)).to.be.false;
    });
  });


  describe("Error conditions", function () {
    it("Should revert with ContractNotFound for non-existent contracts", async function () {
      const fakeContractId = ethers.keccak256(ethers.toUtf8Bytes("fake"));


      await expect(htlc.getHTLC(fakeContractId)).to.be.revertedWithCustomError(htlc, "ContractNotFound");
      await expect(htlc.getStatus(fakeContractId)).to.be.revertedWithCustomError(htlc, "ContractNotFound");
      await expect(htlc.getRemainingAmount(fakeContractId)).to.be.revertedWithCustomError(htlc, "ContractNotFound");
      await expect(htlc.getFilledAmount(fakeContractId)).to.be.revertedWithCustomError(htlc, "ContractNotFound");
    });


    it("Should prevent double spending", async function () {
      const totalAmount = amount + safetyDeposit;


      const tx = await htlc.connect(sender).createHTLC(
        receiver.address,
        amount,
        ethers.ZeroAddress,
        hashlock,
        timelock,
        safetyDeposit,
        false,
        0,
        { value: totalAmount }
      );


      const receipt = await tx.wait();
      const event = receipt?.logs.find(log => {
        try {
          const parsed = htlc.interface.parseLog(log as any);
          return parsed?.name === "HTLCNew";
        } catch {
          return false;
        }
      });


      const parsed = htlc.interface.parseLog(event as any);
      const contractId = parsed?.args[0];


      // First withdrawal
      await htlc.connect(receiver).withdraw(contractId, secret, 0);


      // Try to withdraw again - should fail
      await expect(
        htlc.connect(receiver).withdraw(contractId, secret, 0)
      ).to.be.revertedWithCustomError(htlc, "AlreadyWithdrawn");


      // Try to refund after withdrawal - should fail
      await expect(
        htlc.connect(sender).refund(contractId)
      ).to.be.revertedWithCustomError(htlc, "AlreadyWithdrawn");
    });
  });


  describe("Cross-chain compatibility", function () {
    it("Should generate consistent contract IDs", async function () {
      const timestamp = Math.floor(Date.now() / 1000);


      const id1 = await htlc.generateContractId(
        sender.address,
        receiver.address,
        amount,
        hashlock,
        timelock,
        timestamp
      );


      const id2 = await htlc.generateContractId(
        sender.address,
        receiver.address,
        amount,
        hashlock,
        timelock,
        timestamp
      );


      expect(id1).to.equal(id2);
    });


    it("Should generate different IDs for different parameters", async function () {
      const timestamp = Math.floor(Date.now() / 1000);


      const id1 = await htlc.generateContractId(
        sender.address,
        receiver.address,
        amount,
        hashlock,
        timelock,
        timestamp
      );


      const id2 = await htlc.generateContractId(
        sender.address,
        receiver.address,
        amount + 1n,
        hashlock,
        timelock,
        timestamp
      );


      expect(id1).to.not.equal(id2);
    });
  });
});