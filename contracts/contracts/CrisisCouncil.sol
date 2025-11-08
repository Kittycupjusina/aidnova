// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReliefTreasury} from "./ReliefTreasury.sol";
import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

contract CrisisCouncil is SepoliaConfig {
    enum ResolutionStatus { Active, Passed, Rejected, Executed, Cancelled }

    struct Resolution {
        uint256 id;
        address proposer;
        address recipient;
        address token;
        uint256 amount;
        string purposeCID;
        uint256 startTime;
        uint256 endTime;
        ResolutionStatus status;
        bool emergency;
        bool fromCrisisPool;
    }

    struct VoteInfo { bool support; bool voted; }

    event ResolutionSubmitted(uint256 indexed id, address indexed proposer, address indexed recipient, uint256 amount, bool emergency);
    event VoteCast(uint256 indexed id, address indexed voter, bool support, uint256 weight);
    event OutcomeFinalized(uint256 indexed id, ResolutionStatus status);

    ReliefTreasury public immutable treasury;
    address public owner;

    uint256 public quorum;
    uint256 public passRatioBps;
    uint256 public normalVotingPeriod;
    uint256 public emergencyVotingPeriod;

    uint256 public nextResolutionId = 1;
    mapping(uint256 => Resolution) public resolutions;
    mapping(uint256 => uint256) public supportWeight;
    mapping(uint256 => uint256) public againstWeight;
    mapping(uint256 => mapping(address => VoteInfo)) public votes;

    mapping(uint256 => euint32) private _encSupport;
    mapping(uint256 => euint32) private _encAgainst;

    modifier onlyOwner() { require(msg.sender == owner, "Not owner"); _; }

    constructor(ReliefTreasury _treasury) {
        treasury = _treasury;
        owner = msg.sender;
        quorum = 3;
        passRatioBps = 6000;
        normalVotingPeriod = 3 days;
        emergencyVotingPeriod = 6 hours;
    }

    function setParams(uint256 _quorum, uint256 _passRatioBps, uint256 _normal, uint256 _emergency) external onlyOwner {
        require(_passRatioBps <= 10000, "invalid ratio");
        quorum = _quorum;
        passRatioBps = _passRatioBps;
        normalVotingPeriod = _normal;
        emergencyVotingPeriod = _emergency;
    }

    function submitResolution(
        address recipient,
        address token,
        uint256 amount,
        string calldata purposeCID,
        uint256 duration,
        bool emergency,
        bool fromCrisisPool
    ) external returns (uint256 id) {
        require(recipient != address(0), "invalid recipient");
        require(amount > 0, "invalid amount");

        id = nextResolutionId++;
        uint256 nowTs = block.timestamp;
        uint256 endTs = nowTs + (duration > 0 ? duration : (emergency ? emergencyVotingPeriod : normalVotingPeriod));

        resolutions[id] = Resolution({
            id: id,
            proposer: msg.sender,
            recipient: recipient,
            token: token,
            amount: amount,
            purposeCID: purposeCID,
            startTime: nowTs,
            endTime: endTs,
            status: ResolutionStatus.Active,
            emergency: emergency,
            fromCrisisPool: fromCrisisPool
        });

        emit ResolutionSubmitted(id, msg.sender, recipient, amount, emergency);
    }

    function castVote(uint256 id, bool support, externalEuint32 oneExt, bytes calldata inputProof) external {
        Resolution storage r = resolutions[id];
        require(r.status == ResolutionStatus.Active, "not active");
        require(block.timestamp <= r.endTime, "ended");
        VoteInfo storage v = votes[id][msg.sender];
        require(!v.voted, "already voted");

        v.voted = true;
        v.support = support;
        uint256 weight = 1;
        if (support) supportWeight[id] += weight; else againstWeight[id] += weight;
        emit VoteCast(id, msg.sender, support, weight);

        euint32 one = FHE.fromExternal(oneExt, inputProof);
        if (support) {
            _encSupport[id] = FHE.add(_encSupport[id], one);
            FHE.allowThis(_encSupport[id]);
            FHE.allow(_encSupport[id], msg.sender);
        } else {
            _encAgainst[id] = FHE.add(_encAgainst[id], one);
            FHE.allowThis(_encAgainst[id]);
            FHE.allow(_encAgainst[id], msg.sender);
        }
    }

    function finalizeOutcome(uint256 id) public {
        Resolution storage r = resolutions[id];
        require(r.status == ResolutionStatus.Active, "not active");
        require(block.timestamp > r.endTime, "not ended");

        uint256 totalVotes = supportWeight[id] + againstWeight[id];
        if (totalVotes < quorum) {
            r.status = ResolutionStatus.Rejected;
        } else {
            uint256 supportBps = totalVotes == 0 ? 0 : (supportWeight[id] * 10000) / totalVotes;
            r.status = supportBps >= passRatioBps ? ResolutionStatus.Passed : ResolutionStatus.Rejected;
        }
        emit OutcomeFinalized(id, r.status);
    }

    function closeEarly(uint256 id) external {
        Resolution storage r = resolutions[id];
        require(r.status == ResolutionStatus.Active, "not active");
        require(block.timestamp < r.endTime, "already ended");
        require(msg.sender == r.proposer || msg.sender == owner, "not authorized");
        r.endTime = block.timestamp;
    }

    function executeResolution(uint256 id) external {
        Resolution storage r = resolutions[id];
        if (r.status == ResolutionStatus.Active && block.timestamp > r.endTime) {
            finalizeOutcome(id);
        }
        require(r.status == ResolutionStatus.Passed, "not passed");
        r.status = ResolutionStatus.Executed;
        treasury.disburseTo(r.token, r.recipient, r.amount, r.fromCrisisPool);
    }

    function abandon(uint256 id) external {
        Resolution storage r = resolutions[id];
        require(msg.sender == r.proposer || msg.sender == owner, "not authorized");
        require(r.status == ResolutionStatus.Active, "not active");
        r.status = ResolutionStatus.Cancelled;
        emit OutcomeFinalized(id, r.status);
    }

    function getEncryptedTallies(uint256 id) external view returns (euint32 encSupport, euint32 encAgainst) {
        return (_encSupport[id], _encAgainst[id]);
    }

    function grantDecryption(uint256 id, address viewer) external {
        Resolution storage r = resolutions[id];
        require(r.proposer == msg.sender, "not proposer");
        FHE.allow(_encSupport[id], viewer);
        FHE.allow(_encAgainst[id], viewer);
    }
}



