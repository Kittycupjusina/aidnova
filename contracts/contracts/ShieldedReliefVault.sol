// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, euint32, externalEuint64, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

// FHE vault with two encrypted pools and a per-user memo
contract ShieldedReliefVault is SepoliaConfig {
    euint64 private _encStandardTotal;
    euint64 private _encCrisisTotal;
    mapping(address => euint32) private _userMemo;

    function viewEncryptedStandardTotal() external view returns (euint64) {
        return _encStandardTotal;
    }

    function viewEncryptedCrisisTotal() external view returns (euint64) {
        return _encCrisisTotal;
    }

    function viewEncryptedUserMemo(address user) external view returns (euint32) {
        return _userMemo[user];
    }

    function accumulateStandard(externalEuint64 valueExt, bytes calldata inputProof) external {
        euint64 value = FHE.fromExternal(valueExt, inputProof);
        _encStandardTotal = FHE.add(_encStandardTotal, value);
        FHE.allowThis(_encStandardTotal);
        FHE.allow(_encStandardTotal, msg.sender);
    }

    function accumulateCrisis(externalEuint64 valueExt, bytes calldata inputProof) external {
        euint64 value = FHE.fromExternal(valueExt, inputProof);
        _encCrisisTotal = FHE.add(_encCrisisTotal, value);
        FHE.allowThis(_encCrisisTotal);
        FHE.allow(_encCrisisTotal, msg.sender);
    }

    function saveMyEncryptedMemo(externalEuint32 noteExt, bytes calldata inputProof) external {
        euint32 note = FHE.fromExternal(noteExt, inputProof);
        _userMemo[msg.sender] = note;
        FHE.allowThis(_userMemo[msg.sender]);
        FHE.allow(_userMemo[msg.sender], msg.sender);
    }
}



