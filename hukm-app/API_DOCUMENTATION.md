# HUKM API Reference

Every endpoint returns JSON. Errors share a common envelope:

```json
{
  "success": false,
  "error":   "Human-readable message.",
  "code":    "OPTIONAL_MACHINE_CODE"
}
```

`code` values used by the API:

| code              | Meaning                                              |
| ----------------- | ---------------------------------------------------- |
| `BAD_JSON`        | The request body was not parseable JSON.             |
| `VALIDATION`      | Input failed schema validation (length, type, etc.). |
| `RATE_LIMIT`      | The caller has exceeded the per-(ip, modelId) cap.   |
| `NOT_FOUND`       | The resource doesn't exist or isn't owned by you.    |
| `SESSION_MISMATCH`| The body's `sessionId` doesn't match the cookie.     |
| `AI_UPSTREAM`     | NVIDIA chat API failed across the entire fallback chain. |
| `PERSIST_FAILED`  | Database insert failed.                              |
| `DB_READ`         | Database read failed.                                |

Successful responses always include `success: true`.

---

## POST /api/analyze

Generates a structured 7-step analysis for a scenario.

### Request

```http
POST /api/analyze
Content-Type: application/json
```

```json
{
  "scenario": "On 12 March 2024 in Addis Ababa, two men entered a small shop with a knife…",
  "modelId":  "z-ai/glm4.7",
  "language": "en"
}
```

| Field      | Type                | Required | Constraints                                |
| ---------- | ------------------- | -------- | ------------------------------------------ |
| `scenario` | string              | yes      | 10–5000 characters (after trim).           |
| `modelId`  | string              | yes      | Must be present in the model registry.     |
| `language` | `"en"` \| `"am"`    | no       | Default `"en"`.                            |
| `sessionId`| string              | no       | Reserved; the cookie is the source of truth. |

### Response 200

```json
{
  "success":  true,
  "resultId": "8f6e1a13-…",
  "result": {
    "step1FactIdentification":    "…",
    "step2LegalClassification":   "…",
    "step3ElementsAnalysis":      "…",
    "step4DefensesAndMitigation": "…",
    "step5SentencingFramework":   "…",
    "step6PrecedentApplication":  "…",
    "step7Conclusion":            "…",
    "estimatedPunishment":        "…",
    "confidenceLevel":            "MEDIUM",
    "confidenceReason":           "…",
    "proceduralRoadmap":          "…",
    "disclaimer":                 "…",
    "isCivilMatter":              false,
    "needsClarification":         false,
    "rawResponse":                "{ … original model output … }"
  },
  "modelId": "z-ai/glm4.7",
  "retrievedChunks": [
    {
      "id":                42,
      "document_name":     "criminal-code-414-2004",
      "article_reference": "Article 688 — Robbery with Violence",
      "content":           "…",
      "similarity":        0.81
    }
  ]
}
```

### Headers

Both 200 and 429 responses include rate-limit headers:

```
X-RateLimit-Limit:     30
X-RateLimit-Remaining: 27
Retry-After:           42        ; 429 only
```

### Error responses

| Status | Code            | Reason                                                |
| ------ | --------------- | ----------------------------------------------------- |
| 400    | `BAD_JSON`      | Body wasn't valid JSON.                               |
| 400    | `VALIDATION`    | Length out of range / unknown model / bad language.   |
| 429    | `RATE_LIMIT`    | Limit exceeded; consult `Retry-After`.                |
| 500    | `PERSIST_FAILED`| Result was generated but couldn't be saved.           |
| 503    | `AI_UPSTREAM`   | NVIDIA chat API failed for all fallback models.       |

---

## POST /api/chat

Sends a follow-up question in an existing conversation. Replies in natural
language, never JSON.

### Request

```http
POST /api/chat
Content-Type: application/json
Cookie: hukm_session=…
```

```json
{
  "message":        "Would the sentence change if the offender was 16?",
  "conversationId": "2b7e8a06-…",
  "sessionId":      "<same-uuid-as-cookie>"
}
```

| Field            | Type   | Required | Constraints                          |
| ---------------- | ------ | -------- | ------------------------------------ |
| `message`        | string | yes      | 1–5000 characters (after trim).      |
| `conversationId` | string | yes      | Must exist and be owned by your session. |
| `sessionId`      | string | yes      | Must match the `hukm_session` cookie. |

### Response 200

```json
{
  "success":        true,
  "conversationId": "2b7e8a06-…",
  "messageId":      "fcd902c1-…",
  "response":       "Under Article 56 of the Criminal Code …",
  "retrievedChunks": [ /* LawChunk[] */ ]
}
```

### Error responses

| Status | Code               | Reason                                                |
| ------ | ------------------ | ----------------------------------------------------- |
| 400    | `BAD_JSON`         | Body wasn't valid JSON.                               |
| 400    | `VALIDATION`       | Length out of range or missing field.                 |
| 403    | `SESSION_MISMATCH` | `sessionId` doesn't match the cookie.                 |
| 404    | `NOT_FOUND`        | Conversation doesn't exist or isn't owned by your session. |
| 429    | `RATE_LIMIT`       | Limit exceeded.                                       |
| 500    | `DB_READ`          | Could not read the conversation or its messages.      |
| 500    | `PERSIST_FAILED`   | Reply was generated but couldn't be saved.            |
| 503    | `AI_UPSTREAM`      | NVIDIA chat API failed for all fallback models.       |

---

## POST /api/conversations

Creates a new conversation, optionally seeded from a previous analysis.

### Request

```http
POST /api/conversations
Content-Type: application/json
Cookie: hukm_session=…
```

```json
{
  "scenarioDescription": "Robbery scenario from 12 March 2024 …",
  "modelId":             "z-ai/glm4.7",
  "analysisId":          "8f6e1a13-…"
}
```

| Field                 | Type   | Required | Constraints                                        |
| --------------------- | ------ | -------- | -------------------------------------------------- |
| `scenarioDescription` | string | yes      | 1–5000 characters; shown as the conversation title. |
| `modelId`             | string | yes      | Must exist in the model registry.                  |
| `analysisId`          | string | no       | If present, must be owned by your session.         |

### Response 200

```json
{ "success": true, "conversationId": "2b7e8a06-…" }
```

### Error responses

| Status | Code                  | Reason                                          |
| ------ | --------------------- | ----------------------------------------------- |
| 400    | `BAD_JSON`            | Body wasn't valid JSON.                         |
| 400    | `VALIDATION`          | Missing or out-of-range field.                  |
| 404    | `ANALYSIS_NOT_FOUND`  | Provided `analysisId` doesn't belong to you.    |
| 500    | `PERSIST_FAILED`      | Insert failed.                                  |

---

## GET /api/conversations

Returns the caller's recent conversations (up to 20).

### Response 200

```json
{
  "success": true,
  "conversations": [
    {
      "id":                   "2b7e8a06-…",
      "scenario_description": "Robbery scenario …",
      "first_user_message":   "Would the sentence change if …",
      "model_id":             "z-ai/glm4.7",
      "confidence_level":     "MEDIUM",
      "created_at":           "2025-05-01T12:30:00.000Z",
      "updated_at":           "2025-05-01T12:34:11.000Z",
      "message_count":        7
    }
  ]
}
```

If the caller has no session cookie yet, the endpoint returns an empty
`conversations` array with HTTP 200 (no error).

---

## GET /api/conversations/[id]

Returns a single conversation along with its full message history.

### Response 200

```json
{
  "success": true,
  "conversation": {
    "id":                   "2b7e8a06-…",
    "scenario_description": "…",
    "model_id":             "z-ai/glm4.7",
    "confidence_level":     "MEDIUM",
    "is_civil_matter":      false,
    "needs_clarification":  false,
    "created_at":           "…",
    "updated_at":           "…"
  },
  "messages": [
    {
      "id":          "…",
      "role":        "user",
      "content":     "…",
      "metadata":    null,
      "created_at":  "…"
    }
  ],
  "sessionId": "<cookie value>"
}
```

### Error responses

| Status | Code         | Reason                                            |
| ------ | ------------ | ------------------------------------------------- |
| 400    | `VALIDATION` | Missing id.                                       |
| 404    | `NOT_FOUND`  | Conversation doesn't exist or isn't yours.        |
| 500    | `DB_READ`    | Database read failure.                            |

---

## GET /api/results/[id]

Returns a previously persisted analysis (and the chunks it cited).

### Response 200

```json
{
  "success":         true,
  "id":              "8f6e1a13-…",
  "scenarioInput":   { "scenario": "…", "modelId": "z-ai/glm4.7", "language": "en" },
  "result": {
    "step1FactIdentification": "…",
    "...":                    "...",
    "rawResponse":            "…"
  },
  "retrievedChunks": [ /* LawChunk[] */ ],
  "modelId":         "z-ai/glm4.7",
  "createdAt":       "2025-05-01T12:30:00.000Z"
}
```

### Error responses

| Status | Code        | Reason                                       |
| ------ | ----------- | -------------------------------------------- |
| 400    | `VALIDATION`| Missing id.                                  |
| 404    | `NOT_FOUND` | Result doesn't exist or isn't yours.         |
| 500    | `DB_READ`   | Database read failure.                       |

---

## GET /api/session

Returns the caller's session id (minting one if necessary). The browser
needs to read this value before posting to `/api/chat`, because the
`hukm_session` cookie is HttpOnly and unreadable from JavaScript.

### Response 200

```json
{ "success": true, "sessionId": "uuid-v4-here" }
```

This endpoint cannot fail; calling it always succeeds and always sets the
cookie if it wasn't already set.

---

## Rate limiting

All endpoints that hit the LLM (`/api/analyze`, `/api/chat`) are rate-limited
per (IP, modelId). When the limit is exceeded, the response is HTTP 429 with
a `Retry-After` header (seconds).

| Tier      | Models             | Limit          |
| --------- | ------------------ | -------------- |
| Premium   | `z-ai/*`           | 10 / minute    |
| Standard  | All other models   | 30 / minute    |

The limiter is in-memory by default. Set `REDIS_URL` and call
`setRateLimitStore(...)` at startup to swap in a Redis-backed implementation
(see `lib/ratelimit.ts`).

---

## Models

The model registry is the single source of truth (`lib/models.ts`).
Primary (recommended) models:

| ID            | Display name | Notes                          |
| ------------- | ------------ | ------------------------------ |
| `z-ai/glm4.7` | GLM-4.7      | Default; free tier; 131K ctx. |
| `z-ai/glm5`   | GLM-5        | Highest quality; paid endpoint. |

Fallback chain (used automatically by `callChatWithFallback`):

1. `meta/llama-4-maverick-17b-128e-instruct`
2. `meta/llama-3.1-405b-instruct`
3. `meta/llama-3.3-70b-instruct`
4. `deepseek-ai/deepseek-v3.2`
5. `mistralai/mistral-large-3-675b-instruct-2512`
