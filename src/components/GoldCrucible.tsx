import React, { useEffect, useState } from "react";

/** Phase du rituel de fonderie. */
export type CruciblePhase = "idle" | "filling" | "ready";

/** Répit de stabilisation avant le démarrage automatique (ms). */
export const START_DELAY_MS = 500;
/** Durée (ms) de la coulée d'or (9,5 s : tempo lent, viscosité du métal en fusion). */
export const POUR_DURATION_MS = 9500;
/** Durée (ms) du fondu enchaîné vers l'or antique d'Aldus. */
export const SOLIDIFY_DURATION_MS = 1500;

/**
 * Tracé de la lettrine vénitienne « A » (esprit gravure) : deux fûts évasés,
 * traverse à losange, volutes au sommet et patins d'appui.
 * Sert à la fois de silhouette (`clipPath`) et de contour gravé.
 */
const LETTER_A_PATH = [
  // Fût gauche
  "M100 14 L116 14 L62 206 L26 206 Z",
  // Fût droit
  "M100 14 L84 14 L138 206 L174 206 Z",
  // Traverse
  "M64 142 L136 142 L136 160 L64 160 Z",
  // Losange central escripté
  "M100 132 L115 152 L100 172 L85 152 Z",
  // Volute du sommet (gauche)
  "M100 14 C86 2 62 4 56 20 C70 12 86 14 92 26 Z",
  // Volute du sommet (droite)
  "M100 14 C114 2 138 4 144 20 C130 12 114 14 108 26 Z",
  // Patin gauche
  "M18 204 L66 204 L66 218 L18 218 Z",
  // Patin droit
  "M134 204 L182 204 L182 218 L134 218 Z",
].join(" ");

export interface GoldCrucibleProps {
  /** `true` (clic n'importe où) → court-circuite la coulée vers l'état « ready ». */
  skip?: boolean;
  /** Entrée dans l'atelier (bouton révélé à la fin de la coulée). */
  onEnter?: () => void;
}

/** Micro-éclats sur les points saillants de la lettrine (phase « ready »). */
const GLINTS: { left: string; top: string; delay: string }[] = [
  { left: "50%", top: "16%", delay: "0s" },
  { left: "50%", top: "50%", delay: "1200ms" },
  { left: "28%", top: "74%", delay: "2400ms" },
];

/** Micro-braises dorées : ascension très lente, dérives latérales asymétriques. */
const EMBERS: {
  left: string;
  top: string;
  drift: string;
  delay: string;
  duration: string;
}[] = [
  { left: "34%", top: "70%", drift: "-14px", delay: "0ms", duration: "5200ms" },
  { left: "46%", top: "74%", drift: "8px", delay: "900ms", duration: "6000ms" },
  { left: "58%", top: "69%", drift: "18px", delay: "1800ms", duration: "4800ms" },
  { left: "40%", top: "62%", drift: "-22px", delay: "2700ms", duration: "7200ms" },
  { left: "64%", top: "64%", drift: "12px", delay: "3600ms", duration: "5600ms" },
];

/** Repères d'atelier laiton aux 4 angles du creuset. */
const CORNERS = [
  "top-1 left-1 border-t border-l",
  "top-1 right-1 border-t border-r",
  "bottom-1 left-1 border-b border-l",
  "bottom-1 right-1 border-b border-r",
];

/** Éclats lumineux projetés depuis la base, la traverse et le sommet du « A ». */
const SPARKS: { left: string; top: string; dx: string; dy: string; delay: string }[] = [
  { left: "34%", top: "72%", dx: "-40px", dy: "-52px", delay: "0ms" },
  { left: "66%", top: "72%", dx: "42px", dy: "-48px", delay: "180ms" },
  { left: "26%", top: "54%", dx: "-34px", dy: "-30px", delay: "320ms" },
  { left: "74%", top: "54%", dx: "36px", dy: "-34px", delay: "500ms" },
  { left: "46%", top: "40%", dx: "-20px", dy: "-46px", delay: "640ms" },
  { left: "54%", top: "40%", dx: "22px", dy: "-50px", delay: "760ms" },
  { left: "40%", top: "28%", dx: "-28px", dy: "-40px", delay: "880ms" },
  { left: "60%", top: "28%", dx: "30px", dy: "-42px", delay: "1000ms" },
];

/** Micro-gouttes d'or projetées, évanouies dans l'obscurité du creuset. */
const DROPS: { left: string; top: string; dx: string; dy: string; delay: string }[] = [
  { left: "38%", top: "66%", dx: "-14px", dy: "42px", delay: "220ms" },
  { left: "58%", top: "62%", dx: "16px", dy: "48px", delay: "480ms" },
  { left: "48%", top: "50%", dx: "-10px", dy: "38px", delay: "720ms" },
  { left: "62%", top: "44%", dx: "12px", dy: "36px", delay: "940ms" },
];

/**
 * **Creuset de fonderie** : la matrice de la lettrine « A » gravée dans un bloc de
 * fonte se remplit d'or en fusion par paliers (9,5 s, menisque concave, gerbes
 * d'étincelles), puis bascule sur une **ambiance de forge vivante** : lueur de
 * foyer instable (2,1 s / 3,7 s croisées), braises ascendantes et scintillements
 * d'arêtes — **aucun balayage ni faisceau oblique**. Démarrage **automatique**
 * (500 ms) ; un clic sur la zone du creuset (`skip`) abrège la coulée.
 */
export const GoldCrucible: React.FC<GoldCrucibleProps> = ({ skip = false, onEnter }) => {
  const [phase, setPhase] = useState<CruciblePhase>("idle");
  const [instant, setInstant] = useState(false);
  /** Pulsation thermique finale déclenchée par l'impulsion d'entrée. */
  const [flash, setFlash] = useState(false);
  const active = phase === "filling";
  const ready = phase === "ready";

  // Démarrage automatique après un court répit de stabilisation.
  useEffect(() => {
    const timer = window.setTimeout(
      () => setPhase((current) => (current === "idle" ? "filling" : current)),
      START_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, []);

  // Or au sommet → phase « ready » (boucle vivante + bouton).
  useEffect(() => {
    if (phase !== "filling") return;
    const timer = window.setTimeout(() => setPhase("ready"), POUR_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  // Court-circuit (clic n'importe où) : passage instantané à l'état « ready ».
  useEffect(() => {
    if (!skip) return;
    setInstant(true);
    setPhase("ready");
  }, [skip]);

  const filled = phase !== "idle";
  const heatFilter = active
    ? "drop-shadow(0 0 18px rgba(255, 140, 0, 0.45))"
    : ready
      ? "drop-shadow(0 1px 0 rgba(255,255,255,0.25)) drop-shadow(0 2px 3px rgba(0,0,0,0.85))"
      : "none";

  return (
    <div className="flex flex-col items-center">
      <div className="relative flex h-[300px] w-[300px] items-center justify-center rounded-xs border border-[#2b241c] bg-[#12100e] p-8 shadow-2xl">
      {/* Halo thermique pulsant (intensité croissante au fil du remplissage) */}
      {filled && (
        <div
          aria-hidden
          className="animate-heat-pulse pointer-events-none absolute -inset-6 rounded-full bg-[radial-gradient(circle,rgba(255,140,0,0.35)_0%,transparent_70%)]"
        />
      )}

      {/* Filet d'encadrement laiton + repères d'atelier aux angles */}
      <div className="pointer-events-none absolute inset-2 rounded-xs border border-[#8f6e2b]/40" />
      {CORNERS.map((position) => (
        <span
          key={position}
          aria-hidden
          className={`pointer-events-none absolute h-4 w-4 border-[#c5a059]/60 ${position}`}
        />
      ))}

      {/* Boucle vivante (derrière la matrice) : lueur de foyer — deux pulsations
          asynchrones, l'une ambrée et diffuse, l'autre braise et tramée. */}
      {ready && (
        <>
          <div
            aria-hidden
            className="animate-fire-flicker-a pointer-events-none absolute -inset-6 rounded-full bg-[radial-gradient(circle,rgba(212,175,55,0.55)_0%,transparent_68%)]"
          />
          <div
            aria-hidden
            className="animate-fire-flicker-b pointer-events-none absolute inset-1 rounded-xs bg-[radial-gradient(ellipse_at_bottom,rgba(255,85,0,0.42)_0%,rgba(212,175,55,0.18)_45%,transparent_75%)]"
          />
        </>
      )}

      {/* Matrice SVG de la lettrine */}
      <svg
        data-testid="gold-crucible"
        data-phase={phase}
        viewBox="0 -60 200 280"
        className="relative h-[220px] w-auto"
        style={{ filter: heatFilter }}
        aria-hidden
      >
        <defs>
          {/* Silhouette gravée de la lettrine servant de masque */}
          <clipPath id="renaissance-a-mask">
            <path d={LETTER_A_PATH} />
          </clipPath>
          {/* Or en fusion : étincelant → cœur incandescent */}
          <linearGradient id="moltenGold" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#ffe57f" />
            <stop offset="100%" stopColor="#ff6a00" />
          </linearGradient>
          {/* Or satiné d'Aldus (solidification) */}
          <linearGradient id="nobleGold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f3e7c4" />
            <stop offset="100%" stopColor="#aa832d" />
          </linearGradient>
        </defs>

        <g clipPath="url(#renaissance-a-mask)">
          {/* Fond de la matrice (métal creux) */}
          <rect x="0" y="0" width="200" height="220" fill="#0c0a08" />

          {/* Niveau d'or : montée par paliers (9,5 s), menisque concave & gerbes.
              `animate-molten-fill` gère la cinématique ; à l'arrivée en phase
              « ready » la classe est retirée et la position finale (translateY 0,
              identique au 100 % de l'animation) est reprise en style inline :
              aucun saut. */}
          <g
            className={active && !instant ? "animate-molten-fill" : undefined}
            style={{
              transform: filled ? "translateY(0)" : "translateY(220px)",
            }}
          >
            <rect
              data-testid="gold-crucible-fill"
              x="0"
              y="0"
              width="200"
              height="220"
              fill="url(#moltenGold)"
            />

            {/* Menisque ondulé à la crête du métal */}
            <g className="animate-meniscus">
              <path
                d="M-50 2 Q-25 -3 0 2 T50 2 T100 2 T150 2 T200 2 T250 2 L250 12 L-50 12 Z"
                fill="url(#moltenGold)"
                opacity="0.95"
              />
              <path
                d="M-50 2 Q-25 -3 0 2 T50 2 T100 2 T150 2 T200 2 T250 2"
                fill="none"
                stroke="#fff3a8"
                strokeWidth="1.5"
              />
            </g>

            {/* Gerbes et traits lumineux radiaux (salves brèves) */}
            {active && (
              <g className="animate-spark-streak" strokeLinecap="round">
                <line x1="100" y1="0" x2="56" y2="-34" stroke="#fff3a8" strokeWidth="2" />
                <line x1="100" y1="0" x2="146" y2="-38" stroke="#ff9900" strokeWidth="2" />
                <line x1="100" y1="0" x2="100" y2="-44" stroke="#fff3a8" strokeWidth="1.5" />
              </g>
            )}
          </g>

          {/* Solidification : or satiné d'Aldus */}
          <rect
            data-testid="gold-crucible-solid"
            x="0"
            y="0"
            width="200"
            height="220"
            fill="url(#nobleGold)"
            style={{
              opacity: ready ? 1 : 0,
              transition: `opacity ${SOLIDIFY_DURATION_MS}ms ease-in-out`,
            }}
          />
        </g>

        {/* Contour gravé (relief biseauté de la lettrine vénitienne) */}
        <path d={LETTER_A_PATH} fill="none" stroke="#8f6e2b" strokeWidth="1" />
      </svg>

      {/* Éclats lumineux projetés (base, traverse, sommet du A) */}
      {active &&
        SPARKS.map((spark) => (
          <span
            key={`${spark.left}-${spark.top}`}
            aria-hidden
            className="animate-spark-burst pointer-events-none absolute h-1 w-1 rounded-full bg-[#fff3a8] shadow-[0_0_6px_2px_rgba(255,153,0,0.7)]"
            style={
              {
                left: spark.left,
                top: spark.top,
                animationDelay: spark.delay,
                "--dx": spark.dx,
                "--dy": spark.dy,
              } as React.CSSProperties
            }
          />
        ))}

      {/* Micro-gouttes d'or projetées, évanouies dans l'obscurité */}
      {active &&
        DROPS.map((drop) => (
          <span
            key={`${drop.left}-${drop.top}`}
            aria-hidden
            className="animate-gold-drop pointer-events-none absolute h-1.5 w-1.5 rounded-full bg-[#ffb733]"
            style={
              {
                left: drop.left,
                top: drop.top,
                animationDelay: drop.delay,
                "--dx": drop.dx,
                "--dy": drop.dy,
              } as React.CSSProperties
            }
          />
        ))}

      {/* Boucle vivante : scintillements furtifs sur les arêtes (pointe, nœud, volute) */}
      {ready &&
        GLINTS.map((glint) => (
          <span
            key={`${glint.left}-${glint.top}`}
            aria-hidden
            className="animate-gold-glint pointer-events-none absolute h-2 w-2 rotate-45 bg-[#fff6cc] shadow-[0_0_10px_3px_rgba(255,214,80,0.8)]"
            style={{
              left: glint.left,
              top: glint.top,
              marginLeft: "-0.25rem",
              marginTop: "-0.25rem",
              animationDelay: glint.delay,
            }}
          />
        ))}

      {/* Boucle vivante : braises dorées s'élevant et s'évaporant */}
      {ready &&
        EMBERS.map((ember) => (
          <span
            key={`${ember.left}-${ember.top}`}
            aria-hidden
            className="animate-ember pointer-events-none absolute h-1.5 w-1.5 rounded-full bg-[#ffd700] shadow-[0_0_6px_2px_rgba(255,140,0,0.55)]"
            style={
              {
                left: ember.left,
                top: ember.top,
                animationDelay: ember.delay,
                animationDuration: ember.duration,
                "--drift-x": ember.drift,
              } as React.CSSProperties
            }
          />
        ))}

      {/* Impulsion d'entrée : pulsation thermique finale du creuset (0–150 ms) */}
      {flash && (
        <div
          aria-hidden
          data-testid="gold-crucible-flash"
          className="animate-finale-pulse pointer-events-none absolute -inset-4 rounded-full bg-[radial-gradient(circle,rgba(255,214,120,0.85)_0%,rgba(255,120,0,0.35)_45%,transparent_72%)]"
        />
      )}

      </div>

      {/* Bouton « Entrer dans l'atelier » — révélé à la fin de la coulée */}
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setFlash(true); // impulsion : pulsation thermique finale (320 ms)
          window.setTimeout(() => setFlash(false), 320);
          onEnter?.();
        }}
        aria-hidden={!ready}
        className={`mt-8 border border-[#997728]/50 bg-linear-to-b from-[#2e1d0f] to-[#170f07] px-8 py-2.5 font-serif text-xs uppercase tracking-[0.28em] text-[#eedcb8] shadow-lg transition-all duration-700 hover:scale-[1.01] hover:border-[#ffd700] hover:text-[#ffd700] hover:shadow-[0_0_24px_rgba(212,175,55,0.25)] active:scale-[0.99] ${
          ready
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-3 opacity-0"
        }`}
      >
        [ Entrer dans l&rsquo;atelier &rsaquo; ]
      </button>
    </div>
  );
};