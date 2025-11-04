import { format } from "date-fns";
import { enUS, ptBR } from "date-fns/locale";
import { useEffect, useMemo, useState } from "react";
import { useMintedItems, ContentType } from "./MintedItemsContext";
import { useLanguage } from "./LanguageContext";

interface MintedItemListProps {
  searchTerm?: string;
}

const MintedItemList = ({ searchTerm = "" }: MintedItemListProps) => {
  const { items } = useMintedItems();
  const { language } = useLanguage();

  const translations = {
    en: {
      categories: {
        artigo: "Articles and papers",
        resenha: "Reviews and critiques",
        tradução: "Published translations",
        certificado: "Certificates and training",
        outro: "Other works",
      },
      emptyTitle: "No NFTs found",
      emptySubtitle: "Start minting works to fill your academic showcase.",
      noDescription: "No description provided.",
      knowledge: "Knowledge area",
      protocol: "Protocol",
      openMedia: "Open media on IPFS ↗",
      previewLabel: "Preview",
      previewLoading: "Loading preview…",
      previewUnavailable: "Preview unavailable for this file type.",
      author: "Author",
      dateFormat: "MM/dd/yyyy",
    },
    pt: {
      categories: {
        artigo: "Artigos e papers",
        resenha: "Resenhas e recensões",
        tradução: "Traduções publicadas",
        certificado: "Certificados e formações",
        outro: "Outras produções",
      },
      emptyTitle: "Nenhum NFT encontrado",
      emptySubtitle: "Comece mintando produções para popular sua vitrine acadêmica.",
      noDescription: "Sem descrição adicionada.",
      knowledge: "Área do conhecimento",
      protocol: "Protocolo",
      openMedia: "Abrir mídia on-chain ↗",
      previewLabel: "Pré-visualização",
      previewLoading: "Carregando pré-visualização…",
      previewUnavailable: "Pré-visualização indisponível para este tipo de arquivo.",
      author: "Autor",
      dateFormat: "dd/MM/yyyy",
    },
  } as const;

  const t = translations[language];
  const locale = language === "pt" ? ptBR : enUS;

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const groupedItems = useMemo(() => {
    const matchesSearch = (value: string | number | undefined) => {
      if (!normalizedSearch) return true;
      if (!value) return false;
      return value.toString().toLowerCase().includes(normalizedSearch);
    };

    return items.reduce<Record<ContentType, typeof items>>((accumulator, item) => {
      const candidateFields = [
        item.title,
        item.description,
        item.institution,
        item.knowledgeArea,
        item.knowledgeSubarea,
        item.educationLevel,
        item.ownerAddress,
        item.mintAddress,
        item.metadataSignature,
        item.year,
      ];

      if (normalizedSearch && !candidateFields.some(matchesSearch)) {
        return accumulator;
      }

      if (!accumulator[item.contentType]) {
        accumulator[item.contentType] = [];
      }

      accumulator[item.contentType].push(item);
      return accumulator;
    }, {
      artigo: [],
      resenha: [],
      tradução: [],
      certificado: [],
      outro: [],
    });
  }, [items, normalizedSearch]);

  const hasAnyItem = useMemo(
    () => Object.values(groupedItems).some((collection) => collection.length > 0),
    [groupedItems]
  );

  if (!hasAnyItem) {
    return (
      <div className="empty-state">
        <h3>{t.emptyTitle}</h3>
        <p>{t.emptySubtitle}</p>
      </div>
    );
  }

  return (
    <div className="profile-categories">
      {Object.entries(groupedItems).map(([category, entries]) => {
        if (!entries.length) {
          return null;
        }

        return (
          <section key={category} className="category-section">
            <header className="category-header">
              <h3>{t.categories[category as ContentType]}</h3>
              <span className="badge">{entries.length}</span>
            </header>
            <div className="category-row">
              {entries.map((item) => (
                <article key={item.id} className="minted-card">
                  <header>
                    <div>
                      <strong>{item.title}</strong>
                      <p className="minted-meta">
                        {item.year} · {item.institution} · {item.educationLevel}
                      </p>
                    </div>
                    <span className="badge badge--success">+{item.reward.toFixed(4)} SOL</span>
                  </header>
                  {item.uri && (
                    <div className="minted-card__preview">
                      <span className="minted-card__preview-label">{t.previewLabel}</span>
                      <MediaPreview
                        uri={item.uri}
                        title={item.title}
                        loadingLabel={t.previewLoading}
                        errorLabel={t.previewUnavailable}
                        openLabel={t.openMedia}
                      />
                    </div>
                  )}
                  <p>{item.description || t.noDescription}</p>
                  <p className="minted-meta">
                    {t.knowledge}: {item.knowledgeArea} · {item.knowledgeSubarea}
                  </p>
                  <p className="minted-meta">
                    {t.protocol}: {item.storageProtocol.toUpperCase()} · NFT {shorten(item.mintAddress)}
                  </p>
                  <p className="minted-meta">Tx: {shorten(item.metadataSignature)}</p>
                  <footer>
                    <a href={resolveGatewayUrl(item.uri)} target="_blank" rel="noreferrer">
                      {t.openMedia}
                    </a>
                    <span>{format(new Date(item.mintedAt), t.dateFormat, { locale })}</span>
                    <span className="minted-owner">{t.author}: {shorten(item.ownerAddress)}</span>
                  </footer>
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
};

type MediaDisplayMode = "image" | "video" | "audio" | "iframe" | "link";

const MEDIA_EXTENSION_MAP: Record<string, MediaDisplayMode> = {
  jpg: "image",
  jpeg: "image",
  png: "image",
  gif: "image",
  webp: "image",
  svg: "image",
  mp4: "video",
  webm: "video",
  ogv: "video",
  mov: "video",
  mp3: "audio",
  wav: "audio",
  ogg: "audio",
  m4a: "audio",
  flac: "audio",
  pdf: "iframe",
  html: "iframe",
  htm: "iframe",
  txt: "iframe",
  csv: "iframe",
  json: "iframe",
  zip: "link",
  rar: "link",
  "7z": "link",
  gz: "link",
  tar: "link",
};

const inferDisplayModeFromExtension = (uri: string): MediaDisplayMode => {
  try {
    const normalized = uri.split("#")[0]?.split("?")[0] ?? "";
    const extension = normalized.split(".").pop()?.toLowerCase();
    if (!extension) return "iframe";
    return MEDIA_EXTENSION_MAP[extension] ?? "iframe";
  } catch {
    return "iframe";
  }
};

const inferDisplayModeFromContentType = (contentType: string | null): MediaDisplayMode => {
  if (!contentType) return "iframe";
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/")) return "video";
  if (contentType.startsWith("audio/")) return "audio";
  if (
    contentType === "application/pdf" ||
    contentType.startsWith("text/") ||
    contentType.includes("html")
  ) {
    return "iframe";
  }
  if (
    contentType.includes("zip") ||
    contentType.includes("gzip") ||
    contentType.includes("octet-stream")
  ) {
    return "link";
  }
  return "iframe";
};

interface MediaPreviewProps {
  uri: string;
  title: string;
  loadingLabel: string;
  errorLabel: string;
  openLabel: string;
}

const MediaPreview = ({ uri, title, loadingLabel, errorLabel, openLabel }: MediaPreviewProps) => {
  const resolvedUri = useMemo(() => resolveGatewayUrl(uri), [uri]);
  const [mode, setMode] = useState<MediaDisplayMode>(() => inferDisplayModeFromExtension(resolvedUri));
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    const detectContentType = async () => {
      try {
        const response = await fetch(resolvedUri, { method: "HEAD" });
        if (cancelled) return;
        if (!response.ok) {
          throw new Error(`HEAD request failed with status ${response.status}`);
        }
        const contentType = response.headers.get("content-type");
        setMode(inferDisplayModeFromContentType(contentType));
        setStatus("ready");
      } catch (error) {
        if (cancelled) return;
        const fallbackMode = inferDisplayModeFromExtension(resolvedUri);
        setMode(fallbackMode);
        setStatus(fallbackMode === "link" ? "error" : "ready");
      }
    };

    detectContentType();

    return () => {
      cancelled = true;
    };
  }, [resolvedUri]);

  if (!resolvedUri) {
    return null;
  }

  if (status === "loading") {
    return <div className="minted-media-preview minted-media-preview--loading">{loadingLabel}</div>;
  }

  if (status === "error" || mode === "link") {
    return (
      <div className="minted-media-preview minted-media-preview--error">
        <p>{errorLabel}</p>
        <a href={resolvedUri} target="_blank" rel="noreferrer">
          {openLabel}
        </a>
      </div>
    );
  }

  if (mode === "image") {
    return (
      <div className="minted-media-preview minted-media-preview--image">
        <img src={resolvedUri} alt={title} loading="lazy" />
      </div>
    );
  }

  if (mode === "video") {
    return (
      <div className="minted-media-preview minted-media-preview--video">
        <video controls preload="metadata">
          <source src={resolvedUri} />
        </video>
      </div>
    );
  }

  if (mode === "audio") {
    return (
      <div className="minted-media-preview minted-media-preview--audio">
        <audio controls preload="metadata" src={resolvedUri} />
      </div>
    );
  }

  return (
    <div className="minted-media-preview minted-media-preview--iframe">
      <iframe title={title} src={resolvedUri} loading="lazy" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" />
    </div>
  );
};

const shorten = (value: string) => {
  if (value.length <= 10) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
};

const resolveGatewayUrl = (uri: string): string => {
  if (!uri) {
    return "";
  }

  if (uri.startsWith("ipfs://")) {
    const path = uri.slice("ipfs://".length).replace(/^ipfs\//, "");
    return `https://gateway.pinata.cloud/ipfs/${path}`;
  }

  return uri;
};

export default MintedItemList;
