import { AudioLines, Disc3 } from "lucide-react";
import type { AudioChapter, AudioChapterChoice, AudioGenerationProgress } from "../../types";
import { libraryCoverUrl } from "../../utils/libraryApi";
import { AudioTrackPlayer } from "../AudioTrackPlayer";
import { burnDetails } from "./burnDetails";

interface ChapterSynthesisTableProps {
  chapters: AudioChapterChoice[];
  tracks: AudioChapter[];
  generatingIndex: number | null;
  progress: AudioGenerationProgress | null;
  canGenerate: boolean;
  onGenerate: (chapterIndex: number) => void;
  onDelete: (chapter: AudioChapter) => void;
}

const formatEstimatedDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds === 0 ? `${minutes} min` : `${minutes} min ${remainingSeconds} s`;
};

export const ChapterSynthesisTable = ({ chapters, tracks, generatingIndex, progress, canGenerate, onGenerate, onDelete }: ChapterSynthesisTableProps) => (
  <table className="w-full border-collapse text-left font-serif text-sm text-[#c9bea9]">
    <caption className="sr-only">Synthèse vocale par chapitre</caption>
    <thead>
      <tr className="border-b border-[#382f22] font-cinzel text-xs text-[#a99a83]">
        <th scope="col" className="py-2 pr-3 font-normal">Chapitre</th>
        <th scope="col" className="py-2 pr-3 font-normal">Estimation</th>
        <th scope="col" className="py-2 pr-3 font-normal">Piste</th>
        <th scope="col" className="py-2 font-normal"><span className="sr-only">Action</span></th>
      </tr>
    </thead>
    <tbody>
      {chapters.map((chapter) => {
        const track = tracks.find((candidate) => candidate.index === chapter.index);
        const active = generatingIndex === chapter.index;
        const timeline = active && progress?.chapterIndex === chapter.index ? progress : null;
        const label = `${track ? "Régénérer" : "Générer"} le chapitre ${chapter.index}`;
        return (
          <tr key={chapter.index} className="border-b border-[#2e261c] align-top">
            <td className="py-3 pr-3">{chapter.index}. {chapter.title}</td>
            <td className="py-3 pr-3 text-xs text-[#a99a83]">{chapter.pageCount} page(s) estimée(s) · {chapter.wordCount.toLocaleString("fr-FR")} mots · ~{formatEstimatedDuration(chapter.estimatedDurationSeconds)}</td>
            <td className="min-w-56 py-3 pr-3">
              {active ? (
                <div className="flex flex-col gap-1.5">
                  <div role="progressbar" aria-label={`Progression du chapitre ${chapter.index}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(timeline?.progress ?? 0)} className="h-1.5 w-full overflow-hidden rounded-full bg-[#2e261c]">
                    <div className="h-full bg-[#d4af37] transition-[width]" style={{ width: `${Math.round(timeline?.progress ?? 0)}%` }} />
                  </div>
                  <span className="text-xs text-[#c5a059]">{timeline?.segmentIndex != null && timeline.segmentCount != null ? `Segment ${timeline.segmentIndex}/${timeline.segmentCount}` : timeline?.status ?? "Forge en cours…"}</span>
                </div>
              ) : track ? (
                <div className="flex flex-col gap-1.5">
                  <p className="flex flex-wrap items-center gap-x-2 text-xs text-[#d4af37]">
                    <span className="flex items-center gap-1 font-cinzel tracking-wider uppercase"><Disc3 size={12} /> Gravée sur le disque</span>
                    {burnDetails(track) && <span className="text-[#a99a83]">{burnDetails(track)}</span>}
                  </p>
                  <AudioTrackPlayer title={chapter.title} src={libraryCoverUrl(track.path)} onDelete={() => onDelete(track)} />
                </div>
              ) : (
                <span className="text-xs text-[#8c8275]">Aucune piste</span>
              )}
            </td>
            <td className="py-3">
              <button type="button" aria-label={label} aria-busy={active} disabled={!canGenerate} onClick={() => onGenerate(chapter.index)} className={`flex items-center gap-2 rounded-sm border px-3 py-1.5 font-cinzel text-xs transition-all disabled:cursor-not-allowed ${active ? "animate-pulse border-[#d4af37] bg-[#2b2112] text-[#f3d995]" : "border-[#8f6e2b] bg-[#211c15] text-[#d4af37] hover:bg-[#302619] disabled:opacity-40"}`}>
                <AudioLines size={14} /> {track ? "Régénérer" : "Générer"}
              </button>
            </td>
          </tr>
        );
      })}
    </tbody>
  </table>
);
