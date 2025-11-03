import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { v4 as uuid } from "uuid";
import {
  useMintedItems,
  ContentType,
  EducationLevel,
  StorageProtocol,
} from "./MintedItemsContext";
import { mintContent } from "../services/solana";
import { uploadToDecentralizedStorage, type UploadResult } from "../services/storage";
import { useLanguage } from "./LanguageContext";

interface MintFormProps {
  onMinted?: () => void;
}

const contentOptionDefinitions: {
  value: ContentType;
  label: { en: string; pt: string };
}[] = [
  { value: "artigo", label: { en: "Article", pt: "Artigo" } },
  { value: "resenha", label: { en: "Review", pt: "Resenha" } },
  { value: "tradução", label: { en: "Translation", pt: "Tradução" } },
  { value: "certificado", label: { en: "Certificate", pt: "Certificado" } },
  { value: "outro", label: { en: "Other", pt: "Outro" } },
];

const educationLevelOptionDefinitions: {
  value: EducationLevel | string;
  label: { en: string; pt: string };
}[] = [
  { value: "extensão", label: { en: "Extension", pt: "Extensão" } },
  { value: "graduação", label: { en: "Undergraduate", pt: "Graduação" } },
  { value: "pós-graduação", label: { en: "Graduate", pt: "Pós-graduação" } },
  { value: "pesquisa", label: { en: "Research", pt: "Pesquisa" } },
  { value: "outro", label: { en: "Other", pt: "Outro" } },
];

const storageOptions: { value: StorageProtocol; label: string }[] = [
  { value: "ipfs", label: "IPFS" },
  { value: "arweave", label: "Arweave" },
];

const TITLE_MAX_LENGTH = 64;
const DESCRIPTION_MAX_LENGTH = 240;
const URI_MAX_LENGTH = 128;

const translations = {
  en: {
    title: "Register a new work",
    description:
      "Upload papers, reviews, certificates, or extension projects to store them on IPFS/Arweave and register their on-chain metadata.",
    titleLabel: "Title",
    titlePlaceholder: "e.g. Introduction to Quantum Computing (max 64 characters)",
    descriptionLabel: "Description",
    descriptionPlaceholder: "Describe the content in up to 240 characters",
    categoryLabel: "Category",
    yearLabel: "Year of creation",
    yearPlaceholder: "2024",
    educationLabel: "Level",
    institutionLabel: "Institution",
    institutionPlaceholder: "Federal University of Paraná",
    knowledgeAreaLabel: "Knowledge area",
    knowledgeAreaPlaceholder: "Exact and Earth Sciences",
    knowledgeSubareaLabel: "Subarea",
    knowledgeSubareaPlaceholder: "Quantum Computing",
    storageLabel: "Storage protocol",
    uriLabel: "Link / IPFS",
    fileLabel: "Upload (optional)",
    fileHint: "The file will be sent to {protocol} and the link will be associated with the NFT.",
    submitIdle: "Register on Solana",
    submitLoading: "Minting...",
    connectWallet: "Connect your wallet to enable minting.",
    uploadPreparing: "Uploading to decentralized storage...",
    uploadSuccess: (protocol: string, filename: string) =>
      `Upload completed on ${protocol} (${filename})`,
    uploadError: "Failed to upload file. Please try again.",
    mintError: "Failed to mint. Check the console for details.",
    viewUploadedFile: "Open file",
  },
  pt: {
    title: "Registrar nova produção",
    description:
      "Faça o upload de artigos, resenhas, certificados ou projetos de extensão para armazená-los no IPFS/Arweave e registrar a metadata on-chain.",
    titleLabel: "Título",
    titlePlaceholder: "Ex.: Introdução à Computação Quântica (máx. 64 caracteres)",
    descriptionLabel: "Descrição",
    descriptionPlaceholder: "Contextualize o conteúdo em até 240 caracteres",
    categoryLabel: "Categoria",
    yearLabel: "Ano da produção",
    yearPlaceholder: "2024",
    educationLabel: "Nível",
    institutionLabel: "Instituição",
    institutionPlaceholder: "Universidade Federal do Paraná",
    knowledgeAreaLabel: "Área do conhecimento",
    knowledgeAreaPlaceholder: "Ciências Exatas e da Terra",
    knowledgeSubareaLabel: "Subárea",
    knowledgeSubareaPlaceholder: "Computação Quântica",
    storageLabel: "Protocolo de armazenamento",
    uriLabel: "Link/IPFS",
    fileLabel: "Upload (opcional)",
    fileHint: "O arquivo será enviado para o {protocol} e o link será associado ao NFT.",
    submitIdle: "Registrar na Solana",
    submitLoading: "Mintando...",
    connectWallet: "Conecte sua carteira para liberar o mint.",
    uploadPreparing: "Realizando upload descentralizado...",
    uploadSuccess: (protocol: string, filename: string) =>
      `Upload concluído no ${protocol} (${filename})`,
    uploadError: "Falha ao enviar arquivo. Tente novamente.",
    mintError: "Não foi possível mintar. Verifique o console para detalhes.",
    viewUploadedFile: "Abrir arquivo",
  },
} as const;

const resolveGatewayUrl = (uri: string): string => {
  if (uri.startsWith("ipfs://")) {
    return `https://gateway.pinata.cloud/ipfs/${uri.slice("ipfs://".length)}`;
  }
  return uri;
};

const MintForm = ({ onMinted }: MintFormProps) => {
  const wallet = useWallet();
  const { publicKey } = wallet;
  const { connection } = useConnection();
  const { addItem } = useMintedItems();
  const { language } = useLanguage();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [uri, setUri] = useState("");
  const [contentType, setContentType] = useState<ContentType>("artigo");
  const [year, setYear] = useState<string>("");
  const [institution, setInstitution] = useState("");
  const [knowledgeArea, setKnowledgeArea] = useState("");
  const [knowledgeSubarea, setKnowledgeSubarea] = useState("");
  const [educationLevel, setEducationLevel] = useState<EducationLevel | string>("extensão");
  const [storageProtocol, setStorageProtocol] = useState<StorageProtocol>("ipfs");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [uploadedFileInfo, setUploadedFileInfo] = useState<UploadResult | null>(null);

  const t = translations[language];

  const contentOptions = useMemo(
    () =>
      contentOptionDefinitions.map((option) => ({
        value: option.value,
        label: option.label[language],
      })),
    [language]
  );

  const educationLevelOptions = useMemo(
    () =>
      educationLevelOptionDefinitions.map((option) => ({
        value: option.value,
        label: option.label[language],
      })),
    [language]
  );

  const isDisabled = useMemo(
    () =>
      loading ||
      uploading ||
      !publicKey ||
      !title.trim() ||
      !uri.trim() || // URI is required (populated after file upload)
      !year.trim() ||
      !institution.trim() ||
      !knowledgeArea.trim() ||
      !knowledgeSubarea.trim(),
    [
      loading,
      uploading,
      publicKey,
      title,
      uri,
      year,
      institution,
      knowledgeArea,
      knowledgeSubarea,
    ]
  );

  useEffect(() => {
    setUploadStatus(null);
    setUploadedFileInfo(null);
  }, [storageProtocol, language]);

  const handleMint = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!publicKey) {
      return;
    }

    const sanitizedTitle = title.trim();
    const sanitizedDescription = description.trim();
    const sanitizedUri = uri.trim();

    if (
      sanitizedTitle.length > TITLE_MAX_LENGTH ||
      sanitizedDescription.length > DESCRIPTION_MAX_LENGTH ||
      sanitizedUri.length > URI_MAX_LENGTH
    ) {
      alert(
        language === "pt"
          ? "Título, descrição ou URI excedem o limite suportado on-chain (64/240/128 caracteres). Ajuste os campos antes de registrar."
          : "Title, description, or URI exceed the on-chain limit (64/240/128 characters). Please adjust before minting."
      );
      return;
    }

    try {
      setLoading(true);
      const { rewardLamports, mintAddress, metadataSignature } = await mintContent(
        connection,
        wallet,
        {
          title: sanitizedTitle,
          description: sanitizedDescription,
          uri: sanitizedUri,
          contentType,
          year,
          institution,
          educationLevel,
          knowledgeArea,
          knowledgeSubarea,
          storageProtocol,
        }
      );

      addItem({
        id: uuid(),
        title: sanitizedTitle,
        description: sanitizedDescription,
        uri: sanitizedUri,
        contentType,
        reward: rewardLamports / LAMPORTS_PER_SOL,
        ownerAddress: publicKey.toBase58(),
        mintedAt: new Date().toISOString(),
        year,
        institution,
        educationLevel,
        knowledgeArea,
        knowledgeSubarea,
        storageProtocol,
        mintAddress,
        metadataSignature,
      });

      setTitle("");
      setDescription("");
      setUri("");
      setContentType("artigo");
      setYear("");
      setInstitution("");
      setKnowledgeArea("");
      setKnowledgeSubarea("");
      setEducationLevel("extensão");
      setStorageProtocol("ipfs");
      onMinted?.();
    } catch (error) {
      console.error("Failed to mint content", error);
      // Replace with toast/alert in a production UI.
      alert(t.mintError);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadStatus(t.uploadPreparing);
    setUploadedFileInfo(null);

    uploadToDecentralizedStorage(file, storageProtocol)
      .then((result) => {
        const normalizedUri = result.uri.trim();
        if (normalizedUri.length > URI_MAX_LENGTH) {
          console.error(
            `Uploaded URI exceeds on-chain limit: received ${normalizedUri.length} characters, max ${URI_MAX_LENGTH}`
          );
          setUploadStatus(
            language === "pt"
              ? "O link retornado excede o limite de 128 caracteres suportado on-chain. Tente enviar outro arquivo ou use um hash mais curto."
              : "The returned link exceeds the 128-character on-chain limit. Try another file or use a shorter hash."
          );
          setUploadedFileInfo(null);
          return;
        }

        setUri(normalizedUri);
        setUploadStatus(t.uploadSuccess(result.protocol.toUpperCase(), result.filename));
        setUploadedFileInfo(result);
      })
      .catch((error) => {
        console.error("Failed to upload file", error);
        setUploadStatus(t.uploadError);
        setUploadedFileInfo(null);
      })
      .finally(() => {
        setUploading(false);
      });
  };

  return (
    <form onSubmit={handleMint}>
      <h2>{t.title}</h2>
      <p>{t.description}</p>
      <div className="input-group">
        <label htmlFor="title">{t.titleLabel}</label>
        <input
          id="title"
          value={title}
          maxLength={TITLE_MAX_LENGTH}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={t.titlePlaceholder}
          required
        />
      </div>
      <div className="input-group">
        <label htmlFor="description">{t.descriptionLabel}</label>
        <textarea
          id="description"
          value={description}
          maxLength={DESCRIPTION_MAX_LENGTH}
          onChange={(event) => setDescription(event.target.value)}
          placeholder={t.descriptionPlaceholder}
          rows={4}
        />
      </div>
      <div className="input-group">
        <label htmlFor="contentType">{t.categoryLabel}</label>
        <select
          id="contentType"
          value={contentType}
          onChange={(event) => setContentType(event.target.value as ContentType)}
        >
          {contentOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="multi-input">
        <div className="input-group">
          <label htmlFor="year">{t.yearLabel}</label>
          <input
            id="year"
            type="number"
            min="1900"
            max={new Date().getFullYear() + 1}
            value={year}
            onChange={(event) => setYear(event.target.value)}
            placeholder={t.yearPlaceholder}
            required
          />
        </div>
        <div className="input-group">
          <label htmlFor="educationLevel">{t.educationLabel}</label>
          <select
            id="educationLevel"
            value={educationLevel}
            onChange={(event) => setEducationLevel(event.target.value)}
          >
            {educationLevelOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="input-group">
        <label htmlFor="institution">{t.institutionLabel}</label>
        <input
          id="institution"
          value={institution}
          onChange={(event) => setInstitution(event.target.value)}
          placeholder={t.institutionPlaceholder}
          required
        />
      </div>
      <div className="multi-input">
        <div className="input-group">
          <label htmlFor="knowledgeArea">{t.knowledgeAreaLabel}</label>
          <input
            id="knowledgeArea"
            value={knowledgeArea}
            onChange={(event) => setKnowledgeArea(event.target.value)}
            placeholder={t.knowledgeAreaPlaceholder}
            required
          />
        </div>
        <div className="input-group">
          <label htmlFor="knowledgeSubarea">{t.knowledgeSubareaLabel}</label>
          <input
            id="knowledgeSubarea"
            value={knowledgeSubarea}
            onChange={(event) => setKnowledgeSubarea(event.target.value)}
            placeholder={t.knowledgeSubareaPlaceholder}
            required
          />
        </div>
      </div>
      {/* <div className="input-group">
        <label htmlFor="uri">{t.uriLabel}</label>
        <input
          id="uri"
          value={uri}
          onChange={(event) => setUri(event.target.value)}
          placeholder="https://..."
          required
        />
      </div> */}
      <div className="input-group">
        <label htmlFor="file">{t.fileLabel}</label>
        <input id="file" type="file" accept=".pdf,.png,.jpg,.jpeg,.mp4" onChange={handleFileUpload} />
        <small>{t.fileHint.replace("{protocol}", storageProtocol.toUpperCase())}</small>
        {uploadStatus && (
          <small className="upload-status">
            {uploadStatus}
            {uploadedFileInfo && (
              <>
                {" — "}
                <a
                  href={resolveGatewayUrl(uploadedFileInfo.uri)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t.viewUploadedFile}
                </a>
              </>
            )}
          </small>
        )}
      </div>
      <button className="primary-button" type="submit" disabled={isDisabled}>
        {loading ? t.submitLoading : t.submitIdle}
      </button>
      {!publicKey && <p>{t.connectWallet}</p>}
      {publicKey && !uri.trim() && (
        <p style={{ color: "#ffa500", marginTop: "0.5rem" }}>
          {language === "pt" 
            ? "⚠️ Faça o upload de um arquivo para habilitar o registro"
            : "⚠️ Upload a file to enable registration"}
        </p>
      )}
    </form>
  );
};

export default MintForm;
