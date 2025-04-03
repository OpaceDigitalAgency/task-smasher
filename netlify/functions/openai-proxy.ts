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

// Function to get the Blob store
function getBlobStore() {
  return getStore(RATE_LIMIT_STORE_NAME);
}

// Function to load the rate limit store from Blob store
async function loadRateLimitStore(): Promise<RateLimitStore> {
  try {
    const blobStore = getBlobStore();
    const blob = await blobStore.get("rate-limits");
    
    if (blob) {
      try {
        // Parse the blob data - handle different possible formats
        let data;
        if (typeof blob === 'string') {
          data = blob;
        } else if (blob instanceof Uint8Array) {
          data = new TextDecoder().decode(blob);
        } else if (typeof blob.toString === 'function') {
          data = blob.toString();
        } else {
          data = String(blob);
        }
        
        console.log('Loaded rate limit data:', data);
        return JSON.parse(data);
      } catch (parseError) {
        console.error('Error parsing rate limit store:', parseError);
      }
    } else {
      console.log('No rate limit data found in Blob store');
    }
  } catch (error) {
    console.error('Error loading rate limit store from Blob store:', error);
  }
  return {};
}

// Function to save the rate limit store to Blob store
async function saveRateLimitStore(rateLimitData: RateLimitStore): Promise<void> {
  try {
    const blobStore = getBlobStore();
    const dataString = JSON.stringify(rateLimitData);
    console.log('Saving rate limit data:', dataString);
    await blobStore.set("rate-limits", dataString);
    console.log('Rate limit data saved successfully');
  } catch (error) {
    console.error('Error saving rate limit store to Blob store:', error);
  }
}

// Initialize an empty store (will be loaded when needed)
let rateLimitStore: RateLimitStore = {};

// Function to check and update rate limit
async function checkRateLimit(ip: string): Promise<{ allowed: boolean; remaining: number; resetTime: number; total: number }> {
  const now = Date.now();
  
  try {
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
      console.log(`Created new rate limit entry for IP ${ip}: count=1, resetTime=${new Date(rateLimitStore[ip].resetTime).toISOString()}`);
      return {
        allowed: true,
        remaining: RATE_LIMIT - 1,
        resetTime: rateLimitStore[ip].resetTime,
        total: RATE_LIMIT
      };
    }
    
    // Check if rate limit exceeded
    if (rateLimitStore[ip].count >= RATE_LIMIT) {
      console.log(`Rate limit exceeded for IP ${ip}: count=${rateLimitStore[ip].count}, resetTime=${new Date(rateLimitStore[ip].resetTime).toISOString()}`);
      return {
        allowed: false,
        remaining: 0,
        resetTime: rateLimitStore[ip].resetTime,
        total: RATE_LIMIT
      };
    }
    
    // Increment count
    rateLimitStore[ip].count += 1;
    console.log(`Incrementing count for IP ${ip} from ${rateLimitStore[ip].count - 1} to ${rateLimitStore[ip].count}`);
    
    // Log the entire rate limit store for debugging
    console.log('Current rate limit store:', JSON.stringify(rateLimitStore));
    
    await saveRateLimitStore(rateLimitStore);
    console.log(`Updated rate limit for IP ${ip}: count=${rateLimitStore[ip].count}, resetTime=${new Date(rateLimitStore[ip].resetTime).toISOString()}`);
    
    return {
      allowed: true,
      remaining: RATE_LIMIT - rateLimitStore[ip].count,
      resetTime: rateLimitStore[ip].resetTime,
      total: RATE_LIMIT
    };
  } catch (error) {
    console.error('Error in checkRateLimit:', error);
    
    // Fallback to a default response if there's an error
    return {
      allowed: true,
      remaining: RATE_LIMIT - 1,
      resetTime: now + RATE_LIMIT_WINDOW,
      total: RATE_LIMIT
    };
  }
}

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Get client IP
  const clientIP = event.headers["client-ip"] ||
                  event.headers["x-forwarded-for"] ||
                  "unknown-ip";
  
  // Check if it's local development
  const isLocalDev = clientIP === "::1" || clientIP === "127.0.0.1" || clientIP.startsWith("192.168.");
  if (isLocalDev) {
    console.log("Local development detected, tracking rate limit but always allowing requests");
  }
  
  // Always check rate limit, but for local dev we'll allow the request regardless
  const rateLimitResult = await checkRateLimit(isLocalDev ? "local-dev" : clientIP);
  
  // For local development, we'll still track the rate limit but always allow the request
  if (isLocalDev) {
    rateLimitResult.allowed = true;
  }
  
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
  
  // Handle GET request for rate limit status
  if (event.httpMethod === "GET" && event.path.endsWith("/rate-limit-status")) {
    console.log("Rate limit status request received");
    console.log("Current rate limit store:", JSON.stringify(rateLimitStore));
    console.log("Rate limit result for this request:", JSON.stringify(rateLimitResult));
    
    // For local development, make sure we're using the correct IP
    const ipToUse = isLocalDev ? "local-dev" : clientIP;
    console.log(`Using IP ${ipToUse} for rate limit status`);
    
    // Get the actual count from the store if it exists
    const actualUsed = rateLimitStore[ipToUse]?.count || 1;
    const actualRemaining = Math.max(0, RATE_LIMIT - actualUsed);
    
    console.log(`Actual used: ${actualUsed}, Actual remaining: ${actualRemaining}`);
    
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "X-RateLimit-Limit": RATE_LIMIT.toString(),
        "X-RateLimit-Remaining": actualRemaining.toString(),
        "X-RateLimit-Reset": new Date(rateLimitResult.resetTime).toISOString(),
        "X-RateLimit-Used": actualUsed.toString()
      },
      body: JSON.stringify({
        limit: RATE_LIMIT,
        remaining: actualRemaining,
        reset: new Date(rateLimitResult.resetTime).toISOString(),
        used: actualUsed
      })
    };
  }
  
  // Validate request method for other endpoints
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