# Task 4: AI Assistant Improvements

## Prompt for Coding Agent

You are enhancing the AI assistant to provide better personalization, multi-modal support, and improved context management. The current system uses prompts and tools to generate learning plans and courses.

### Key Files to Reference

1. **System Prompts**: `lib/prompts/system.ts`
   - `systemPrompt`: Main system prompt
   - `discoveryPhasePrimer`: Discovery conversation flow
   - `personalizationPrimer`: Personalization questions
   - `planningAndDeliveryPrimer`: Plan and course generation rules

2. **Plan Generation**: `lib/prompts/plan.ts`
   - `buildLearningPlanPrompt()`: Constructs plan generation prompt
   - Study how context is built and used

3. **Course Generation**: `lib/prompts/course.ts`
   - `buildCoursePrompt()`, `buildCourseOverviewPrompt()`, etc.
   - How course content is generated from plans

4. **Chat Endpoint**: `app/api/chat/route.ts` (lines 205-453)
   - Main chat orchestration
   - Tool calling logic
   - Message history management

5. **AI Tools**: `lib/ai/tools/`
   - `generate-plan.ts`: Plan generation tool
   - `generate-course.ts`: Course job enqueueing
   - Study tool execution patterns

6. **AI Provider**: `lib/ai/provider.ts`
   - Provider configuration
   - Model selection
   - Web search integration

### Implementation Steps

1. **Enhanced Personalization**:
   - Create `lib/ai/personalization/` module:
     - `learner-profile.ts`: Build learner profile from conversation
     - `preference-detection.ts`: Detect learning style, preferences
     - `context-enrichment.ts`: Enrich context with detected preferences
   - Update `lib/prompts/plan.ts` to use enriched context
   - Store preferences in user profile (create `user_preferences` table if needed)

2. **User Preferences Schema** (`lib/db/schema.ts`):
   ```typescript
   export const userPreferences = pgTable("user_preferences", {
     id: uuid("id").defaultRandom().primaryKey(),
     userId: uuid("user_id").notNull().unique(),
     learningStyle: text("learning_style"), // visual, auditory, kinesthetic, reading
     preferredDifficulty: text("preferred_difficulty"), // beginner, intermediate, advanced
     preferredPace: text("preferred_pace"), // slow, moderate, fast
     interests: jsonb("interests"), // Array of topics
     goals: jsonb("goals"), // Array of learning goals
     tools: jsonb("tools"), // Preferred tools/technologies
     constraints: jsonb("constraints"), // Time, resources, etc.
     updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
   });
   ```

3. **Improved Context Management**:
   - Create `lib/ai/context/` module:
     - `conversation-summarizer.ts`: Summarize long conversations
     - `context-compressor.ts`: Compress context to fit token limits
     - `context-builder.ts`: Build optimal context for prompts
   - Update `app/api/chat/route.ts` to use context management
   - Implement sliding window for very long conversations

4. **Multi-modal Support**:
   - Update course generation to support images:
     - Add image generation tool (if using image generation API)
     - Store image URLs in course content
     - Update markdown renderer to display images
   - Support image uploads in chat:
     - Add file upload endpoint
     - Process images with vision model
     - Extract information from images
   - Generate diagrams/visualizations:
     - Use diagram generation tools
     - Embed in course content

5. **Advanced Tools**:
   - `lib/ai/tools/web-search.ts` (if not fully implemented):
     - Integrate web search for current information
     - Cite sources in generated content
   - `lib/ai/tools/code-execution.ts`:
     - Safe code execution for programming courses
     - Sandboxed environment
     - Return execution results
   - `lib/ai/tools/resource-finder.ts`:
     - Find relevant learning resources
     - Curate resources for courses
     - Validate resource quality

6. **Prompt Engineering**:
   - Create `lib/prompts/templates/`:
     - Domain-specific prompt templates
     - A/B test different prompt variations
   - Improve error handling:
     - Better error messages
     - Retry logic with exponential backoff
     - Fallback prompts
   - Add prompt versioning:
     - Track which prompts work best
     - A/B test results

7. **Adaptive Difficulty**:
   - Track user performance in `lib/analytics/`
   - Adjust difficulty based on engagement block performance
   - Update course recommendations based on performance

8. **Database Operations** (`lib/db/operations.ts`):
   - `getUserPreferences()`: Get user preferences
   - `updateUserPreferences()`: Update preferences
   - `detectPreferencesFromConversation()`: Extract preferences from chat

### Prompt Improvements

1. **Better Discovery**:
   - More nuanced questions
   - Better follow-up based on responses
   - Detect when user wants to skip questions

2. **Personalization Prompts**:
   - Use detected preferences in plan/course generation
   - Reference user's goals and constraints
   - Adapt examples to user's interests

3. **Context-Aware Generation**:
   - Reference previous conversations
   - Build on existing knowledge
   - Avoid repetition

### Multi-modal Implementation

1. **Image Generation**:
   - Integrate with image generation API (DALL-E, Stable Diffusion)
   - Generate images for course content
   - Store images in cloud storage (Supabase Storage)
   - Reference images in markdown

2. **Image Processing**:
   - Accept image uploads in chat
   - Use vision model to analyze images
   - Extract information for context

3. **Diagrams**:
   - Generate flowcharts, diagrams
   - Use Mermaid or similar for markdown
   - Or generate images for complex diagrams

### Success Criteria

- Enhanced personalization improves course quality (measured by user feedback)
- Multi-modal features work correctly (images display, uploads process)
- Context management optimizes token usage
- New tools are integrated and tested
- Prompts produce better, more personalized results
- User preferences are stored and used effectively
- No regressions in existing functionality
- Performance is maintained or improved

### Notes

- Image generation/storage may require additional infrastructure
- Code execution requires careful security (sandboxing)
- Context compression should maintain important information
- A/B testing requires analytics infrastructure
- Consider rate limiting for expensive operations (image generation)

