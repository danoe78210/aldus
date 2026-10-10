import React from "react";
import type { ActiveMenu } from "../types";
import { useStudio } from "./StudioContext";
import { SettingsNavigator } from "./SettingsNavigator";
import { InfoEditionPanel } from "./InfoView";
import { ImpositionPanel } from "./ImpositionPanel";
import { CoverStudioView } from "./cover/CoverStudioView";
import { ExportView } from "./ExportView";
import { CorrectorView } from "./CorrectorView";

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
    case "organisation":
      /* Feuillet IV : imposition & calibrage KDP — la table des matières
         (Feuillet III) est composée sur la page de gauche. */
      return <ImpositionPanel />;
    case "couverture":
      return <CoverStudioView />;
    case "correcteur":
      return <CorrectorView />;
    case "export":
      return (
        <ExportView
          onExport={studio.onExport}
          onPreview={studio.onPreview}
          isExporting={studio.isExporting}
        />
      );
  }
};
