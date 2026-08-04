# DataSmart Govern Frontend Change Log

This file records user-visible frontend features, fixes, and delivery checks.

## 2026-08-05

### Agent conversation history

- Added a project-scoped personal Agent session sidebar with active and
  archived views.
- Added session detail loading, pin/unpin, archive/restore, and new-conversation
  actions.
- Restored persisted conversation messages when opening a historical session.
- Added continued questioning under the original Agent session; each follow-up
  creates a new Run while preserving the conversation history.
- Reset active conversation state when switching projects to prevent history or
  filters leaking across project boundaries.
- Added typed API contracts for Agent identity, delegation, messages, pinned
  state, and archive state.

### Validation

- `npm run lint` passed.
- `npm run build` passed with TypeScript and Vite production compilation.
- The existing Vite warning for a JavaScript chunk larger than `500kB` remains
  an optimization item; it does not block this release.

## 2026-07-20 to 2026-07-31

### Agent collaboration experience

- Added live model/tool execution timelines, streamed planning progress,
  collapsible intermediate work, model decision explanations, and reasoning
  cancellation.
- Added conversational correction and progressive clarification for ambiguous
  synchronization requirements and datasource selection.
- Added editable synchronization configuration review, detailed object/field
  mapping, missing-field prompts, failure explanations, and recovery actions.
- Removed the obsolete synchronization-template product surface and aligned the
  Agent flow with real synchronization task creation and submission.
- Restored authorized datasource choices for delegated project users.
