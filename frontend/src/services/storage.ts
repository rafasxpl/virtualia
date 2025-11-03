import type { StorageProtocol } from "../components/MintedItemsContext";

export interface UploadResult {
  uri: string;
  filename: string;
  protocol: StorageProtocol;
}

const PINATA_ENDPOINT = "https://api.pinata.cloud/pinning/pinFileToIPFS";

const resolvePinataJwt = (): string | undefined => {
  console.log("🔍 Resolving Pinata JWT...");
  console.log("🔍 import.meta.env:", import.meta.env);
  console.log("🔍 Type of import.meta.env:", typeof import.meta.env);
  
  const env = import.meta.env as Record<string, string | undefined>;
  const jwt = env.VITE_PINATA_JWT;
  
  console.log("🔍 VITE_PINATA_JWT value:", jwt ? `${jwt.substring(0, 20)}...` : "undefined");
  console.log("🔍 All VITE_ keys:", Object.keys(env).filter(k => k.startsWith("VITE_")));
  
  // Debug log (remove in production)
  if (!jwt) {
    console.error("❌ VITE_PINATA_JWT not found in environment");
    console.log("Available env vars:", Object.keys(env).filter(k => k.startsWith("VITE_")));
  } else {
    console.log("✅ PINATA_JWT loaded successfully");
  }
  
  return jwt;
};

const createPinataFormData = (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append(
    "pinataMetadata",
    JSON.stringify({
      name: file.name,
      keyvalues: {
        uploadedBy: "virtualia-frontend",
      },
    })
  );
  return formData;
};

export const uploadToDecentralizedStorage = async (
  file: File,
  protocol: StorageProtocol
): Promise<UploadResult> => {
  // Currently only IPFS is implemented
  if (protocol === "arweave") {
    throw new Error("Arweave upload not yet implemented. Please use IPFS.");
  }

  const pinataJwt = resolvePinataJwt();
  if (!pinataJwt) {
    throw new Error("PINATA_JWT não configurado. Defina VITE_PINATA_JWT no arquivo .env.");
  }

  const body = createPinataFormData(file);

  const response = await fetch(PINATA_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${pinataJwt}`,
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Erro desconhecido no Pinata.");
    throw new Error(`Falha ao enviar arquivo: ${response.status} - ${errorText}`);
  }

  const payload: { IpfsHash: string } = await response.json();

  return {
    uri: `ipfs://${payload.IpfsHash}`,
    filename: file.name,
    protocol,
  };
};
