// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ProjectEscrow
 * @dev Smart contract for freelance escrow with milestone-based payments
 */
contract ProjectEscrow is ReentrancyGuard, Ownable {
    // Enums for different states
    enum ProjectStatus {
        CREATED,
        ACTIVE,
        COMPLETED,
        CANCELLED,
        DISPUTED
    }
    enum MilestoneStatus {
        PENDING,
        SUBMITTED,
        APPROVED,
        REJECTED,
        DISPUTED
    }

    // Milestone structure
    struct Milestone {
        string description;
        uint256 amount;
        uint256 deadline;
        MilestoneStatus status;
        string deliverableHash; // IPFS hash of work submitted
        uint256 submittedAt;
    }

    // Project structure
    struct Project {
        uint256 id;
        address payable client;
        address payable freelancer;
        string title;
        string descriptionHash; // IPFS hash
        uint256 totalAmount;
        ProjectStatus status;
        uint256 createdAt;
        uint256 acceptedAt;
        bool fundsDeposited;
    }

    // Dispute structure
    struct Dispute {
        uint256 projectId;
        uint256 milestoneId;
        address initiator;
        string reason;
        bool isResolved;
        uint256 createdAt;
    }

    // State variables
    uint256 public projectCounter;
    uint256 public disputeCounter;
    uint256 public platformFeePercent = 2; // 2% platform fee
    uint256 public constant DISPUTE_TIMEOUT = 3 days;

    // Mappings
    mapping(uint256 => Project) public projects;
    mapping(uint256 => Milestone[]) public projectMilestones;
    mapping(uint256 => Dispute) public disputes;
    mapping(address => uint256[]) public userProjects;
    mapping(address => uint256) public userRatings; // Total rating points
    mapping(address => uint256) public userRatingCount; // Number of ratings

    // Events
    event ProjectCreated(
        uint256 indexed projectId,
        address indexed client,
        uint256 totalAmount
    );
    event ProjectAccepted(
        uint256 indexed projectId,
        address indexed freelancer
    );
    event FundsDeposited(uint256 indexed projectId, uint256 amount);
    event MilestoneSubmitted(
        uint256 indexed projectId,
        uint256 milestoneId,
        string deliverableHash
    );
    event MilestoneApproved(uint256 indexed projectId, uint256 milestoneId);
    event PaymentReleased(
        uint256 indexed projectId,
        uint256 milestoneId,
        uint256 amount
    );
    event DisputeRaised(
        uint256 indexed disputeId,
        uint256 indexed projectId,
        address initiator
    );
    event DisputeResolved(
        uint256 indexed disputeId,
        uint256 percentageToFreelancer
    );
    event UserRated(address indexed user, uint256 rating);

    // Modifiers
    modifier onlyClient(uint256 _projectId) {
        require(
            msg.sender == projects[_projectId].client,
            "Only client can call this"
        );
        _;
    }

    modifier onlyFreelancer(uint256 _projectId) {
        require(
            msg.sender == projects[_projectId].freelancer,
            "Only freelancer can call this"
        );
        _;
    }

    modifier onlyParticipant(uint256 _projectId) {
        require(
            msg.sender == projects[_projectId].client ||
                msg.sender == projects[_projectId].freelancer,
            "Only project participants can call this"
        );
        _;
    }

    modifier projectExists(uint256 _projectId) {
        require(_projectId < projectCounter, "Project does not exist");
        _;
    }

    /**
     * @dev Create a new project with milestones
     */
    function createProject(
        string memory _title,
        string memory _descriptionHash,
        string[] memory _milestoneDescriptions,
        uint256[] memory _milestoneAmounts,
        uint256[] memory _milestoneDeadlines
    ) external payable returns (uint256) {
        require(
            _milestoneDescriptions.length > 0,
            "At least one milestone required"
        );
        require(
            _milestoneDescriptions.length == _milestoneAmounts.length &&
                _milestoneAmounts.length == _milestoneDeadlines.length,
            "Milestone arrays must be same length"
        );

        // Calculate total amount
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < _milestoneAmounts.length; i++) {
            require(_milestoneAmounts[i] > 0, "Milestone amount must be > 0");
            require(
                _milestoneDeadlines[i] > block.timestamp,
                "Deadline must be in future"
            );
            totalAmount += _milestoneAmounts[i];
        }

        require(msg.value >= totalAmount, "Insufficient funds deposited");

        // Create project
        uint256 projectId = projectCounter++;
        Project storage newProject = projects[projectId];
        newProject.id = projectId;
        newProject.client = payable(msg.sender);
        newProject.title = _title;
        newProject.descriptionHash = _descriptionHash;
        newProject.totalAmount = totalAmount;
        newProject.status = ProjectStatus.CREATED;
        newProject.createdAt = block.timestamp;
        newProject.fundsDeposited = true;

        // Create milestones
        for (uint256 i = 0; i < _milestoneDescriptions.length; i++) {
            Milestone memory milestone = Milestone({
                description: _milestoneDescriptions[i],
                amount: _milestoneAmounts[i],
                deadline: _milestoneDeadlines[i],
                status: MilestoneStatus.PENDING,
                deliverableHash: "",
                submittedAt: 0
            });
            projectMilestones[projectId].push(milestone);
        }

        // Track user projects
        userProjects[msg.sender].push(projectId);

        // Refund excess funds
        if (msg.value > totalAmount) {
            payable(msg.sender).transfer(msg.value - totalAmount);
        }

        emit ProjectCreated(projectId, msg.sender, totalAmount);
        emit FundsDeposited(projectId, totalAmount);

        return projectId;
    }

    /**
     * @dev Freelancer accepts the project
     */
    function acceptProject(
        uint256 _projectId
    ) external projectExists(_projectId) {
        Project storage project = projects[_projectId];
        require(
            project.status == ProjectStatus.CREATED,
            "Project not available"
        );
        require(project.freelancer == address(0), "Project already accepted");
        require(
            msg.sender != project.client,
            "Client cannot accept own project"
        );

        project.freelancer = payable(msg.sender);
        project.status = ProjectStatus.ACTIVE;
        project.acceptedAt = block.timestamp;

        userProjects[msg.sender].push(_projectId);

        emit ProjectAccepted(_projectId, msg.sender);
    }

    /**
     * @dev Freelancer submits work for a milestone
     */
    function submitMilestone(
        uint256 _projectId,
        uint256 _milestoneId,
        string memory _deliverableHash
    ) external projectExists(_projectId) onlyFreelancer(_projectId) {
        Project storage project = projects[_projectId];
        require(project.status == ProjectStatus.ACTIVE, "Project not active");
        require(
            _milestoneId < projectMilestones[_projectId].length,
            "Invalid milestone"
        );

        Milestone storage milestone = projectMilestones[_projectId][
            _milestoneId
        ];
        require(
            milestone.status == MilestoneStatus.PENDING,
            "Milestone not pending"
        );
        require(
            bytes(_deliverableHash).length > 0,
            "Deliverable hash required"
        );

        milestone.status = MilestoneStatus.SUBMITTED;
        milestone.deliverableHash = _deliverableHash;
        milestone.submittedAt = block.timestamp;

        emit MilestoneSubmitted(_projectId, _milestoneId, _deliverableHash);
    }

    /**
     * @dev Client approves milestone and releases payment
     */
    function approveMilestone(
        uint256 _projectId,
        uint256 _milestoneId
    ) external projectExists(_projectId) onlyClient(_projectId) nonReentrant {
        Project storage project = projects[_projectId];
        require(project.status == ProjectStatus.ACTIVE, "Project not active");
        require(
            _milestoneId < projectMilestones[_projectId].length,
            "Invalid milestone"
        );

        Milestone storage milestone = projectMilestones[_projectId][
            _milestoneId
        ];
        require(
            milestone.status == MilestoneStatus.SUBMITTED,
            "Milestone not submitted"
        );

        milestone.status = MilestoneStatus.APPROVED;

        // Calculate platform fee
        uint256 platformFee = (milestone.amount * platformFeePercent) / 100;
        uint256 freelancerAmount = milestone.amount - platformFee;

        // Transfer funds
        project.freelancer.transfer(freelancerAmount);
        payable(owner()).transfer(platformFee);

        emit MilestoneApproved(_projectId, _milestoneId);
        emit PaymentReleased(_projectId, _milestoneId, freelancerAmount);

        // Check if all milestones are approved
        if (allMilestonesApproved(_projectId)) {
            project.status = ProjectStatus.COMPLETED;
        }
    }

    /**
     * @dev Raise a dispute for a milestone
     */
    function raiseDispute(
        uint256 _projectId,
        uint256 _milestoneId,
        string memory _reason
    )
        external
        projectExists(_projectId)
        onlyParticipant(_projectId)
        returns (uint256)
    {
        Project storage project = projects[_projectId];
        require(project.status == ProjectStatus.ACTIVE, "Project not active");
        require(
            _milestoneId < projectMilestones[_projectId].length,
            "Invalid milestone"
        );

        Milestone storage milestone = projectMilestones[_projectId][
            _milestoneId
        ];
        require(
            milestone.status == MilestoneStatus.SUBMITTED,
            "Can only dispute submitted milestones"
        );
        require(
            block.timestamp <= milestone.submittedAt + DISPUTE_TIMEOUT,
            "Dispute period expired"
        );

        uint256 disputeId = disputeCounter++;
        Dispute storage dispute = disputes[disputeId];
        dispute.projectId = _projectId;
        dispute.milestoneId = _milestoneId;
        dispute.initiator = msg.sender;
        dispute.reason = _reason;
        dispute.isResolved = false;
        dispute.createdAt = block.timestamp;

        project.status = ProjectStatus.DISPUTED;
        milestone.status = MilestoneStatus.DISPUTED;

        emit DisputeRaised(disputeId, _projectId, msg.sender);

        return disputeId;
    }

    /**
     * @dev Admin resolves dispute (can be enhanced with voting mechanism)
     */
    function resolveDispute(
        uint256 _disputeId,
        uint256 _percentageToFreelancer
    ) external onlyOwner nonReentrant {
        require(_disputeId < disputeCounter, "Dispute does not exist");
        Dispute storage dispute = disputes[_disputeId];
        require(!dispute.isResolved, "Dispute already resolved");
        require(_percentageToFreelancer <= 100, "Invalid percentage");

        uint256 projectId = dispute.projectId;
        uint256 milestoneId = dispute.milestoneId;

        Project storage project = projects[projectId];
        Milestone storage milestone = projectMilestones[projectId][milestoneId];

        // Calculate amounts
        uint256 freelancerAmount = (milestone.amount *
            _percentageToFreelancer) / 100;
        uint256 clientAmount = milestone.amount - freelancerAmount;

        // Transfer funds
        if (freelancerAmount > 0) {
            project.freelancer.transfer(freelancerAmount);
        }
        if (clientAmount > 0) {
            project.client.transfer(clientAmount);
        }

        // Update states
        dispute.isResolved = true;
        milestone.status = MilestoneStatus.APPROVED; // Mark as resolved
        project.status = ProjectStatus.ACTIVE;

        emit DisputeResolved(_disputeId, _percentageToFreelancer);
    }

    /**
     * @dev Rate a user after project completion
     */
    function rateUser(address _user, uint256 _rating) external {
        require(_rating >= 1 && _rating <= 5, "Rating must be between 1 and 5");

        // Simple rating system - can be enhanced to verify project completion
        userRatings[_user] += _rating;
        userRatingCount[_user]++;

        emit UserRated(_user, _rating);
    }

    /**
     * @dev Cancel project before freelancer accepts
     */
    function cancelProject(
        uint256 _projectId
    ) external projectExists(_projectId) onlyClient(_projectId) nonReentrant {
        Project storage project = projects[_projectId];
        require(
            project.status == ProjectStatus.CREATED,
            "Can only cancel created projects"
        );
        require(
            project.freelancer == address(0),
            "Cannot cancel accepted project"
        );

        project.status = ProjectStatus.CANCELLED;

        // Refund client
        project.client.transfer(project.totalAmount);
    }

    /**
     * @dev Get all milestones for a project
     */
    function getProjectMilestones(
        uint256 _projectId
    ) external view projectExists(_projectId) returns (Milestone[] memory) {
        return projectMilestones[_projectId];
    }

    /**
     * @dev Get user's average rating
     */
    function getUserRating(address _user) external view returns (uint256) {
        if (userRatingCount[_user] == 0) return 0;
        return userRatings[_user] / userRatingCount[_user];
    }

    /**
     * @dev Get all projects for a user
     */
    function getUserProjects(
        address _user
    ) external view returns (uint256[] memory) {
        return userProjects[_user];
    }

    /**
     * @dev Check if all milestones are approved
     */
    function allMilestonesApproved(
        uint256 _projectId
    ) internal view returns (bool) {
        Milestone[] storage milestones = projectMilestones[_projectId];
        for (uint256 i = 0; i < milestones.length; i++) {
            if (milestones[i].status != MilestoneStatus.APPROVED) {
                return false;
            }
        }
        return true;
    }

    /**
     * @dev Update platform fee (only owner)
     */
    function setPlatformFee(uint256 _feePercent) external onlyOwner {
        require(_feePercent <= 10, "Fee cannot exceed 10%");
        platformFeePercent = _feePercent;
    }

    /**
     * @dev Get contract balance
     */
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
