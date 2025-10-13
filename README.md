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
   - Add the following environment variables to your `.env.local` file so the app can connect to Supabase:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_public_anon_key_here
```

   - Notes:
     - `NEXT_PUBLIC_SUPABASE_URL` is your Supabase project URL (starts with `https://`).
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY` is the public anon key from your Supabase project's API settings.
     - Keep server-only secrets (like a Supabase service_role key) out of `NEXT_PUBLIC_` vars and `.env.local` if you plan to publish them client-side.

4. **Run the development server**:
   ```bash
   npm run dev
   ```

5. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## License

MIT
