# Task 5: Performance & Optimization

## Prompt for Coding Agent

You are optimizing the platform for better performance and scalability. The system handles async course generation, real-time chat, and database operations that need optimization.

### Key Files to Reference

1. **Worker**: `worker/course-generator.ts`
   - Sequential module generation
   - Database polling
   - LLM API calls

2. **Database**: `lib/db/`
   - `client.ts`: Database connection
   - `operations.ts`: All database queries
   - `schema.ts`: Table definitions

3. **API Routes**: `app/api/`
   - `chat/route.ts`: Chat endpoint
   - `dashboard/courses/route.ts`: Dashboard data
   - `course-versions/`: Course version endpoints

4. **Course Workspace**: `components/course/course-workspace.tsx`
   - Large component with many re-renders
   - Real-time updates

5. **Next.js Config**: `next.config.ts`
   - Build configuration
   - Optimization settings

### Implementation Steps

1. **Database Optimization**:
   - Review `lib/db/schema.ts` and add indexes:
     ```typescript
     // Add indexes for common queries
     index("idx_chat_sessions_user_updated").on(chatSessions.userId, chatSessions.updatedAt),
     index("idx_courses_user_updated").on(courses.userId, courses.updatedAt),
     index("idx_course_versions_course").on(courseVersions.courseId),
     index("idx_engagement_responses_user_course").on(
       courseEngagementResponses.userId,
       courseEngagementResponses.courseId
     ),
     ```
   - Optimize N+1 queries in `lib/db/operations.ts`:
     - Use joins instead of multiple queries
     - Batch operations
     - Use `Promise.all()` for parallel queries
   - Add connection pooling configuration
   - Use prepared statements where possible

2. **Caching Strategy**:
   - Install Redis or use in-memory cache
   - Create `lib/cache/` module:
     - `cache.ts`: Cache interface and implementation
     - `strategies.ts`: Cache strategies (stale-while-revalidate, etc.)
   - Cache endpoints:
     - Course versions (cache by versionId)
     - Dashboard data (cache by userId, TTL: 5 minutes)
     - Chat session summaries (cache by sessionId)
   - Implement cache invalidation:
     - Invalidate on course updates
     - Invalidate on new messages
     - Use cache tags for related data

3. **Worker Optimization** (`worker/course-generator.ts`):
   - Parallel module generation:
     ```typescript
     // Instead of sequential:
     for (const module of modules) { ... }
     
     // Use parallel with concurrency limit:
     const results = await pLimit(3)(modules.map(module => 
       generateModule(module)
     ));
     ```
   - Batch database operations:
     - Collect all engagement blocks, then insert in batch
     - Use transactions for related operations
   - Optimize LLM calls:
     - Batch similar requests
     - Use streaming where possible
     - Implement rate limiting
   - Add job prioritization:
     - Priority queue for jobs
     - Process high-priority jobs first

4. **API Optimization**:
   - Add response caching headers:
     ```typescript
     headers: {
       'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
     }
     ```
   - Implement pagination for list endpoints
   - Use database cursors for large datasets
   - Add request rate limiting
   - Optimize JSON serialization

5. **Frontend Optimization**:
   - Code splitting:
     - Lazy load course workspace
     - Split large components
     - Dynamic imports for heavy libraries
   - Optimize re-renders:
     - Use `React.memo()` for expensive components
     - Use `useMemo()` and `useCallback()` appropriately
     - Avoid unnecessary state updates
   - Lazy load course content:
     - Load lessons on demand
     - Virtual scrolling for long lists
   - Service worker for offline:
     - Cache static assets
     - Cache API responses
     - Offline fallbacks

6. **Monitoring & Metrics**:
   - Add performance monitoring:
     - Track API response times
     - Monitor database query times
     - Track worker job processing times
   - Use tools like:
     - Vercel Analytics (already in package.json)
     - Custom metrics endpoint
     - Database query logging
   - Set up alerts for:
     - Slow queries (>1s)
     - High error rates
     - Worker queue backup

7. **CDN & Static Assets**:
   - Optimize images:
     - Use Next.js Image component
     - Serve WebP format
     - Lazy load images
   - Configure caching headers:
     - Static assets: long cache
     - API responses: appropriate TTL
   - Use CDN for:
     - Static files
     - Images
     - Fonts

### Specific Optimizations

1. **Database Queries**:
   - Review all queries in `lib/db/operations.ts`
   - Use `EXPLAIN ANALYZE` to identify slow queries
   - Add missing indexes
   - Optimize joins
   - Use materialized views for complex aggregations

2. **Worker Performance**:
   - Measure current processing time
   - Identify bottlenecks
   - Parallelize where possible
   - Batch operations
   - Optimize LLM API usage

3. **API Response Times**:
   - Profile each endpoint
   - Identify slow endpoints
   - Add caching
   - Optimize database queries
   - Consider GraphQL for complex queries

4. **Frontend Bundle Size**:
   - Analyze bundle with `@next/bundle-analyzer`
   - Remove unused dependencies
   - Code split effectively
   - Tree shake unused code

### Caching Implementation

```typescript
// lib/cache/cache.ts
export interface Cache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  invalidate(pattern: string): Promise<void>;
}

// Use Redis or in-memory cache
export const cache = process.env.REDIS_URL 
  ? new RedisCache(process.env.REDIS_URL)
  : new MemoryCache();
```

### Success Criteria

- Database queries are optimized (90th percentile < 100ms)
- Caching reduces database load by 50%+
- Worker processes jobs 2x faster
- Frontend loads 30% faster (Lighthouse score > 90)
- API response times improved (p95 < 500ms)
- Monitoring is in place
- No functionality regressions
- Bundle size reduced by 20%+

### Performance Targets

- **API Endpoints**: p95 < 500ms, p99 < 1s
- **Database Queries**: p95 < 100ms, p99 < 500ms
- **Worker Jobs**: Process 2x faster
- **Frontend**: Lighthouse score > 90
- **Bundle Size**: < 500KB initial load

### Notes

- Test performance before and after changes
- Use profiling tools to identify bottlenecks
- Monitor production metrics
- Consider database read replicas for scale
- Use connection pooling
- Implement graceful degradation

