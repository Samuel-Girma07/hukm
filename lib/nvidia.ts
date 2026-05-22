/**
 * HUKM — NVIDIA Chat API Client
 *
 * Handles chat completions using NVIDIA API with GLM and other models.
 */

import { CHAT_ENDPOINT, isValidModelId } from "./models";
import { ScenarioInput, AnalysisResult } from "./types";

// ============================================================================
// CHAT API FUNCTION
// ============================================================================

/**
 * Calls the NVIDIA chat completions API with the provided scenario and system prompt
 *
 * @param input - The scenario input from the user
 * @param systemPrompt - The pre-built system prompt (already enriched with retrieved law text)
 * @returns Promise resolving to an AnalysisResult
 * @throws Error if the API call fails or returns invalid response
 */
export async function callChatAPI(
  input: ScenarioInput,
  systemPrompt: string,
): Promise<AnalysisResult> {
  const apiKey = process.env.NVIDIA_API_KEY;

  // Validate API key
  if (!apiKey || apiKey.trim() === "") {
    throw new Error(
      "NVIDIA_API_KEY is not configured. Please set it in your .env.local file.",
    );
  }

  // Validate model ID
  if (!isValidModelId(input.modelId)) {
    throw new Error(`Invalid model ID: ${input.modelId}`);
  }

  // Build user message
  const userMessage = buildUserMessage(input);

  try {
    // Prepare request body
    const requestBody: {
      model: string;
      messages: { role: string; content: string }[];
      temperature: number;
      max_tokens: number;
      stream: boolean;
      chat_template_kwargs?: { enable_thinking: boolean };
    } = {
      model: input.modelId,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userMessage,
        },
      ],
      temperature: 0.1,
      max_tokens: 2048,
      stream: false,
    };

    // Add chat_template_kwargs for GLM models (disable thinking mode)
    if (input.modelId.startsWith("z-ai/")) {
      requestBody.chat_template_kwargs = {
        enable_thinking: false,
      };
    }

    // Make API call
    const response = await fetch(CHAT_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    // Check for HTTP errors
    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(
        `NVIDIA Chat API error (${response.status}): ${errorText}`,
      );
    }

    const data = await response.json();

    // Validate response structure
    if (
      !data.choices ||
      !Array.isArray(data.choices) ||
      data.choices.length === 0
    ) {
      throw new Error("NVIDIA Chat API returned no choices");
    }

    const content = data.choices[0].message?.content;

    if (!content || content.trim() === "") {
      throw new Error("NVIDIA Chat API returned empty response");
    }

    // Parse the response (parser never throws)
    const parser = await import("./parser");
    const result = parser.parseResponse(content);

    return result;
  } catch (error) {
    // Re-throw if it's already our error
    if (error instanceof Error && error.message.includes("NVIDIA")) {
      throw error;
    }
    // Wrap other errors
    throw new Error(
      `Failed to call chat API: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Builds the user message from scenario input
 *
 * @param input - The scenario input
 * @returns Formatted user message string
 */
function buildUserMessage(input: ScenarioInput): string {
  const lines: string[] = [];

  // Scenario description
  lines.push("## SCENARIO DESCRIPTION");
  lines.push("");
  lines.push(input.description);
  lines.push("");

  // Language
  lines.push("## RESPONSE LANGUAGE");
  lines.push("");
  lines.push(
    `Respond in: ${input.language === "amharic" ? "Amharic" : "English"}`,
  );
  lines.push("");

  // Crime category (if provided)
  if (input.crimeCategory) {
    lines.push("## CRIME CATEGORY");
    lines.push("");
    lines.push(`Category: ${input.crimeCategory}`);
    lines.push("");
  }

  // Slider values (if provided)
  const sliders: string[] = [];

  if (input.severity !== undefined) {
    const severityLabel = getSliderLabel(input.severity);
    sliders.push(`- Severity: ${input.severity}/10 (${severityLabel})`);
  }

  if (input.intent !== undefined) {
    const intentLabel = getSliderLabel(input.intent);
    sliders.push(`- Intent: ${input.intent}/10 (${intentLabel})`);
  }

  if (input.history !== undefined) {
    const historyLabel = getSliderLabel(input.history);
    sliders.push(`- Prior History: ${input.history}/10 (${historyLabel})`);
  }

  if (sliders.length > 0) {
    lines.push("## ASSESSMENT FACTORS");
    lines.push("");
    lines.push(...sliders);
    lines.push("");
  }

  // Final instruction
  lines.push("## INSTRUCTION");
  lines.push("");
  lines.push(
    "Analyze this scenario according to Ethiopian criminal law. Provide your response in valid JSON format only, following the AnalysisResult schema.",
  );

  return lines.join("\n");
}

/**
 * Converts slider value to human-readable label
 *
 * @param value - Slider value (1-10)
 * @returns Human-readable label
 */
function getSliderLabel(value: number): string {
  if (value <= 3) return "Low";
  if (value <= 6) return "Moderate";
  if (value <= 8) return "High";
  return "Very High";
}
