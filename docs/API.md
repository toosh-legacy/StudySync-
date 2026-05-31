# StudySync Public API

Generate structured study material from raw text with a single HTTP request.
You bring your own LLM API key — StudySync never sees, stores, or bills against it.

- **Base URL:** `https://studysync-api-0lru.onrender.com`
- **Endpoint:** `POST /v1/public/generate`
- **Auth:** none (your `llm_key` authenticates the underlying OpenAI call)

---

## Quickstart

```bash
curl -X POST https://studysync-api-0lru.onrender.com/v1/public/generate \
  -H "Content-Type: application/json" \
  -d '{
    "llm_key": "sk-...your-openai-key...",
    "content": "Mitochondria are the powerhouse of the cell. They generate ATP through oxidative phosphorylation...",
    "output_format": "flashcards",
    "depth": "standard"
  }'
```

---

## Request body

| Field           | Type   | Required | Notes                                                                       |
| --------------- | ------ | -------- | --------------------------------------------------------------------------- |
| `llm_key`       | string | yes      | Your OpenAI API key. Used only for this single request; not stored.         |
| `content`       | string | yes      | Raw study material. Max 300,000 characters.                                 |
| `output_format` | enum   | yes      | One of the formats below.                                                   |
| `depth`         | enum   | no       | `quick` · `standard` (default) · `deep`.                                    |
| `user_prompt`   | string | no       | Extra instructions (e.g. "focus on chapter 3"). Max 1,000 chars.            |
| `model`         | string | no       | OpenAI model id. Defaults to `gpt-4o-mini`.                                 |

### Output formats

| `output_format`      | Returns                                                       |
| -------------------- | ------------------------------------------------------------- |
| `flashcards`         | Q&A cards with topic tags                                     |
| `study_guide`        | Sectioned guide with key terms + summary                      |
| `notes`              | Cornell-method notes (cue column + notes + summary)           |
| `practice_questions` | Mixed-difficulty questions with full answers                  |
| `summary`            | Headline + key points + detail paragraph                      |
| `mind_map`           | Hierarchical concept tree                                     |

---

## Response

```json
{
  "output_format": "flashcards",
  "depth": "standard",
  "output": {
    "cards": [
      { "front": "What do mitochondria produce?", "back": "ATP via oxidative phosphorylation.", "topic": "Cell biology" }
    ],
    "total": 1
  },
  "usage": {
    "prompt_tokens": 312,
    "completion_tokens": 184,
    "total_tokens": 496,
    "model": "gpt-4o-mini"
  }
}
```

The shape of `output` varies by format. The model is forced into strict JSON
matching that format's schema, so you can parse it directly.

### Errors

Returned as `{ "error": string, "message": string, "status": number }`.

| Status | Meaning                                       |
| ------ | --------------------------------------------- |
| 401    | Invalid `llm_key`                             |
| 422    | Validation error (missing/oversized fields)   |
| 429    | OpenAI rate limit                             |
| 502    | LLM returned invalid JSON                     |
| 503    | OpenAI unreachable                            |

---

## Node example

```ts
const res = await fetch("https://studysync-api-0lru.onrender.com/v1/public/generate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    llm_key: process.env.OPENAI_API_KEY,
    content: lectureNotes,
    output_format: "practice_questions",
    depth: "deep",
  }),
});
const { output } = await res.json();
```

## Python example

```python
import os, requests

r = requests.post(
    "https://studysync-api-0lru.onrender.com/v1/public/generate",
    json={
        "llm_key": os.environ["OPENAI_API_KEY"],
        "content": open("notes.txt").read(),
        "output_format": "summary",
    },
    timeout=120,
)
r.raise_for_status()
print(r.json()["output"])
```
