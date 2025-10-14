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

   # Optional: override the model used for different flows
   # AI_MODEL_ID=gpt-5-mini
   # AI_MODEL_CHAT=gpt-5-mini
   # AI_MODEL_PLAN=gpt-5-mini
   # AI_MODEL_COURSE=gpt-5-mini
   ```
   - For Cerebras, set `AI_MODEL_ID` (or the per-use-case variables) to a model offered by the service, for example `llama3.1-8b-instruct`.

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

6. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)
