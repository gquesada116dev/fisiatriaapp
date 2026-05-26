/**
 * Generates a pre or post-lecture podcast script (JSON + TXT) for a topic.
 * Audio is generated manually in ElevenLabs and uploaded via process-podcast-wav.ts
 *
 * Usage:
 *   tsx scripts/generate-podcast-script.ts --slug=rehabilitacion-cardiaca --type=pre
 *   tsx scripts/generate-podcast-script.ts --slug=rehabilitacion-cardiaca --type=post
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";

const SLUG = process.argv.find((a) => a.startsWith("--slug="))?.split("=")[1];
const TYPE = (process.argv.find((a) => a.startsWith("--type="))?.split("=")[1] ?? "pre") as "pre" | "post";
if (!SLUG) { console.error("Falta --slug=<slug>"); process.exit(1); }

const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const SYSTEM = `Eres un médico fisiatra docente en Costa Rica (CENDEISSS/CCSS/CENARE), preparando residentes para el examen de admisión de segunda etapa de Medicina Física y Rehabilitación.

REGLA FUNDAMENTAL: Todo dato, estadística, clasificación y terminología que uses debe provenir ÚNICAMENTE del texto del capítulo que se te adjunta. No agregues información externa. El capítulo es la fuente de verdad. Usa la terminología exacta del capítulo.`;

function extractPrimarySource(fullText: string): string {
  // Extract only the primary source section (Frontera), before the secondary source marker
  const secondaryMarker = "=== FUENTE SECUNDARIA";
  const idx = fullText.indexOf(secondaryMarker);
  return idx !== -1 ? fullText.slice(0, idx).trim() : fullText;
}

function buildPrompt(type: "pre" | "post"): string {
  if (type === "pre") {
    return `Escribe un guion de podcast PRE-LECTURA en español (Costa Rica) basándote en el capítulo adjunto.

Personajes:
- C: Presentadora. Habla directamente a Bele (la residente oyente principal). Tono cálido y motivador, como una mentora que la prepara para la lectura. SOLO la Presentadora puede usar el nombre "Bele".
- A: Dr. Marín, fisiatra académico. Estructura conceptual, datos concretos del capítulo. NUNCA dice "Bele" — habla en tercera persona ("el residente", "uno como médico") o directamente sobre el tema.
- B: Dra. Vargas, fisiatra clínica. Conecta con la práctica, ejemplos de pacientes reales. NUNCA dice "Bele" — habla en tercera persona o directamente sobre el tema.

Estructura OBLIGATORIA:
1. INTRO — C (1 intervención): La Presentadora le habla a Bele directamente. La sitúa en el tema, por qué importa en su práctica clínica, qué va a encontrar en el capítulo. Emotivo y práctico.
2. DESARROLLO — A/B alternando (20-28 intervenciones): Mapa mental del capítulo en orden lógico. Conversación natural costarricense ("uno", "vea", "fíjese", "exactamente"). Cada intervención 3-5 oraciones.
3. OUTRO — C (1 intervención): La Presentadora le deja a Bele 3 preguntas para responder después de leer el capítulo. Cierre motivador y personal, usando su nombre.

Reglas:
- Tono para escuchar manejando: claro, con transiciones naturales.
- NUNCA mencionen ser una IA.
- Solo la Presentadora (C) usa el nombre "Bele". Dr. Marín y Dra. Vargas NUNCA lo usan.
- NUNCA uses siglas en mayúsculas (AHA, ECG, MET, NYHA, etc.) — sustitúyelas por el nombre completo en español o una descripción equivalente. Solo usa una sigla si no existe otra forma de expresarlo.
- NUNCA uses palabras en inglés. Todo en español: "rehabilitación" en vez de "rehab", "frecuencia cardíaca" en vez de "heart rate", etc.
- Todo contenido debe provenir ÚNICAMENTE del capítulo adjunto.

JSON exacto (sin markdown):
{ "script": [{ "speaker": "C", "text": "..." }, { "speaker": "A", "text": "..." }] }`;
  }

  return `Escribe un guion de podcast POST-LECTURA en español (Costa Rica) basándote en el capítulo adjunto.

Personajes:
- C: Presentadora. Habla directamente a Bele (la residente oyente principal). Tono de refuerzo y consolidación — ella ya leyó el capítulo. SOLO la Presentadora puede usar el nombre "Bele".
- A: Dr. Marín, fisiatra académico. Profundiza en conceptos clave, aclara lo que suele confundir, da los datos exactos del capítulo que caen en exámenes. NUNCA dice "Bele" — habla en tercera persona ("el residente", "uno como médico") o directamente sobre el tema.
- B: Dra. Vargas, fisiatra clínica. Conecta los conceptos con casos clínicos reales, errores comunes en práctica, perlas clínicas. NUNCA dice "Bele" — habla en tercera persona o directamente sobre el tema.

Estructura OBLIGATORIA:
1. INTRO — C (1 intervención): La Presentadora felicita a Bele por haber leído el capítulo y le dice que ahora van a consolidar lo más importante. Usa su nombre. Tono motivador.
2. DESARROLLO — A/B alternando (22-30 intervenciones): Repaso profundo de los puntos de alto rendimiento del capítulo: clasificaciones, criterios, datos numéricos exactos, errores comunes, casos clínicos. Más profundo que el pre. Cada intervención 3-5 oraciones.
3. OUTRO — C (1 intervención): La Presentadora cierra con las 3 cosas que Bele debe poder decir de memoria el día del examen. Cierre motivador y personal.

Reglas:
- Tono de repaso activo, no de introducción — el oyente ya leyó.
- NUNCA mencionen ser una IA.
- Solo la Presentadora (C) usa el nombre "Bele". Dr. Marín y Dra. Vargas NUNCA lo usan.
- NUNCA uses siglas en mayúsculas (AHA, ECG, MET, NYHA, etc.) — sustitúyelas por el nombre completo en español o una descripción equivalente. Solo usa una sigla si no existe otra forma de expresarlo.
- NUNCA uses palabras en inglés. Todo en español: "rehabilitación" en vez de "rehab", "frecuencia cardíaca" en vez de "heart rate", etc.
- Todo contenido debe provenir ÚNICAMENTE del capítulo adjunto.

JSON exacto (sin markdown):
{ "script": [{ "speaker": "C", "text": "..." }, { "speaker": "A", "text": "..." }] }`;
}

async function main() {
  const chapterPath = path.join(__dirname, "chapter-sources", `${SLUG}.txt`);
  if (!fs.existsSync(chapterPath)) {
    console.error(`Archivo no encontrado: ${chapterPath}`);
    process.exit(1);
  }

  const fullText = fs.readFileSync(chapterPath, "utf-8");
  const chapterText = extractPrimarySource(fullText);
  console.log(`\n📖 ${SLUG} [${TYPE}] — ${(chapterText.length / 1000).toFixed(1)}k chars (solo Frontera)\n`);

  const taskPrompt = buildPrompt(TYPE);

  console.log("Generando script con Claude...");
  const resp = await ai.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 14000,
    system: SYSTEM,
    messages: [{
      role: "user",
      content: `--- TEXTO DEL CAPÍTULO ---\n${chapterText}\n--- FIN DEL CAPÍTULO ---\n\n${taskPrompt}`,
    }],
  });

  let raw = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text).join("").trim();
  raw = raw.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```\s*$/, "");

  const { script } = JSON.parse(raw) as { script: { speaker: string; text: string }[] };

  const outDir = path.join(__dirname, "podcast-sources");
  fs.mkdirSync(outDir, { recursive: true });

  const jsonPath = path.join(outDir, `${SLUG}--${TYPE}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(script, null, 2));

  const txtPath = path.join(outDir, `${SLUG}--${TYPE}.txt`);
  fs.writeFileSync(txtPath, script.map((l) => l.text).join("\n\n"));

  const byC = script.filter((l) => l.speaker === "C").length;
  const byA = script.filter((l) => l.speaker === "A").length;
  const byB = script.filter((l) => l.speaker === "B").length;

  console.log(`✓ Script [${TYPE}]: ${script.length} intervenciones (C=${byC}, A=${byA}, B=${byB})`);
  console.log(`  JSON → ${jsonPath}`);
  console.log(`  TXT  → ${txtPath}`);
  console.log(`  Tokens output: ${resp.usage.output_tokens}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
