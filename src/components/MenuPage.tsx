import React from "react";
import type { ActiveMenu } from "../types";
import { useStudio } from "./StudioContext";
import { SettingsNavigator } from "./SettingsNavigator";
import { InfoEditionPanel } from "./InfoView";
import { ImpositionPanel } from "./ImpositionPanel";
import { CoverCalibration } from "./CoverCalibration";
import { ProofWorkbench } from "./ProofWorkbench";
import { PressWorkshop } from "./PressWorkshop";
import { WritingPreview } from "./WritingStudio";
import { LibraryView } from "./LibraryView";
import { StudioAudioView } from "./audio/StudioAudioView";
import { IssuesList } from "./epreuve-plume/IssuesList";
import { AudioReaderView } from "./audio/AudioReaderView";
import { DiscothequeView } from "./audio/DiscothequeView";
import { SalonView } from "./reader/SalonView";

/**
 * Page du livre virtuel : rend la **vue correspondant au menu** en lisant l'état
 * applicatif depuis {@link useStudio}.
 *
 * L'élément `MenuPage` est créé une seule fois (référence stable) : le contenu
 * reste vivant via le contexte, sans provoquer de ré-initialisation du flipbook
 * lors des rendus de l'application.
 */
export const MenuPage: React.FC<{ menu: ActiveMenu }> = ({ menu }) => {
  const studio = useStudio();

  switch (menu) {
    case "reglages":
      return (
        <SettingsNavigator
          manuscriptConfig={studio.manuscriptConfig}
          sourceConfig={studio.sourceConfig}
          errorLogConfig={studio.errorLogConfig}
          onTrimChange={studio.onTrimChange}
          onLayoutChange={studio.onLayoutChange}
          onSourcesDirectoryChange={studio.onSourcesDirectoryChange}
          onImageColorModeChange={studio.onImageColorModeChange}
          onLogLevelChange={studio.onLogLevelChange}
          onLogDirectoryChange={studio.onLogDirectoryChange}
          onOpenLog={studio.onOpenLog}
          onQuit={studio.onQuit}
        />
      );
    case "infos":
      return <InfoEditionPanel />;
    case "ecritoire":
      return <WritingPreview />;
    case "bibliotheque":
      return <LibraryView exportDirectory={studio.exportDirectory} sourceDirectory={studio.sourceConfig.directory} currentBookTitle={studio.bookInfo.title} currentCoverPath={studio.cover.frontPath} onPickExportDirectory={studio.onPickExportDirectory} onReadBook={studio.onOpenSalon} />;
    case "studio-audio":
      return <StudioAudioView exportDirectory={studio.exportDirectory} onPickExportDirectory={studio.onPickExportDirectory} />;
    case "discotheque":
      return <DiscothequeView currentBookTitle={studio.bookInfo.title} deck={studio.audioDeck} exportDirectory={studio.exportDirectory} onPlay={studio.onPlayOnDeck} onOpenStudio={studio.onOpenStudioAudio} />;
    case "organisation":
      /* Feuillet VI : imposition & calibrage KDP — la table des matières
         (Feuillet V) est composée sur la page de gauche. */
      return <ImpositionPanel />;
    case "couverture":
      /* Feuillet VIII (droite) : calibreur KDP — le marbre de montage 2D/3D est
         composé sur la page de gauche (Feuillet VII). */
      return <CoverCalibration />;
    case "lecteur":
      return <AudioReaderView currentBookTitle={studio.bookInfo.title} deck={studio.audioDeck} onDeckChange={studio.onAudioDeckChange} onOpenStudio={studio.onOpenStudioAudio} onOpenDiscotheque={studio.onOpenDiscotheque} />;
    case "salon":
      return <SalonView target={studio.salonTarget} />;
    case "correcteur":
      return <ProofWorkbench />;
    case "banc-epreuve":
      return <ProofWorkbench />;
    case "epreuve-plume":
      return <IssuesList />;
    case "export":
      /* Feuillet XII (droite) : marbre de pressage — l'inspection pré-presse est
         composée sur la page de gauche (Feuillet XI). */
      return <PressWorkshop />;
  }
};
