import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'Silent Gallery',
  projectId: 'SILENT_GALLERY_PROJECT_ID', // Replace with your WalletConnect project ID.
  chains: [sepolia],
  ssr: false,
});
