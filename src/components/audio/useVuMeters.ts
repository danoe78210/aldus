import { useCallback, useEffect, useRef, type RefObject } from "react";
import { invokeCommand, isInvokeAvailable } from "../../utils/tauri";

export const VU_REST_ANGLE = -45;
export const VU_CREST_ANGLE = 40;
const FLOOR_DB = -20;
const CEILING_DB = 3;
/** Calage de l'échelle : 0 VU est atteint à -20 dBFS efficaces, niveau courant d'une voix de synthèse. */
const REFERENCE_DB = 20;
const FFT_SIZE = 512;
const ATTACK_SECONDS = 0.04;
const RELEASE_SECONDS = 0.1;
const SETTLED = 0.002;

const amplitude = (db: number): number => 10 ** (db / 20);

/** Position 0..1 d'un niveau en dB sur l'échelle d'un VU-mètre (graduée en tension, pas en dB). */
export const dbToLevel = (db: number): number => {
  const low = amplitude(FLOOR_DB);
  const high = amplitude(CEILING_DB);
  return (Math.min(Math.max(amplitude(db), low), high) - low) / (high - low);
};

export const levelToAngle = (level: number): number => VU_REST_ANGLE + level * (VU_CREST_ANGLE - VU_REST_ANGLE);

interface Graph {
  analysers: AnalyserNode[];
  disconnect: () => void;
}

let sharedContext: AudioContext | null = null;

const report = (reason: unknown): void => {
  const message = `Magnétophone : analyse audio indisponible (${reason instanceof Error ? reason.message : String(reason)}).`;
  console.error(message);
  if (isInvokeAvailable()) void invokeCommand("log_frontend", { level: "error", message }).catch((cause) => console.error("Transmission au journal Aldus impossible :", cause));
};

/** Source → haut-parleurs d'abord (le son ne dépend jamais de l'analyse), puis source → stéréo forcée → un analyseur par canal. */
const connect = (audio: HTMLAudioElement): Graph => {
  sharedContext ??= new AudioContext();
  const context = sharedContext;
  const source = context.createMediaElementSource(audio);
  source.connect(context.destination);
  const stereo = context.createGain();
  stereo.channelCount = 2;
  stereo.channelCountMode = "explicit";
  stereo.channelInterpretation = "speakers";
  const splitter = context.createChannelSplitter(2);
  source.connect(stereo);
  stereo.connect(splitter);
  const analysers = [0, 1].map((channel) => {
    const analyser = context.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = 0.3;
    splitter.connect(analyser, channel);
    return analyser;
  });
  return { analysers, disconnect: () => [source, stereo, splitter, ...analysers].forEach((node) => node.disconnect()) };
};

const measure = (analyser: AnalyserNode, buffer: Uint8Array<ArrayBuffer>): number => {
  analyser.getByteTimeDomainData(buffer);
  let sum = 0;
  for (const sample of buffer) sum += ((sample - 128) / 128) ** 2;
  return dbToLevel(20 * Math.log10(Math.sqrt(sum / buffer.length)) + REFERENCE_DB);
};

/**
 * Aiguilles de VU-mètre pilotées par le signal réel de l'élément audio : RMS par canal, attaque rapide,
 * retombée lente, retour en douceur à la butée de repos à l'arrêt. Les transformations sont écrites
 * directement sur les aiguilles (pas de rendu React à 60 images/s).
 */
export const useVuMeters = (audioRef: RefObject<HTMLAudioElement | null>, playing: boolean) => {
  const left = useRef<SVGLineElement>(null);
  const right = useRef<SVGLineElement>(null);
  const graph = useRef<Graph | null>(null);
  const failed = useRef(false);
  const levels = useRef([0, 0]);

  /** À appeler avant `play()` : branche l'analyse et réveille le contexte suspendu par le navigateur. */
  const prepare = useCallback(() => {
    const audio = audioRef.current;
    if (audio && !graph.current && !failed.current) {
      try {
        graph.current = connect(audio);
      } catch (reason) {
        failed.current = true;
        report(reason);
      }
    }
    if (sharedContext?.state === "suspended") sharedContext.resume().catch(report);
  }, [audioRef]);

  useEffect(() => () => {
    graph.current?.disconnect();
    graph.current = null;
  }, []);

  useEffect(() => {
    if (playing) prepare();
    const needles = [left.current, right.current];
    const buffer = new Uint8Array(FFT_SIZE);
    let last = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const elapsed = Math.min((now - last) / 1000, 0.1);
      last = now;
      let moving = false;
      needles.forEach((needle, channel) => {
        const analyser = graph.current?.analysers[channel];
        const target = playing && analyser ? measure(analyser, buffer) : 0;
        const current = levels.current[channel];
        const smoothed = current + (target - current) * (1 - Math.exp(-elapsed / (target > current ? ATTACK_SECONDS : RELEASE_SECONDS)));
        levels.current[channel] = !playing && smoothed < SETTLED ? 0 : smoothed;
        if (levels.current[channel] > 0) moving = true;
        if (needle) needle.style.transform = `rotate(${levelToAngle(levels.current[channel])}deg)`;
      });
      if (playing || moving) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, prepare]);

  return { left, right, prepare };
};
