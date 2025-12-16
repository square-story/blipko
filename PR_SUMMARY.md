# Pull Request: AI Enhancements & Robustness Upgrade

## Summary
this PR introduces significant improvements to the AI parsing layer, making the bot more robust, conversational, and user-friendly. Key changes include switching to OpenAI (GPT-4o-mini) as the primary parser, implementing a Gemini fallback strategy, adding fuzzy contact matching, and enabling natural conversation capabilities.

## Key Changes

### 1. Robust AI Parsing (Primary + Fallback)
- **Primary Parser**: Integrated `OpenAIParser` using `gpt-4o-mini` for faster and more cost-effective parsing.
- **Fallback Mechanism**: Implemented `FallbackAiParser`. If OpenAI fails (e.g., API key issue, downtime), the system automatically retries with `GeminiParser`.
- **Graceful Failure**: If both parsers fail, a safe default response is returned to prevent crashes.

### 2. Intelligent Contact Matching
- **Fuzzy Search**: Implemented Levenshtein distance algorithm in `PrismaContactRepository`.
- **Benefit**: The bot can now match names even with spelling mistakes (e.g., "Faisel" matches "Faizal").

### 3. Conversational Assistant Mode
- **New Intents**: Added `CHAT` and `QUERY` intents to `ParsedData`.
- **Dynamic Context**: The AI now generates context-aware responses for greetings and questions (e.g., "Hi" -> "Hello!...", "What is 2+2?" -> "4").
- **Processors**:
    - `ChatProcessor`: Handles conversational inputs.
    - `QueryProcessor`: Handles analytics questions (e.g., "Total spend this month").

### 4. Technical Improvements
- **Dependency Injection**: Updated `WebhookController` to support the new parser architecture.
- **Environment**: Added `OPENAI_API_KEY` to configuration.
- **Refactoring**: Cleaned up `ProcessIncomingMessageUseCase` to support new processors.

## Files Modified
### Data Layer
- `src/data/ai/OpenAIParser.ts` (New)
- `src/data/ai/FallbackAiParser.ts` (New)
- `src/data/ai/GeminiParser.ts` (Updated prompts)
- `src/data/repositories/PrismaContactRepository.ts` (Added fuzzy matching)

### Application Layer
- `src/application/use-cases/processors/ChatProcessor.ts` (New)
- `src/application/use-cases/processors/QueryProcessor.ts` (New)
- `src/application/use-cases/ProcessIncomingMessageUseCase.ts` (Registered processors)

### Domain Layer
- `src/domain/entities/ParsedData.ts` (Added new intents)

### Config
- `.env.example`
- `src/config/env.ts`

## Verification
- **Test Scripts**:
    - `scripts/test-fuzzy.ts`: Verified name matching.
    - `scripts/test-fallback.ts`: Verified OpenAI -> Gemini failover.
    - `scripts/test-chat.ts`: Verified conversational responses.
- **Manual Testing**: Confirmed webhook processes standard transactions, greetings, and queries correctly.
