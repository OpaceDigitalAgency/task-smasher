import { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import OpenAI from "openai";

// In-memory store for rate limiting
// Note: This will reset when the function is redeployed or goes cold
// For production, consider using a more persistent solution like Redis or DynamoDB
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore: Record<string, RateLimitEntry> = {};

// Rate limit configuration
const RATE_LIMIT = 5; // 5 requests per hour
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds

// Function to check and update rate limit
function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  
  // Clean up expired entries
  Object.keys(rateLimitStore).forEach(key => {
    if (rateLimitStore[key].resetTime < now) {
      delete rateLimitStore[key];
    }
  });
  
  // Check if IP exists in store
  if (!rateLimitStore[ip] || rateLimitStore[ip].resetTime < now) {
    // Create new entry or reset expired entry
    rateLimitStore[ip] = {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW
    };
    return { allowed: true, remaining: RATE_LIMIT - 1, resetTime: rateLimitStore[ip].resetTime };
  }
  
  // Check if rate limit exceeded
  if (rateLimitStore[ip].count >= RATE_LIMIT) {
    return { allowed: false, remaining: 0, resetTime: rateLimitStore[ip].resetTime };
  }
  
  // Increment count
  rateLimitStore[ip].count += 1;
  return { 
    allowed: true, 
    remaining: RATE_LIMIT - rateLimitStore[ip].count,
    resetTime: rateLimitStore[ip].resetTime
  };
}

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Get client IP
  const clientIP = event.headers["client-ip"] || 
                  event.headers["x-forwarded-for"] || 
                  "unknown-ip";
  
  // Check rate limit
  const rateLimitResult = checkRateLimit(clientIP);
  
  if (!rateLimitResult.allowed) {
    const resetDate = new Date(rateLimitResult.resetTime).toISOString();
    return {
      statusCode: 429,
      headers: {
        "Content-Type": "application/json",
        "X-RateLimit-Limit": RATE_LIMIT.toString(),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": resetDate
      },
      body: JSON.stringify({
        error: "Rate limit exceeded",
        message: `You have exceeded the rate limit of ${RATE_LIMIT} requests per hour. Please try again after ${resetDate}.`
      })
    };
  }
  
  // Validate request method
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }
  
  try {
    // Get API key from environment variable
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "API key not configured" })
      };
    }
    
    // Parse request body
    const requestBody = JSON.parse(event.body || "{}");
    
    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: apiKey
    });
    
    // Forward the request to OpenAI
    // This example handles chat completions, but you can modify to handle other endpoints
    if (!requestBody.model || !requestBody.messages) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid request. 'model' and 'messages' are required." })
      };
    }
    
    const response = await openai.chat.completions.create({
      model: requestBody.model,
      messages: requestBody.messages,
      ...requestBody // Include any other parameters passed in the request
    });
    
    // Return the response with rate limit headers
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "X-RateLimit-Limit": RATE_LIMIT.toString(),
        "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
        "X-RateLimit-Reset": new Date(rateLimitResult.resetTime).toISOString()
      },
      body: JSON.stringify(response)
    };
  } catch (error) {
    console.error("Error proxying request to OpenAI:", error);
    
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "X-RateLimit-Limit": RATE_LIMIT.toString(),
        "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
        "X-RateLimit-Reset": new Date(rateLimitResult.resetTime).toISOString()
      },
      body: JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error"
      })
    };
  }
};

export { handler };