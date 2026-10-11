import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useStudio } from "../StudioContext";
import { isInvokeAvailable } from "../../utils/tauri";
import {
  calculateCoverGeometry,
  exportKdpCoverPdf,
  extractSpineColor,
  inspectCoverImages,
  pickCoverOutputPath,
  type CoverGeometry,
  type ImageInspectionReport,
  type SpineColorSuggestion,
} from "../../utils/coverApi";
import { CoverCanvas2D } from "./CoverCanvas2D";
import { Cover3DPreview } from "./Cover3DPreview";
import { CoverPreExportModal, type PreExportCheck } from "./CoverPreExportModal";

/** Bascule d'épreuve du marbre de montage (Feuillet V). */
const SUB_TABS = [
  { id: "canvas2d", label: "Épreuve à plat 2D" },
  { id: "preview3d", label: "Volume relié 3D" },
] as const;

type SubTab = (typeof SUB_TABS)[number]["id"];

/**
 * **Feuillet V — Le Marbre de Montage 2D/3D** (page de gauche de l'atelier de
 * couverture) : table d'encrage en ardoise sombre, grille de composition
 * millimétrique en filigrane, bascule d'épreuve `[ Épreuve à plat 2D ]` /
 * `[ Volume relié 3D ]`, bannière de dérive (§10) et dialogue de conformité
 * avant export (§9). L'état persistant vit dans le contexte projet.
 */
export const CoverPlate: React.FC = () => {
  const { manuscriptConfig, bookInfo, cover, onCoverChange, structureSignature, coverExportRequest } =
    useStudio();
  const trimSize = manuscriptConfig.trimSize;

  const [activeSubTab, setActiveSubTab] = useState<SubTab>("canvas2d");
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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- repli synchrone si le moteur natif est absent
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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- remise à zéro synchrone hors moteur natif
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

  // Demande d'export émise depuis le calibreur (Feuillet VI) : le marbre ouvre
  // son dialogue de conformité pré-export.
  useEffect(() => {
    if (coverExportRequest > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- réponse à une demande d'export externe (Feuillet VI)
      setModalOpen(true);
    }
  }, [coverExportRequest]);

  // Détection de dérive (§10) : pagination ou contenu modifiés depuis la validation.
  const drift =
    cover.pageCount !== cover.pageCountSnapshot ||
    structureSignature !== cover.structureSignature;

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
    /* **Feuillet V — Le Marbre de Montage** : table d'encrage en ardoise sombre,
       grille millimétrique en filigrane ; aucun carton gris ni bordure blanche. */
    <div className="relative flex h-full min-h-0 flex-col gap-3 rounded-xs border-2 border-[#382f22] bg-[#1a1815] p-6 shadow-2xl">
      {/* Grille de composition millimétrique (filigrane discret) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-xs"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(44,36,25,0.55) 0 1px, transparent 1px 10px), repeating-linear-gradient(90deg, rgba(44,36,25,0.55) 0 1px, transparent 1px 10px)",
        }}
      />

      <h2 className="relative shrink-0 text-center font-serif text-lg tracking-[0.25em] text-[#d4af37] uppercase">
        V. Le Marbre de Montage
      </h2>

      {/* Bascule d'épreuve — commutateur laiton discret */}
      <div className="relative grid shrink-0 grid-cols-2 gap-2 border-b border-[#382f22] pb-3">
        {SUB_TABS.map((tab) => {
          const active = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubTab(tab.id)}
              aria-current={active ? "page" : undefined}
              className={`rounded-xs border px-2 py-2 text-center font-serif text-[10px] tracking-widest uppercase transition-colors ${
                active
                  ? "border-[#d4af37] bg-[#1c1814] text-[#ffd700]"
                  : "border-[#2a2c33] bg-[#0f0e0d] text-[#9e9587] hover:border-[#8f6e2b] hover:text-[#c5a059]"
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
            onBack={() => setActiveSubTab("preview3d")}
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
            onBackToSettings={() => setActiveSubTab("canvas2d")}
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
