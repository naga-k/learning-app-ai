# AI Learning-Plan Assistant

A Next.js application that helps users create personalized learning plans using the Vercel AI SDK and OpenAI.

## Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up your OpenAI API key**:
   - Create a `.env.local` file and add your API key:
   ```bash
   OPENAI_API_KEY=your_actual_api_key_here
   ```

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
