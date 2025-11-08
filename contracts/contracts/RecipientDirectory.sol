// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract RecipientDirectory {
    address public owner;
    mapping(address => bool) public approved;
    mapping(address => string) public profileCID;

    event RecipientEnrolled(address indexed recipient, string profileCID);
    event RecipientApprovalUpdated(address indexed recipient, bool approved);

    modifier onlyOwner() { require(msg.sender == owner, "Not owner"); _; }

    constructor() { owner = msg.sender; }

    function enrollRecipient(address recipient, string calldata _profileCID) external {
        require(recipient != address(0), "invalid");
        profileCID[recipient] = _profileCID;
        emit RecipientEnrolled(recipient, _profileCID);
    }

    function updateRecipientApproval(address recipient, bool isApproved) external onlyOwner {
        approved[recipient] = isApproved;
        emit RecipientApprovalUpdated(recipient, isApproved);
    }
}



