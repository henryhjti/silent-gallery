import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm, deployments } from "hardhat";
import { SilentGallery } from "../types";
import { expect } from "chai";

type Signers = {
  alice: HardhatEthersSigner;
};

describe("SilentGallerySepolia", function () {
  let signers: Signers;
  let gallery: SilentGallery;
  let galleryAddress: string;
  let step: number;
  let steps: number;

  function progress(message: string) {
    console.log(`${++step}/${steps} ${message}`);
  }

  before(async function () {
    if (fhevm.isMock) {
      console.warn(`This hardhat test suite can only run on Sepolia Testnet`);
      this.skip();
    }

    try {
      const deployment = await deployments.get("SilentGallery");
      galleryAddress = deployment.address;
      gallery = await ethers.getContractAt("SilentGallery", deployment.address);
    } catch (e) {
      (e as Error).message += ". Call 'npx hardhat deploy --network sepolia'";
      throw e;
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { alice: ethSigners[0] };
  });

  beforeEach(async () => {
    step = 0;
    steps = 0;
  });

  it("stores a file and verifies count on Sepolia", async function () {
    steps = 6;
    this.timeout(4 * 40000);

    const name = `sepolia-${Date.now()}.png`;
    const encryptedHash = "v1:iv:ciphertext";
    const clearKey = "0x1000000000000000000000000000000000000002";

    progress("Encrypting file key...");
    const encryptedKey = await fhevm
      .createEncryptedInput(galleryAddress, signers.alice.address)
      .addAddress(clearKey)
      .encrypt();

    progress("Reading current file count...");
    const beforeCount = await gallery.fileCount(signers.alice.address);

    progress(`Calling storeFile() on ${galleryAddress}...`);
    const tx = await gallery
      .connect(signers.alice)
      .storeFile(name, encryptedHash, encryptedKey.handles[0], encryptedKey.inputProof);
    await tx.wait();

    progress("Reading updated file count...");
    const afterCount = await gallery.fileCount(signers.alice.address);

    progress("Reading stored file...");
    const record = await gallery.getFile(signers.alice.address, afterCount - 1n);

    expect(afterCount).to.eq(beforeCount + 1n);
    expect(record[0]).to.eq(name);
    expect(record[1]).to.eq(encryptedHash);
  });
});
