import { createServer } from "node:http";

const HOST = "127.0.0.1";
const PORT = 8020;
const SAMPLE_RATE = 22050;
const MAX_BODY_BYTES = 16384;
const ALLOWED_ORIGINS = new Set(["tauri://localhost", "https://tauri.localhost", "http://tauri.localhost", "http://localhost:5173", "http://127.0.0.1:5173"]);
const VOICES = [
  { id: "Gracie Wise", name: "Gracie Wise", language: "fr-FR", pitchHz: 262 },
  { id: "Narrateur Grave", name: "Narrateur Grave", language: "fr-FR", pitchHz: 110 },
  { id: "Voix Féminine 1", name: "Voix Féminine 1", language: "fr-FR", pitchHz: 330 },
  { id: "Voix Féminine 2", name: "Voix Féminine 2", language: "fr-FR", pitchHz: 392 },
];

const sendJson = (response, status, payload) => {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
};

const fail = (response, status, detail) => sendJson(response, status, { detail });

const readBody = (request) => new Promise((resolve, reject) => {
  const chunks = [];
  let size = 0;
  request.on("data", (chunk) => {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) reject(new Error("Corps de requête trop volumineux."));
    else chunks.push(chunk);
  });
  request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  request.on("error", reject);
});

const toneWav = (text, pitchHz) => {
  const seconds = Math.min(3, Math.max(2, text.length / 70));
  const frames = Math.round(seconds * SAMPLE_RATE);
  const samples = Buffer.alloc(frames * 2);
  const fade = Math.round(0.03 * SAMPLE_RATE);
  for (let frame = 0; frame < frames; frame += 1) {
    const t = frame / SAMPLE_RATE;
    const pulse = 0.5 + 0.5 * Math.sin(2 * Math.PI * 3.5 * t);
    const swell = 0.6 + 0.4 * Math.sin(2 * Math.PI * 0.5 * t);
    const edge = Math.min(1, frame / fade, (frames - frame) / fade);
    const tone = Math.sin(2 * Math.PI * pitchHz * t) * 0.6
      + Math.sin(2 * Math.PI * pitchHz * 1.5 * t) * 0.3
      + Math.sin(2 * Math.PI * pitchHz * 2 * t) * 0.1;
    const value = Math.max(-1, Math.min(1, tone * pulse * swell * edge * 0.6));
    samples.writeInt16LE(Math.round(value * 32767), frame * 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + samples.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(samples.length, 40);
  return Buffer.concat([header, samples]);
};

const synthesize = async (request, response) => {
  let payload;
  try {
    payload = JSON.parse(await readBody(request));
  } catch (error) {
    return fail(response, 400, error instanceof Error ? error.message : "Requête JSON invalide.");
  }
  const { text, voiceId, language, outputFormat, chapterTitle, segmentIndex, segmentCount } = payload ?? {};
  if (outputFormat !== "mp3") return fail(response, 400, "Format non pris en charge : le mock attend outputFormat « mp3 ».");
  if (language !== "fr") return fail(response, 400, "Langue non prise en charge : seul « fr » est accepté.");
  if (typeof text !== "string" || text.trim().length === 0 || text.length > 240) {
    return fail(response, 400, "Texte invalide : 1 à 240 caractères attendus.");
  }
  const voice = VOICES.find((candidate) => candidate.id === voiceId);
  if (!voice) return fail(response, 404, `Voix inconnue : ${voiceId}`);
  console.log(`[mock-tts] synthèse ${voice.id} · ${text.length} car. · ${chapterTitle ?? "?"} ${segmentIndex ?? "?"}/${segmentCount ?? "?"}`);
  response.writeHead(200, { "Content-Type": "audio/wav" });
  response.end(toneWav(text, voice.pitchHz));
};

const server = createServer(async (request, response) => {
  const origin = request.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }
  response.setHeader("Access-Control-Allow-Methods", "GET, POST");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }
  const path = new URL(request.url ?? "/", `http://${HOST}`).pathname;
  try {
    if (request.method === "GET" && path === "/health") return sendJson(response, 200, { ready: true });
    if (request.method === "GET" && path === "/status") {
      return sendJson(response, 200, { status: "ready", percent: 100, stage: "Moteur de démonstration prêt", model_loaded: true, ready: true, error: null });
    }
    if (request.method === "GET" && path === "/voices") {
      return sendJson(response, 200, { voices: VOICES.map(({ id, name, language }) => ({ id, name, language })) });
    }
    if (request.method === "POST" && path === "/synthesize") return await synthesize(request, response);
    return fail(response, 404, "Route inconnue.");
  } catch (error) {
    console.error("[mock-tts] erreur interne", error);
    return fail(response, 500, "Erreur interne du mock.");
  }
});

server.on("error", (error) => {
  console.error(error.code === "EADDRINUSE" ? `Port ${PORT} déjà utilisé : fermez l'autre serveur TTS.` : error);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`Mock TTS Aldus prêt sur http://${HOST}:${PORT} (voix : ${VOICES.map((voice) => voice.id).join(", ")})`);
});
