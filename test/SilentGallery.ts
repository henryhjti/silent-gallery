import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { SilentGallery, SilentGallery__factory } from "../types";
import { expect } from "chai";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("SilentGallery")) as SilentGallery__factory;
  const gallery = (await factory.deploy()) as SilentGallery;
  const galleryAddress = await gallery.getAddress();

  return { gallery, galleryAddress };
}

describe("SilentGallery", function () {
  let signers: Signers;
  let gallery: SilentGallery;
  let galleryAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ gallery, galleryAddress } = await deployFixture());
  });

  it("stores and retrieves a file record", async function () {
    const name = "sunset.png";
    const encryptedHash = "v1:iv:ciphertext";
    const clearKey = "0x1000000000000000000000000000000000000001";

    const encryptedKey = await fhevm
      .createEncryptedInput(galleryAddress, signers.alice.address)
      .addAddress(clearKey)
      .encrypt();

    const tx = await gallery
      .connect(signers.alice)
      .storeFile(name, encryptedHash, encryptedKey.handles[0], encryptedKey.inputProof);
    await tx.wait();

    const count = await gallery.fileCount(signers.alice.address);
    expect(count).to.eq(1n);

    const record = await gallery.getFile(signers.alice.address, 0);
    expect(record[0]).to.eq(name);
    expect(record[1]).to.eq(encryptedHash);
    expect(record[2]).to.not.eq(ethers.ZeroHash);
    expect(record[3]).to.be.gt(0);
  });
});
