import { expect } from "chai";
import { ethers } from "hardhat";
import { HTLC } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("HTLC Contract", function () {
  let htlc: HTLC;
  let sender: SignerWithAddress;
  let receiver: SignerWithAddress;
  let other: SignerWithAddress;

  const secret = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
  const hashlock = ethers.keccak256(ethers.solidityPacked(["bytes32"], [secret]));
  const amount = ethers.parseEther("1.0");
  const safetyDeposit = ethers.parseEther("0.1");
  const timelock = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

  beforeEach(async function () {
    [sender, receiver, other] = await ethers.getSigners();
    
    const HTLCFactory = await ethers.getContractFactory("HTLC");
    htlc = await HTLCFactory.deploy();
    await htlc.waitForDeployment();
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

    it("Should fail with invalid amount", async function () {
      await expect(
        htlc.connect(sender).createHTLC(
          receiver.address,
          0,
          ethers.ZeroAddress,
          hashlock,
          timelock,
          safetyDeposit,
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
          { value: amount } // Missing safety deposit
        )
      ).to.be.revertedWithCustomError(htlc, "InsufficientBalance");
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

      const tx = await htlc.connect(receiver).withdraw(contractId, secret);
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
        htlc.connect(receiver).withdraw(contractId, wrongSecret)
      ).to.be.revertedWithCustomError(htlc, "InvalidPreimage");
    });

    it("Should fail if not called by receiver", async function () {
      await expect(
        htlc.connect(other).withdraw(contractId, secret)
      ).to.be.revertedWithCustomError(htlc, "Unauthorized");
    });

    it("Should fail after timelock expiry", async function () {
      // Fast forward time past timelock
      await ethers.provider.send("evm_increaseTime", [3700]); // 1 hour + 100 seconds
      await ethers.provider.send("evm_mine", []);

      await expect(
        htlc.connect(receiver).withdraw(contractId, secret)
      ).to.be.revertedWithCustomError(htlc, "TimelockExpired");
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
      expect(htlcData.tokenAddress).to.equal(ethers.ZeroAddress);
      expect(htlcData.hashlock).to.equal(hashlock);
      expect(htlcData.timelock).to.equal(timelock);
      expect(htlcData.safetyDeposit).to.equal(safetyDeposit);
      expect(htlcData.status).to.equal(0); // Active
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

    it("Should return correct contract balance", async function () {
      const balance = await htlc.getContractBalance(ethers.ZeroAddress);
      expect(balance).to.equal(amount + safetyDeposit);
    });
  });

  describe("generateContractId", function () {
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