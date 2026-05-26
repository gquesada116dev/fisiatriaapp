/**
 * Generates a pre-lecture podcast script (JSON + TXT) for a topic.
 * Audio is generated manually in ElevenLabs and uploaded via process-podcast-wav.ts
 *
 * Usage:
 *   tsx scripts/generate-podcast-script.ts --slug=rehabilitacion-cardiaca
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";

const SLUG = process.argv.find((a) => a.startsWith("--slug="))?.split("=")[1];
if (!SLUG) { console.error("Falta --slug=<slug>"); process.exit(1); }

const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const SYSTEM = `Eres un médico fisiatra docente en Costa Rica (CENDEISSS/CCSS/CENARE), preparando residentes para el examen de admisión de segunda etapa de Medicina Física y Rehabilitación.

REGLA FUNDAMENTAL: Todo dato, estadística, clasificación y terminología que uses debe provenir ÚNICAMENTE del texto del capítulo que se te adjunta. No agregues información externa. El capítulo es la fuente de verdad. Usa la terminología exacta del capítulo.`;

async function main() {
  const chapterPath = path.join(__dirname, "chapter-sources", `${SLUG}.txt`);
  if (!fs.existsSync(chapterPath)) {
    console.error(`Archivo no encontrado: ${chapterPath}`);
    process.exit(1);
  }
  const chapterText = fs.readFileSync(chapterPath, "utf-8");
  console.log(`\n📖 ${SLUG} — ${(chapterText.length / 1000).toFixed(1)}k chars\n`);

  const taskPrompt = `Escribe un guion de podcast PRE-LECTURA en español (Costa Rica) basándote en el capítulo adjunto.

Personajes:
- C: Presentadora. Habla directamente a Bele (la residente oyente principal). Tono cálido y motivador, como una mentora que la prepara para la lectura. Usa "Bele" por nombre.
- A: Dr. Marín, fisiatra académico. Estructura conceptual, datos concretos del capítulo.
- B: Dra. Vargas, fisiatra clínica. Conecta con la práctica, ejemplos de pacientes reales.

Estructura OBLIGATORIA:
1. INTRO — C (1 intervención): La Presentadora le habla a Bele directamente. La sitúa en el tema, por qué importa en su práctica clínica, qué va a encontrar en el capítulo. Emotivo y práctico.
2. DESARROLLO — A/B alternando (20-28 intervenciones): Mapa mental del capítulo en orden lógico. Conversación natural costarricense ("uno", "vea", "fíjese", "exactamente"). Cada intervención 3-5 oraciones.
3. OUTRO — C (1 intervención): La Presentadora le deja a Bele 3 preguntas para responder después de leer el capítulo. Cierre motivador y personal, usando su nombre.

Reglas:
- Tono para escuchar manejando: claro, con transiciones naturales entre temas.
- NUNCA mencionen ser una IA.
- Todo contenido debe provenir del capítulo adjunto.

JSON exacto (sin markdown, sin comentarios):
{
  "script": [
    { "speaker": "C", "text": "..." },
    { "speaker": "A", "text": "..." },
    { "speaker": "B", "text": "..." }
  ]
}`;

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

  // Save JSON (for process-podcast-wav.ts)
  const outDir = path.join(__dirname, "podcast-sources");
  fs.mkdirSync(outDir, { recursive: true });

  const jsonPath = path.join(outDir, `${SLUG}--pre.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(script, null, 2));

  // Save TXT (one paragraph per line, for pasting into ElevenLabs)
  const txtPath = path.join(outDir, `${SLUG}--pre.txt`);
  fs.writeFileSync(txtPath, script.map((l) => l.text).join("\n\n"));

  const byC = script.filter((l) => l.speaker === "C").length;
  const byA = script.filter((l) => l.speaker === "A").length;
  const byB = script.filter((l) => l.speaker === "B").length;

  console.log(`\n✓ Script generado: ${script.length} intervenciones (C=${byC}, A=${byA}, B=${byB})`);
  console.log(`  JSON → ${jsonPath}`);
  console.log(`  TXT  → ${txtPath}`);
  console.log(`\nTokens output: ${resp.usage.output_tokens}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
