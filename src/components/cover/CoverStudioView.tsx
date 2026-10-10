import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useStudio } from "../StudioContext";
import { isInvokeAvailable } from "../../utils/tauri";
import {
  calculateCoverGeometry,
  exportKdpCoverPdf,
  extractSpineColor,
  inspectCoverImages,
  pickCoverImage,
  pickCoverOutputPath,
  type CoverGeometry,
  type CoverPaperType,
  type ImageInspectionReport,
  type SpineColorSuggestion,
} from "../../utils/coverApi";
import { CoverSettingsPanel } from "./CoverSettingsPanel";
import { CoverCanvas2D } from "./CoverCanvas2D";
import { Cover3DPreview } from "./Cover3DPreview";
import { CoverPreExportModal, type PreExportCheck } from "./CoverPreExportModal";

const SUB_TABS = [
  { id: "settings", label: "1. Réglages & Sources" },
  { id: "canvas2d", label: "2. Planche technique 2D" },
  { id: "preview3d", label: "3. Volume 3D" },
] as const;

type SubTab = (typeof SUB_TABS)[number]["id"];

/**
 * Atelier de composition de la couverture : navigation en **3 vues
 * séquentielles**, état persistant (contexte projet), détection de dérive (§10)
 * et dialogue de conformité avant export (§9).
 */
export const CoverStudioView: React.FC = () => {
  const { manuscriptConfig, bookInfo, cover, onCoverChange, structureSignature } =
    useStudio();
  const trimSize = manuscriptConfig.trimSize;

  const [activeSubTab, setActiveSubTab] = useState<SubTab>("settings");
  const [geometry, setGeometry] = useState<CoverGeometry | null>(null);
  const [inspection, setInspection] = useState<ImageInspectionReport | null>(null);
  const [suggestion, setSuggestion] = useState<SpineColorSuggestion | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const textInitialized = useRef(false);

  const { frontPath, backPath, pageCount, paperType, spineText, gradient } = cover;

  // Texte de tranche par défaut : « Titre — Auteur » (une seule fois).
  useEffect(() => {
    if (textInitialized.current) return;
    textInitialized.current = true;
    if (cover.spineText.trim() === "") {
      const value = [bookInfo.title, bookInfo.author].filter(Boolean).join(" — ");
      if (value) onCoverChange({ spineText: value });
    }
  }, [cover.spineText, bookInfo.title, bookInfo.author, onCoverChange]);

  // Géométrie recalculée à chaque changement de paramètre.
  useEffect(() => {
    if (!isInvokeAvailable()) {
      setGeometry(null);
      return;
    }
    let active = true;
    calculateCoverGeometry(pageCount, paperType, trimSize)
      .then((result) => {
        if (active) setGeometry(result);
      })
      .catch((error) => {
        if (active) setMessage(String(error));
      });
    return () => {
      active = false;
    };
  }, [pageCount, paperType, trimSize]);

  // Inspection DPI + couleur de tranche dès que les deux plats sont choisis.
  useEffect(() => {
    if (!frontPath || !backPath || !isInvokeAvailable()) {
      setInspection(null);
      setSuggestion(null);
      return;
    }
    let active = true;
    setBusy(true);
    Promise.all([
      inspectCoverImages(frontPath, backPath, trimSize),
      extractSpineColor(frontPath, backPath),
    ])
      .then(([report, color]) => {
        if (!active) return;
        setInspection(report);
        setSuggestion(color);
        onCoverChange({
          spineColorFront: color.colorFront,
          spineColorBack: color.colorBack,
          gradient: color.gradientRecommended,
        });
      })
      .catch((error) => {
        if (active) setMessage(String(error));
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frontPath, backPath, trimSize]);

  // Détection de dérive (§10) : pagination ou contenu modifiés depuis la validation.
  const drift =
    cover.pageCount !== cover.pageCountSnapshot ||
    structureSignature !== cover.structureSignature;

  const handlePick = async (target: "front" | "back") => {
    try {
      setMessage(null);
      const path = await pickCoverImage();
      if (!path) return;
      onCoverChange(target === "front" ? { frontPath: path } : { backPath: path });
    } catch (error) {
      setMessage(String(error));
    }
  };

  const handleRecalcSpine = () => {
    onCoverChange({ pageCountSnapshot: pageCount, structureSignature });
  };

  // Contrôles automatiques du dialogue de pré-export (§9).
  const checks: PreExportCheck[] = useMemo(() => {
    const frontDpi = inspection?.front.dpi ?? 0;
    const backDpi = inspection?.back.dpi ?? 0;
    return [
      {
        label: "Résolution ≥ 300 DPI",
        ok: Boolean(inspection) && frontDpi >= 300 && backDpi >= 300,
        detail: inspection
          ? `${Math.round(frontDpi)} / ${Math.round(backDpi)} DPI`
          : "images non inspectées",
      },
      {
        label: "Fond perdu 3,2 mm",
        ok: Boolean(geometry) && Math.abs((geometry?.bleedMm ?? 0) - 3.2) < 0.01,
        detail: geometry ? `${geometry.bleedMm} mm` : "—",
      },
      {
        label: "Épaisseur de tranche",
        ok: Boolean(geometry),
        detail: geometry
          ? `${geometry.spine.widthMm.toFixed(2)} mm · ${geometry.spine.pagesUsed} pages`
          : "—",
      },
      {
        label: "Réserve code-barres",
        ok: Boolean(geometry),
        detail: "50,8 × 30,5 mm",
      },
      {
        label: "Texte de tranche",
        ok:
          Boolean(geometry) &&
          ((geometry?.spine.textEligible ?? false) || spineText.trim() === ""),
        detail: geometry?.spine.textEligible ? "éligible" : "tranche < 80 pages",
      },
    ];
  }, [inspection, geometry, spineText]);

  const handleExportRequest = () => {
    if (!frontPath || !backPath) {
      setMessage("Sélectionnez les deux plats (Recto & Verso) avant l'export.");
      return;
    }
    setModalOpen(true);
  };

  const runExport = async () => {
    setModalOpen(false);
    if (!frontPath || !backPath) return;
    try {
      setMessage(null);
      const destination = await pickCoverOutputPath(`couverture-${trimSize}.pdf`);
      if (!destination) return;
      setBusy(true);
      const report = await exportKdpCoverPdf(
        {
          frontPath,
          backPath,
          pageCount,
          paperType,
          trimSize,
          spineText: geometry?.spine.textEligible ? spineText : null,
          spineColorFront: cover.spineColorFront ?? suggestion?.colorFront ?? null,
          // Dégradé désactivé → couleur unie (mêmes teintes des deux côtés).
          spineColorBack: gradient
            ? cover.spineColorBack ?? suggestion?.colorBack ?? null
            : cover.spineColorFront ?? suggestion?.colorFront ?? null,
        },
        destination,
      );
      setMessage(
        `Couverture exportée (${Math.round(report.bytes / 1024)} Ko) → ${report.outputPath}`,
      );
    } catch (error) {
      setMessage(String(error));
    } finally {
      setBusy(false);
    }
  };

  const canExport = Boolean(frontPath && backPath && geometry) && !busy;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* Sous-navigation registre / laiton */}
      <div className="grid shrink-0 grid-cols-3 gap-2 border-b-2 border-brass/40 pb-3">
        {SUB_TABS.map((tab) => {
          const active = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubTab(tab.id)}
              aria-current={active ? "page" : undefined}
              className={`whitespace-nowrap rounded-sm border px-2 py-2 text-center font-mono text-[10px] uppercase tracking-tight transition-colors ${
                active
                  ? "border-brass/60 bg-copper text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_2px_4px_rgba(0,0,0,0.5)]"
                  : "border-stone-400/30 bg-stone-500/5 text-stone-600 hover:bg-stone-500/10"
              }`}
            >
              [ {tab.label} ]
            </button>
          );
        })}
      </div>

      {drift && (
        <div className="flex shrink-0 items-center justify-between gap-3 rounded-sm border border-amber-600/40 bg-amber-100/50 px-3 py-2">
          <span className="flex items-center gap-2 text-[11px] italic text-amber-900">
            <AlertTriangle size={14} />
            Dérive détectée : la pagination ou le contenu a changé depuis la validation de
            la tranche.
          </span>
          <button
            type="button"
            onClick={handleRecalcSpine}
            className="shrink-0 rounded-sm border border-brass/50 bg-linear-to-b from-copper to-[#8a5426] px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_2px_4px_rgba(0,0,0,0.5)] transition-all hover:brightness-110 active:translate-y-px"
          >
            [ Recalculer la tranche ]
          </button>
        </div>
      )}

      <div className="min-h-0 flex-1">
        {activeSubTab === "settings" && (
          <CoverSettingsPanel
            trimSize={trimSize}
            pageCount={pageCount}
            onPageCountChange={(value) => onCoverChange({ pageCount: value })}
            paperType={paperType}
            onPaperTypeChange={(value: CoverPaperType) => onCoverChange({ paperType: value })}
            frontPath={frontPath}
            backPath={backPath}
            inspection={inspection}
            onPick={handlePick}
            spineText={spineText}
            onSpineTextChange={(value) => onCoverChange({ spineText: value })}
            geometry={geometry}
            suggestion={suggestion}
            useGradient={gradient}
            onUseGradientChange={(value) => onCoverChange({ gradient: value })}
          />
        )}

        {activeSubTab === "canvas2d" && (
          <CoverCanvas2D
            geometry={geometry}
            spineText={spineText}
            suggestion={suggestion}
            useGradient={gradient}
            busy={busy}
            message={message}
            canExport={canExport}
            onExport={handleExportRequest}
            onBack={() => setActiveSubTab("settings")}
            frontPath={frontPath}
            backPath={backPath}
          />
        )}

        {activeSubTab === "preview3d" && (
          <Cover3DPreview
            trimWidthMm={geometry?.trimWidthMm ?? 152.4}
            trimHeightMm={geometry?.trimHeightMm ?? 228.6}
            spineWidthMm={geometry?.spine.widthMm ?? 0}
            spineText={spineText}
            spineColor={suggestion?.colorFront ?? null}
            spineColorAlt={suggestion?.colorBack ?? null}
            useGradient={gradient}
            spineTextEligible={geometry?.spine.textEligible ?? false}
            frontPath={frontPath}
            backPath={backPath}
            onBack={() => setActiveSubTab("canvas2d")}
            onBackToSettings={() => setActiveSubTab("settings")}
            onExport={handleExportRequest}
            canExport={canExport}
            busy={busy}
          />
        )}
      </div>

      <CoverPreExportModal
        open={modalOpen}
        checks={checks}
        busy={busy}
        onCancel={() => setModalOpen(false)}
        onConfirm={runExport}
      />
    </div>
  );
};
