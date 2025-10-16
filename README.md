# AI Learning-Plan Assistant

A Next.js application that helps users create personalized learning plans using the Vercel AI SDK. The app supports both OpenAI and Cerebras inference backends.

## Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure your AI provider**:
   - Create a `.env.local` file with the provider selection and credentials. By default, the app will use OpenAI.
   ```bash
   # Select the provider: openai (default) or cerebras
   AI_PROVIDER=openai

   # OpenAI credentials (required when AI_PROVIDER=openai)
   OPENAI_API_KEY=your_openai_api_key

   # Cerebras credentials (required when AI_PROVIDER=cerebras)
   CEREBRAS_API_KEY=your_cerebras_api_key
   # Optional: override the base URL if you are using a private deployment
   # CEREBRAS_BASE_URL=https://api.cerebras.ai/v1
   ```
   - Modify `lib/ai/config.ts` to adjust the default models for each provider/use case. For example, `gpt-oss-120b` for Cerebras chat or `gpt-5-mini` for OpenAI.

3. **Set up Supabase (required for persistence)**:
   Add these variables to `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_public_anon_key_here
SUPABASE_SECRET_KEY=your_secret_key_here
SUPABASE_DB_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
```

   - The `NEXT_PUBLIC_*` keys are safe for the browser.
   - `SUPABASE_SECRET_KEY` (a.k.a. service role key) and `SUPABASE_DB_URL` are **server-only** values; keep them out of the client bundle and version control. Rotate them immediately if they leak.

4. **Run database migrations** (after setting env vars):
   ```bash
   npm run db:generate
   npm run db:migrate
   ```

5. **Run the development server**:
   ```bash
   npm run dev
   ```

6. **Run the background worker**

   Course generation now happens fully asynchronously. There is a long-running worker that polls `course_generation_jobs`, calls the LLM, and persists results.

   ### Local development

   1. Make sure the required env vars are present (the easiest way is to export them in the shell that runs the worker; `.env.local` is *not* loaded automatically by `tsx`):

      ```bash
      export SUPABASE_DB_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
      export OPENAI_API_KEY=your_openai_api_key
      export AI_PROVIDER=openai
      # Optional tuning
      export COURSE_GENERATION_WORKER_CONCURRENCY=3
      export COURSE_GENERATION_HEARTBEAT_MS=45000
      export COURSE_GENERATION_STALE_TIMEOUT_MS=180000
      export COURSE_GENERATION_REQUEUE_INTERVAL_MS=60000
      ```

      You can add these to your shell profile or use `direnv`/`dotenvx` to load them automatically.

   2. Start the worker in a separate terminal:

      ```bash
      npm run worker:course
      ```

      This script uses `tsx` to run `worker/course-generator.ts` directly. Keep it running alongside `npm run dev`.

   ### Render (production)

   1. Create a Render Background Worker service pointing to this repo/branch.
   2. Set the same environment variables in the Render dashboard (`SUPABASE_DB_URL`, `OPENAI_API_KEY`, `AI_PROVIDER`, plus any optional tuning vars).
   3. Use a start command that installs deps (with dev deps, for `tsx`) and launches the worker. For example:

      ```bash
      npm install
      npm run worker:course
      ```

      Alternatively you can build once and run the compiled JS with `node dist/worker/course-generator.js` if you prefer not to ship dev deps.

7. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)
