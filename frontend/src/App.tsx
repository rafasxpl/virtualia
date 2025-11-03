import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl } from "@solana/web3.js";
import { useMemo, useState } from "react";
import WalletConnection from "./components/WalletConnection";
import WalletGate from "./components/WalletGate";
import { MintedItemProvider } from "./components/MintedItemsContext";
import { ProfileProvider } from "./components/ProfileContext";
import ProfilePage from "./components/ProfilePage";
import MintingPage from "./components/MintingPage";
import ProfileEditModal from "./components/ProfileEditModal";
import { useLanguage } from "./components/LanguageContext";

import "@solana/wallet-adapter-react-ui/styles.css";

const App = () => {
  const endpoint = useMemo(() => clusterApiUrl("devnet"), []);
  const wallets = useMemo(() => [], []);

  const [view, setView] = useState<"profile" | "mint">("profile");
  const [globalSearch, setGlobalSearch] = useState("");
  const [editingProfile, setEditingProfile] = useState(false);
  const { language, toggleLanguage } = useLanguage();

  const translations = {
    en: {
      tagline: "Academic résumés as NFTs on Solana.",
      searchLabel: "Search works or users",
      searchPlaceholder: "Search works or users",
      footer: "Roadmap: support for videos, workshop tracks, and tokenized certificate issuance.",
      languageSwitch: "Português",
    },
    pt: {
      tagline: "Currículos acadêmicos como NFTs na Solana.",
      searchLabel: "Buscar produções ou usuários",
      searchPlaceholder: "Buscar produções ou usuários",
      footer: "Roadmap: suporte a vídeos, trilhas de workshops e emissão de certificados tokenizados.",
      languageSwitch: "English",
    },
  } as const;

  const t = translations[language];

  const goToProfile = () => {
    setView("profile");
  };

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <MintedItemProvider>
            <ProfileProvider>
              <WalletGate>
                <div className="app-shell">
                  <header className="app-header">
                    <div>
                      <h1>Virtualia</h1>
                      <p>{t.tagline}</p>
                    </div>
                    <div className="header-tools">
                      <button type="button" className="language-toggle" onClick={toggleLanguage}>
                        {t.languageSwitch}
                      </button>
                      <div className="header-search">
                        <label htmlFor="globalSearch" className="sr-only">
                          {t.searchLabel}
                        </label>
                        <input
                          id="globalSearch"
                          value={globalSearch}
                          onChange={(event) => setGlobalSearch(event.target.value)}
                          placeholder={t.searchPlaceholder}
                        />
                      </div>
                      <WalletConnection />
                    </div>
                  </header>
                  <main className="page-area">
                    {view === "profile" ? (
                      <ProfilePage
                        onCreate={() => setView("mint")}
                        onEditProfile={() => setEditingProfile(true)}
                        globalSearchTerm={globalSearch}
                      />
                    ) : (
                      <MintingPage onBackToProfile={goToProfile} onMintSuccess={goToProfile} />
                    )}
                  </main>
                  <p className="footer-note">{t.footer}</p>
                  <ProfileEditModal open={editingProfile} onClose={() => setEditingProfile(false)} />
                </div>
              </WalletGate>
            </ProfileProvider>
          </MintedItemProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default App;
