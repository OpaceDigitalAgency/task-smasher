import { ChatCompletionMessageParam } from "openai/resources/chat/completions";

/**
 * Interface for OpenAI chat completion request
 */
interface ChatCompletionRequest {
  model: string;
  messages: ChatCompletionMessageParam[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
}

/**
 * Interface for OpenAI chat completion response
 */
interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Error response from the API
 */
interface ErrorResponse {
  error: string;
  message: string;
}

/**
 * Rate limit information from response headers
 */
interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
  used: number;
}

/**
 * Service for interacting with OpenAI API through our Netlify function proxy
 */
export const OpenAIService = {
  /**
   * Send a chat completion request to OpenAI through our proxy
   * 
   * @param request The chat completion request
   * @returns The chat completion response and rate limit info
   * @throws Error if the request fails
   */
  async createChatCompletion(request: ChatCompletionRequest): Promise<{
    data: ChatCompletionResponse;
    rateLimit: RateLimitInfo;
  }> {
    try {
      // Use the Netlify function proxy instead of direct OpenAI API
      const response = await fetch('/api/openai-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      // Extract rate limit information from headers
      const rateLimit: RateLimitInfo = {
        limit: parseInt(response.headers.get('X-RateLimit-Limit') || '20', 10),
        remaining: parseInt(response.headers.get('X-RateLimit-Remaining') || '0', 10),
        reset: new Date(response.headers.get('X-RateLimit-Reset') || Date.now() + 3600000),
        used: parseInt(response.headers.get('X-RateLimit-Used') || '0', 10)
      };

      // Handle rate limit exceeded
      if (response.status === 429) {
        const errorData = await response.json() as ErrorResponse;
        throw new Error(`Rate limit exceeded. Try again after ${rateLimit.reset.toLocaleString()}`);
      }

      // Handle other errors
      if (!response.ok) {
        const errorData = await response.json() as ErrorResponse;
        throw new Error(errorData.message || 'Unknown error occurred');
      }

      const data = await response.json() as ChatCompletionResponse;
      return { data, rateLimit };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to communicate with OpenAI API');
    }
  },

  /**
   * Get a simple text completion from OpenAI
   * 
   * @param prompt The text prompt
   * @param model The model to use (defaults to gpt-3.5-turbo)
   * @returns The generated text
   */
  async getCompletion(prompt: string, model = 'gpt-3.5-turbo'): Promise<string> {
    try {
      const { data } = await this.createChatCompletion({
        model,
        messages: [{ role: 'user', content: prompt }],
      });
      
      return data.choices[0]?.message.content || '';
    } catch (error) {
      console.error('Error getting completion:', error);
      throw error;
    }
  },

  /**
   * Get the current rate limit status
   * 
   * @returns Promise that resolves to the current rate limit info
   */
  async getRateLimitStatus(): Promise<RateLimitInfo> {
    try {
      // Use the dedicated rate limit status endpoint
      console.log('Fetching rate limit status from dedicated endpoint');
      const response = await fetch('/api/openai-proxy/rate-limit-status', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get rate limit status: ${response.statusText}`);
      }
      
      // Extract rate limit information from headers
      const rateLimit: RateLimitInfo = {
        limit: parseInt(response.headers.get('X-RateLimit-Limit') || '20', 10),
        remaining: parseInt(response.headers.get('X-RateLimit-Remaining') || '0', 10),
        reset: new Date(response.headers.get('X-RateLimit-Reset') || Date.now() + 3600000),
        used: parseInt(response.headers.get('X-RateLimit-Used') || '0', 10)
      };
      
      console.log('Rate limit status from headers:', rateLimit);
      
      // Also parse the response body as a fallback
      const data = await response.json();
      console.log('Rate limit status from body:', data);
      
      // Use body data if available, otherwise use header data
      return {
        limit: data.limit || rateLimit.limit,
        remaining: data.remaining || rateLimit.remaining,
        reset: new Date(data.reset) || rateLimit.reset,
        used: data.used || rateLimit.used
      };
    } catch (error) {
      console.error('Error getting rate limit status:', error);
      
      // Fallback to default values
      return {
        limit: 20,
        remaining: 19,
        reset: new Date(Date.now() + 3600000),
        used: 1
      };
    }
  }
};

export default OpenAIService;