import { FONT_SIZE_RANGE, LINE_HEIGHT_RANGE, PDF_ZOOM_RANGE, READER_FONTS, READER_THEMES } from "./readerSettings";
import type { ReaderSettings } from "./readerSettings";

interface ReaderDrawerProps {
  settings: ReaderSettings;
  isPdf: boolean;
  onChange: (patch: Partial<ReaderSettings>) => void;
}

const choiceClass = (active: boolean): string =>
  `rounded-sm border px-2 py-1 text-xs transition-colors ${active ? "border-current font-medium" : "border-amber-900/20 opacity-70 hover:opacity-100"}`;

const Slider = ({ label, value, min, max, step, display, onChange }: { label: string; value: number; min: number; max: number; step: number; display: string; onChange: (value: number) => void }) => (
  <label className="flex flex-col gap-1.5 text-xs">
    <span className="flex justify-between"><span>{label}</span><span className="opacity-70">{display}</span></span>
    <input type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full accent-[#d4af37]" />
  </label>
);

export const ReaderDrawer = ({ settings, isPdf, onChange }: ReaderDrawerProps) => (
  <aside aria-label="Réglages typographiques" className="flex h-full w-72 max-w-full flex-col gap-6 overflow-y-auto border-l border-amber-900/20 p-5 text-sm" style={{ background: "inherit" }}>
    <section className="flex flex-col gap-2">
      <h2 className="font-cinzel text-xs tracking-wide">Papier</h2>
      <div role="group" aria-label="Thème" className="flex flex-col gap-1.5">
        {READER_THEMES.map((theme) => (
          <button key={theme.id} type="button" aria-pressed={settings.theme === theme.id} onClick={() => onChange({ theme: theme.id })} className={`flex items-center gap-2 ${choiceClass(settings.theme === theme.id)}`}>
            <span aria-hidden="true" className="size-3.5 shrink-0 rounded-full border border-amber-900/40" style={{ background: theme.background }} />{theme.label}
          </button>
        ))}
      </div>
    </section>
    {isPdf ? (
      <section className="flex flex-col gap-3">
        <h2 className="font-cinzel text-xs tracking-wide">Page</h2>
        <div role="group" aria-label="Disposition du PDF" className="flex gap-1.5">
          <button type="button" aria-pressed={settings.pdfView === "single"} onClick={() => onChange({ pdfView: "single" })} className={choiceClass(settings.pdfView === "single")}>Page seule</button>
          <button type="button" aria-pressed={settings.pdfView === "double"} onClick={() => onChange({ pdfView: "double" })} className={choiceClass(settings.pdfView === "double")}>Vis-à-vis</button>
        </div>
        <Slider label="Zoom" value={settings.pdfZoom} {...PDF_ZOOM_RANGE} display={`${Math.round(settings.pdfZoom * 100)} %`} onChange={(pdfZoom) => onChange({ pdfZoom })} />
      </section>
    ) : (
      <>
        <section className="flex flex-col gap-2">
          <h2 className="font-cinzel text-xs tracking-wide">Caractère</h2>
          <div role="group" aria-label="Police" className="grid grid-cols-2 gap-1.5">
            {READER_FONTS.map((font) => (
              <button key={font.id} type="button" aria-pressed={settings.font === font.id} onClick={() => onChange({ font: font.id })} className={choiceClass(settings.font === font.id)} style={{ fontFamily: font.family }}>{font.label}</button>
            ))}
          </div>
        </section>
        <section className="flex flex-col gap-3">
          <Slider label="Taille du texte" value={settings.fontSize} {...FONT_SIZE_RANGE} display={`${settings.fontSize} px`} onChange={(fontSize) => onChange({ fontSize })} />
          <Slider label="Interligne" value={settings.lineHeight} {...LINE_HEIGHT_RANGE} display={settings.lineHeight.toFixed(2)} onChange={(lineHeight) => onChange({ lineHeight })} />
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="font-cinzel text-xs tracking-wide">Colonne</h2>
          <div role="group" aria-label="Largeur de colonne" className="flex gap-1.5">
            <button type="button" aria-pressed={settings.width === "comfort"} onClick={() => onChange({ width: "comfort" })} className={choiceClass(settings.width === "comfort")}>Confort roman</button>
            <button type="button" aria-pressed={settings.width === "full"} onClick={() => onChange({ width: "full" })} className={choiceClass(settings.width === "full")}>Feuillet entier</button>
          </div>
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="font-cinzel text-xs tracking-wide">Défilement</h2>
          <div role="group" aria-label="Mode de lecture" className="flex gap-1.5">
            <button type="button" aria-pressed={settings.flow === "paged"} onClick={() => onChange({ flow: "paged" })} className={choiceClass(settings.flow === "paged")}>Paginé</button>
            <button type="button" aria-pressed={settings.flow === "continuous"} onClick={() => onChange({ flow: "continuous" })} className={choiceClass(settings.flow === "continuous")}>Continu</button>
          </div>
        </section>
      </>
    )}
  </aside>
);
