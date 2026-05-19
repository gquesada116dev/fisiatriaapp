# FisiaPrep

App de estudio personalizada para preparación del examen de segunda etapa de residencia en Medicina Física y Rehabilitación (CCSS / CENDEISSS, Costa Rica).

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind
- Supabase (Postgres + Storage)
- Anthropic Claude API (Sonnet 4.6 / Haiku 4.5)
- ElevenLabs (TTS, 2 voces)
- Vercel-friendly

## Funcionalidades

1. **Biblioteca de temas** — 70+ temas pre-cargados de fisiatría.
2. **Resúmenes AI** — generados por Claude, cacheados por tema.
3. **Banco de preguntas** — MCQ con explicación, pool de 20+ por tema.
4. **Flashcards con SM-2** — algoritmo SuperMemo 2 clásico.
5. **Podcast 2-voces** — diálogo educativo generado y narrado con ElevenLabs.
6. **Modo Carro** — autoplay queue con controles grandes y MediaSession (lockscreen).
7. **Progreso por tema** — métrica derivada de flashcards maduras + accuracy MCQ.

## Setup

```bash
# 1. Instalar deps
npm install

# 2. Configurar env
cp .env.example .env.local
# editar APP_PASSWORD, AUTH_COOKIE_SECRET, Supabase, Anthropic, ElevenLabs

# 3. Crear schema en Supabase
# Ejecutar supabase/migrations/0001_init.sql en el SQL editor del proyecto.
# (O usar `supabase db push` si tienes la CLI.)

# 4. Sembrar temas
npm run seed

# 5. Dev
npm run dev
```

### Variables de entorno

Ver `.env.example`. Las más críticas:

- `APP_PASSWORD`: contraseña de acceso (single-user).
- `AUTH_COOKIE_SECRET`: cadena random de 32 bytes — el valor que se guarda en la cookie tras autenticar.
- `ANTHROPIC_API_KEY`
- `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_HOST_A`, `ELEVENLABS_VOICE_HOST_B`

### Voces de ElevenLabs

Elegir dos voces distintas en español. La voz "Marín" (A) es la que pregunta/duda; "Vargas" (B) la que estructura/responde. Guardar los IDs en `ELEVENLABS_VOICE_HOST_A` y `_B`.

## Notas de diseño

- **Cache agresivo**: resúmenes y podcasts se generan una vez. Preguntas en pools recyclables. `prompt_v` en cada tabla permite regenerar al cambiar el prompt.
- **Modelos por feature**: ver `lib/ai/config.ts`. Cambiar Sonnet ↔ Opus ahí.
- **SM-2 puro**: implementación en `lib/sm2/index.ts`. Aislada para facilitar swap a FSRS si se quiere.
- **Modo Carro**: usa MediaSession API para controles desde lockscreen / Bluetooth del carro.

## Estructura

```
app/
  api/             # Route handlers (Node runtime)
  login/           # Single-user auth
  topics/[slug]/   # Detalle por tema (tabs)
  car-mode/        # Player full-screen
  review/          # Repaso global (cards due)
components/
  topic/, flashcard/, question/, podcast/, layout/
lib/
  ai/              # prompts + Anthropic client + model config
  audio/           # ElevenLabs client
  db/              # Supabase clients + seed-topics
  sm2/             # Algoritmo de repaso espaciado
supabase/
  migrations/0001_init.sql
scripts/
  seed-topics.ts
```

## Despliegue (Vercel)

- Conectar el repo.
- Configurar env vars en el dashboard.
- El endpoint `/api/podcast` puede tardar >60s; en Vercel Pro/Team se permite `maxDuration = 300`.
- En el plan Hobby, considerar mover la síntesis a un job aparte (Inngest, Trigger.dev) si la generación supera el límite.
