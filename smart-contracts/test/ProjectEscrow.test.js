const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("ProjectEscrow", function () {
  let escrow;
  let owner;
  let client;
  let freelancer;

  beforeEach(async function () {
    [owner, client, freelancer] = await ethers.getSigners();
    
    const ProjectEscrow = await ethers.getContractFactory("ProjectEscrow");
    escrow = await ProjectEscrow.deploy();
    await escrow.waitForDeployment();
  });

  describe("Project Creation", function () {
    it("Should create a project with milestones", async function () {
      const title = "Build a Website";
      const descHash = "QmDescriptionHash123";
      const milestoneDescs = ["Design", "Development"];
      const milestoneAmounts = [
        ethers.parseEther("1"),
        ethers.parseEther("2")
      ];
      
      const now = await time.latest();
      const milestoneDeadlines = [
        now + 7 * 24 * 60 * 60,
        now + 14 * 24 * 60 * 60
      ];

      const totalAmount = ethers.parseEther("3");

      await expect(
        escrow.connect(client).createProject(
          title,
          descHash,
          milestoneDescs,
          milestoneAmounts,
          milestoneDeadlines,
          { value: totalAmount }
        )
      ).to.emit(escrow, "ProjectCreated")
       .withArgs(0, client.address, totalAmount);

      const project = await escrow.projects(0);
      expect(project.client).to.equal(client.address);
      expect(project.totalAmount).to.equal(totalAmount);
      expect(project.status).to.equal(0); // CREATED
    });

    it("Should require at least one milestone", async function () {
      await expect(
        escrow.connect(client).createProject(
          "Test",
          "hash",
          [],
          [],
          [],
          { value: ethers.parseEther("1") }
        )
      ).to.be.revertedWith("At least one milestone required");
    });
  });

  describe("Project Acceptance", function () {
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
    });

    it("Should allow freelancer to accept project", async function () {
      await expect(escrow.connect(freelancer).acceptProject(projectId))
        .to.emit(escrow, "ProjectAccepted")
        .withArgs(projectId, freelancer.address);

      const project = await escrow.projects(projectId);
      expect(project.freelancer).to.equal(freelancer.address);
      expect(project.status).to.equal(1); // ACTIVE
    });

    it("Should not allow client to accept own project", async function () {
      await expect(
        escrow.connect(client).acceptProject(projectId)
      ).to.be.revertedWith("Client cannot accept own project");
    });
  });

  describe("Milestone Submission", function () {
    let projectId;

    beforeEach(async function () {
      const now = await time.latest();
      await escrow.connect(client).createProject(
        "Test Project",
        "hash",
        ["Design"],
        [ethers.parseEther("1")],
        [now + 7 * 24 * 60 * 60],
        { value: ethers.parseEther("1") }
      );
      projectId = 0;
      await escrow.connect(freelancer).acceptProject(projectId);
    });

    it("Should allow freelancer to submit milestone", async function () {
      const deliverableHash = "QmDeliverable123";
      
      await expect(
        escrow.connect(freelancer).submitMilestone(projectId, 0, deliverableHash)
      ).to.emit(escrow, "MilestoneSubmitted")
        .withArgs(projectId, 0, deliverableHash);

      const milestones = await escrow.getProjectMilestones(projectId);
      expect(milestones[0].status).to.equal(1); // SUBMITTED
    });
  });

  describe("Milestone Approval", function () {
    let projectId;

    beforeEach(async function () {
      const now = await time.latest();
      await escrow.connect(client).createProject(
        "Test Project",
        "hash",
        ["Design"],
        [ethers.parseEther("1")],
        [now + 7 * 24 * 60 * 60],
        { value: ethers.parseEther("1") }
      );
      projectId = 0;
      await escrow.connect(freelancer).acceptProject(projectId);
      await escrow.connect(freelancer).submitMilestone(projectId, 0, "hash");
    });

    it("Should allow client to approve milestone and release payment", async function () {
      const freelancerBalanceBefore = await ethers.provider.getBalance(freelancer.address);
      
      await escrow.connect(client).approveMilestone(projectId, 0);

      const freelancerBalanceAfter = await ethers.provider.getBalance(freelancer.address);
      
      // Freelancer should receive 98% (2% fee)
      const expectedAmount = ethers.parseEther("1") * BigInt(98) / BigInt(100);
      expect(freelancerBalanceAfter - freelancerBalanceBefore).to.equal(expectedAmount);
    });
  });
});