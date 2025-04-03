# OpenAI Proxy Netlify Function

This Netlify function securely proxies requests to the OpenAI API with rate limiting (5 requests per IP per hour).

## Features

- Securely proxies requests to OpenAI API
- Keeps your API key secure on the server side
- Implements rate limiting (5 requests per IP address per hour)
- Returns rate limit information in response headers
- Handles errors gracefully

## Setup Instructions

### 1. Environment Variables

Add your OpenAI API key to your Netlify environment variables:

1. Go to your Netlify site dashboard
2. Navigate to Site settings > Environment variables
3. Add a new variable:
   - Key: `OPENAI_API_KEY`
   - Value: Your OpenAI API key

For local development, create a `.env` file in your project root (make sure it's in your `.gitignore`):

```
OPENAI_API_KEY=your_openai_api_key_here
```

### 2. Deploy to Netlify

The function will be automatically deployed when you push your code to your connected Git repository.

For manual deployment:

```bash
netlify deploy --prod
```

### 3. Testing the Function

You can test the function using curl:

```bash
curl -X POST \
  https://your-site-name.netlify.app/.netlify/functions/openai-proxy \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [
      {
        "role": "user",
        "content": "Hello, how are you?"
      }
    ]
  }'
```

Or use the included `OpenAIExample` React component.

## Usage in Your Application

### Using the OpenAIService Utility

Import the OpenAIService utility in your components:

```typescript
import OpenAIService from '../utils/openaiService';

// Simple completion
const response = await OpenAIService.getCompletion('Your prompt here');

// Advanced usage
const { data, rateLimit } = await OpenAIService.createChatCompletion({
  model: 'gpt-3.5-turbo',
  messages: [{ role: 'user', content: 'Your prompt here' }],
  temperature: 0.7,
});

// Check rate limit status
const rateLimitInfo = await OpenAIService.getRateLimitStatus();
```

### Rate Limit Headers

The function returns the following headers with rate limit information:

- `X-RateLimit-Limit`: Maximum number of requests allowed per hour (5)
- `X-RateLimit-Remaining`: Number of requests remaining in the current window
- `X-RateLimit-Reset`: ISO timestamp when the rate limit will reset

## Important Notes

- The in-memory rate limiting implementation will reset when the function is redeployed or goes cold
- For production use with high traffic, consider implementing a more persistent solution using Redis or DynamoDB
- The function is configured to handle chat completions by default, but can be modified to handle other OpenAI endpoints

## Customizing Rate Limits

To change the rate limit, modify the following constants in `openai-proxy.ts`:

```typescript
const RATE_LIMIT = 5; // Number of requests per window
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // Window size in milliseconds (1 hour)