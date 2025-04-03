import { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import OpenAI from "openai";

// Import Node.js file system module for persistent storage
import * as fs from 'fs';
import * as path from 'path';

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

// Path to the rate limit store file
// Using a more persistent location for the rate limit store
// In production, this should be replaced with a database or KV store
const RATE_LIMIT_STORE_PATH = process.env.NETLIFY
  ? path.join('/tmp', 'persistent-rate-limit-store.json')
  : path.join(process.cwd(), '.netlify', 'rate-limit-store.json');

// Function to load the rate limit store from file with better error handling
function loadRateLimitStore(): RateLimitStore {
  try {
    // Ensure directory exists
    const dir = path.dirname(RATE_LIMIT_STORE_PATH);
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (mkdirError) {
        console.error('Error creating directory:', mkdirError);
      }
    }
    
    if (fs.existsSync(RATE_LIMIT_STORE_PATH)) {
      const data = fs.readFileSync(RATE_LIMIT_STORE_PATH, 'utf8');
      try {
        return JSON.parse(data);
      } catch (parseError) {
        console.error('Error parsing rate limit store:', parseError);
        // If file is corrupted, create a backup and return empty store
        try {
          const backupPath = `${RATE_LIMIT_STORE_PATH}.backup.${Date.now()}`;
          fs.copyFileSync(RATE_LIMIT_STORE_PATH, backupPath);
          console.log(`Corrupted rate limit store backed up to ${backupPath}`);
        } catch (backupError) {
          console.error('Error backing up corrupted store:', backupError);
        }
      }
    }
  } catch (error) {
    console.error('Error loading rate limit store:', error);
  }
  return {};
}

// Function to save the rate limit store to file with better error handling
function saveRateLimitStore(store: RateLimitStore): void {
  try {
    // Ensure directory exists
    const dir = path.dirname(RATE_LIMIT_STORE_PATH);
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (mkdirError) {
        console.error('Error creating directory:', mkdirError);
        return;
      }
    }
    
    // Write to a temporary file first, then rename to avoid corruption
    const tempPath = `${RATE_LIMIT_STORE_PATH}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(store), 'utf8');
    fs.renameSync(tempPath, RATE_LIMIT_STORE_PATH);
  } catch (error) {
    console.error('Error saving rate limit store:', error);
  }
}

// Load the rate limit store
let rateLimitStore: RateLimitStore = loadRateLimitStore();

// Function to check and update rate limit
function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetTime: number; total: number } {
  const now = Date.now();
  
  // Reload the store to get the latest data
  rateLimitStore = loadRateLimitStore();
  
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
    saveRateLimitStore(rateLimitStore);
  }
  
  // Check if IP exists in store
  if (!rateLimitStore[ip] || rateLimitStore[ip].resetTime < now) {
    // Create new entry or reset expired entry
    rateLimitStore[ip] = {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW
    };
    saveRateLimitStore(rateLimitStore);
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
  saveRateLimitStore(rateLimitStore);
  
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
  
  // Check rate limit
  const rateLimitResult = checkRateLimit(clientIP);
  
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