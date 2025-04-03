import { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import OpenAI from "openai";

// Rate limit configuration
const RATE_LIMIT = 20; // 20 requests per IP per day
const RATE_LIMIT_WINDOW = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Define the handler function
export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Get client IP
  const clientIP = event.headers["client-ip"] ||
                  event.headers["x-forwarded-for"] ||
                  "unknown-ip";
  
  // For rate limit status endpoint
  if (event.httpMethod === "GET" && event.path.endsWith("/rate-limit-status")) {
    console.log("Rate limit status request received");
    
    // Return a simple response with default values
    // The actual tracking will be done on the client side
    const headers = {
      "Content-Type": "application/json",
      "X-RateLimit-Limit": String(RATE_LIMIT),
      "X-RateLimit-Remaining": String(RATE_LIMIT - 1),
      "X-RateLimit-Reset": new Date(Date.now() + RATE_LIMIT_WINDOW).toISOString(),
      "X-RateLimit-Used": "1"
    };
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        limit: RATE_LIMIT,
        remaining: RATE_LIMIT - 1,
        reset: new Date(Date.now() + RATE_LIMIT_WINDOW).toISOString(),
        used: 1
      })
    };
  }
  
  // Validate request method for other endpoints
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }
  
  try {
    // Get API key from environment variable
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
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
    if (!requestBody.model || !requestBody.messages) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Invalid request. 'model' and 'messages' are required." })
      };
    }
    
    const response = await openai.chat.completions.create({
      model: requestBody.model,
      messages: requestBody.messages,
      ...requestBody // Include any other parameters passed in the request
    });
    
    // Get the API call count from the request headers or use a default value
    const apiCallCount = parseInt(event.headers["x-api-call-count"] || "0", 10) + 1;
    
    // Return the response with rate limit headers
    const responseHeaders = {
      "Content-Type": "application/json",
      "X-RateLimit-Limit": String(RATE_LIMIT),
      "X-RateLimit-Remaining": String(RATE_LIMIT - apiCallCount),
      "X-RateLimit-Reset": new Date(Date.now() + RATE_LIMIT_WINDOW).toISOString(),
      "X-RateLimit-Used": String(apiCallCount)
    };
    
    return {
      statusCode: 200,
      headers: responseHeaders,
      body: JSON.stringify(response)
    };
  } catch (error) {
    console.error("Error proxying request to OpenAI:", error);
    
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error"
      })
    };
  }
};