"""Loopback-only XTTS v2 adapter for Aldus's local audio API.

Install this wrapper in a separate Python 3.10 environment. XTTS weights are
downloaded on first use and are never bundled with the Aldus desktop app.
"""

from __future__ import annotations

import json
import logging
import os
import sys
import tempfile
import threading
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

if os.environ.get("ALDUS_LOCAL_DATA_DIR"):
    DATA_ROOT = Path(os.environ["ALDUS_LOCAL_DATA_DIR"]).expanduser().resolve()
elif sys.platform == "win32":
    DATA_ROOT = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData/Local")) / "net.danoe.aldus"
else:
    DATA_ROOT = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local/share")) / "net.danoe.aldus"

MODEL_DIR = DATA_ROOT / "models"
CACHE_DIR = DATA_ROOT / "cache"
TEMP_DIR = DATA_ROOT / "temp"
CONFIG_DIR = DATA_ROOT / "config"
for directory in (MODEL_DIR, CACHE_DIR, TEMP_DIR, CONFIG_DIR):
    directory.mkdir(parents=True, exist_ok=True)

os.environ["ALDUS_LOCAL_DATA_DIR"] = str(DATA_ROOT)
os.environ["TTS_HOME"] = str(MODEL_DIR)
os.environ["HF_HOME"] = str(CACHE_DIR / "huggingface")
os.environ["TRANSFORMERS_CACHE"] = str(CACHE_DIR / "transformers")
os.environ["TORCH_HOME"] = str(CACHE_DIR / "torch")
os.environ["XDG_CACHE_HOME"] = str(CACHE_DIR)
os.environ["XDG_CONFIG_HOME"] = str(CONFIG_DIR)
os.environ["MPLCONFIGDIR"] = str(CACHE_DIR / "matplotlib")
os.environ["NUMBA_CACHE_DIR"] = str(CACHE_DIR / "numba")
os.environ["HF_DATASETS_CACHE"] = str(CACHE_DIR / "huggingface" / "datasets")
os.environ["TEMP"] = str(TEMP_DIR)
os.environ["TMP"] = str(TEMP_DIR)
os.environ["TMPDIR"] = str(TEMP_DIR)
os.environ["PYTHONPYCACHEPREFIX"] = str(CACHE_DIR / "pycache")

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field
from pydub import AudioSegment

FFMPEG_PATH = os.environ.get("ALDUS_FFMPEG_PATH")
if FFMPEG_PATH:
    AudioSegment.converter = FFMPEG_PATH

MODEL_NAME = os.environ.get(
    "ALDUS_XTTS_MODEL", "tts_models/multilingual/multi-dataset/xtts_v2"
)
MAX_SEGMENT_CHARS = 240
torch: Any = None
TTS: Any = None
MODEL = None
VOICES: dict[str, dict[str, Any]] = {}
SYNTHESIS_LOCK = threading.Lock()
VOICE_LOCK = threading.Lock()
STATUS_LOCK = threading.Lock()
INIT_STATUS: dict[str, Any] = {
    "status": "initializing",
    "percent": 10,
    "stage": "Démarrage du processus sidecar Python",
    "model_loaded": False,
    "ready": False,
    "error": None,
}
LOGGER = logging.getLogger("aldus.xtts")
LOGGER.setLevel(logging.INFO)
if not LOGGER.handlers:
    _console_handler = logging.StreamHandler()
    _console_handler.setFormatter(
        logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s")
    )
    LOGGER.addHandler(_console_handler)
LOGGER.propagate = False


def _set_init_status(
    percent: int,
    stage: str,
    *,
    model_loaded: bool | None = None,
    ready: bool = False,
    error: str | None = None,
) -> None:
    with STATUS_LOCK:
        status = "error" if error is not None else "ready" if ready else "initializing"
        INIT_STATUS.update(status=status, percent=percent, stage=stage, ready=ready, error=error)
        if model_loaded is not None:
            INIT_STATUS["model_loaded"] = model_loaded


def _current_init_status() -> dict[str, Any]:
    with STATUS_LOCK:
        return dict(INIT_STATUS)


def _initialize_model() -> None:
    global MODEL, torch, TTS
    try:
        _set_init_status(35, "Import des dépendances Python et initialisation PyTorch/CUDA")
        import torch as torch_module
        from TTS.api import TTS as tts_class

        torch = torch_module
        TTS = tts_class
        _set_init_status(65, "Vérification ou téléchargement des poids XTTS v2")
        MODEL = TTS(model_name=MODEL_NAME, progress_bar=False, gpu=torch.cuda.is_available())
        _set_init_status(85, "Modèle XTTS chargé en mémoire", model_loaded=True)
        LOGGER.info("XTTS model initialization completed")
    except Exception as error:
        LOGGER.exception("XTTS initialization failed")
        _set_init_status(0, "Échec de l'initialisation XTTS", error=str(error))


@asynccontextmanager
async def lifespan(_: FastAPI):
    threading.Thread(target=_initialize_model, name="aldus-xtts-init", daemon=True).start()
    yield


def _voice_profiles(model: Any) -> dict[str, dict[str, Any]]:
    """Load local reference clips, or expose XTTS's bundled speaker profiles."""
    raw_profiles = os.environ.get("ALDUS_TTS_VOICES", "")
    if raw_profiles:
        try:
            profiles = json.loads(raw_profiles)
        except json.JSONDecodeError as error:
            raise RuntimeError("ALDUS_TTS_VOICES must contain a JSON object") from error
        result = {}
        for voice_id, profile in profiles.items():
            reference = Path(profile.get("speakerWav", "")).expanduser()
            if not reference.is_file():
                continue
            result[voice_id] = {
                "name": profile.get("name", voice_id),
                "language": profile.get("language", "fr-FR"),
                "speakerWav": str(reference.resolve()),
            }
        return result

    speakers = getattr(model, "speakers", None) or []
    if not speakers:
        manager = getattr(
            getattr(getattr(model, "synthesizer", None), "tts_model", None),
            "speaker_manager",
            None,
        )
        speakers = list(getattr(manager, "speakers", {}).keys())
    return {
        speaker: {"name": speaker, "language": "fr-FR", "speaker": speaker}
        for speaker in speakers
    }


app = FastAPI(title="Aldus XTTS local adapter", docs_url=None, redoc_url=None, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "tauri://localhost",
        "https://tauri.localhost",
        "http://tauri.localhost",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.get("/health")
def health() -> dict[str, bool]:
    return {"ready": _current_init_status()["ready"]}


@app.get("/status")
def status() -> dict[str, Any]:
    return _current_init_status()


class SynthesisRequest(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_SEGMENT_CHARS)
    voice_id: str = Field(alias="voiceId")
    language: str = "fr"
    output_format: str = Field(default="mp3", alias="outputFormat")
    chapter_index: int | None = Field(default=None, alias="chapterIndex")
    chapter_title: str | None = Field(default=None, alias="chapterTitle")
    segment_index: int | None = Field(default=None, alias="segmentIndex")
    segment_count: int | None = Field(default=None, alias="segmentCount")


@app.get("/voices")
def list_voices() -> dict[str, list[dict[str, str]]]:
    global VOICES
    initialization = _current_init_status()
    if not initialization["ready"] or MODEL is None:
        raise HTTPException(
            status_code=503,
            detail=initialization["error"] or initialization["stage"],
        )
    try:
        with VOICE_LOCK:
            if not VOICES:
                VOICES = _voice_profiles(MODEL)
        if not VOICES:
            raise RuntimeError("Aucun profil vocal français n'est exposé par le modèle XTTS.")
        _set_init_status(95, "Profils vocaux indexés", model_loaded=True, ready=True)
    except Exception as error:
        LOGGER.exception("XTTS voice profile indexing failed")
        _set_init_status(85, "Échec de l'indexation des voix", error=f"{type(error).__name__}: {error}")
        raise HTTPException(
            status_code=503,
            detail=f"Voice profile indexing failed: {type(error).__name__}: {error}",
        ) from error
    return {
        "voices": [
            {"id": voice_id, "name": profile["name"], "language": profile["language"]}
            for voice_id, profile in VOICES.items()
            if str(profile["language"]).lower().startswith("fr")
        ]
    }


@app.post("/synthesize")
def synthesize(request: SynthesisRequest) -> Response:
    if MODEL is None:
        initialization = _current_init_status()
        raise HTTPException(
            status_code=503,
            detail=initialization["error"] or initialization["stage"],
        )
    context = (
        f"chapter={request.chapter_index or '?'} title={request.chapter_title or '?'} "
        f"segment={request.segment_index or '?'}/{request.segment_count or '?'} "
        f"voice={request.voice_id} characters={len(request.text)}"
    )
    if request.output_format.lower() != "mp3":
        LOGGER.warning("Rejected synthesis output format=%s %s", request.output_format, context)
        raise HTTPException(status_code=400, detail="Only MP3 output is supported")
    if not request.language.lower().startswith("fr"):
        LOGGER.warning("Rejected synthesis language=%s %s", request.language, context)
        raise HTTPException(status_code=400, detail="Only French synthesis is enabled")
    profile = VOICES.get(request.voice_id)
    if not profile or not str(profile["language"]).lower().startswith("fr"):
        LOGGER.warning("Rejected unknown/non-French voice %s", context)
        raise HTTPException(status_code=404, detail="French voice profile not found")

    started_at = time.perf_counter()
    LOGGER.info("XTTS synthesis started %s", context)
    try:
        with tempfile.TemporaryDirectory(prefix="aldus-xtts-") as temp_dir:
            wav_path = Path(temp_dir) / "chapter.wav"
            mp3_path = Path(temp_dir) / "chapter.mp3"
            options = {"speaker_wav": profile["speakerWav"]} if "speakerWav" in profile else {"speaker": profile["speaker"]}
            with SYNTHESIS_LOCK:
                MODEL.tts_to_file(
                    text=request.text,
                    file_path=str(wav_path),
                    language="fr",
                    **options,
                )
            AudioSegment.from_wav(wav_path).export(
                mp3_path, format="mp3", bitrate="192k"
            )
            payload = mp3_path.read_bytes()
    except torch.cuda.OutOfMemoryError as error:
        LOGGER.exception("XTTS CUDA out of memory %s", context)
        raise HTTPException(
            status_code=503,
            detail=f"CUDA out of memory during XTTS inference ({context}): {error}",
        ) from error
    except MemoryError as error:
        LOGGER.exception("XTTS host memory exhausted %s", context)
        raise HTTPException(
            status_code=503,
            detail=f"Host memory exhausted during XTTS inference ({context}): {error}",
        ) from error
    except Exception as error:  # Keep the server alive and return an actionable segment error.
        LOGGER.exception("XTTS synthesis or MP3 conversion failed %s", context)
        raise HTTPException(
            status_code=500,
            detail=f"XTTS synthesis failed ({context}): {type(error).__name__}: {error}",
        ) from error

    LOGGER.info(
        "XTTS synthesis completed %s bytes=%d elapsed_ms=%d",
        context,
        len(payload),
        round((time.perf_counter() - started_at) * 1000),
    )
    return Response(
        content=payload,
        media_type="audio/mpeg",
        headers={"Content-Disposition": 'inline; filename="chapter.mp3"'},
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="127.0.0.1",
        port=int(os.environ.get("ALDUS_TTS_PORT", "8020")),
        log_level="info",
    )