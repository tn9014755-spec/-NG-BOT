# OpenAI AI service for LINE bot

This service is deployed separately from the existing LINE bot. It does not replace the LINE webhook or the store-report code.

## Render setup

Create a new **Web Service** from this repository and select branch `openai-ai-service`.
Set **Root Directory** to `ai-service`, **Build Command** to `npm install`, and **Start Command** to `npm start`.

Set these environment variables in Render:
- `OPENAI_API_KEY`: your OpenAI API key (keep secret; never commit it)
- `AI_SERVICE_TOKEN`: a long random secret shared only with the existing bot
- `OPENAI_MODEL`: optional; defaults to `gpt-4.1-mini`

The service exposes:
- `GET /health`: basic health check
- `POST /chat`: protected by `Authorization: Bearer <AI_SERVICE_TOKEN>`, body `{"message":"...","context":"..." }`, returns `{"reply":"..." }`

## Important

Deploying this service alone does **not** switch the existing bot to OpenAI. The existing bot still needs a small adapter change to call this service instead of Gemini. Keep the existing bot's current Render service running until the adapter is tested. OpenAI API usage is billed separately from a ChatGPT subscription.
