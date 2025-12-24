// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, eaddress, externalEaddress} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title SilentGallery
/// @notice Stores file metadata with encrypted access keys on-chain.
contract SilentGallery is ZamaEthereumConfig {
    struct FileRecord {
        string name;
        string encryptedHash;
        eaddress encryptedKey;
        uint256 timestamp;
    }

    mapping(address => FileRecord[]) private files;

    event FileStored(address indexed owner, uint256 indexed index, string name, uint256 timestamp);

    /// @notice Store a file record for the sender.
    /// @param name File name to display.
    /// @param encryptedHash Encrypted IPFS hash produced off-chain.
    /// @param encryptedKey Encrypted address used to decrypt the hash.
    /// @param inputProof Zama input proof for encryptedKey.
    function storeFile(
        string calldata name,
        string calldata encryptedHash,
        externalEaddress encryptedKey,
        bytes calldata inputProof
    ) external {
        require(bytes(name).length > 0, "Name required");
        require(bytes(encryptedHash).length > 0, "Encrypted hash required");

        eaddress key = FHE.fromExternal(encryptedKey, inputProof);
        FHE.allowThis(key);
        FHE.allow(key, msg.sender);

        files[msg.sender].push(
            FileRecord({
                name: name,
                encryptedHash: encryptedHash,
                encryptedKey: key,
                timestamp: block.timestamp
            })
        );

        emit FileStored(msg.sender, files[msg.sender].length - 1, name, block.timestamp);
    }

    /// @notice Return how many files an owner has stored.
    function fileCount(address owner) external view returns (uint256) {
        return files[owner].length;
    }

    /// @notice Return a file record at a given index.
    function getFile(
        address owner,
        uint256 index
    ) external view returns (string memory, string memory, eaddress, uint256) {
        require(index < files[owner].length, "Index out of bounds");

        FileRecord storage record = files[owner][index];
        return (record.name, record.encryptedHash, record.encryptedKey, record.timestamp);
    }
}
