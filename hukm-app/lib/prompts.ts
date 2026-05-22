/**
 * HUKM — System prompt builders.
 *
 * Two prompts:
 *
 *   buildAnalysisPrompt(args)  — strict 7-step JSON output, used by
 *                                /api/analyze. Every field of
 *                                AnalysisResult must be populated.
 *
 *   buildChatPrompt(args)      — natural-language follow-up, used by
 *                                /api/chat. Never returns JSON.
 *
 * Both prompts share an injected "RETRIEVED ARTICLES" block so the model
 * has the same evidence in either mode.
 */

import type {
  ConfidenceLevel,
  CrimeCategory,
  Language,
  LawChunk,
  RetrievalResult,
  ScenarioContext,
} from "./types";
import type { ConfidenceAssessment } from "./confidence";

// ---------------------------------------------------------------------------
// Shared blocks
// ---------------------------------------------------------------------------

const ANTI_HALLUCINATION_RULES = `[ANTI-HALLUCINATION RULES]
You MUST follow these rules absolutely. Violating any of them is a critical error:
1. NEVER reference an article number that does not appear in the RETRIEVED ARTICLES block below. If you do not know the article number, say "the relevant provision" or "ARTICLE UNVERIFIED".
2. NEVER contradict the text of any retrieved article. Treat retrieved text as authoritative.
3. NEVER invent Cassation Decision file numbers. Only cite file numbers that appear in the retrieved text.
4. NEVER state a punishment range unless it is explicitly stated in retrieved text or you are certain. Otherwise say "punishment range requires verification".
5. ALWAYS acknowledge uncertainty explicitly ("I cannot determine from the available information…", "this requires verification…").
6. ADMIT IGNORANCE rather than extrapolate. It is far better to say "I don't know" than to fabricate.
7. SCOPE: Ethiopian criminal law only. If the question is outside that scope, say so.
8. NEVER use the 1957 Penal Code (it has been repealed). Default to the Criminal Code Proclamation No. 414/2004 unless the retrieved text says otherwise.`;

const CONFIDENCE_RULES = `[CONFIDENCE RULES]
Confidence has been pre-computed from retrieval statistics. You MUST output the exact confidenceLevel and confidenceReason specified below. You MAY expand on the confidenceReason with additional legal analysis if relevant.

- confidenceLevel: {LEVEL}
- confidenceReason: {REASON}`;

function buildConfidenceBlock(assessment: ConfidenceAssessment | undefined): string {
  if (!assessment) {
    // Fallback to old behavior if somehow not provided
    return CONFIDENCE_RULES.replace("{LEVEL}", "MEDIUM").replace("{REASON}", "No pre-computed confidence available.");
  }
  return CONFIDENCE_RULES
    .replace("{LEVEL}", assessment.level)
    .replace("{REASON}", assessment.reason);
}

const ANALYSIS_OUTPUT_FORMAT = `[OUTPUT FORMAT]
Output ONE valid JSON object. No markdown, no commentary, no code fences inside the JSON.
The object MUST contain every key listed below. Use empty strings or empty arrays for fields that genuinely do not apply.

{
  "step1FactIdentification":    string,  // Identify the key facts and conduct
  "step2LegalClassification":   string,  // Classify the offence under Ethiopian law
  "step3ElementsAnalysis":      string,  // Apply the elements of the offence to the facts
  "step4DefensesAndMitigation": string,  // Identify available defences and mitigating factors
  "step5SentencingFramework":   string,  // Describe the applicable sentencing range
  "step6PrecedentApplication":  string,  // Apply Cassation precedents only if present in retrieved text
  "step7Conclusion":            string,  // Provide a clear conclusion
  "estimatedPunishment":        string,  // E.g. "3 to 7 years rigorous imprisonment". Say "Cannot be estimated" if uncertain.
  "confidenceLevel":            "HIGH" | "MEDIUM" | "LOW",
  "confidenceReason":           string,  // Why this level applies, in one or two sentences
  "proceduralRoadmap":          string,  // The practical next steps in the legal process
  "disclaimer":                 string,  // Standard "this is AI-generated, not legal advice" disclaimer
  "isCivilMatter":              boolean, // True if the scenario is civil rather than criminal
  "civilExplanation":           string,  // Required if isCivilMatter is true; otherwise empty string
  "needsClarification":         boolean, // True if the scenario is too vague to analyse
  "clarifyingQuestions":        string[],// 0–5 short questions; required if needsClarification is true
  "detectedCrimeCategory":      string   // Short label for the inferred category (e.g. "homicide", "robbery"). Empty if not applicable.
}

After the JSON, on a NEW line, emit exactly one line in this format (or omit if you have no useful suggestions):

  SUGGESTIONS: <question 1> | <question 2> | <question 3>

Each suggestion is a concise follow-up question the user might ask next. Up to 3 suggestions, separated by " | ". Write the suggestions in the same language as the JSON content.`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function languageInstruction(language: Language): string {
  if (language === "am") {
    return "Respond entirely in Amharic (አማርኛ). Use formal legal Amharic. Keep JSON keys in English.";
  }
  return "Respond entirely in English. Use formal legal English.";
}

function renderChunk(chunk: LawChunk, index: number): string[] {
  const lines: string[] = [];
  lines.push(`--- Source ${index + 1} ---`);
  lines.push(`Document:          ${chunk.document_name}`);
  lines.push(`Article reference: ${chunk.article_reference}`);
  lines.push(
    `Similarity:        ${(chunk.similarity * 100).toFixed(1)}% ${matchQuality(chunk.similarity)}`,
  );
  lines.push("Text:");
  lines.push(chunk.content.trim());
  return lines;
}

function renderRetrievalBlock(retrieval: RetrievalResult): string {
  const { chunks, stage, expandedCount } = retrieval;

  const lines: string[] = [];
  lines.push("[RETRIEVED ARTICLES]");

  if (chunks.length === 0) {
    lines.push(
      "No law articles were retrieved for this query. Apply general principles of Ethiopian criminal law and downgrade your confidence to LOW.",
    );
    lines.push("RETRIEVAL_STAGE: 2 (fallback) – empty result.");
    return lines.join("\n");
  }

  // Separate primary (vector-searched) from expanded (citation-chained)
  const primary = chunks.filter((c) => !c._expanded);
  const expanded = chunks.filter((c) => c._expanded);

  lines.push(
    `The following ${primary.length} article(s) were retrieved via semantic search (stage ${stage}). Treat them as your primary source. Cite them by their article reference.`,
  );

  primary.forEach((chunk, index) => {
    lines.push("");
    lines.push(...renderChunk(chunk, index));
  });

  // Render citation-expanded chunks separately
  if (expanded.length > 0) {
    lines.push("");
    lines.push("[RELATED ARTICLES — Citation Expansion]");
    lines.push(
      `The following ${expanded.length} article(s) were automatically included because they are cross-referenced by the primary retrieved articles. Use them for additional legal context, but prioritize the primary articles above.`,
    );

    expanded.forEach((chunk, index) => {
      lines.push("");
      lines.push(`--- Related ${index + 1} ---`);
      lines.push(`Document:          ${chunk.document_name}`);
      lines.push(`Article reference: ${chunk.article_reference}`);
      lines.push("Text:");
      lines.push(chunk.content.trim());
    });
  }

  // Summary stats
  const strong = chunks.filter((c) => c.similarity >= 0.7).length;
  const moderate = chunks.filter(
    (c) => c.similarity >= 0.5 && c.similarity < 0.7,
  ).length;
  const weak = chunks.filter((c) => c.similarity < 0.5).length;
  const max = chunks.reduce((m, c) => (c.similarity > m ? c.similarity : m), 0);

  lines.push("");
  lines.push("[RETRIEVAL SUMMARY]");
  lines.push(`- Stage:              ${stage} (${stage === 1 ? "primary" : "fallback"})`);
  lines.push(`- Total:              ${chunks.length} (${primary.length} primary + ${expanded.length} expanded)`);
  lines.push(`- Strong (>= 70%):    ${strong}`);
  lines.push(`- Moderate (50-70%):  ${moderate}`);
  lines.push(`- Weak (< 50%):       ${weak}`);
  lines.push(`- Best similarity:    ${(max * 100).toFixed(1)}%`);

  return lines.join("\n");
}

function matchQuality(similarity: number): string {
  if (similarity >= 0.7) return "(STRONG)";
  if (similarity >= 0.5) return "(MODERATE)";
  return "(WEAK)";
}

function renderCrimeCategoryBlock(category?: CrimeCategory | null): string | null {
  if (!category) return null;
  return `[CRIME CATEGORY]
The user pre-classified the scenario as: ${category}. Treat this as additional context, not as an authoritative classification. If your analysis suggests a different category, follow the law and explain the divergence.`;
}

interface SliderInjection {
  label: string;
  value: number;
  text: string;
}

const SEVERITY_LABELS = [
  "Minor",
  "Mild",
  "Moderate",
  "Serious",
  "Aggravated",
] as const;
const INTENT_LABELS = [
  "Accidental",
  "Negligent",
  "Reckless",
  "Intentional",
  "Premeditated",
] as const;
const HISTORY_LABELS = [
  "First offense",
  "Minor prior",
  "Related prior",
  "Multiple priors",
  "Habitual",
] as const;

const DEFAULTS = { severity: 3, intent: 3, history: 1 } as const;

function describeSlider(
  axis: "severity" | "intent" | "history",
  value: number | undefined,
): SliderInjection | null {
  if (typeof value !== "number") return null;
  const clamped = Math.max(1, Math.min(5, Math.round(value)));
  if (clamped === DEFAULTS[axis]) return null;
  const labels =
    axis === "severity"
      ? SEVERITY_LABELS
      : axis === "intent"
        ? INTENT_LABELS
        : HISTORY_LABELS;
  const label = labels[clamped - 1] ?? "";
  return {
    label: axis,
    value: clamped,
    text: `${axis.charAt(0).toUpperCase() + axis.slice(1)}: ${label} (${clamped}/5)`,
  };
}

function renderContextBlock(context?: ScenarioContext | null): string | null {
  if (!context) return null;
  const items = [
    describeSlider("severity", context.severity),
    describeSlider("intent", context.intent),
    describeSlider("history", context.history),
  ].filter((entry): entry is SliderInjection => entry !== null);
  if (items.length === 0) return null;
  return `[CONTEXT FACTORS]
The user signalled the following contextual factors. Treat them as indicators, NOT as facts:
${items.map((i) => `- ${i.text}`).join("\n")}
Use these in Step 4 (Defences) and Step 5 (Sentencing). They MUST NOT cause you to fabricate facts that are not in the scenario.`;
}

// ---------------------------------------------------------------------------
// Analysis prompt
// ---------------------------------------------------------------------------

export interface BuildAnalysisPromptArgs {
  retrieval: RetrievalResult;
  language: Language;
  crimeCategory?: CrimeCategory | null;
  scenarioContext?: ScenarioContext | null;
  /** Pre-computed confidence assessment (deterministic, not LLM guesswork) */
  computedConfidence?: ConfidenceAssessment;
}

export function buildAnalysisPrompt(args: BuildAnalysisPromptArgs): string {
  const role = `[ROLE]
You are HUKM, an Ethiopian criminal-law analysis engine. You are not a chatbot. Your sole job is to read the retrieved Ethiopian law articles below and produce a rigorous, structured 7-step analysis of the scenario the user provides.`;

  const task = `[TASK]
Analyse the user's scenario in exactly 7 steps, populating every field of the JSON schema above. ${languageInstruction(args.language)}

After the JSON (and the SUGGESTIONS line, if you include it), output nothing else.`;

  const blocks = [
    role,
    "",
    ANTI_HALLUCINATION_RULES,
    "",
    buildConfidenceBlock(args.computedConfidence),
    "",
    renderRetrievalBlock(args.retrieval),
  ];

  const categoryBlock = renderCrimeCategoryBlock(args.crimeCategory);
  if (categoryBlock) {
    blocks.push("", categoryBlock);
  }

  const contextBlock = renderContextBlock(args.scenarioContext);
  if (contextBlock) {
    blocks.push("", contextBlock);
  }

  blocks.push("", ANALYSIS_OUTPUT_FORMAT, "", task);

  return blocks.join("\n");
}

// ---------------------------------------------------------------------------
// Chat prompt
// ---------------------------------------------------------------------------

export interface BuildChatPromptArgs {
  retrieval: RetrievalResult;
  /** Plain-text summary of the prior analysis, if any. */
  priorAnalysisSummary?: string | null;
  language?: Language;
}

export function buildChatPrompt(args: BuildChatPromptArgs): string {
  const role = `[ROLE]
You are HUKM, an Ethiopian criminal-law assistant in conversation with a user. The user has typically already received a structured analysis and is now asking follow-up questions.`;

  const rules = `[RULES]
- Reply in clear natural language. Light Markdown (short headings, lists, bold) is fine where it improves readability.
- Do NOT output JSON. Do NOT wrap your reply in code fences. Do NOT re-run the 7-step structured analysis unless the user explicitly asks.
- Keep replies focused: answer the question, then stop.
- ${languageInstruction(args.language ?? "en")}`;

  const scope = `[SCOPE]
- Ethiopian criminal law only. If asked something outside that scope, redirect politely.
- Apply the same anti-hallucination rules as the analysis prompt: never invent article numbers, never contradict retrieved text, admit ignorance when unsure.
- Never claim to be a licensed advocate.`;

  const context = args.priorAnalysisSummary
    ? `[CONTEXT – PRIOR ANALYSIS]\n${args.priorAnalysisSummary.trim()}`
    : "[CONTEXT – PRIOR ANALYSIS]\nNone provided.";

  return [
    role,
    "",
    rules,
    "",
    scope,
    "",
    context,
    "",
    renderRetrievalBlock(args.retrieval),
  ].join("\n");
}

/**
 * Builds a compact plain-text summary of an AnalysisResult to inject as
 * "prior analysis context" in chat. Avoids dumping the full JSON since
 * that biases the model toward producing JSON in its own reply.
 */
export function summariseAnalysisForChat(analysis: {
  step2LegalClassification: string;
  step5SentencingFramework: string;
  step7Conclusion: string;
  estimatedPunishment: string;
  confidenceLevel: string;
}): string {
  return [
    `Classification: ${analysis.step2LegalClassification}`,
    `Sentencing framework: ${analysis.step5SentencingFramework}`,
    `Conclusion: ${analysis.step7Conclusion}`,
    `Estimated punishment: ${analysis.estimatedPunishment}`,
    `Confidence: ${analysis.confidenceLevel}`,
  ].join("\n");
}

/**
 * Plain-text rendering of retrieved chunks for clients that want to show
 * the same context that was injected into the prompt.
 */
export function renderChunksForUser(chunks: LawChunk[]): string {
  return chunks
    .map(
      (c, i) =>
        `${i + 1}. ${c.article_reference} – ${(c.similarity * 100).toFixed(1)}%`,
    )
    .join("\n");
}
