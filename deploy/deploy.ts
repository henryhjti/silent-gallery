import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedGallery = await deploy("SilentGallery", {
    from: deployer,
    log: true,
  });

  console.log(`SilentGallery contract: `, deployedGallery.address);
};
export default func;
func.id = "deploy_silent_gallery"; // id required to prevent reexecution
func.tags = ["SilentGallery"];
