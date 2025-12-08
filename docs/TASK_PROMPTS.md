# Coding Agent Prompts for Parallel Tasks

## Task 1: Enhanced Engagement Tools System

### Context
The platform currently supports two engagement block types: `quiz` and `reflection`. The engagement tool system uses a registry pattern (`lib/ai/tools/registry.ts`) that allows tools to generate engagement blocks dynamically based on lesson context.

### Current Implementation
- **Location**: `lib/ai/tools/`
  - `registry.ts`: Tool registry interface and implementation
  - `types.ts`: Engagement block schemas (Quiz, Reflection)
  - `execution.ts`: Tool execution and fallback logic
  - `mock-executor.ts`: Mock tool for testing

- **Schema**: `lib/db/schema.ts`
  - `courseEngagementBlocks`: Stores engagement blocks
  - `courseEngagementResponses`: Stores user responses

- **Usage**: `worker/course-generator.ts` uses tools during course generation

### Task Requirements

1. **Add New Engagement Block Types**:
   - `code-exercise`: Interactive coding challenges
   - `fill-in-blank`: Fill-in-the-blank questions
   - `matching`: Matching exercises (e.g., match terms to definitions)
   - `essay`: Long-form written responses with AI feedback

2. **Extend Tool Registry**:
   - Create new tool implementations for each block type
   - Tools should accept `ToolExecutionContext` (moduleTitle, lessonTitle, domain, learnerLevel)
   - Tools should return `EngagementBlock` conforming to schemas

3. **Update Schemas**:
   - Extend `EngagementBlockSchema` in `lib/ai/tools/types.ts`
   - Add Zod schemas for each new block type
   - Update TypeScript types

4. **Database Schema**:
   - No migration needed (uses JSONB `payload` field)
   - Ensure backward compatibility with existing blocks

5. **UI Components**:
   - Update `components/course/course-workspace.tsx`
   - Add rendering logic for new block types in `LessonEngagementBlocks`
   - Add response handling in engagement block components

6. **API Endpoints**:
   - Update `app/api/course-versions/[versionId]/engagement-responses/route.ts` if needed
   - Ensure response validation handles new block types

### Reference Files
- `lib/ai/tools/types.ts` - Schema definitions
- `lib/ai/tools/registry.ts` - Registry pattern
- `lib/ai/tools/execution.ts` - Execution logic
- `components/course/course-workspace.tsx` - UI rendering (lines 361-437)
- `lib/db/schema.ts` - Database schema (lines 85-147)
- `worker/course-generator.ts` - Course generation (lines 553-606)

### Acceptance Criteria
- [ ] All new block types have Zod schemas
- [ ] Tools are registered and executable
- [ ] UI renders all new block types correctly
- [ ] Responses are saved and validated
- [ ] Backward compatibility maintained
- [ ] TypeScript types are complete
- [ ] No breaking changes to existing functionality

---

## Task 2: Course Analytics & Progress Tracking

### Context
The platform tracks course engagement through `courseEngagementResponses` but lacks comprehensive analytics and progress visualization.

### Current Implementation
- **Database**: `lib/db/schema.ts`
  - `courseEngagementResponses`: Stores responses with scores
  - `courses`: Course metadata
  - `courseVersions`: Version tracking

- **Dashboard**: `app/(authenticated)/dashboard/page.tsx`
  - Basic course listing
  - Session history

### Task Requirements

1. **Progress Tracking Schema**:
   - Add `course_progress` table to track:
     - User completion status per submodule
     - Time spent per lesson
     - Last accessed timestamp
     - Overall course completion percentage

2. **Analytics Aggregation**:
   - Create `lib/analytics/` module:
     - `progress.ts`: Calculate completion metrics
     - `engagement.ts`: Analyze engagement block performance
     - `time-tracking.ts`: Track learning time

3. **API Endpoints**:
   - `app/api/courses/[id]/progress/route.ts`: Get user progress
   - `app/api/courses/[id]/analytics/route.ts`: Get analytics data
   - `app/api/dashboard/analytics/route.ts`: Dashboard analytics

4. **Dashboard UI**:
   - Update `components/dashboard/dashboard-view.tsx`
   - Add progress bars, completion percentages
   - Add analytics charts (using a charting library)
   - Show learning streaks, time spent

5. **Course Workspace Integration**:
   - Track when user views/completes lessons
   - Update progress in real-time
   - Show progress indicators in navigation

6. **Database Operations**:
   - Add functions in `lib/db/operations.ts`:
     - `updateCourseProgress()`
     - `getCourseProgress()`
     - `getUserAnalytics()`

### Reference Files
- `lib/db/schema.ts` - Database schema
- `lib/db/operations.ts` - Database operations
- `components/dashboard/dashboard-view.tsx` - Dashboard UI
- `components/course/course-workspace.tsx` - Course workspace
- `app/api/dashboard/courses/route.ts` - Dashboard API

### Acceptance Criteria
- [ ] Progress tracking table created and migrated
- [ ] Progress updates in real-time during course navigation
- [ ] Analytics API returns accurate metrics
- [ ] Dashboard displays progress and analytics
- [ ] Time tracking works correctly
- [ ] Completion percentages are accurate
- [ ] No performance degradation

---

## Task 3: Course Sharing & Collaboration

### Context
The platform has basic sharing via `shareToken` in `courseVersions` but lacks advanced collaboration features.

### Current Implementation
- **Sharing**: `lib/db/operations.ts`
  - `enableCourseVersionSharing()`: Generates share token
  - `getCourseVersionByShareToken()`: Retrieves shared course

- **UI**: `app/courses/[token]/page.tsx`
  - Shared course view (read-only)

### Task Requirements

1. **Enhanced Sharing**:
   - Add sharing permissions (view-only, comment, edit)
   - Add expiration dates for share links
   - Add password protection option
   - Track share link usage analytics

2. **Comments System**:
   - Add `course_comments` table:
     - Comment text, author, timestamp
     - Threading support (replies)
     - Reactions (likes, helpful)

3. **Collaboration Features**:
   - Add `course_collaborators` table:
     - User permissions (viewer, editor, owner)
     - Invitation system
   - Real-time collaboration indicators
   - Shared annotations/highlights

4. **API Endpoints**:
   - `app/api/courses/[id]/share/route.ts`: Enhanced sharing
   - `app/api/courses/[id]/comments/route.ts`: Comments CRUD
   - `app/api/courses/[id]/collaborators/route.ts`: Collaborator management
   - `app/api/courses/[id]/invitations/route.ts`: Invitation system

5. **UI Components**:
   - Comment sidebar in course workspace
   - Share dialog with permission options
   - Collaborator management UI
   - Real-time presence indicators

6. **Real-time Updates** (optional):
   - Use Supabase Realtime for live comments
   - Presence tracking

### Reference Files
- `lib/db/schema.ts` - Database schema
- `lib/db/operations.ts` - Sharing operations (lines 600-700)
- `app/courses/[token]/page.tsx` - Shared course view
- `components/course/shared-course-workspace.tsx` - Shared workspace
- `app/api/course-versions/[versionId]/share/route.ts` - Share API

### Acceptance Criteria
- [ ] Enhanced sharing with permissions
- [ ] Comments system fully functional
- [ ] Collaborator management works
- [ ] Invitation system implemented
- [ ] UI components are polished
- [ ] Real-time updates work (if implemented)
- [ ] Security: users can only access permitted courses

---

## Task 4: AI Assistant Improvements

### Context
The AI assistant uses system prompts and tools to generate plans and courses. There's room for improvement in personalization and capabilities.

### Current Implementation
- **Prompts**: `lib/prompts/`
  - `system.ts`: System prompt and primers
  - `plan.ts`: Learning plan generation
  - `course.ts`: Course content generation

- **Tools**: `lib/ai/tools/`
  - `generate-plan.ts`: Plan generation
  - `generate-course.ts`: Course job enqueueing

- **Chat**: `app/api/chat/route.ts`
  - Main chat endpoint with tool orchestration

### Task Requirements

1. **Enhanced Personalization**:
   - Improve `lib/prompts/plan.ts` to better capture learner context
   - Add adaptive difficulty adjustment based on responses
   - Add learning style detection from conversation
   - Store learner preferences in user profile

2. **Multi-modal Support**:
   - Add image generation for course content
   - Support image uploads in chat
   - Generate diagrams/visualizations for lessons

3. **Better Context Management**:
   - Improve conversation summarization
   - Add context window optimization
   - Better handling of long conversations

4. **Advanced Tools**:
   - Add `web_search` integration (if not fully implemented)
   - Add `code_execution` tool for programming courses
   - Add `resource_finder` tool for finding learning resources

5. **Prompt Engineering**:
   - A/B test different prompt variations
   - Add prompt templates for different domains
   - Improve error handling and retry logic

6. **User Profile Integration**:
   - Add `user_preferences` table
   - Store learning history, preferences
   - Use for personalization

### Reference Files
- `lib/prompts/system.ts` - System prompts
- `lib/prompts/plan.ts` - Plan generation prompts
- `lib/prompts/course.ts` - Course generation prompts
- `app/api/chat/route.ts` - Chat endpoint (lines 205-453)
- `lib/ai/tools/generate-plan.ts` - Plan tool
- `lib/ai/tools/generate-course.ts` - Course tool
- `lib/ai/provider.ts` - AI provider configuration

### Acceptance Criteria
- [ ] Enhanced personalization improves course quality
- [ ] Multi-modal features work correctly
- [ ] Context management is optimized
- [ ] New tools are integrated and tested
- [ ] Prompts produce better results
- [ ] User preferences are stored and used
- [ ] No regressions in existing functionality

---

## Task 5: Performance & Optimization

### Context
The platform handles async course generation and real-time chat. Performance optimization is needed for scale.

### Current Implementation
- **Worker**: `worker/course-generator.ts`
  - Polls database for jobs
  - Generates course content sequentially

- **API**: Various endpoints in `app/api/`
- **Database**: Drizzle ORM with Supabase PostgreSQL

### Task Requirements

1. **Database Optimization**:
   - Add indexes for frequently queried fields
   - Optimize N+1 queries
   - Add query result caching (Redis or in-memory)
   - Connection pooling optimization

2. **API Caching**:
   - Cache course versions (stale-while-revalidate)
   - Cache dashboard data
   - Cache chat session summaries
   - Implement cache invalidation strategies

3. **Worker Optimization**:
   - Parallel module generation (currently sequential)
   - Batch database operations
   - Optimize LLM API calls (batching, rate limiting)
   - Add job prioritization

4. **Frontend Optimization**:
   - Code splitting for course workspace
   - Lazy load course content
   - Optimize re-renders
   - Add service worker for offline support

5. **Monitoring & Metrics**:
   - Add performance monitoring
   - Track API response times
   - Monitor worker job processing times
   - Add error tracking

6. **CDN & Static Assets**:
   - Optimize images
   - Use CDN for static assets
   - Implement proper caching headers

### Reference Files
- `worker/course-generator.ts` - Worker implementation
- `lib/db/client.ts` - Database client
- `lib/db/operations.ts` - Database operations
- `app/api/chat/route.ts` - Chat API
- `app/api/dashboard/courses/route.ts` - Dashboard API
- `next.config.ts` - Next.js configuration

### Acceptance Criteria
- [ ] Database queries are optimized
- [ ] Caching reduces load significantly
- [ ] Worker processes jobs faster
- [ ] Frontend loads faster
- [ ] Monitoring is in place
- [ ] No functionality regressions
- [ ] Performance metrics improved by 30%+

---

## Task 6: Testing & Quality Assurance

### Context
The codebase lacks comprehensive testing. Add tests to ensure reliability.

### Current Implementation
- No test files found
- Manual testing only

### Task Requirements

1. **Unit Tests**:
   - Test database operations (`lib/db/operations.ts`)
   - Test curriculum utilities (`lib/curriculum.ts`)
   - Test AI tool execution (`lib/ai/tools/`)
   - Test prompt building (`lib/prompts/`)

2. **Integration Tests**:
   - Test API endpoints (`app/api/`)
   - Test worker job processing
   - Test course generation flow
   - Test engagement block persistence

3. **E2E Tests**:
   - Test complete user flows:
     - Sign up → Create plan → Generate course → Complete lesson
     - Share course → View shared course
     - Dashboard navigation

4. **Test Infrastructure**:
   - Set up Jest/Vitest
   - Set up Playwright for E2E
   - Add test database setup/teardown
   - Add CI/CD test pipeline

5. **Test Coverage**:
   - Aim for 80%+ coverage on critical paths
   - Test error cases
   - Test edge cases

6. **Quality Tools**:
   - Add linting rules
   - Add type checking in CI
   - Add code quality metrics

### Reference Files
- All files in `lib/` - Core logic to test
- `app/api/` - API endpoints to test
- `worker/course-generator.ts` - Worker to test
- `components/` - UI components to test

### Acceptance Criteria
- [ ] Test infrastructure set up
- [ ] Unit tests for core functions
- [ ] Integration tests for APIs
- [ ] E2E tests for critical flows
- [ ] CI/CD pipeline runs tests
- [ ] Coverage meets targets
- [ ] Tests are maintainable

---

## Task 7: UI/UX Enhancements

### Context
The UI is functional but can be improved for better user experience, especially on mobile.

### Current Implementation
- **Course Workspace**: `components/course/course-workspace.tsx`
- **Chat**: `components/chat/chat-app.tsx`
- **Dashboard**: `components/dashboard/dashboard-view.tsx`
- **UI Components**: `components/ui/` (Radix UI based)

### Task Requirements

1. **Mobile Experience**:
   - Improve mobile navigation
   - Optimize course workspace for small screens
   - Better touch interactions
   - Responsive typography

2. **Accessibility**:
   - Add ARIA labels
   - Keyboard navigation
   - Screen reader support
   - Focus management
   - Color contrast compliance

3. **Course Workspace Improvements**:
   - Better lesson navigation
   - Progress indicators
   - Bookmarking/favorites
   - Search within course
   - Print-friendly view

4. **Chat Interface**:
   - Better message formatting
   - Code syntax highlighting
   - Markdown rendering improvements
   - Message reactions
   - Copy/export conversation

5. **Dashboard Enhancements**:
   - Better course cards
   - Filtering and sorting
   - Quick actions
   - Recent activity feed

6. **Design System**:
   - Consistent spacing/typography
   - Component documentation
   - Design tokens
   - Dark mode improvements

### Reference Files
- `components/course/course-workspace.tsx` - Main course UI
- `components/chat/chat-app.tsx` - Chat interface
- `components/dashboard/dashboard-view.tsx` - Dashboard
- `components/ui/` - UI component library
- `app/globals.css` - Global styles

### Acceptance Criteria
- [ ] Mobile experience is polished
- [ ] Accessibility standards met (WCAG 2.1 AA)
- [ ] Course workspace is intuitive
- [ ] Chat interface is improved
- [ ] Dashboard is user-friendly
- [ ] Design is consistent
- [ ] Performance is maintained

---

## Task 8: Documentation & Developer Experience

### Context
The project needs comprehensive documentation for developers and users.

### Current Implementation
- `README.md` - Basic setup instructions
- No API documentation
- No architecture docs

### Task Requirements

1. **API Documentation**:
   - Document all API endpoints
   - Request/response schemas
   - Authentication requirements
   - Error codes and handling
   - Use OpenAPI/Swagger or similar

2. **Architecture Documentation**:
   - System architecture diagram
   - Database schema documentation
   - Component hierarchy
   - Data flow diagrams

3. **Developer Guides**:
   - Setup instructions (detailed)
   - Development workflow
   - Contributing guidelines
   - Code style guide
   - Testing guide

4. **User Documentation**:
   - User guide for creating courses
   - Feature documentation
   - FAQ
   - Troubleshooting guide

5. **Code Documentation**:
   - JSDoc comments for public APIs
   - Inline comments for complex logic
   - README files in key directories

6. **Deployment Documentation**:
   - Production deployment guide
   - Environment variables reference
   - Database migration guide
   - Worker deployment guide

### Reference Files
- All files in the project
- `README.md` - Current documentation
- `package.json` - Dependencies
- `.env.example` - Environment variables (create if missing)

### Acceptance Criteria
- [ ] API documentation is complete
- [ ] Architecture is documented
- [ ] Developer guides are clear
- [ ] User documentation exists
- [ ] Code is well-documented
- [ ] Deployment guide is accurate
- [ ] Documentation is maintainable

