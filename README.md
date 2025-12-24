# Silent Gallery

Silent Gallery is a privacy-first media library that lets users manage local images and videos while keeping content
references confidential on-chain. It uses Zama FHEVM to store encrypted metadata, so the IPFS hash and the encryption
key never appear in plaintext on the blockchain. The current implementation uses a pseudo IPFS upload that returns a
random hash to simulate a real IPFS pipeline.

## Overview

Silent Gallery targets a common privacy gap in decentralized storage: the IPFS hash itself reveals the content and can
be correlated across users. By encrypting the hash and the key material before persisting anything on-chain, the system
reduces metadata leakage while preserving usability.

## Problems Solved

- Prevents plaintext IPFS hashes from leaking content pointers on-chain.
- Keeps file linkage private even if the chain state is fully public.
- Avoids centralized custody of encryption keys.
- Keeps the user workflow simple while still using strong cryptography.

## Key Advantages

- End-to-end confidentiality for content pointers and keys.
- On-chain storage remains useful without revealing file contents.
- Client-side generation of the encryption address avoids shared secrets.
- Clear separation between storage, encryption, and presentation layers.
- Works with standard wallets and a familiar web experience.

## How It Works

1. The user selects a local image or video in the frontend.
2. The file is pseudo-uploaded to IPFS to obtain a random IPFS hash.
3. The frontend generates a random EVM address A locally.
4. The IPFS hash is encrypted using A, producing an encrypted hash.
5. The filename, encrypted hash, and the Zama-encrypted address A are stored on-chain.
6. When listing files, the frontend reads all on-chain entries for the user.
7. On request, the encrypted address A is decrypted, which enables decrypting the IPFS hash.

## Architecture

- Smart contracts store encrypted metadata only.
- The frontend handles local file selection, pseudo IPFS upload, encryption, and decryption.
- The Zama FHEVM stack provides encrypted storage and authorized decryption.
- Wallets sign transactions for write operations; reads use a lightweight client path.

## Tech Stack

- Solidity smart contracts on Hardhat
- Zama FHEVM protocol
- React + Vite frontend (no Tailwind)
- viem for read calls
- ethers for write calls
- RainbowKit for wallet UX
- IPFS (pseudo upload for now)

## Repository Structure

```
app/             Frontend (React + Vite)
contracts/       Smart contract source files
deploy/          Deployment scripts
deployments/     Network deployments and contract ABIs
docs/            Zama and project notes
tasks/           Hardhat tasks
test/            Contract tests
```

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Install Dependencies

```bash
npm install
```

### Compile and Test

```bash
npm run compile
npm run test
```

### Configure Environment for Deployment

Create a `.env` file in the repository root and define:

```bash
INFURA_API_KEY=your_infura_key
PRIVATE_KEY=your_private_key
ETHERSCAN_API_KEY=your_etherscan_key
```

Notes:
- Deployment uses a private key only. Do not use a mnemonic.
- Hardhat loads the variables via `dotenv`.

### Deploy Locally

```bash
npx hardhat node
npx hardhat deploy --network localhost
```

### Deploy to Sepolia

```bash
npx hardhat deploy --network sepolia
npx hardhat verify --network sepolia <CONTRACT_ADDRESS>
```

### Run Tests on Sepolia

```bash
npx hardhat test --network sepolia
```

## Frontend Usage

1. Open the frontend in `app/` and start the Vite dev server.
2. Connect a wallet on Sepolia.
3. Select a local image or video to upload.
4. View the stored items, then decrypt to reveal the IPFS hash.

Notes:
- The frontend does not use localhost networks and does not persist state in local storage.
- Contract ABIs used by the frontend must be sourced from `deployments/sepolia`.

## Data Model

For each file, the system persists:

- `filename` in plaintext (UI label only)
- `encrypted_ipfs_hash`
- `encrypted_address_a` (Zama encrypted)

The original IPFS hash is only recoverable after decrypting `encrypted_address_a` and then decrypting the hash.

## Security and Privacy Notes

- Only encrypted metadata is stored on-chain.
- The IPFS hash is never public in plaintext.
- The encryption address A is generated locally per file.
- The pseudo IPFS upload is a placeholder and should be replaced by a real IPFS integration in production.

## Roadmap

- Replace pseudo IPFS with real pinning and retry logic.
- Add file previews that never expose plaintext hashes unless explicitly decrypted.
- Batch operations for encrypt, upload, and store.
- Granular access sharing using re-encryption workflows.
- UX improvements for large files and video streaming.

## License

BSD-3-Clause-Clear. See `LICENSE`.
