import { Program, AnchorProvider, web3, BN } from "@coral-xyz/anchor";
import { Buffer as BufferPolyfill } from "buffer";
import { Connection, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import type {
  ContentType,
  EducationLevel,
  MintedItem,
  StorageProtocol,
} from "../components/MintedItemsContext";
import { SOLANA_CONFIG, PROGRAM_ID_VALIDATED } from "../config/solana";

// Import the IDL (versioned in frontend for build compatibility)
import { IDL } from "../idl/virtualia";

interface MintRequest {
  title: string;
  description: string;
  uri: string;
  contentType: ContentType;
  year: string;
  institution: string;
  educationLevel: EducationLevel | string;
  knowledgeArea: string;
  knowledgeSubarea: string;
  storageProtocol: StorageProtocol;
}

export interface MintResponse {
  rewardLamports: number;
  mintAddress: string;
  metadataSignature: string;
}

interface ContentMetadata {
  title: string;
  description: string;
  uri: string;
  contentType: string;
  rewardLamports: BN;
}

// Virtualia program ID - loaded from configuration
const PROGRAM_ID = PROGRAM_ID_VALIDATED;

/**
 * Initialize the Virtualia program
 */
const getVirtualiaProgram = (connection: Connection, wallet: any): Program => {
  try {
    const provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });

    return new Program(IDL as any, PROGRAM_ID, provider);
  } catch (error) {
    console.error("Failed to initialize Virtualia program:", error);
    throw new Error("Failed to initialize blockchain connection");
  }
};

/**
 * Initialize user profile if it doesn't exist
 */
export const initializeUserProfile = async (
  connection: Connection,
  wallet: any
): Promise<string> => {
  try {
    if (!wallet || !wallet.publicKey) {
      throw new Error("Wallet not connected");
    }

    const program = getVirtualiaProgram(connection, wallet);
    const publicKey = wallet.publicKey;

    const [profilePda, bump] = PublicKey.findProgramAddressSync(
      [BufferPolyfill.from("profile"), publicKey.toBuffer()],
      PROGRAM_ID
    );

    try {
      // Check if profile already exists
      await program.account.profile.fetch(profilePda);
      return profilePda.toBase58(); // Already exists
    } catch {
      // Profile doesn't exist, initialize it
      const tx = await program.methods
        .initializeUser(bump)
        .accounts({
          authority: publicKey,
          profile: profilePda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      return profilePda.toBase58();
    }
  } catch (error) {
    console.error("Failed to initialize user profile:", error);
    throw new Error("Failed to initialize user profile on blockchain");
  }
};

/**
 * Mint content on the Solana blockchain
 */
export const mintContent = async (
  connection: Connection,
  wallet: any,
  payload: MintRequest
): Promise<MintResponse> => {
  // Check if using System Program (placeholder) - use mock instead
  if (PROGRAM_ID.toBase58() === "11111111111111111111111111111111") {
    console.warn("⚠️ Using mock mint - Deploy contract and update VITE_VIRTUALIA_PROGRAM_ID");
    return mintContentMockInternal(connection, wallet, payload);
  }

  try {
    if (!wallet || !wallet.publicKey) {
      throw new Error("Wallet not connected");
    }

    const program = getVirtualiaProgram(connection, wallet);
    const publicKey = wallet.publicKey;

    // Ensure user profile exists
    await initializeUserProfile(connection, wallet);

    // Get profile account to determine the next content index
    const [profilePda] = PublicKey.findProgramAddressSync(
      [BufferPolyfill.from("profile"), publicKey.toBuffer()],
      PROGRAM_ID
    );

    const profileAccount = await program.account.profile.fetch(profilePda);
    const currentTotalMints = (profileAccount.totalMints as any).toNumber();

    // Generate content PDA
    const [contentPda] = PublicKey.findProgramAddressSync(
      [
        BufferPolyfill.from("content"),
        publicKey.toBuffer(),
        new BN(currentTotalMints).toArrayLike(BufferPolyfill, "le", 8)
      ],
      PROGRAM_ID
    );

    // Prepare metadata
    const metadata: ContentMetadata = {
      title: payload.title,
      description: payload.description,
      uri: payload.uri,
      contentType: payload.contentType,
      rewardLamports: new BN(1_000_000), // 0.001 SOL reward
    };

    // Mint the content
    const txSignature = await program.methods
      .mintContent(metadata)
      .accounts({
        authority: publicKey,
        profile: profilePda,
        content: contentPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return {
      rewardLamports: metadata.rewardLamports.toNumber(),
      mintAddress: contentPda.toBase58(),
      metadataSignature: txSignature,
    };
  } catch (error) {
    console.error("Failed to mint content:", error);
    throw new Error(`Failed to mint content on blockchain: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Fetch all minted content for the connected wallet from on-chain PDAs.
 */
export const fetchMintedContent = async (
  connection: Connection,
  wallet: any
): Promise<MintedItem[]> => {
  if (!wallet || !wallet.publicKey) {
    throw new Error("Wallet not connected");
  }

  const program = getVirtualiaProgram(connection, wallet);
  const publicKey = wallet.publicKey;

  const [profilePda] = PublicKey.findProgramAddressSync(
   [BufferPolyfill.from("profile"), publicKey.toBuffer()],
    PROGRAM_ID
  );

  let profileAccount: any;
  try {
    profileAccount = (await program.account.profile.fetch(profilePda)) as any;
  } catch (error) {
    console.warn("Profile account not found for wallet, skipping on-chain fetch", error);
    return [];
  }

  const totalMints = (profileAccount.totalMints as BN).toNumber();
  if (!Number.isFinite(totalMints) || totalMints <= 0) {
    return [];
  }

  const items: MintedItem[] = [];

  for (let index = 0; index < totalMints; index += 1) {
    const [contentPda] = PublicKey.findProgramAddressSync(
      [
        BufferPolyfill.from("content"),
        publicKey.toBuffer(),
        new BN(index).toArrayLike(BufferPolyfill, "le", 8)
      ],
      PROGRAM_ID
    );

    try {
      const contentAccount = (await program.account.content.fetch(contentPda)) as any;

      const rewardLamports = new BN(contentAccount.rewardLamports ?? 0).toNumber();
      const createdAtSeconds = new BN(contentAccount.createdAt ?? 0).toNumber();
      const ownerAddress = new PublicKey(contentAccount.owner).toBase58();
      const uri: string = typeof contentAccount.uri === "string" ? contentAccount.uri : "";

      const inferredProtocol: StorageProtocol = uri.startsWith("ipfs://")
        ? "ipfs"
        : uri.includes("arweave")
        ? "arweave"
        : "ipfs";

      const mintedAtIso = createdAtSeconds > 0
        ? new Date(createdAtSeconds * 1000).toISOString()
        : new Date().toISOString();

      items.push({
        id: contentPda.toBase58(),
        title: typeof contentAccount.title === "string" ? contentAccount.title : "Untitled",
        description: typeof contentAccount.description === "string" ? contentAccount.description : "",
        contentType: (typeof contentAccount.contentType === "string"
          ? contentAccount.contentType
          : "outro") as ContentType,
        uri,
        reward: rewardLamports / LAMPORTS_PER_SOL,
        ownerAddress,
        mintedAt: mintedAtIso,
        year: "",
        institution: "",
        educationLevel: "outro",
        knowledgeArea: "",
        knowledgeSubarea: "",
        storageProtocol: inferredProtocol,
        mintAddress: contentPda.toBase58(),
        metadataSignature: "",
      });
    } catch (error) {
      console.warn(`Failed to fetch content PDA at index ${index}`, error);
    }
  }

  return items;
};

/**
 * Internal mock function for testing without deployed contract
 * This is called automatically by mintContent when Program ID is placeholder
 */
const mintContentMockInternal = async (
  _connection: Connection,
  wallet: any,
  payload: MintRequest
): Promise<MintResponse> => {
  if (!wallet || !wallet.publicKey) {
    throw new Error("Wallet not connected");
  }
  
  await new Promise((resolve) => setTimeout(resolve, 1200));
  const simulatedReward = 0.02 + Math.random() * 0.03;
  const rewardLamports = simulatedReward * 1_000_000_000;
  const mintAddress = `Mock${Array.from({ length: 3 })
    .map(() => Math.random().toString(36).slice(2, 12))
    .join("")
    .slice(0, 32)}`;
  const metadataSignature = `MockSig${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;

  return {
    rewardLamports,
    mintAddress,
    metadataSignature,
  };
};
