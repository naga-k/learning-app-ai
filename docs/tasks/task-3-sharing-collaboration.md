# Task 3: Course Sharing & Collaboration

## Prompt for Coding Agent

You are enhancing the course sharing system and adding collaboration features. The platform currently has basic sharing via share tokens, but needs advanced permissions, comments, and collaboration.

### Key Files to Reference

1. **Current Sharing**: `lib/db/operations.ts` (lines 600-700)
   - `enableCourseVersionSharing()`: Generates share token
   - `getCourseVersionByShareToken()`: Retrieves shared course
   - Study the current implementation

2. **Shared Course View**: `app/courses/[token]/page.tsx`
   - How shared courses are currently displayed
   - Read-only view implementation

3. **Database Schema**: `lib/db/schema.ts`
   - `courseVersions` table has `shareToken` and `shareEnabledAt`
   - Understand the current structure

4. **Share API**: `app/api/course-versions/[versionId]/share/route.ts`
   - Current sharing endpoint

5. **Course Workspace**: `components/course/course-workspace.tsx`
   - Main course viewing interface
   - Study how to add collaboration features

### Implementation Steps

1. **Enhanced Sharing Schema** (`lib/db/schema.ts`):
   ```typescript
   export const courseShares = pgTable("course_shares", {
     id: uuid("id").defaultRandom().primaryKey(),
     courseVersionId: uuid("course_version_id").notNull().references(() => courseVersions.id, { onDelete: "cascade" }),
     shareToken: text("share_token").notNull().unique(),
     permission: text("permission").notNull().default("view"), // view, comment, edit
     passwordHash: text("password_hash"), // Optional password protection
     expiresAt: timestamp("expires_at", { withTimezone: true }),
     maxUses: integer("max_uses"),
     useCount: integer("use_count").default(0),
     createdBy: uuid("created_by").notNull(),
     createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
     updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
   });
   ```

2. **Comments System Schema** (`lib/db/schema.ts`):
   ```typescript
   export const courseComments = pgTable("course_comments", {
     id: uuid("id").defaultRandom().primaryKey(),
     courseVersionId: uuid("course_version_id").notNull().references(() => courseVersions.id, { onDelete: "cascade" }),
     submoduleId: text("submodule_id"), // Optional: comment on specific lesson
     blockId: text("block_id"), // Optional: comment on specific engagement block
     parentCommentId: uuid("parent_comment_id").references(() => courseComments.id, { onDelete: "cascade" }), // For threading
     userId: uuid("user_id").notNull(),
     content: text("content").notNull(),
     createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
     updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
   });

   export const commentReactions = pgTable("comment_reactions", {
     id: uuid("id").defaultRandom().primaryKey(),
     commentId: uuid("comment_id").notNull().references(() => courseComments.id, { onDelete: "cascade" }),
     userId: uuid("user_id").notNull(),
     reactionType: text("reaction_type").notNull(), // like, helpful, etc.
     createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
   }, (table) => ({
     uniqueUserReaction: uniqueIndex("comment_reactions_user_idx").on(
       table.commentId,
       table.userId
     ),
   }));
   ```

3. **Collaboration Schema** (`lib/db/schema.ts`):
   ```typescript
   export const courseCollaborators = pgTable("course_collaborators", {
     id: uuid("id").defaultRandom().primaryKey(),
     courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
     userId: uuid("user_id").notNull(),
     role: text("role").notNull().default("viewer"), // owner, editor, viewer
     invitedBy: uuid("invited_by").notNull(),
     invitedAt: timestamp("invited_at", { withTimezone: true }).defaultNow().notNull(),
     acceptedAt: timestamp("accepted_at", { withTimezone: true }),
   }, (table) => ({
     uniqueCourseUser: uniqueIndex("course_collaborators_unique_idx").on(
       table.courseId,
       table.userId
     ),
   }));

   export const courseInvitations = pgTable("course_invitations", {
     id: uuid("id").defaultRandom().primaryKey(),
     courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
     email: text("email").notNull(),
     role: text("role").notNull().default("viewer"),
     token: text("token").notNull().unique(),
     invitedBy: uuid("invited_by").notNull(),
     expiresAt: timestamp("expires_at", { withTimezone: true }),
     acceptedAt: timestamp("accepted_at", { withTimezone: true }),
     createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
   });
   ```

4. **Database Operations** (`lib/db/operations.ts`):
   - `createCourseShare()`: Create share link with permissions
   - `getCourseShareByToken()`: Get share details
   - `validateShareAccess()`: Check if share is valid (not expired, password correct)
   - `incrementShareUseCount()`: Track share usage
   - `createComment()`: Add comment
   - `getComments()`: Get comments for a course/lesson
   - `updateComment()`: Edit comment
   - `deleteComment()`: Delete comment
   - `addCommentReaction()`: Add reaction
   - `inviteCollaborator()`: Send invitation
   - `acceptInvitation()`: Accept invitation
   - `getCollaborators()`: List collaborators
   - `updateCollaboratorRole()`: Change permissions
   - `removeCollaborator()`: Remove collaborator

5. **API Endpoints**:
   - `app/api/courses/[id]/share/route.ts`:
     - POST: Create share link with options
     - GET: Get share settings
     - PATCH: Update share settings
     - DELETE: Disable sharing
   - `app/api/courses/[id]/comments/route.ts`:
     - GET: List comments (with pagination)
     - POST: Create comment
   - `app/api/courses/[id]/comments/[commentId]/route.ts`:
     - PATCH: Update comment
     - DELETE: Delete comment
   - `app/api/courses/[id]/comments/[commentId]/reactions/route.ts`:
     - POST: Add reaction
     - DELETE: Remove reaction
   - `app/api/courses/[id]/collaborators/route.ts`:
     - GET: List collaborators
     - POST: Add collaborator
   - `app/api/courses/[id]/collaborators/[userId]/route.ts`:
     - PATCH: Update role
     - DELETE: Remove collaborator
   - `app/api/courses/[id]/invitations/route.ts`:
     - GET: List invitations
     - POST: Create invitation
   - `app/api/invitations/[token]/route.ts`:
     - GET: Get invitation details
     - POST: Accept invitation

6. **UI Components**:
   - `components/course/share-dialog.tsx`: Share dialog with permission options
   - `components/course/comments-panel.tsx`: Comments sidebar
   - `components/course/comment-item.tsx`: Individual comment with replies
   - `components/course/collaborators-panel.tsx`: Collaborator management
   - `components/course/invitation-form.tsx`: Invite collaborators
   - `components/course/presence-indicator.tsx`: Show who's viewing (if real-time)

7. **Update Course Workspace** (`components/course/course-workspace.tsx`):
   - Add comments panel toggle
   - Show comment count badges
   - Add share button in header
   - Show collaborator avatars
   - Display presence indicators (if real-time)

8. **Real-time Features** (Optional, using Supabase Realtime):
   - Live comment updates
   - Presence tracking (who's viewing the course)
   - Typing indicators for comments

### Security Considerations

1. **Share Links**:
   - Validate expiration dates
   - Check password (hash comparison)
   - Enforce max uses
   - Rate limit share link access

2. **Comments**:
   - Users can only edit/delete their own comments
   - Validate content (prevent XSS, spam)
   - Rate limit comment creation

3. **Collaborators**:
   - Only course owners can add/remove collaborators
   - Validate invitation tokens
   - Check expiration dates
   - Ensure users can only access courses they have permission for

4. **API Security**:
   - Authenticate all requests
   - Authorize based on permissions
   - Validate input (Zod schemas)
   - Sanitize user-generated content

### Success Criteria

- Enhanced sharing with permissions works
- Comments system is fully functional (CRUD, threading, reactions)
- Collaborator management works (invite, accept, manage roles)
- Invitation system is implemented
- UI components are polished and accessible
- Real-time updates work (if implemented)
- Security: users can only access permitted courses
- Password-protected shares work correctly
- Share link expiration and usage limits work
- All TypeScript types are correct

### Notes

- Maintain backward compatibility with existing share tokens
- Consider email notifications for invitations and comments
- Comments should support markdown formatting
- Consider moderation features (report, hide comments)
- Real-time features require Supabase Realtime setup
- Password hashing should use secure methods (bcrypt, argon2)

