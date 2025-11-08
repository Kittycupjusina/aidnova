// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract ReliefTreasury is ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    address public council; // authorized governance contract
    address public owner;

    mapping(address => uint256) public balances;
    mapping(address => uint256) public crisisBalances;

    event ContributionReceived(address indexed contributor, address indexed token, uint256 amount, bool crisis);
    event FundsSent(address indexed token, address indexed beneficiary, uint256 amount);
    event CouncilUpdated(address indexed council);

    modifier onlyOwner() { require(msg.sender == owner, "Not owner"); _; }
    modifier onlyCouncil() { require(msg.sender == council, "Not council"); _; }

    constructor(address _owner) {
        require(_owner != address(0), "invalid owner");
        owner = _owner;
    }

    function setCouncil(address _council) external onlyOwner {
        require(_council != address(0), "invalid council");
        council = _council;
        emit CouncilUpdated(_council);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // token = address(0) for ETH
    function contribute(address token, uint256 amount, bool crisis) external payable whenNotPaused nonReentrant {
        if (token == address(0)) {
            require(msg.value > 0, "no eth");
            amount = msg.value;
        } else {
            require(amount > 0, "no amount");
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        }

        if (crisis) {
            crisisBalances[token] += amount;
        } else {
            balances[token] += amount;
        }

        emit ContributionReceived(msg.sender, token, amount, crisis);
    }

    function queryBalances(address token) external view returns (uint256 normal, uint256 crisis) {
        return (balances[token], crisisBalances[token]);
    }

    // Only callable by Council after resolution passed
    function disburseTo(address token, address to, uint256 amount, bool fromCrisis)
        external
        onlyCouncil
        whenNotPaused
        nonReentrant
    {
        require(to != address(0), "invalid to");
        if (fromCrisis) {
            require(crisisBalances[token] >= amount, "insufficient crisis");
            crisisBalances[token] -= amount;
        } else {
            require(balances[token] >= amount, "insufficient balance");
            balances[token] -= amount;
        }

        if (token == address(0)) {
            (bool ok, ) = to.call{value: amount}("");
            require(ok, "eth transfer failed");
        } else {
            IERC20(token).safeTransfer(to, amount);
        }

        emit FundsSent(token, to, amount);
    }
}



