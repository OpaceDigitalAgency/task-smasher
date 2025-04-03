import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get the use case definitions
const useCaseDefinitions = {
  daily: {
    label: "Daily Organizer",
    description: "Everyday tasks, scheduled activities, and daily routines",
    keywords: ["today", "tomorrow", "morning", "evening", "daily", "schedule", "routine"]
  },
  goals: {
    label: "Goal Planner",
    description: "Long-term objectives, milestones, and personal development targets",
    keywords: ["goal", "objective", "milestone", "achieve", "accomplish", "target"]
  },
  marketing: {
    label: "Marketing Tasks",
    description: "Marketing campaigns, content creation, SEO, and advertising tasks with project planning",
    keywords: ["marketing", "campaign", "social media", "post", "content", "email"]
  },
  recipe: {
    label: "Recipe Steps",
    description: "Cooking recipes with ingredients, step-by-step instructions, and kitchen tasks",
    keywords: ["recipe", "cook", "bake", "ingredient", "food", "meal", "prep"]
  },
  home: {
    label: "Home Chores",
    description: "Household tasks, cleaning, organizing, and home maintenance",
    keywords: ["clean", "tidy", "organize", "declutter", "laundry", "dishes"]
  },
  freelance: {
    label: "Freelancer Projects",
    description: "Client work, freelance projects, and business management tasks",
    keywords: ["client", "project", "deadline", "proposal", "contract", "invoice"]
  },
  travel: {
    label: "Trip Planner",
    description: "Travel planning, vacation itineraries, and trip logistics",
    keywords: ["travel", "trip", "vacation", "journey", "flight", "hotel", "booking"]
  },
  shopping: {
    label: "Shopping Tasks",
    description: "Shopping lists, purchase planning, and store errands",
    keywords: ["shopping", "buy", "purchase", "store", "shop", "mall", "online"]
  },
  study: {
    label: "Study Plan",
    description: "Academic tasks, learning goals, and education-related activities",
    keywords: ["study", "learn", "course", "class", "assignment", "homework"]
  },
  events: {
    label: "Event Planning",
    description: "Party planning, event organization, and gathering logistics",
    keywords: ["event", "party", "celebration", "wedding", "birthday", "anniversary"]
  },
  diy: {
    label: "DIY Projects",
    description: "Do-it-yourself projects, crafts, and home improvement tasks",
    keywords: ["diy", "build", "make", "craft", "create", "project", "tool"]
  },
  creative: {
    label: "Creative Projects",
    description: "Artistic endeavors, content creation, and creative pursuits",
    keywords: ["creative", "art", "design", "draw", "paint", "sketch", "illustration"]
  }
};

// Read the template HTML file
const templatePath = path.join(__dirname, '..', 'index.html');
const template = fs.readFileSync(templatePath, 'utf8');

// Create the dist/tools/task-smasher directory if it doesn't exist
const distDir = path.join(__dirname, '..', 'dist', 'tools', 'task-smasher');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Generate a static HTML file for each use case
Object.entries(useCaseDefinitions).forEach(([id, definition]) => {
  const urlPath = definition.label.toLowerCase().replace(/\s+/g, '-');
  const pageDir = path.join(distDir, urlPath);
  
  // Create the directory for this use case
  if (!fs.existsSync(pageDir)) {
    fs.mkdirSync(pageDir, { recursive: true });
  }
  
  // Create the HTML content with proper meta tags and content
  const htmlContent = template
    .replace(
      /<title>.*?<\/title>/,
      `<title>${definition.label} | AI To-Do Lists & Project Planning | TaskSmasher</title>`
    )
    .replace(
      /<meta name="description" content=".*?" \/>/,
      `<meta name="description" content="Organize your ${definition.label.toLowerCase()} with TaskSmasher's AI To-Do Lists & Project Planning tools. ${definition.description.substring(0, 70)}" />`
    )
    // Fix script paths to use absolute paths with the subdirectory prefix
    .replace(
      /<script type="module" src="\/src\/main.tsx"><\/script>/,
      `<script type="module" crossorigin src="/tools/task-smasher/assets/index-DLJ8pJh6.js"></script>
      <link rel="modulepreload" crossorigin href="/tools/task-smasher/assets/lucide-react-woLeNmVQ.js">
      <link rel="stylesheet" crossorigin href="/tools/task-smasher/assets/index-CqRqDW3n.css">`
    )
    .replace(
      /<meta name="keywords" content=".*?" \/>/,
      `<meta name="keywords" content="${definition.label}, AI To-Do Lists, Project Planning, Task Management, ${definition.keywords.slice(0, 5).join(', ')}" />`
    )
    .replace(
      /<meta property="og:title" content=".*?" \/>/,
      `<meta property="og:title" content="${definition.label} | AI To-Do Lists & Project Planning | TaskSmasher" />`
    )
    .replace(
      /<meta property="og:description" content=".*?" \/>/,
      `<meta property="og:description" content="Organize your ${definition.label.toLowerCase()} with TaskSmasher's AI To-Do Lists & Project Planning tools. ${definition.description.substring(0, 70)}" />`
    )
    .replace(
      /<meta property="og:url" content=".*?" \/>/,
      `<meta property="og:url" content="https://smashingapps.ai/tools/task-smasher/${urlPath}/" />`
    )
    .replace(
      /<meta name="twitter:title" content=".*?" \/>/,
      `<meta name="twitter:title" content="${definition.label} | AI To-Do Lists & Project Planning | TaskSmasher" />`
    )
    .replace(
      /<meta name="twitter:description" content=".*?" \/>/,
      `<meta name="twitter:description" content="Organize your ${definition.label.toLowerCase()} with TaskSmasher's AI To-Do Lists & Project Planning tools." />`
    )
    .replace(
      /<meta name="twitter:url" content=".*?" \/>/,
      `<meta name="twitter:url" content="https://smashingapps.ai/tools/task-smasher/${urlPath}/" />`
    );
  
  // Create assets directory
  const assetsDir = path.join(pageDir, 'assets');
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }
  
  // Add actual content to the body for SEO
  const contentHtml = `
    <div id="root">
      <div class="min-h-screen w-full flex">
        <div class="w-64 bg-white border-r border-gray-200 p-4 flex flex-col gap-2 shadow-sm z-10">
          <h2 class="text-lg font-semibold text-gray-900 mb-2">Use Case Categories</h2>
          <p class="text-sm text-gray-600 mb-4">Select a category below to create AI-generated tasks specific to that domain</p>
        </div>
        <div class="flex-1 bg-gradient-to-br p-6 overflow-auto">
          <div class="bg-white/80 backdrop-blur-sm rounded-lg shadow-sm border border-gray-200/80 p-4 mb-6">
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div class="flex items-center gap-4 w-full sm:w-auto">
                <img src="/tools/task-smasher/assets/AITaskSmasher-small.png" alt="TaskSmasher Logo" class="w-8 h-8" />
                <h1 class="text-2xl font-bold text-gray-900">TaskSmasher ${definition.label}</h1>
                <div class="ml-4 text-sm text-gray-500">AI-powered task management</div>
              </div>
            </div>
          </div>
          <header class="mb-8">
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
              <div class="flex items-center gap-4 w-full sm:w-auto">
                <h2 class="text-xl font-semibold">${definition.label}</h2>
              </div>
            </div>
            <p class="text-gray-700 mb-4">${definition.description}</p>
            <div class="mb-6">
              <h3 class="text-lg font-medium mb-2">Key Features:</h3>
              <ul class="list-disc pl-5 space-y-1">
                ${definition.keywords.slice(0, 5).map(keyword => `<li class="text-gray-700">${keyword}</li>`).join('')}
              </ul>
            </div>
          </header>
        </div>
      </div>
    </div>
  `;
  
  // Replace the empty root div with our content
  const htmlWithContent = htmlContent.replace(
    /<div id="root"><\/div>/,
    contentHtml
  );
  
  // Write the HTML file
  const indexPath = path.join(pageDir, 'index.html');
  fs.writeFileSync(indexPath, htmlWithContent);
  
  console.log(`Generated static page for ${definition.label} at ${indexPath}`);
});

console.log('Static page generation complete!');