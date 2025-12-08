# Task 1: Enhanced Engagement Tools System

## Prompt for Coding Agent

You are implementing an enhanced engagement tools system for an AI-powered learning platform. The system currently supports `quiz` and `reflection` engagement blocks, and you need to add four new types: `code-exercise`, `fill-in-blank`, `matching`, and `essay`.

### Key Files to Reference

1. **Schema Definitions**: `lib/ai/tools/types.ts`
   - Study the existing `QuizEngagementBlockSchema` and `ReflectionEngagementBlockSchema`
   - Understand the `EngagementBlockSchema` discriminated union pattern
   - Note the `EngagementMetadataSchema` for id, revision, contentHash

2. **Tool Registry**: `lib/ai/tools/registry.ts`
   - Review the `ToolRegistry` interface and `InMemoryToolRegistry` implementation
   - Understand how tools are registered and executed
   - Note the `ToolExecutionContext` type (moduleTitle, lessonTitle, domain, learnerLevel)

3. **Execution Logic**: `lib/ai/tools/execution.ts`
   - Review `resolveEngagementBlocksFromResults` function
   - Understand fallback mechanism when tools fail
   - See how blocks are resolved from tool results

4. **Database Schema**: `lib/db/schema.ts` (lines 85-147)
   - `courseEngagementBlocks` table uses JSONB `payload` field
   - No schema changes needed - blocks are stored as JSON
   - `courseEngagementResponses` stores user responses

5. **UI Rendering**: `components/course/course-workspace.tsx` (lines 361-437)
   - `LessonEngagementBlocks` component renders blocks
   - Study how quiz and reflection blocks are rendered
   - Understand the `EngagementResponseState` type

6. **Course Generation**: `worker/course-generator.ts` (lines 553-606)
   - See how engagement blocks are generated during course creation
   - Tools are executed with `ToolExecutionContext`
   - Blocks are persisted via `replaceCourseEngagementBlocks`

### Implementation Steps

1. **Extend Type Definitions** (`lib/ai/tools/types.ts`):
   - Add Zod schemas for each new block type following the pattern of existing schemas
   - Each schema should extend `EngagementMetadataSchema`
   - Update `EngagementBlockSchema` to include new types in the discriminated union
   - Export TypeScript types for each new block type

2. **Create Tool Implementations**:
   - Create tools in `lib/ai/tools/` directory (or extend existing structure)
   - Each tool should:
     - Accept `ToolExecutionContext`
     - Return `ToolExecutionResult` with an `EngagementBlock`
     - Handle errors gracefully
   - Tools can be domain-specific (e.g., code-exercise for programming courses)

3. **Register Tools**:
   - Tools should be registered in the tool registry
   - Consider where registration happens (likely in course generation or initialization)

4. **Update UI Components** (`components/course/course-workspace.tsx`):
   - Add rendering logic for each new block type in `LessonEngagementBlocks`
   - Create components for:
     - Code exercise editor/runner
     - Fill-in-blank input fields
     - Matching drag-and-drop or selection
     - Essay textarea with character count
   - Handle response submission for each type

5. **Update Response Handling**:
   - Ensure `app/api/course-versions/[versionId]/engagement-responses/route.ts` handles new types
   - Validate responses match block type requirements
   - Store responses appropriately in `courseEngagementResponses`

6. **Testing**:
   - Test each new block type renders correctly
   - Test tool execution and fallback behavior
   - Test response saving and retrieval
   - Ensure backward compatibility with existing blocks

### Block Type Specifications

**code-exercise**:
- `type: "code-exercise"`
- `prompt: string` - Instructions for the exercise
- `starterCode?: string` - Initial code template
- `solution?: string` - Expected solution (for validation)
- `language?: string` - Programming language (e.g., "javascript", "python")
- `testCases?: Array<{input: string, expectedOutput: string}>` - Test cases
- `hints?: string[]` - Progressive hints

**fill-in-blank**:
- `type: "fill-in-blank"`
- `prompt: string` - Question or statement with blanks
- `blanks: Array<{id: string, correctAnswer: string, alternatives?: string[]}>` - Blank definitions
- `caseSensitive?: boolean` - Whether answers are case-sensitive

**matching**:
- `type: "matching"`
- `prompt: string` - Instructions
- `leftItems: Array<{id: string, label: string}>` - Left column items
- `rightItems: Array<{id: string, label: string}>` - Right column items
- `correctPairs: Array<{leftId: string, rightId: string}>` - Correct matches

**essay**:
- `type: "essay"`
- `prompt: string` - Essay question
- `guidance?: string` - Writing guidance
- `minWords?: number` - Minimum word count
- `maxWords?: number` - Maximum word count
- `rubric?: string` - Grading rubric
- `enableAIFeedback?: boolean` - Whether to provide AI feedback

### Success Criteria

- All four new block types have complete Zod schemas
- Tools can generate blocks of each type
- UI renders all new block types with appropriate interactions
- User responses are saved and validated correctly
- Existing quiz and reflection blocks continue to work
- TypeScript compilation passes with no errors
- No breaking changes to existing API contracts

### Notes

- The database uses JSONB, so schema changes aren't required
- Maintain backward compatibility - existing courses should still work
- Consider accessibility for new UI components (keyboard navigation, screen readers)
- Code exercises may need a code execution environment (consider security implications)

