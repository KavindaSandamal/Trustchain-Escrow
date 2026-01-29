// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title ProjectEscrowImproved
 * @dev Enhanced escrow with auto-approval, multi-admin disputes, and emergency pause
 */
contract ProjectEscrowImproved is ReentrancyGuard, Ownable, Pausable {
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
        string deliverableHash;
        uint256 submittedAt;
    }

    // Project structure
    struct Project {
        uint256 id;
        address payable client;
        address payable freelancer;
        string title;
        string descriptionHash;
        uint256 totalAmount;
        ProjectStatus status;
        uint256 createdAt;
        uint256 acceptedAt;
        bool fundsDeposited;
    }

    // Dispute structure with voting
    struct Dispute {
        uint256 projectId;
        uint256 milestoneId;
        address initiator;
        string reason;
        bool isResolved;
        uint256 createdAt;
        mapping(address => bool) hasVoted;
        mapping(address => uint256) votes; // admin => percentage to freelancer
        uint256 voteCount;
    }

    // State variables
    uint256 public projectCounter;
    uint256 public disputeCounter;
    uint256 public platformFeePercent = 2;
    uint256 public constant DISPUTE_TIMEOUT = 3 days;
    uint256 public constant AUTO_APPROVE_TIMEOUT = 7 days; // NEW: Auto-approval after 7 days
    uint256 public constant REQUIRED_ADMIN_VOTES = 2; // NEW: 2 out of 3 admins

    // Mappings
    mapping(uint256 => Project) public projects;
    mapping(uint256 => Milestone[]) public projectMilestones;
    mapping(uint256 => Dispute) public disputes;
    mapping(address => uint256[]) public userProjects;
    mapping(address => uint256) public userRatings;
    mapping(address => uint256) public userRatingCount;
    mapping(address => bool) public isAdmin; // NEW: Multi-admin system
    address[] public adminList; // NEW: List of admins

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
    event MilestoneAutoApproved(uint256 indexed projectId, uint256 milestoneId); // NEW
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
    event DisputeVoted(
        uint256 indexed disputeId,
        address indexed admin,
        uint256 percentage
    ); // NEW
    event DisputeResolved(
        uint256 indexed disputeId,
        uint256 percentageToFreelancer
    );
    event UserRated(address indexed user, uint256 rating);
    event AdminAdded(address indexed admin); // NEW
    event AdminRemoved(address indexed admin); // NEW
    event ContractPaused(address indexed by); // NEW
    event ContractUnpaused(address indexed by); // NEW

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

    modifier onlyAdmin() {
        require(
            isAdmin[msg.sender] || msg.sender == owner(),
            "Only admin can call this"
        );
        _;
    }

    constructor() Ownable() {
        // Add contract deployer as first admin
        isAdmin[msg.sender] = true;
        adminList.push(msg.sender);
    }

    // NEW: Admin management functions
    function addAdmin(address _admin) external onlyOwner {
        require(!isAdmin[_admin], "Already an admin");
        require(_admin != address(0), "Invalid address");

        isAdmin[_admin] = true;
        adminList.push(_admin);

        emit AdminAdded(_admin);
    }

    function removeAdmin(address _admin) external onlyOwner {
        require(isAdmin[_admin], "Not an admin");
        require(adminList.length > 1, "Cannot remove last admin");

        isAdmin[_admin] = false;

        // Remove from adminList
        for (uint256 i = 0; i < adminList.length; i++) {
            if (adminList[i] == _admin) {
                adminList[i] = adminList[adminList.length - 1];
                adminList.pop();
                break;
            }
        }

        emit AdminRemoved(_admin);
    }

    function getAdminList() external view returns (address[] memory) {
        return adminList;
    }

    // NEW: Emergency pause functions
    function pause() external onlyOwner {
        _pause();
        emit ContractPaused(msg.sender);
    }

    function unpause() external onlyOwner {
        _unpause();
        emit ContractUnpaused(msg.sender);
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
    ) external payable whenNotPaused returns (uint256) {
        require(
            _milestoneDescriptions.length > 0,
            "At least one milestone required"
        );
        require(
            _milestoneDescriptions.length == _milestoneAmounts.length &&
                _milestoneAmounts.length == _milestoneDeadlines.length,
            "Milestone arrays must be same length"
        );

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

        userProjects[msg.sender].push(projectId);

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
    ) external projectExists(_projectId) whenNotPaused {
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
    )
        external
        projectExists(_projectId)
        onlyFreelancer(_projectId)
        whenNotPaused
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
    )
        external
        projectExists(_projectId)
        onlyClient(_projectId)
        nonReentrant
        whenNotPaused
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
            "Milestone not submitted"
        );

        _releaseMilestonePayment(project, milestone, _projectId, _milestoneId);
    }

    /**
     * @dev NEW: Auto-approve milestone if client hasn't responded in 7 days
     * Anyone can call this function
     */
    function autoApproveMilestone(
        uint256 _projectId,
        uint256 _milestoneId
    ) external projectExists(_projectId) nonReentrant whenNotPaused {
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
        require(
            block.timestamp >= milestone.submittedAt + AUTO_APPROVE_TIMEOUT,
            "Auto-approval timeout not reached"
        );

        emit MilestoneAutoApproved(_projectId, _milestoneId);
        _releaseMilestonePayment(project, milestone, _projectId, _milestoneId);
    }

    /**
     * @dev Internal function to release milestone payment
     */
    function _releaseMilestonePayment(
        Project storage project,
        Milestone storage milestone,
        uint256 _projectId,
        uint256 _milestoneId
    ) internal {
        milestone.status = MilestoneStatus.APPROVED;

        uint256 platformFee = (milestone.amount * platformFeePercent) / 100;
        uint256 freelancerAmount = milestone.amount - platformFee;

        project.freelancer.transfer(freelancerAmount);
        payable(owner()).transfer(platformFee);

        emit MilestoneApproved(_projectId, _milestoneId);
        emit PaymentReleased(_projectId, _milestoneId, freelancerAmount);

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
        whenNotPaused
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
        dispute.voteCount = 0;

        project.status = ProjectStatus.DISPUTED;
        milestone.status = MilestoneStatus.DISPUTED;

        emit DisputeRaised(disputeId, _projectId, msg.sender);

        return disputeId;
    }

    /**
     * @dev NEW: Multi-admin dispute voting system
     */
    function voteOnDispute(
        uint256 _disputeId,
        uint256 _percentageToFreelancer
    ) external onlyAdmin whenNotPaused {
        require(_disputeId < disputeCounter, "Dispute does not exist");
        Dispute storage dispute = disputes[_disputeId];
        require(!dispute.isResolved, "Dispute already resolved");
        require(_percentageToFreelancer <= 100, "Invalid percentage");
        require(!dispute.hasVoted[msg.sender], "Already voted");

        dispute.hasVoted[msg.sender] = true;
        dispute.votes[msg.sender] = _percentageToFreelancer;
        dispute.voteCount++;

        emit DisputeVoted(_disputeId, msg.sender, _percentageToFreelancer);

        // If enough votes, execute resolution
        if (dispute.voteCount >= REQUIRED_ADMIN_VOTES) {
            _executeDisputeResolution(_disputeId);
        }
    }

    /**
     * @dev NEW: Execute dispute resolution based on average of votes
     */
    function _executeDisputeResolution(
        uint256 _disputeId
    ) internal nonReentrant {
        Dispute storage dispute = disputes[_disputeId];
        require(!dispute.isResolved, "Already resolved");

        // Calculate average percentage from all votes
        uint256 totalPercentage = 0;
        uint256 validVotes = 0;

        for (uint256 i = 0; i < adminList.length; i++) {
            address admin = adminList[i];
            if (dispute.hasVoted[admin]) {
                totalPercentage += dispute.votes[admin];
                validVotes++;
            }
        }

        uint256 avgPercentage = totalPercentage / validVotes;

        uint256 projectId = dispute.projectId;
        uint256 milestoneId = dispute.milestoneId;

        Project storage project = projects[projectId];
        Milestone storage milestone = projectMilestones[projectId][milestoneId];

        uint256 freelancerAmount = (milestone.amount * avgPercentage) / 100;
        uint256 clientAmount = milestone.amount - freelancerAmount;

        if (freelancerAmount > 0) {
            project.freelancer.transfer(freelancerAmount);
        }
        if (clientAmount > 0) {
            project.client.transfer(clientAmount);
        }

        dispute.isResolved = true;
        milestone.status = MilestoneStatus.APPROVED;
        project.status = ProjectStatus.ACTIVE;

        emit DisputeResolved(_disputeId, avgPercentage);
    }

    /**
     * @dev Rate a user after project completion
     */
    function rateUser(address _user, uint256 _rating) external whenNotPaused {
        require(_rating >= 1 && _rating <= 5, "Rating must be between 1 and 5");

        userRatings[_user] += _rating;
        userRatingCount[_user]++;

        emit UserRated(_user, _rating);
    }

    /**
     * @dev Cancel project before freelancer accepts
     */
    function cancelProject(
        uint256 _projectId
    )
        external
        projectExists(_projectId)
        onlyClient(_projectId)
        nonReentrant
        whenNotPaused
    {
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

    /**
     * @dev NEW: Check if milestone can be auto-approved
     */
    function canAutoApprove(
        uint256 _projectId,
        uint256 _milestoneId
    ) external view returns (bool) {
        if (_projectId >= projectCounter) return false;
        if (_milestoneId >= projectMilestones[_projectId].length) return false;

        Milestone storage milestone = projectMilestones[_projectId][
            _milestoneId
        ];

        return (milestone.status == MilestoneStatus.SUBMITTED &&
            block.timestamp >= milestone.submittedAt + AUTO_APPROVE_TIMEOUT);
    }

    /**
     * @dev NEW: Get dispute voting status
     */
    function getDisputeVotes(
        uint256 _disputeId
    )
        external
        view
        returns (
            uint256 voteCount,
            bool isResolved,
            address[] memory voters,
            uint256[] memory percentages
        )
    {
        require(_disputeId < disputeCounter, "Dispute does not exist");
        Dispute storage dispute = disputes[_disputeId];

        address[] memory tempVoters = new address[](adminList.length);
        uint256[] memory tempPercentages = new uint256[](adminList.length);
        uint256 count = 0;

        for (uint256 i = 0; i < adminList.length; i++) {
            address admin = adminList[i];
            if (dispute.hasVoted[admin]) {
                tempVoters[count] = admin;
                tempPercentages[count] = dispute.votes[admin];
                count++;
            }
        }

        voters = new address[](count);
        percentages = new uint256[](count);

        for (uint256 i = 0; i < count; i++) {
            voters[i] = tempVoters[i];
            percentages[i] = tempPercentages[i];
        }

        return (dispute.voteCount, dispute.isResolved, voters, percentages);
    }
}
