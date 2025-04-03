import { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import OpenAI from "openai";

// Import Netlify's KV store client
import { getStore } from "@netlify/blobs";

// Rate limit configuration
const RATE_LIMIT = 20; // 20 requests per IP per day
const RATE_LIMIT_WINDOW = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Interface for rate limit entries
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// Interface for rate limit store
interface RateLimitStore {
  [ip: string]: RateLimitEntry;
}

// Store name for rate limits
const RATE_LIMIT_STORE_NAME = "rate-limits";

// Function to get the KV store
function getRateLimitStore() {
  return getStore(RATE_LIMIT_STORE_NAME);
}

// Function to load the rate limit store from KV store
async function loadRateLimitStore(): Promise<RateLimitStore> {
  try {
    const store = getRateLimitStore();
    const data = await store.get("rate-limits");
    
    if (data) {
      try {
        return JSON.parse(data as string);
      } catch (parseError) {
        console.error('Error parsing rate limit store:', parseError);
      }
    }
  } catch (error) {
    console.error('Error loading rate limit store from KV:', error);
  }
  return {};
}

// Function to save the rate limit store to KV store
async function saveRateLimitStore(store: RateLimitStore): Promise<void> {
  try {
    const kvStore = getRateLimitStore();
    await kvStore.set("rate-limits", JSON.stringify(store));
  } catch (error) {
    console.error('Error saving rate limit store to KV:', error);
  }
}

// Initialize an empty store (will be loaded when needed)
let rateLimitStore: RateLimitStore = {};

// Function to check and update rate limit
async function checkRateLimit(ip: string): Promise<{ allowed: boolean; remaining: number; resetTime: number; total: number }> {
  const now = Date.now();
  
  // Reload the store to get the latest data
  rateLimitStore = await loadRateLimitStore();
  
  // Clean up expired entries
  let cleanupPerformed = false;
  Object.keys(rateLimitStore).forEach(key => {
    if (rateLimitStore[key].resetTime < now) {
      delete rateLimitStore[key];
      cleanupPerformed = true;
    }
  });
  
  // Save the store if we cleaned up any entries
  if (cleanupPerformed) {
    await saveRateLimitStore(rateLimitStore);
  }
  
  // Check if IP exists in store
  if (!rateLimitStore[ip] || rateLimitStore[ip].resetTime < now) {
    // Create new entry or reset expired entry
    rateLimitStore[ip] = {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW
    };
    await saveRateLimitStore(rateLimitStore);
    return {
      allowed: true,
      remaining: RATE_LIMIT - 1,
      resetTime: rateLimitStore[ip].resetTime,
      total: RATE_LIMIT
    };
  }
  
  // Check if rate limit exceeded
  if (rateLimitStore[ip].count >= RATE_LIMIT) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: rateLimitStore[ip].resetTime,
      total: RATE_LIMIT
    };
  }
  
  // Increment count
  rateLimitStore[ip].count += 1;
  await saveRateLimitStore(rateLimitStore);
  
  return {
    allowed: true,
    remaining: RATE_LIMIT - rateLimitStore[ip].count,
    resetTime: rateLimitStore[ip].resetTime,
    total: RATE_LIMIT
  };
}

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Get client IP
  const clientIP = event.headers["client-ip"] ||
                  event.headers["x-forwarded-for"] ||
                  "unknown-ip";
  
  // Bypass rate limit for local development
  const isLocalDev = clientIP === "::1" || clientIP === "127.0.0.1" || clientIP.startsWith("192.168.");
  if (isLocalDev) {
    console.log("Local development detected, bypassing rate limit");
  }
  
  // Check rate limit
  const rateLimitResult = isLocalDev ?
    { allowed: true, remaining: RATE_LIMIT - 1, resetTime: Date.now() + RATE_LIMIT_WINDOW, total: RATE_LIMIT } :
    await checkRateLimit(clientIP);
  
  if (!rateLimitResult.allowed) {
    const resetDate = new Date(rateLimitResult.resetTime).toISOString();
    return {
      statusCode: 429,
      headers: {
        "Content-Type": "application/json",
        "X-RateLimit-Limit": rateLimitResult.total.toString(),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": resetDate,
        "X-RateLimit-Used": rateLimitResult.total.toString()
      },
      body: JSON.stringify({
        error: "Rate limit exceeded",
        message: `You have exceeded the rate limit of ${RATE_LIMIT} requests per day. Please try again after ${resetDate}.`
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
        "X-RateLimit-Limit": rateLimitResult.total.toString(),
        "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
        "X-RateLimit-Reset": new Date(rateLimitResult.resetTime).toISOString(),
        "X-RateLimit-Used": (rateLimitResult.total - rateLimitResult.remaining).toString()
      },
      body: JSON.stringify(response)
    };
  } catch (error) {
    console.error("Error proxying request to OpenAI:", error);
    
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "X-RateLimit-Limit": rateLimitResult.total.toString(),
        "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
        "X-RateLimit-Reset": new Date(rateLimitResult.resetTime).toISOString(),
        "X-RateLimit-Used": (rateLimitResult.total - rateLimitResult.remaining).toString()
      },
      body: JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error"
      })
    };
  }
};

export { handler };