import { useCallback, useEffect, useState } from "react";
import type { AudioConfig, AudioVoice } from "../../types";
import { getAudioConsent, listAudioVoices, listenAudioInitProgress, saveAudioConsent, startAudioEngine } from "../../utils/libraryApi";

export const INACTIVE_TTS_MESSAGE = "Le moteur vocal local est inactif. Veuillez lancer le wrapper TTS sur le port 8020 ou configurer ALDUS_TTS_URL.";

const messageOf = (reason: unknown): string => (reason instanceof Error ? reason.message : INACTIVE_TTS_MESSAGE);

export const useAudioEngine = () => {
  const [voices, setVoices] = useState<AudioVoice[]>([]);
  const [voiceId, setVoiceId] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [initPercent, setInitPercent] = useState<number | null>(null);
  const [engineMode, setEngineMode] = useState<AudioConfig["engine_mode"]>("external");
  const [cpmlAccepted, setCpmlAccepted] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);

  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | null = null;
    const initialize = async () => {
      setChecking(true);
      setInitPercent(0);
      let shouldOfferSetup = true;
      try {
        const stopProgress = await listenAudioInitProgress((progress) => {
          if (!active) return;
          setInitPercent(progress.isReady ? 100 : progress.error ? null : progress.percent);
          if (progress.error) setVoiceError(progress.error);
        });
        if (!active) {
          stopProgress?.();
          return;
        }
        unlisten = stopProgress;
        const config = await getAudioConsent();
        if (!active) return;
        setEngineMode(config.engine_mode);
        setCpmlAccepted(config.cpml_accepted);
        if (config.engine_mode === "integrated" && !config.cpml_accepted) {
          setVoiceId("");
          setVoiceError("L'accord CPML est requis pour télécharger et utiliser XTTS v2.");
          setSetupOpen(true);
          return;
        }
        shouldOfferSetup = config.engine_mode === "external";
        const available = config.engine_mode === "integrated" ? await startAudioEngine() : await listAudioVoices();
        if (!active) return;
        if (available.length === 0) {
          setVoices([]);
          setVoiceId("");
          setVoiceError(INACTIVE_TTS_MESSAGE);
          if (config.engine_mode === "external") setSetupOpen(true);
          return;
        }
        setVoices(available);
        setVoiceId((current) => current || available[0]?.id || "");
        setVoiceError(null);
      } catch (reason: unknown) {
        if (active) {
          setVoiceError(messageOf(reason));
          if (shouldOfferSetup) setSetupOpen(true);
        }
      } finally {
        if (active) {
          setChecking(false);
          setInitPercent(null);
        }
      }
    };
    void initialize();
    return () => {
      active = false;
      unlisten?.();
    };
  }, []);

  const adopt = useCallback((available: AudioVoice[]) => {
    if (available.length === 0) throw new Error(INACTIVE_TTS_MESSAGE);
    setVoices(available);
    setVoiceId((current) => (available.some((voice) => voice.id === current) ? current : available[0].id));
    setVoiceError(null);
  }, []);

  const retry = useCallback(async () => {
    setChecking(true);
    try {
      adopt(engineMode === "integrated" ? await startAudioEngine() : await listAudioVoices());
      setSetupOpen(false);
    } catch (reason) {
      setVoiceError(messageOf(reason));
    } finally {
      setChecking(false);
    }
  }, [adopt, engineMode]);

  const acceptAndStart = useCallback(async () => {
    setSetupOpen(false);
    setChecking(true);
    try {
      await saveAudioConsent(true);
      setCpmlAccepted(true);
      setEngineMode("integrated");
      setVoiceError(null);
      adopt(await startAudioEngine());
    } catch (reason) {
      setVoiceError(messageOf(reason));
    } finally {
      setChecking(false);
    }
  }, [adopt]);

  return { voices, voiceId, setVoiceId, voiceError, setVoiceError, checking, initPercent, engineMode, cpmlAccepted, setupOpen, setSetupOpen, retry, acceptAndStart };
};
