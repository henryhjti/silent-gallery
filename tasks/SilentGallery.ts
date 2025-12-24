import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

/**
 * Examples:
 *   - npx hardhat --network sepolia task:gallery-address
 *   - npx hardhat --network localhost task:gallery-store --name photo.png --hash v1:iv:cipher
 *   - npx hardhat --network localhost task:gallery-list
 */

task("task:gallery-address", "Prints the SilentGallery address").setAction(async function (_taskArgs: TaskArguments, hre) {
  const { deployments } = hre;
  const deployment = await deployments.get("SilentGallery");
  console.log(`SilentGallery address is ${deployment.address}`);
});

task("task:gallery-store", "Stores a file record in SilentGallery")
  .addParam("name", "File name to store")
  .addParam("hash", "Encrypted IPFS hash string")
  .addOptionalParam("key", "Optional clear address used for encryption")
  .addOptionalParam("address", "Optionally specify the SilentGallery contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { deployments, ethers, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const deployment = taskArguments.address ? { address: taskArguments.address } : await deployments.get("SilentGallery");
    const gallery = await ethers.getContractAt("SilentGallery", deployment.address);
    const [signer] = await ethers.getSigners();

    const clearKey = taskArguments.key ?? ethers.Wallet.createRandom().address;

    const encryptedKey = await fhevm
      .createEncryptedInput(deployment.address, signer.address)
      .addAddress(clearKey)
      .encrypt();

    const tx = await gallery
      .connect(signer)
      .storeFile(taskArguments.name, taskArguments.hash, encryptedKey.handles[0], encryptedKey.inputProof);
    console.log(`Wait for tx:${tx.hash}...`);
    await tx.wait();

    console.log(`Stored file "${taskArguments.name}" with key ${clearKey}`);
  });

task("task:gallery-list", "Lists stored files for an owner")
  .addOptionalParam("owner", "Owner address (defaults to first signer)")
  .addOptionalParam("address", "Optionally specify the SilentGallery contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { deployments, ethers } = hre;

    const deployment = taskArguments.address ? { address: taskArguments.address } : await deployments.get("SilentGallery");
    const gallery = await ethers.getContractAt("SilentGallery", deployment.address);
    const [signer] = await ethers.getSigners();
    const owner = taskArguments.owner ?? signer.address;

    const count = await gallery.fileCount(owner);
    console.log(`File count for ${owner}: ${count}`);

    for (let i = 0; i < count; i += 1) {
      const record = await gallery.getFile(owner, i);
      console.log(`#${i} name=${record[0]} hash=${record[1]} key=${record[2]} timestamp=${record[3]}`);
    }
  });
