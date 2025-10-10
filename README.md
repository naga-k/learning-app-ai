# AI Learning-Plan Assistant

A Next.js application that helps users create personalized learning plans using the Vercel AI SDK and OpenAI.

## Features

- 🤖 **Intelligent Conversation Flow**: The AI naturally extracts learning goals, time constraints, and experience levels through conversation
- 🎯 **Personalized Learning Plans**: Generates structured, actionable learning plans tailored to individual needs
- 🛠️ **Tool Calling**: Uses AI function calling to generate detailed plans with a specialized planning agent
- 💬 **Real-time Streaming**: Smooth, real-time chat experience with streaming responses
- 🎨 **Modern UI**: Clean, responsive interface with dark mode support

## Architecture

This application replicates the Langflow workflow with:

1. **Main Agent** (`/api/chat/route.ts`): 
   - Handles user conversation
   - Extracts learning requirements naturally
   - Decides when to generate a plan

2. **Planning Tool** (within the route):
   - Generates detailed, structured learning plans
   - Considers topic, time, experience level, and motivation
   - Provides actionable steps and milestones

3. **Chat UI** (`/app/page.tsx`):
   - Interactive chat interface
   - Real-time message streaming
   - Tool invocation visualization

## Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up your OpenAI API key**:
   - Edit `.env.local` and add your API key:
   ```bash
   OPENAI_API_KEY=your_actual_api_key_here
   ```

3. **Run the development server**:
   ```bash
   npm run dev
   ```

4. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## How It Works

### Conversation Flow

1. User greets the assistant or states what they want to learn
2. The assistant naturally asks follow-up questions about:
   - The specific topic
   - Available time (30 min - 3 hours)
   - Current experience level
   - Learning motivation
3. Once all info is gathered, the assistant confirms and generates a plan
4. User can request modifications to refine the plan

### Tool Calling

The app uses the Vercel AI SDK's tool calling feature to:
- Trigger plan generation when ready
- Pass structured data to the planning agent
- Return formatted learning plans

### Streaming

Both the main conversation and plan generation use streaming for:
- Immediate response feedback
- Smooth user experience
- Efficient token usage

## Tech Stack

- **Next.js 15**: React framework with App Router
- **Vercel AI SDK**: AI/ML integration and streaming
- **OpenAI**: GPT-4o-mini for both agents
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Styling and responsive design
- **Zod**: Schema validation for tool parameters

## Customization

### Modify the System Prompt
Edit the `systemPrompt` in `/app/api/chat/route.ts` to change the assistant's behavior.

### Add More Tools
Add additional tools to the `tools` object in the `streamText` call:

```typescript
tools: {
  generate_plan: generatePlanTool,
  your_new_tool: yourNewTool,
}
```

### Change the Model
Replace `openai('gpt-4o-mini')` with any supported model:
- `openai('gpt-4')`
- `openai('gpt-4-turbo')`
- Or use other providers from `@ai-sdk/*`

## Deployment

Deploy to Vercel with one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

Make sure to add your `OPENAI_API_KEY` environment variable in the Vercel dashboard.

## License

MIT
