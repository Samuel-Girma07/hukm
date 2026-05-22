# 💬 Conversation System Setup Guide

## Overview

The conversation system allows users to:
- **Continue conversations** with the AI after receiving analysis
- **Ask follow-up questions** and get clarifications
- **Maintain context** across multiple messages
- **Session-based isolation** - each user's conversations are kept separate

---

## Setup Steps

### Step 1: Run Database Setup

**IMPORTANT:** Run this SQL in your Supabase SQL Editor:

1. Go to https://supabase.com
2. Open your project → SQL Editor
3. Create a new query
4. Copy **ALL** of `supabase-conversations-setup.sql`
5. Click **Run**

This creates:
- `conversations` table - stores conversation sessions
- `messages` table - stores individual messages
- Helper functions for querying conversations
- Row Level Security policies (auth-ready)

---

### Step 2: Restart the Application

```bash
# Stop the current dev server (Ctrl+C)
npm run dev
```

---

### Step 3: Test the Conversation System

1. **Open:** http://localhost:3000
2. **Submit a scenario:** "Someone stole a phone from a shop"
3. **Wait for analysis** to complete
4. **On results page:** Click the **"Continue Conversation"** button
5. **You'll be redirected to:** `/chat/[conversationId]`
6. **Ask a follow-up:** "What if the person returned the phone later?"

---

## How It Works

### Session Management

- **First visit:** Browser gets a session ID cookie (`hukm_session_id`)
- **Cookie persists:** 30 days
- **Conversations:** Linked to session ID
- **Future auth:** Ready for user accounts (just link `user_id` field)

### Conversation Flow

```
1. User submits scenario → Analysis generated → Results page
2. User clicks "Continue Conversation" → Conversation created in database
3. Initial analysis saved as assistant message
4. Original scenario saved as user message
5. Redirect to /chat/[conversationId]
6. User can now chat freely with AI
7. AI remembers full conversation context
```

### API Endpoints

**`/api/chat`** (POST)
- Creates new conversations or continues existing ones
- Saves messages to database
- Calls NVIDIA API with conversation history
- Returns AI response

**Request:**
```json
{
  "conversationId": "optional-uuid",  // Omit for new conversation
  "message": "Your question here",
  "modelId": "z-ai/glm4.7"
}
```

**Response:**
```json
{
  "success": true,
  "conversationId": "uuid-here",
  "messageId": "message-uuid",
  "response": "AI response text"
}
```

---

## Features

### ✅ Currently Implemented

- **Session-based conversations** - Cookie-based session tracking
- **Multi-turn chat** - Full conversation history sent to AI
- **Context persistence** - AI remembers what you discussed
- **Law article context** - Initial analysis includes retrieved law chunks
- **Auth-ready** - `user_id` field ready for future authentication
- **Per-user isolation** - Each session sees only its own conversations

### 🔲 Future Enhancements (When You Add Auth)

- Link conversations to user accounts
- Show conversation history dashboard
- Search past conversations
- Export conversations
- Share conversations

---

## Database Schema

### conversations table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `session_id` | TEXT | Browser session ID (cookie) |
| `user_id` | TEXT | For future auth (currently null) |
| `scenario_description` | TEXT | Original scenario |
| `model_id` | TEXT | Model used |
| `confidence_level` | TEXT | HIGH/MEDIUM/LOW |
| `is_civil_matter` | BOOLEAN | Civil vs criminal |
| `needs_clarification` | BOOLEAN | AI requested clarification |
| `created_at` | TIMESTAMPTZ | Creation time |
| `updated_at` | TIMESTAMPTZ | Last message time |

### messages table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `conversation_id` | UUID | Foreign key to conversations |
| `role` | TEXT | 'user', 'assistant', or 'system' |
| `content` | TEXT | Message content |
| `metadata` | JSONB | Additional data |
| `created_at` | TIMESTAMPTZ | Message time |

---

## Testing

### Test Case 1: New Conversation

1. Submit scenario
2. Click "Continue Conversation"
3. Ask: "What are the elements of this crime?"
4. AI should respond with legal elements

### Test Case 2: Follow-up Question

1. After Test Case 1
2. Ask: "What if the person was under 15?"
3. AI should reference age and criminal responsibility

### Test Case 3: Context Retention

1. After Test Case 2
2. Ask: "So what would the sentence be?"
3. AI should understand "the sentence" refers to the crime from earlier

---

## Troubleshooting

### "Conversation not found" error

**Cause:** SQL setup wasn't run or failed

**Fix:** Run `supabase-conversations-setup.sql` again

### Messages not appearing

**Cause:** Database connection issue

**Fix:** Check Supabase credentials in `.env.local`

### Session ID not persisting

**Cause:** Cookies blocked or cleared

**Fix:** Check browser cookie settings, ensure not in incognito mode

---

## Files Created

- `lib/session.ts` - Session management
- `app/api/chat/route.ts` - Chat API endpoint
- `components/ChatInterface.tsx` - Chat UI component
- `app/chat/[conversationId]/page.tsx` - Conversation page
- `app/results/page.tsx` - Updated with "Continue Conversation" button
- `supabase-conversations-setup.sql` - Database migrations

---

## Next Steps

Your conversation system is now fully functional! Users can:

1. Get legal analysis
2. Continue the conversation
3. Ask clarifying questions
4. Get follow-up guidance

**When ready for auth:** Add user authentication and link `user_id` in the conversations table to user accounts.
