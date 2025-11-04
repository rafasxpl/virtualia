import { format } from "date-fns";
import { enUS, ptBR } from "date-fns/locale";
import { useMemo } from "react";
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
                  <p>{item.description || t.noDescription}</p>
                  <p className="minted-meta">
                    {t.knowledge}: {item.knowledgeArea} · {item.knowledgeSubarea}
                  </p>
                  <p className="minted-meta">
                    {t.protocol}: {item.storageProtocol.toUpperCase()} · NFT {shorten(item.mintAddress)}
                  </p>
                  <p className="minted-meta">Tx: {shorten(item.metadataSignature)}</p>
                  <footer>
                    <a href={item.uri} target="_blank" rel="noreferrer">
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

const shorten = (value: string) => {
  if (value.length <= 10) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
};

export default MintedItemList;
