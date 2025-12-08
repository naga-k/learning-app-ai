# Task 2: Course Analytics & Progress Tracking

## Prompt for Coding Agent

You are implementing comprehensive analytics and progress tracking for the learning platform. Currently, the system tracks engagement responses but lacks detailed progress metrics and analytics.

### Key Files to Reference

1. **Database Schema**: `lib/db/schema.ts`
   - Review existing tables: `courses`, `courseVersions`, `courseEngagementResponses`
   - Understand the relationship between courses, versions, and responses
   - Note user identification via `userId`

2. **Database Operations**: `lib/db/operations.ts`
   - Study existing query patterns
   - Understand how to add new operations
   - Review transaction handling

3. **Dashboard**: `components/dashboard/dashboard-view.tsx`
   - Current dashboard implementation
   - Course listing structure
   - User interface patterns

4. **Course Workspace**: `components/course/course-workspace.tsx`
   - How users navigate through courses
   - Lesson viewing logic
   - Engagement block interactions

5. **API Routes**: `app/api/dashboard/`
   - `courses/route.ts` - Course listing
   - `sessions/route.ts` - Session history
   - Study response formats

### Implementation Steps

1. **Create Progress Tracking Schema** (`lib/db/schema.ts`):
   ```typescript
   export const courseProgress = pgTable("course_progress", {
     id: uuid("id").defaultRandom().primaryKey(),
     userId: uuid("user_id").notNull(),
     courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
     courseVersionId: uuid("course_version_id").notNull().references(() => courseVersions.id, { onDelete: "cascade" }),
     submoduleId: text("submodule_id").notNull(),
     status: text("status").notNull().default("not_started"), // not_started, in_progress, completed
     timeSpentSeconds: integer("time_spent_seconds").default(0),
     lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true }),
     completedAt: timestamp("completed_at", { withTimezone: true }),
     createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
     updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
   }, (table) => ({
     uniqueUserSubmodule: uniqueIndex("course_progress_user_submodule_idx").on(
       table.userId,
       table.courseVersionId,
       table.submoduleId
     ),
   }));
   ```

2. **Create Analytics Module** (`lib/analytics/`):
   - `progress.ts`: Calculate completion percentages, time spent
   - `engagement.ts`: Analyze engagement block performance (correct rates, response times)
   - `time-tracking.ts`: Track and aggregate learning time
   - `metrics.ts`: Overall learning metrics (courses completed, total time, streaks)

3. **Database Operations** (`lib/db/operations.ts`):
   - `updateCourseProgress()`: Update or create progress record
   - `getCourseProgress()`: Get progress for a course
   - `getUserProgress()`: Get all progress for a user
   - `getCourseAnalytics()`: Aggregate analytics for a course
   - `getUserAnalytics()`: User-level analytics

4. **API Endpoints**:
   - `app/api/courses/[id]/progress/route.ts`:
     - GET: Get user's progress for a course
     - POST: Update progress (called from course workspace)
   - `app/api/courses/[id]/analytics/route.ts`:
     - GET: Get analytics data (completion rates, engagement stats)
   - `app/api/dashboard/analytics/route.ts`:
     - GET: Dashboard-level analytics (total courses, time spent, etc.)

5. **Update Course Workspace** (`components/course/course-workspace.tsx`):
   - Track when user views a lesson (update `lastAccessedAt`)
   - Track time spent (use `useEffect` with timers)
   - Mark lessons as completed when user finishes
   - Show progress indicators in navigation
   - Display completion percentage

6. **Update Dashboard** (`components/dashboard/dashboard-view.tsx`):
   - Add progress bars to course cards
   - Show completion percentages
   - Display learning statistics (total time, courses completed)
   - Add analytics charts (use a charting library like recharts)
   - Show learning streaks

7. **Time Tracking**:
   - Implement time tracking in course workspace
   - Track active time (when tab is visible)
   - Update progress periodically (debounce to avoid too many DB writes)
   - Handle page refresh/navigation

### Analytics Metrics to Track

1. **Course-Level**:
   - Overall completion percentage
   - Average time per lesson
   - Engagement block performance (quiz scores, reflection completion)
   - Drop-off points (where users stop)
   - Time to completion

2. **User-Level**:
   - Total courses started/completed
   - Total learning time
   - Learning streak (consecutive days)
   - Average course completion rate
   - Most engaged topics

3. **Engagement-Level**:
   - Quiz accuracy rates
   - Average response time
   - Reflection completion rates
   - Most challenging topics

### Database Migration

Create migration file:
```bash
npm run db:generate
```

Review the generated migration and ensure:
- Indexes are created for common queries
- Foreign key constraints are correct
- Default values are set appropriately

### UI Components to Create

1. **ProgressBar**: Reusable progress bar component
2. **AnalyticsChart**: Chart component for analytics visualization
3. **TimeTracker**: Component to display time spent
4. **CompletionBadge**: Badge showing completion status
5. **StreakIndicator**: Display learning streak

### Success Criteria

- Progress tracking table created and migrated
- Progress updates in real-time during course navigation
- Analytics API returns accurate metrics
- Dashboard displays progress and analytics with charts
- Time tracking works correctly (handles tab visibility, navigation)
- Completion percentages are accurate
- No performance degradation (use indexes, batch updates)
- All TypeScript types are correct

### Performance Considerations

- Use database indexes on frequently queried fields (userId, courseId, courseVersionId)
- Batch progress updates (debounce)
- Cache analytics data (stale-while-revalidate)
- Use efficient aggregation queries
- Consider materialized views for complex analytics

### Notes

- Progress should be version-specific (tied to `courseVersionId`)
- Handle edge cases: deleted courses, multiple versions
- Ensure data privacy (users can only see their own progress)
- Consider adding analytics for course creators (if multi-tenant in future)

