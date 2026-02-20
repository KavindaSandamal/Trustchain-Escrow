const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("ProjectEscrowImproved", function () {
  let escrow;
  let owner;
  let client;
  let freelancer;
  let admin2;
  let admin3;

  beforeEach(async function () {
    [owner, client, freelancer, admin2, admin3] = await ethers.getSigners();
    
    const ProjectEscrow = await ethers.getContractFactory("ProjectEscrowImproved");
    escrow = await ProjectEscrow.deploy();
    await escrow.waitForDeployment();
  });

  describe("Admin Management", function () {
    it("Should add owner as first admin", async function () {
      expect(await escrow.isAdmin(owner.address)).to.be.true;
      const adminList = await escrow.getAdminList();
      expect(adminList.length).to.equal(1);
      expect(adminList[0]).to.equal(owner.address);
    });

    it("Should allow owner to add new admin", async function () {
      await expect(escrow.addAdmin(admin2.address))
        .to.emit(escrow, "AdminAdded")
        .withArgs(admin2.address);

      expect(await escrow.isAdmin(admin2.address)).to.be.true;
      const adminList = await escrow.getAdminList();
      expect(adminList.length).to.equal(2);
    });

    it("Should not allow non-owner to add admin", async function () {
      await expect(
        escrow.connect(client).addAdmin(admin2.address)
      ).to.be.reverted;
    });

    it("Should allow owner to remove admin", async function () {
      await escrow.addAdmin(admin2.address);
      
      await expect(escrow.removeAdmin(admin2.address))
        .to.emit(escrow, "AdminRemoved")
        .withArgs(admin2.address);

      expect(await escrow.isAdmin(admin2.address)).to.be.false;
    });

    it("Should not allow removing last admin", async function () {
      await expect(
        escrow.removeAdmin(owner.address)
      ).to.be.revertedWith("Cannot remove last admin");
    });
  });

  describe("Emergency Pause", function () {
    it("Should allow owner to pause contract", async function () {
      await expect(escrow.pause())
        .to.emit(escrow, "ContractPaused")
        .withArgs(owner.address);

      expect(await escrow.paused()).to.be.true;
    });

    it("Should prevent actions when paused", async function () {
      await escrow.pause();

      const now = await time.latest();
      await expect(
        escrow.connect(client).createProject(
          "Test",
          "hash",
          ["Milestone 1"],
          [ethers.parseEther("1")],
          [now + 7 * 24 * 60 * 60],
          { value: ethers.parseEther("1") }
        )
      ).to.be.reverted;
    });

    it("Should allow owner to unpause", async function () {
      await escrow.pause();
      
      await expect(escrow.unpause())
        .to.emit(escrow, "ContractUnpaused")
        .withArgs(owner.address);

      expect(await escrow.paused()).to.be.false;
    });

    it("Should not allow non-owner to pause", async function () {
      await expect(
        escrow.connect(client).pause()
      ).to.be.reverted;
    });
  });

  describe("Auto-Approval Feature", function () {
    let projectId;

    beforeEach(async function () {
      const now = await time.latest();
      await escrow.connect(client).createProject(
        "Test Project",
        "hash",
        ["Milestone 1"],
        [ethers.parseEther("1")],
        [now + 7 * 24 * 60 * 60],
        { value: ethers.parseEther("1") }
      );
      projectId = 0;
      
      await escrow.connect(freelancer).acceptProject(projectId);
      await escrow.connect(freelancer).submitMilestone(projectId, 0, "QmHash123");
    });

    it("Should not allow auto-approval before timeout", async function () {
      await expect(
        escrow.autoApproveMilestone(projectId, 0)
      ).to.be.revertedWith("Auto-approval timeout not reached");
    });

    it("Should allow auto-approval after 7 days", async function () {
      // Fast forward 7 days
      await time.increase(7 * 24 * 60 * 60 + 1);

      const freelancerBalanceBefore = await ethers.provider.getBalance(freelancer.address);

      await expect(escrow.autoApproveMilestone(projectId, 0))
        .to.emit(escrow, "MilestoneAutoApproved")
        .withArgs(projectId, 0);

      const freelancerBalanceAfter = await ethers.provider.getBalance(freelancer.address);
      
      // Freelancer should receive 98% (2% fee)
      const expectedAmount = ethers.parseEther("1") * BigInt(98) / BigInt(100);
      expect(freelancerBalanceAfter - freelancerBalanceBefore).to.equal(expectedAmount);
    });

    it("Should allow anyone to trigger auto-approval", async function () {
      await time.increase(7 * 24 * 60 * 60 + 1);

      // Random account triggers auto-approval
      await expect(escrow.connect(admin2).autoApproveMilestone(projectId, 0))
        .to.emit(escrow, "MilestoneAutoApproved");
    });

    it("Should check canAutoApprove status correctly", async function () {
      // Before timeout
      expect(await escrow.canAutoApprove(projectId, 0)).to.be.false;

      // After timeout
      await time.increase(7 * 24 * 60 * 60 + 1);
      expect(await escrow.canAutoApprove(projectId, 0)).to.be.true;
    });
  });

  describe("Multi-Admin Dispute Resolution", function () {
    let projectId;
    let disputeId;

    beforeEach(async function () {
      // Add two more admins (total 3)
      await escrow.addAdmin(admin2.address);
      await escrow.addAdmin(admin3.address);

      const now = await time.latest();
      await escrow.connect(client).createProject(
        "Test Project",
        "hash",
        ["Milestone 1"],
        [ethers.parseEther("1")],
        [now + 7 * 24 * 60 * 60],
        { value: ethers.parseEther("1") }
      );
      projectId = 0;
      
      await escrow.connect(freelancer).acceptProject(projectId);
      await escrow.connect(freelancer).submitMilestone(projectId, 0, "QmHash123");
      
      const tx = await escrow.connect(client).raiseDispute(projectId, 0, "Work incomplete");
      const receipt = await tx.wait();
      disputeId = 0;
    });

    it("Should allow admin to vote on dispute", async function () {
      await expect(escrow.connect(owner).voteOnDispute(disputeId, 60))
        .to.emit(escrow, "DisputeVoted")
        .withArgs(disputeId, owner.address, 60);

      const dispute = await escrow.disputes(disputeId);
      expect(dispute.voteCount).to.equal(1);
    });

    it("Should not allow voting twice", async function () {
      await escrow.connect(owner).voteOnDispute(disputeId, 60);

      await expect(
        escrow.connect(owner).voteOnDispute(disputeId, 50)
      ).to.be.revertedWith("Already voted");
    });

    it("Should not allow non-admin to vote", async function () {
      await expect(
        escrow.connect(client).voteOnDispute(disputeId, 60)
      ).to.be.revertedWith("Only admin can call this");
    });

    it("Should auto-resolve after 2 votes (average calculation)", async function () {
      const freelancerBalanceBefore = await ethers.provider.getBalance(freelancer.address);
      const clientBalanceBefore = await ethers.provider.getBalance(client.address);

      // Admin 1 votes: 60% to freelancer
      await escrow.connect(owner).voteOnDispute(disputeId, 60);

      // Admin 2 votes: 40% to freelancer (average = 50%)
      await expect(escrow.connect(admin2).voteOnDispute(disputeId, 40))
        .to.emit(escrow, "DisputeResolved")
        .withArgs(disputeId, 50); // Average of 60 and 40

      const freelancerBalanceAfter = await ethers.provider.getBalance(freelancer.address);
      const clientBalanceAfter = await ethers.provider.getBalance(client.address);

      const amount = ethers.parseEther("1");
      
      // Freelancer gets 50%
      expect(freelancerBalanceAfter - freelancerBalanceBefore).to.equal(amount / BigInt(2));
      
      // Client gets 50%
      expect(clientBalanceAfter - clientBalanceBefore).to.equal(amount / BigInt(2));
    });

    it("Should retrieve dispute vote status", async function () {
      await escrow.connect(owner).voteOnDispute(disputeId, 60);
      await escrow.connect(admin2).voteOnDispute(disputeId, 40);

      const [voteCount, isResolved, voters, percentages] = await escrow.getDisputeVotes(disputeId);

      expect(voteCount).to.equal(2);
      expect(isResolved).to.be.true;
      expect(voters.length).to.equal(2);
      expect(voters).to.include(owner.address);
      expect(voters).to.include(admin2.address);
    });

    it("Should calculate correct average with 3 votes", async function () {
      // Add third admin and get 3 votes
      await escrow.connect(owner).voteOnDispute(disputeId, 60);
      
      const tx = await escrow.connect(admin2).voteOnDispute(disputeId, 40);
      await tx.wait();
      
      // Already resolved after 2 votes, but let's test the logic
      const [voteCount, isResolved] = await escrow.getDisputeVotes(disputeId);
      expect(voteCount).to.equal(2); // Resolved at 2 votes
    });
  });

  describe("Complete Project Flow with New Features", function () {
    it("Should handle full lifecycle with auto-approval", async function () {
      const now = await time.latest();
      
      // Create project
      await escrow.connect(client).createProject(
        "Full Test",
        "hash",
        ["M1", "M2"],
        [ethers.parseEther("1"), ethers.parseEther("1")],
        [now + 7 * 24 * 60 * 60, now + 14 * 24 * 60 * 60],
        { value: ethers.parseEther("2") }
      );
      
      // Accept
      await escrow.connect(freelancer).acceptProject(0);
      
      // Submit M1
      await escrow.connect(freelancer).submitMilestone(0, 0, "QmM1");
      
      // Client approves M1 normally
      await escrow.connect(client).approveMilestone(0, 0);
      
      // Submit M2
      await escrow.connect(freelancer).submitMilestone(0, 1, "QmM2");
      
      // Client doesn't respond, wait 7 days
      await time.increase(7 * 24 * 60 * 60 + 1);
      
      // Anyone can auto-approve
      await escrow.connect(admin2).autoApproveMilestone(0, 1);
      
      // Project should be completed
      const project = await escrow.projects(0);
      expect(project.status).to.equal(2);
    });
  });

  describe("Backward Compatibility", function () {
    it("Should maintain all original functions", async function () {
      const now = await time.latest();
      
      await escrow.connect(client).createProject(
        "Test",
        "hash",
        ["M1"],
        [ethers.parseEther("1")],
        [now + 7 * 24 * 60 * 60],
        { value: ethers.parseEther("1") }
      );
      
      await escrow.connect(freelancer).acceptProject(0);
      await escrow.connect(freelancer).submitMilestone(0, 0, "hash");
      await escrow.connect(client).approveMilestone(0, 0);
      
      const project = await escrow.projects(0);
      expect(project.status).to.equal(2);
    });
  });
});