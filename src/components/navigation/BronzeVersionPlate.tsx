import { useEffect, useRef, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { version as packageVersion } from "../../../package.json";
import type { UpdateStatus } from "../../types";
import { checkForUpdates, openExternalUrl } from "../../utils/libraryApi";

const DEFAULT_RELEASE_URL = "https://github.com/danoe78210/aldus/releases/latest";

interface BronzeVersionPlateProps {
  className?: string;
}

export const BronzeVersionPlate = ({ className = "" }: BronzeVersionPlateProps) => {
  const [version, setVersion] = useState(packageVersion);
  const [update, setUpdate] = useState<UpdateStatus | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [openError, setOpenError] = useState("");
  const [checkError, setCheckError] = useState("");
  const [checking, setChecking] = useState(true);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let active = true;
    void getVersion()
      .then((appVersion) => {
        if (active) setVersion(appVersion);
      })
      .catch(() => {});
    void checkForUpdates()
      .then((status) => {
        if (active) setUpdate(status);
      })
      .catch((error: unknown) => {
        if (active) setCheckError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!detailsOpen || !dialog) return;
    dialog.showModal();
    return () => { if (dialog.open) dialog.close(); };
  }, [detailsOpen]);

  const hasUpdate = update?.available === true;
  const rivetClass = hasUpdate ? "border-[#d4af37] bg-[#3a2c14]" : "border-[#2a2014] bg-[#524028]";
  const releaseUrl = update?.releaseUrl || DEFAULT_RELEASE_URL;
  const refreshUpdate = async () => {
    setChecking(true);
    setCheckError("");
    try {
      setUpdate(await checkForUpdates(true));
    } catch (error) {
      setCheckError(error instanceof Error ? error.message : String(error));
    } finally {
      setChecking(false);
    }
  };
  const openRelease = async () => {
    try {
      await openExternalUrl(releaseUrl);
      setOpenError("");
    } catch (error) {
      setOpenError(error instanceof Error ? error.message : "Ouverture du navigateur impossible.");
    }
  };
  const closeDetails = () => {
    setDetailsOpen(false);
    if (dialogRef.current?.open) dialogRef.current.close();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpenError(""); setDetailsOpen(true); }}
        aria-haspopup="dialog"
        title={hasUpdate ? `Version ${version}. Mise à jour ${update?.latestVersion} disponible` : `Aldus Atelier — Version ${version}`}
        className={`relative inline-flex select-none items-center justify-center rounded-sm border bg-linear-to-b from-[#382c1e] via-[#221a12] to-[#18120c] px-3 py-1.5 shadow-[inset_0_1px_2px_rgba(255,215,0,0.12),inset_0_-1px_2px_rgba(0,0,0,0.8),0_2px_5px_rgba(0,0,0,0.55)] disabled:cursor-default ${hasUpdate ? "plaque-update-active hover:brightness-110" : "border-[#5a4527]"} ${className}`}
      >
        <span aria-hidden="true" className={`absolute left-1.5 top-1.5 h-1.5 w-1.5 rounded-full border ${rivetClass} shadow-inner`} />
        <span aria-hidden="true" className={`absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full border ${rivetClass} shadow-inner ${hasUpdate ? "shadow-[0_0_6px_rgba(212,175,55,0.8)]" : ""}`} />
        <span aria-hidden="true" className={`absolute bottom-1.5 left-1.5 h-1.5 w-1.5 rounded-full border ${rivetClass} shadow-inner`} />
        <span aria-hidden="true" className={`absolute bottom-1.5 right-1.5 h-1.5 w-1.5 rounded-full border ${rivetClass} shadow-inner`} />
        <span
          className={`whitespace-nowrap font-sans text-[12px] font-semibold tracking-[0.04em] ${hasUpdate ? "text-[#f0cb6a]" : "text-[#c49a45]"}`}
          style={{ textShadow: hasUpdate ? "0 0 6px rgba(212,175,55,0.6), 0 1px 2px rgba(0,0,0,0.95)" : "0 -1px 0 rgba(0,0,0,0.9), 0 1px 1px rgba(212,175,55,0.2)" }}
        >
          Aldus · v{version}
        </span>
      </button>
      {detailsOpen && (
        <dialog
          ref={dialogRef}
          aria-labelledby="update-dialog-title"
          onCancel={(event) => { event.preventDefault(); closeDetails(); }}
          onClose={() => setDetailsOpen(false)}
          onClick={(event) => { if (event.target === event.currentTarget) closeDetails(); }}
          className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-sm border border-[#7a6039] bg-[#191612] p-0 text-[#e2dbce] shadow-2xl backdrop:bg-black/75"
        >
          <div className="border-b border-[#382f22] px-5 py-4">
            <p className="font-cinzel text-[10px] uppercase tracking-[0.2em] text-[#8f6e2b]">Mise à jour Aldus</p>
            <h2 id="update-dialog-title" className="mt-1 font-serif text-lg text-[#d4af37]">{hasUpdate ? `Version ${update.latestVersion} disponible` : "Mises à jour Aldus"}</h2>
          </div>
          <div className="max-h-[50vh] overflow-y-auto px-5 py-4">
            {hasUpdate ? (
              <>
                <p className="mb-2 font-cinzel text-[10px] uppercase tracking-widest text-[#c5bfb2]">Notes de version</p>
                <div className="whitespace-pre-wrap break-words font-serif text-sm leading-relaxed text-[#f0ece1]">{update.notes?.trim() || "Aucune note de version publiée."}</div>
              </>
            ) : (
              <p className="text-sm text-[#f0ece1]">{checking ? "Vérification en cours…" : checkError ? "Le statut des mises à jour n’a pas pu être actualisé." : "Aucune mise à jour disponible lors de la dernière vérification."}</p>
            )}
            {checkError && <p role="alert" className="mt-3 text-sm text-[#f0ece1]">{checkError}</p>}
            {openError && <p role="alert" className="mt-3 text-xs text-[#d28b75]">{openError}</p>}
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-[#382f22] px-5 py-3">
            <button type="button" disabled={checking} onClick={() => void refreshUpdate()} className="mr-auto rounded-sm px-3 py-2 text-xs text-[#c5bfb2] hover:text-[#d4af37] disabled:opacity-60">{checking ? "Vérification en cours…" : "Vérifier maintenant"}</button>
            <button type="button" onClick={closeDetails} className="rounded-sm border border-[#4a3b2c] px-3 py-2 text-xs text-[#c9bea9] hover:border-[#8f6e2b]">Fermer</button>
            {hasUpdate && <button type="button" onClick={() => void openRelease()} className="rounded-sm border border-[#8f6e2b] bg-[#211c15] px-3 py-2 font-cinzel text-xs text-[#d4af37] hover:border-[#d4af37]">Télécharger la mise à jour</button>}
          </div>
        </dialog>
      )}
    </>
  );
};