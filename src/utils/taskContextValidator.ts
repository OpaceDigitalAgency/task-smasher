import { useCaseDefinitions } from './useCaseDefinitions';

type ValidationResult = {
  isValid: boolean;
  confidence: number; // 0 to 1
  reason: string;
  suggestedUseCase?: string;
};

/**
 * Validates if the task matches the current use case using simple heuristic rules.
 * This is a fallback when OpenAI integration isn't available or enabled.
 */
export const validateTaskLocally = (task: string, useCase: string): ValidationResult => {
  const definition = useCaseDefinitions[useCase];
  if (!definition) {
    return { isValid: true, confidence: 0.5, reason: "No definition for use case" };
  }

  const taskLower = task.toLowerCase();
  
  // Check for keywords that match the use case
  const matchCount = definition.keywords.filter(word => taskLower.includes(word.toLowerCase())).length;
  const mismatchCount = definition.negativeKeywords.filter(word => taskLower.includes(word.toLowerCase())).length;
  
  // Check other use cases for better matches
  let bestMatchUseCase = useCase;
  let bestMatchScore = matchCount;
  
  for (const [otherUseCase, otherDef] of Object.entries(useCaseDefinitions)) {
    if (otherUseCase === useCase) continue;
    
    const otherMatchCount = otherDef.keywords.filter(word => 
      taskLower.includes(word.toLowerCase())
    ).length;
    
    if (otherMatchCount > bestMatchScore) {
      bestMatchUseCase = otherUseCase;
      bestMatchScore = otherMatchCount;
    }
  }
  
  // Calculate confidence based on match and mismatch counts
  const confidence = Math.min(1, Math.max(0, 
    (matchCount / (definition.keywords.length || 1)) - 
    (mismatchCount / (definition.negativeKeywords.length || 1))
  ));
  
  // If confidence is low and we found a better match
  if (confidence < 0.3 && bestMatchUseCase !== useCase && bestMatchScore > 1) {
    return {
      isValid: false,
      confidence: 1 - confidence,
      reason: `This task seems more like a ${useCaseDefinitions[bestMatchUseCase].label} task.`,
      suggestedUseCase: bestMatchUseCase
    };
  }
  
  // Task is valid for the current use case
  return {
    isValid: confidence >= 0.3 || bestMatchUseCase === useCase,
    confidence,
    reason: confidence < 0.3 
      ? "Task doesn't seem to match the current use case."
      : "Task matches the current use case."
  };
};

/**
 * Validates the task using OpenAI API if a key is available.
 * Falls back to local validation if no key or network issues.
 */
export const validateTaskWithAI = async (
  task: string, 
  useCase: string,
  openAIKey: string
): Promise<ValidationResult> => {
  // If no API key is provided, fall back to local validation
  if (!openAIKey) {
    return validateTaskLocally(task, useCase);
  }
  
  try {
    const prompt = `
Task: "${task}"
Current Category: "${useCaseDefinitions[useCase]?.label || useCase}"

Determine if this task belongs in the current category. If it doesn't, suggest a better category from this list:
${Object.entries(useCaseDefinitions).map(([id, def]) => `- ${def.label}`).join('\n')}

Response format (JSON):
{
  "isValid": boolean, // true if task fits in the current category
  "confidence": number, // 0 to 1, how confident you are in this assessment
  "reason": string, // short explanation of your decision
  "suggestedCategory": string // if isValid is false, the name of a better category
}
`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openAIKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a task categorization assistant. Analyze if tasks fit their assigned categories.'
          },
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    const data = await response.json();
    
    if (data.error) {
      console.error('OpenAI API error:', data.error);
      return validateTaskLocally(task, useCase);
    }
    
    if (data.choices && data.choices[0]) {
      try {
        const responseContent = data.choices[0].message.content;
        const parsedResponse = JSON.parse(responseContent);
        
        // Convert suggested category name to useCase id
        let suggestedUseCase = undefined;
        if (!parsedResponse.isValid && parsedResponse.suggestedCategory) {
          for (const [id, def] of Object.entries(useCaseDefinitions)) {
            if (def.label.toLowerCase() === parsedResponse.suggestedCategory.toLowerCase()) {
              suggestedUseCase = id;
              break;
            }
          }
        }
        
        return {
          isValid: parsedResponse.isValid,
          confidence: parsedResponse.confidence,
          reason: parsedResponse.reason,
          suggestedUseCase
        };
      } catch (error) {
        console.error('Error parsing OpenAI response:', error);
        return validateTaskLocally(task, useCase);
      }
    }
    
    return validateTaskLocally(task, useCase);
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    return validateTaskLocally(task, useCase);
  }
};