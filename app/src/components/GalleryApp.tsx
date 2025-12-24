import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useAccount } from 'wagmi';
import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { ethers } from 'ethers';

import { CONTRACT_ABI, CONTRACT_ADDRESS } from '../config/contracts';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { decryptIpfsHash, encryptIpfsHash, formatTimestamp, generateIpfsHash } from '../utils/crypto';
import { Header } from './Header';
import '../styles/GalleryApp.css';

const SEPOLIA_RPC = '';

type StoredFile = {
  index: number;
  name: string;
  encryptedHash: string;
  encryptedKey: string;
  timestamp: bigint;
  decryptedHash?: string;
  isDecrypting?: boolean;
  decryptError?: string;
};

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export function GalleryApp() {
  const { address, isConnected } = useAccount();
  const signerPromise = useEthersSigner();
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [ipfsHash, setIpfsHash] = useState('');
  const [isGeneratingHash, setIsGeneratingHash] = useState(false);
  const [isStoring, setIsStoring] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [files, setFiles] = useState<StoredFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const publicClient = useMemo(
    () =>
      createPublicClient({
        chain: sepolia,
        transport: http(SEPOLIA_RPC),
      }),
    [],
  );

  const isContractUnset = CONTRACT_ADDRESS.toLowerCase() === ZERO_ADDRESS;

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedFile]);

  const resetUploadState = () => {
    setSelectedFile(null);
    setIpfsHash('');
    setStatusMessage(null);
    setErrorMessage(null);
  };

  const refreshFiles = useCallback(async () => {
    if (!address || isContractUnset) {
      setFiles([]);
      return;
    }

    setIsLoadingFiles(true);
    setLoadError(null);
    try {
      const count = (await publicClient.readContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: CONTRACT_ABI,
        functionName: 'fileCount',
        args: [address],
      })) as bigint;

      const total = Number(count);
      const records: StoredFile[] = [];
      for (let i = 0; i < total; i += 1) {
        const record = (await publicClient.readContract({
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: CONTRACT_ABI,
          functionName: 'getFile',
          args: [address, BigInt(i)],
        })) as [string, string, string, bigint];

        records.push({
          index: i,
          name: record[0],
          encryptedHash: record[1],
          encryptedKey: record[2],
          timestamp: record[3],
        });
      }
      setFiles(records);
    } catch (error) {
      console.error('Failed to load files:', error);
      setLoadError('Unable to read on-chain files. Check the contract address.');
    } finally {
      setIsLoadingFiles(false);
    }
  }, [address, isContractUnset, publicClient]);

  useEffect(() => {
    if (!address) {
      setFiles([]);
      return;
    }
    refreshFiles();
  }, [address, refreshFiles]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setIpfsHash('');
    setStatusMessage(null);
    setErrorMessage(null);
  };

  const handleGenerateHash = async () => {
    if (!selectedFile) {
      setErrorMessage('Select a file first.');
      return;
    }
    setIsGeneratingHash(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const hash = generateIpfsHash();
      setIpfsHash(hash);
      setStatusMessage('Pseudo IPFS hash generated.');
    } catch (error) {
      console.error('Failed to generate hash:', error);
      setErrorMessage('Unable to generate an IPFS hash.');
    } finally {
      setIsGeneratingHash(false);
    }
  };

  const handleStore = async () => {
    if (isContractUnset) {
      setErrorMessage('Contract address not configured yet.');
      return;
    }
    if (!selectedFile) {
      setErrorMessage('Select a file first.');
      return;
    }
    if (!ipfsHash) {
      setErrorMessage('Generate a pseudo IPFS hash first.');
      return;
    }
    if (!isConnected || !address) {
      setErrorMessage('Connect your wallet to store a file.');
      return;
    }
    if (!instance) {
      setErrorMessage('Encryption service is still loading.');
      return;
    }

    setIsStoring(true);
    setErrorMessage(null);
    setStatusMessage('Encrypting and preparing transaction...');

    try {
      if (!signerPromise) {
        throw new Error('Wallet signer not available');
      }
      const signer = await signerPromise;

      const keyWallet = ethers.Wallet.createRandom();
      const encryptedHash = await encryptIpfsHash(ipfsHash, keyWallet.address);

      const encryptedInput = await instance
        .createEncryptedInput(CONTRACT_ADDRESS, address)
        .addAddress(keyWallet.address)
        .encrypt();

      const galleryContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await galleryContract.storeFile(
        selectedFile.name,
        encryptedHash,
        encryptedInput.handles[0],
        encryptedInput.inputProof,
      );
      setStatusMessage('Waiting for confirmation...');
      await tx.wait();

      setStatusMessage('Stored on-chain. Refreshing vault...');
      await refreshFiles();
      resetUploadState();
    } catch (error) {
      console.error('Failed to store file:', error);
      setErrorMessage('Failed to store the file on-chain.');
    } finally {
      setIsStoring(false);
    }
  };

  const handleDecrypt = async (record: StoredFile) => {
    if (!instance) {
      setErrorMessage('Encryption service is still loading.');
      return;
    }
    if (!signerPromise || !address) {
      setErrorMessage('Connect your wallet to decrypt.');
      return;
    }

    setFiles((prev) =>
      prev.map((item) =>
        item.index === record.index
          ? { ...item, isDecrypting: true, decryptError: undefined }
          : item,
      ),
    );

    try {
      const signer = await signerPromise;
      const keypair = instance.generateKeypair();
      const handles = [{ handle: record.encryptedKey, contractAddress: CONTRACT_ADDRESS }];
      const startTimeStamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = '3';
      const contractAddresses = [CONTRACT_ADDRESS];
      const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, startTimeStamp, durationDays);
      const signature = await signer.signTypedData(
        eip712.domain,
        { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
        eip712.message,
      );

      const result = await instance.userDecrypt(
        handles,
        keypair.privateKey,
        keypair.publicKey,
        signature.replace('0x', ''),
        contractAddresses,
        address,
        startTimeStamp,
        durationDays,
      );

      const decryptedKey = String(result[record.encryptedKey]);
      const clearHash = await decryptIpfsHash(record.encryptedHash, decryptedKey);

      setFiles((prev) =>
        prev.map((item) =>
          item.index === record.index
            ? { ...item, decryptedHash: clearHash, isDecrypting: false }
            : item,
        ),
      );
    } catch (error) {
      console.error('Failed to decrypt file:', error);
      setFiles((prev) =>
        prev.map((item) =>
          item.index === record.index
            ? { ...item, isDecrypting: false, decryptError: 'Decryption failed.' }
            : item,
        ),
      );
    }
  };

  return (
    <div className="gallery-app">
      <Header />

      <main className="gallery-main">
        <section className="hero">
          <div className="hero-copy">
            <p className="hero-eyebrow">Encrypted media ledger</p>
            <h2>Seal your IPFS hashes, reveal them only with your key.</h2>
            <p className="hero-subtitle">
              Files stay local. The chain only sees encrypted metadata and a Zama-protected unlock address.
            </p>
            <div className="hero-tags">
              <span>Local encryption</span>
              <span>FHE address vault</span>
              <span>Sepolia ready</span>
            </div>
          </div>
          <div className="hero-panel">
            <div className="hero-panel-inner">
              <p className="panel-label">System status</p>
              <div className="status-row">
                <span>Wallet</span>
                <strong>{isConnected ? 'Connected' : 'Not connected'}</strong>
              </div>
              <div className="status-row">
                <span>Encryption</span>
                <strong>{zamaLoading ? 'Loading' : zamaError ? 'Error' : 'Ready'}</strong>
              </div>
              <div className="status-row">
                <span>Contract</span>
                <strong>{isContractUnset ? 'Not set' : 'Ready'}</strong>
              </div>
              {zamaError && <p className="status-note">{zamaError}</p>}
            </div>
          </div>
        </section>

        <section className="grid">
          <div className="panel upload">
            <div className="panel-header">
              <h3>Upload & Encrypt</h3>
              <p>Pick a file, generate a pseudo IPFS hash, and push encrypted metadata on-chain.</p>
            </div>

            <label className="file-drop">
              <input type="file" accept="image/*,video/*" onChange={handleFileChange} />
              <div className="file-drop-inner">
                <span className="file-drop-title">Choose an image or video</span>
                <span className="file-drop-subtitle">We never upload the file itself.</span>
              </div>
            </label>

            {selectedFile && (
              <div className="file-preview">
                <div className="preview-media">
                  {previewUrl &&
                    (selectedFile.type.startsWith('video') ? (
                      <video src={previewUrl} controls />
                    ) : (
                      <img src={previewUrl} alt={selectedFile.name} />
                    ))}
                </div>
                <div className="preview-meta">
                  <div>
                    <p className="meta-label">File name</p>
                    <p className="meta-value">{selectedFile.name}</p>
                  </div>
                  <div>
                    <p className="meta-label">Size</p>
                    <p className="meta-value">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
              </div>
            )}

            <div className="action-row">
              <button type="button" className="secondary" onClick={handleGenerateHash} disabled={isGeneratingHash}>
                {isGeneratingHash ? 'Generating...' : 'Generate IPFS Hash'}
              </button>
              <button type="button" onClick={handleStore} disabled={isStoring}>
                {isStoring ? 'Storing...' : 'Encrypt & Store'}
              </button>
            </div>

            {ipfsHash && (
              <div className="hash-card">
                <p className="meta-label">Pseudo IPFS hash</p>
                <p className="hash-value">{ipfsHash}</p>
              </div>
            )}

            {(statusMessage || errorMessage) && (
              <div className={`notice ${errorMessage ? 'error' : 'info'}`}>
                {errorMessage ?? statusMessage}
              </div>
            )}
          </div>

          <div className="panel vault">
            <div className="panel-header">
              <h3>Your Vault</h3>
              <p>Stored file metadata with encrypted access keys. Decrypt to reveal the hash.</p>
            </div>

            <div className="vault-controls">
              <button type="button" className="secondary" onClick={refreshFiles} disabled={isLoadingFiles}>
                {isLoadingFiles ? 'Refreshing...' : 'Refresh'}
              </button>
              {loadError && <span className="inline-error">{loadError}</span>}
            </div>

            <div className="vault-list">
              {!isConnected && <p className="empty-state">Connect your wallet to view stored files.</p>}
              {isConnected && files.length === 0 && !isLoadingFiles && (
                <p className="empty-state">No files stored yet. Add your first encrypted record.</p>
              )}

              {files.map((record) => (
                <div key={record.index} className="vault-card">
                  <div className="vault-card-header">
                    <div>
                      <p className="meta-label">File name</p>
                      <p className="meta-value">{record.name}</p>
                    </div>
                    <div>
                      <p className="meta-label">Timestamp</p>
                      <p className="meta-value">{formatTimestamp(record.timestamp)}</p>
                    </div>
                  </div>
                  <div className="vault-card-body">
                    <p className="meta-label">Encrypted hash</p>
                    <p className="hash-value">{record.encryptedHash}</p>
                  </div>
                  <div className="vault-card-actions">
                    <button
                      type="button"
                      onClick={() => handleDecrypt(record)}
                      disabled={record.isDecrypting}
                    >
                      {record.isDecrypting ? 'Decrypting...' : 'Decrypt Hash'}
                    </button>
                    {record.decryptedHash && (
                      <span className="decrypted-hash">{record.decryptedHash}</span>
                    )}
                    {record.decryptError && <span className="inline-error">{record.decryptError}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
