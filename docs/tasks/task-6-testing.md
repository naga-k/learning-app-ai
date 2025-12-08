# Task 6: Testing & Quality Assurance

## Prompt for Coding Agent

You are implementing comprehensive testing infrastructure for the learning platform. The codebase currently lacks tests, and you need to add unit, integration, and E2E tests.

### Key Files to Reference

1. **Core Logic**: `lib/`
   - `db/operations.ts`: Database operations
   - `curriculum.ts`: Curriculum utilities
   - `ai/tools/`: AI tool execution
   - `prompts/`: Prompt building

2. **API Routes**: `app/api/`
   - All API endpoints need testing

3. **Components**: `components/`
   - UI components need testing

4. **Worker**: `worker/course-generator.ts`
   - Background job processing

5. **Package.json**: Check existing test scripts and dependencies

### Implementation Steps

1. **Set Up Test Infrastructure**:
   - Install testing dependencies:
     ```bash
     npm install -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom
     npm install -D @testing-library/user-event jsdom
     npm install -D playwright @playwright/test
     npm install -D @types/node
     ```
   - Create `vitest.config.ts`:
     ```typescript
     import { defineConfig } from 'vitest/config';
     import react from '@vitejs/plugin-react';
     import path from 'path';

     export default defineConfig({
       plugins: [react()],
       test: {
         environment: 'jsdom',
         globals: true,
         setupFiles: ['./tests/setup.ts'],
       },
       resolve: {
         alias: {
           '@': path.resolve(__dirname, './'),
         },
       },
     });
     ```
   - Create `playwright.config.ts` for E2E tests
   - Update `package.json` scripts:
     ```json
     {
       "test": "vitest",
       "test:ui": "vitest --ui",
       "test:coverage": "vitest --coverage",
       "test:e2e": "playwright test",
       "test:e2e:ui": "playwright test --ui"
     }
     ```

2. **Test Setup Files**:
   - `tests/setup.ts`: Global test setup
   - `tests/helpers/`: Test utilities
   - `tests/fixtures/`: Test data fixtures
   - `tests/mocks/`: Mock implementations

3. **Unit Tests**:
   - `lib/db/operations.test.ts`:
     - Test all database operations
     - Mock database client
     - Test error handling
   - `lib/curriculum.test.ts`:
     - Test normalization functions
     - Test schema validation
     - Test formatting functions
   - `lib/ai/tools/registry.test.ts`:
     - Test tool registration
     - Test tool execution
     - Test error handling
   - `lib/prompts/*.test.ts`:
     - Test prompt building
     - Test context inclusion

4. **Integration Tests**:
   - `app/api/chat/route.test.ts`:
     - Test chat endpoint
     - Test tool calling
     - Test message persistence
   - `app/api/courses/route.test.ts`:
     - Test course endpoints
     - Test authentication
     - Test authorization
   - `worker/course-generator.test.ts`:
     - Test job processing
     - Test course generation flow
     - Mock LLM calls

5. **Component Tests**:
   - `components/course/course-workspace.test.tsx`:
     - Test rendering
     - Test user interactions
     - Test state management
   - `components/chat/chat-app.test.tsx`:
     - Test chat interface
     - Test message display
     - Test tool output rendering

6. **E2E Tests** (Playwright):
   - `tests/e2e/user-flow.spec.ts`:
     - Sign up → Create plan → Generate course → Complete lesson
   - `tests/e2e/sharing.spec.ts`:
     - Share course → View shared course
   - `tests/e2e/dashboard.spec.ts`:
     - Dashboard navigation
     - Course management

7. **Test Database Setup**:
   - Create test database configuration
   - Set up database migrations for tests
   - Clean database between tests
   - Use transactions for isolation

8. **Mock Implementations**:
   - Mock Supabase client
   - Mock AI provider
   - Mock external APIs
   - Mock file system

### Test Structure

```
tests/
├── setup.ts
├── helpers/
│   ├── db.ts          # Database test helpers
│   ├── auth.ts        # Auth test helpers
│   └── api.ts         # API test helpers
├── fixtures/
│   ├── users.ts       # User fixtures
│   ├── courses.ts     # Course fixtures
│   └── messages.ts    # Message fixtures
├── mocks/
│   ├── supabase.ts    # Supabase mocks
│   ├── ai-provider.ts # AI provider mocks
│   └── worker.ts      # Worker mocks
├── unit/
│   ├── lib/
│   │   ├── db/
│   │   ├── curriculum/
│   │   └── ai/
│   └── components/
├── integration/
│   ├── api/
│   └── worker/
└── e2e/
    ├── user-flow.spec.ts
    ├── sharing.spec.ts
    └── dashboard.spec.ts
```

### Example Test Files

1. **Unit Test Example** (`lib/curriculum.test.ts`):
```typescript
import { describe, it, expect } from 'vitest';
import { normalizeLearningPlan, LearningPlanSchema } from './curriculum';

describe('normalizeLearningPlan', () => {
  it('should add IDs to modules and subtopics', () => {
    const plan = {
      overview: { goal: 'Learn React', totalDuration: '2 hours' },
      modules: [
        {
          title: 'Module 1',
          duration: '1 hour',
          objective: 'Learn basics',
          subtopics: [{ title: 'Topic 1', duration: '30 min', description: 'Desc' }]
        }
      ]
    };
    
    const normalized = normalizeLearningPlan(LearningPlanSchema.parse(plan));
    expect(normalized.modules[0].id).toBeDefined();
    expect(normalized.modules[0].subtopics[0].id).toBeDefined();
  });
});
```

2. **Integration Test Example** (`app/api/chat/route.test.ts`):
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { POST } from '@/app/api/chat/route';
import { createTestUser, createTestSession } from '@/tests/helpers';

describe('POST /api/chat', () => {
  beforeEach(async () => {
    // Clean database
  });

  it('should create a message and return response', async () => {
    const user = await createTestUser();
    const session = await createTestSession(user.id);
    
    const request = new Request('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: { role: 'user', content: 'Hello' },
        sessionId: session.id,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
  });
});
```

3. **E2E Test Example** (`tests/e2e/user-flow.spec.ts`):
```typescript
import { test, expect } from '@playwright/test';

test('complete user flow', async ({ page }) => {
  // Sign up
  await page.goto('/login?view=sign-up');
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');

  // Create plan
  await page.goto('/chat');
  await page.fill('textarea', 'I want to learn React');
  await page.click('button[type="submit"]');
  
  // Wait for plan generation
  await expect(page.locator('.learning-plan')).toBeVisible();

  // Generate course
  await page.click('button:has-text("Generate course")');
  
  // Wait for course
  await expect(page.locator('.course-workspace')).toBeVisible();
});
```

### Test Coverage Goals

- **Unit Tests**: 80%+ coverage for `lib/` directory
- **Integration Tests**: All API endpoints
- **E2E Tests**: Critical user flows
- **Component Tests**: All reusable components

### CI/CD Integration

- Add test step to CI pipeline
- Run tests on every PR
- Generate coverage reports
- Fail build on coverage drop
- Run E2E tests on staging

### Success Criteria

- Test infrastructure is set up and working
- Unit tests for core functions (80%+ coverage)
- Integration tests for all APIs
- E2E tests for critical flows
- CI/CD pipeline runs tests
- Coverage meets targets
- Tests are maintainable and fast
- All tests pass consistently

### Notes

- Use test database (separate from dev/prod)
- Mock external services (AI, Supabase)
- Keep tests fast (< 5s for unit, < 30s for integration)
- Use factories for test data
- Clean up after tests
- Test error cases and edge cases
- Use snapshot tests for UI components

