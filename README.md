# OpenAI Proxy with Netlify Functions

This project implements a secure OpenAI API proxy using Netlify Functions with rate limiting (5 requests per IP per hour).

## Features

- ✅ Securely proxies requests to OpenAI API
- 🔒 Keeps your API key secure on the server side
- ⏱️ Rate limiting: 5 requests per IP address per hour
- 📊 Returns rate limit information in response headers
- 🛡️ Error handling and validation

## Project Structure

```
├── netlify/
│   └── functions/
│       ├── openai-proxy.ts    # Netlify function that proxies OpenAI requests
│       └── README.md          # Detailed function documentation
├── src/
│   ├── components/
│   │   └── OpenAIExample.tsx  # Example React component using the proxy
│   └── utils/
│       └── openaiService.ts   # Client utility for interacting with the proxy
├── netlify.toml               # Netlify configuration
└── .env.example               # Template for environment variables
```

## Setup Instructions

### 1. Environment Variables

Create a `.env` file based on the `.env.example` template:

```
OPENAI_API_KEY=your_openai_api_key_here
```

For production deployment, add your OpenAI API key to your Netlify environment variables:

1. Go to your Netlify site dashboard
2. Navigate to Site settings > Environment variables
3. Add a new variable:
   - Key: `OPENAI_API_KEY`
   - Value: Your OpenAI API key

### 2. Local Development

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

This will start both the Vite development server and the Netlify Functions development server.

### 3. Deployment

Deploy to Netlify:

```bash
npm run build
netlify deploy --prod
```

## Usage

### Client-Side Integration

Import the OpenAIService utility in your components:

```typescript
import OpenAIService from '../utils/openaiService';

// Simple completion
const response = await OpenAIService.getCompletion('Your prompt here');

// Advanced usage
const { data, rateLimit } = await OpenAIService.createChatCompletion({
  model: 'gpt-3.5-turbo',
  messages: [{ role: 'user', content: 'Your prompt here' }],
});
```

### Example Component

The project includes an `OpenAIExample` component that demonstrates how to use the OpenAI proxy. You can import and use this component in your application:

```tsx
import OpenAIExample from './components/OpenAIExample';

function App() {
  return (
    <div className="App">
      <OpenAIExample />
    </div>
  );
}
```

## Rate Limiting

The proxy implements rate limiting of 5 requests per IP address per hour. This is done using an in-memory store in the Netlify function.

Rate limit information is returned in the response headers:

- `X-RateLimit-Limit`: Maximum number of requests allowed per hour (5)
- `X-RateLimit-Remaining`: Number of requests remaining in the current window
- `X-RateLimit-Reset`: ISO timestamp when the rate limit will reset

For more details, see the [function documentation](netlify/functions/README.md).

## Security Considerations

- Your OpenAI API key is stored securely as an environment variable and never exposed to the client
- All requests are validated before being forwarded to OpenAI
- Rate limiting helps prevent abuse and excessive costs

## Customization

To modify the rate limit settings, edit the constants in `netlify/functions/openai-proxy.ts`:

```typescript
const RATE_LIMIT = 5; // Number of requests per window
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // Window size in milliseconds (1 hour)
```

For production use with high traffic, consider implementing a more persistent rate limiting solution using Redis or DynamoDB.