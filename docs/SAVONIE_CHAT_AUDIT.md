# Savonie Chat Audit: Truncation & Reliability

**Date:** January 11, 2026  
**Status:** Phase 1 (Audit)  
**Author:** Savonie Engineering Agent

## A. Architecture Map

The Savonie AI chatbot follows a standard client-server-LLM architecture:

1.  **Client (Browser)**:
    *   **Entry**: User types in `input#chat-input` (pwa-capable interface).
    *   **Logic**: `assets/js/site.js` captures event, calls `sendMessage()`.
    *   **Network**: `fetch('https://savonie-ai.estivan.workers.dev', ...)` (POST).
    *   **Constraint**: No hard client-side truncation on *receipt*, but rendering uses `marked` for Markdown.

2.  **Edge Compute (Cloudflare Worker)**:
    *   **File**: `worker/worker.js`.
    *   **Handler**: Receives JSON payload, handles CORS, Rate Limiting (Cloudflare or Local).
    *   **Preprocessing**: Logic `stripJsonBlobs()` removes accidental JSON.
    *   **Constraint 1 (Hard Slice)**: `sanitizedReply.slice(0, MAX_REPLY_CHARS)` (currently 3000 chars).
    *   **Constraint 2 (Timeout)**: `GEMINI_TIMEOUT = 25000` (25s).

3.  **AI Layer (Google Gemini)**:
    *   **Model**: `gemini-1.5-flash` (or `pro` fallback).
    *   **Constraint 3 (Generation)**: `maxOutputTokens: 500` (approx 2000 chars).
    *   **Behavior**: If token limit reached, model stops generating (often mid-sentence).

4.  **Response Path**:
    *   Worker constructs JSON reply: `{ reply, chips, action, ... }`.
    *   Client `site.js` parses JSON.
    *   Client renders via `addMessageToUI()` -> `renderBotContent()` -> `marked.parse()`.

---

## B. Failure Modes (Why it cuts out)

1.  **Silent Worker Truncation (Major)**:
    *   **Code**: `worker.js` explicitly runs `.slice(0, 3000)`.
    *   **Effect**: Text is chopped at exactly 3000 characters, potentially splitting words, markdown tags (creating broken HTML), or sentences.
    *   **User Visible**: Yes, sentence ends abruptly.

2.  **Model Token Limit (Major)**:
    *   **Config**: `maxOutputTokens` is set to `500`.
    *   **Effect**: 500 tokens is roughly 2000-2500 characters. If the prompt asks for a "detailed explanation", the model will stop generating when it hits 500 tokens.
    *   **User Visible**: Yes, "And then the project was succe...".

3.  **Timeout / Latency**:
    *   **Config**: 25 seconds.
    *   **Effect**: If the model takes longer (unlikely for Flash, potential for Pro), the request aborts. Currently returns error `504` ("I'm thinking too hard!").
    *   **User Visible**: Yes, error message instead of partial content.

4.  **Markdown Render Failure**:
    *   **Scenario**: Logic chops text in the middle of a link like `[Project...`.
    *   **Effect**: `addMessageToUI` -> `marked.parse` might produce broken HTML or fail.
    *   **Current Handling**: `try/catch` falls back to `parseMarkdown` (custom simple parser), but if the syntax is incomplete, it just shows raw text.

---

## C. Reproducton Steps

These prompts trigger the failure modes reliably:

1.  **Trigger Type: Token Limit (500 tokens)**
    *   **Prompt**: *"Tell me the full detailed history of the Roman Empire, focusing on every emperor from Augustus to Romulus Augustulus."*
    *   **Expected**: Stops around 300-400 words. Mid-sentence cut-off.

2.  **Trigger Type: Hard Truncation (3000 chars)**
    *   **Prompt**: *"Repeat the phrase 'Systems Operations ' 500 times."* (approx 9000 chars)
    *   **Expected**: Result will be exactly 3000 characters long. The end will look like "Systems Operat".

3.  **Trigger Type: Broken Markdown**
    *   **Prompt**: *"Write a response that ends exactly with a link to the project page, but make it extremely long so the link gets cut off."*
    *   **Expected**: If truncation hits inside `[Link](...`, the UI may show broken syntax or nothing.

---

## D. Fix Plan

### P0: Stop Silent Truncation (Safety)
*   [Backend] Increase `MAX_REPLY_CHARS` to **8000**.
*   [Backend] Implement `safeTruncate(text, limit)` that cuts at the last period (`.`), question mark (`?`), or exclamation (`!`) within the limit, rather than a hard index.
*   [Backend] Add metadata to response: `truncated: true`.

### P1: Scaling Generation (Capacity)
*   [Backend] Increase `maxOutputTokens` baseline to **900** (~3600 chars).
*   [Backend] **Dynamic Tokens**: If prompt contains keywords (`detailed`, `explain`, `story`), boost tokens to **1200**.

### P2: Auto-Continuation (Reliability)
*   [Backend] Detect if model output stopped due to length (checking Gemini response `finishReason` if available, or heuristic checks).
*   [Backend] If stopped, perform ONE recursive call: "Continue exactly where you left off...".
*   [Backend] Stitch responses together before sending to user.

### P3: User Options & Frontend
*   [Frontend] If `response.truncated === true`, render a **"Continue"** chip.
*   [Frontend] "Continue" chip sends a hidden context/signal to the worker to fetch the next chunk (or just repeats the last intent with "continue" instruction).

---

## E. Risk & Cost

1.  **Token Cost**:
    *   Doubling `maxOutputTokens` (500 -> 900/1200) increases input/output costs per query.
    *   Gemini Flash is very cheap; risk is low for current traffic.
    *   Recursing for continuation doubles the cost for *long* queries only.

2.  **Latency**:
    *   Generating 1200 tokens takes longer (approx 2-3s more).
    *   Recursive calls (Auto-Continuation) will double latency (e.g., 2s + 2s = 4s). This is acceptable for "long" answers but must be handled with UI feedback ("Thinking...").
    *   Worker CPU time limit (10ms-50ms usually for free tier) is for *compute*, not *wait time* (awaiting fetch is fine).

3.  **Limits**:
    *   Cloudflare Worker response size limit: Standard is plenty big (~MBs).

---

## F. Verification Checklist

1.  **Logic Test**:
    *   To run the test locally (requires Node.js):
        ```bash
        # Create a temporary ESM copy for the test runner
        copy worker\worker.js worker\worker.mjs
        node scripts/test_chat_logic.mjs
        # Cleanup
        del worker\worker.mjs
        ```
    *   Passes if "Auto-Continuation stitched correctly" and "Hard truncation enforced".
2.  **Manual Chat Test**:
    *   Ask "Tell me a long story." -> Verify length > 3000 chars or clean cut-off with "Continue" button.
3.  **Markdown check**:
    *   Ensure links `[Text](url)` are not split in a way that breaks the page.
