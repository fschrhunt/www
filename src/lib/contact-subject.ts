/** Find product mentions without choosing arbitrarily when a sentence names several products. */
function subjectProduct(text: string) {
  const products = [
    /\bflip\b/i.test(text) ? "Flip" : "",
    /\bdiffuse\b/i.test(text) ? "Diffuse" : "",
    /(?:\b(?:about|using|with|for) e\b|𝑒)/iu.test(text) ? "𝑒" : "",
  ].filter(Boolean);
  return products.length === 1 ? products[0] : "";
}

/** Suggest three to five words from the strongest intent and its sentence; visitors can edit it. */
export function suggestContactSubject(message: string) {
  const text = message.replace(/https?:\/\/\S+|\S+@\S+/gi, "").replace(/’/g, "'");
  const sentences = text.split(/(?<=[.!?])\s+|[\r\n]+/u).filter(Boolean);
  const rules = [
    { kind: "collaboration", weight: 4, match: /\b(?:collaborat\w*|work(?:ing)? together)\b/i },
    { kind: "feature", weight: 4, match: /\b(?:feature request|could you add|can you add|please add|would love to see)\b/i },
    { kind: "job", weight: 4, match: /\b(?:we're hiring|we are hiring|job opportunity|job offer|join our team|open role)\b/i },
    { kind: "bug", weight: 4, match: /\b(?:bug report|broken|crash(?:es|ed|ing)?|not working|doesn't work|won't (?:open|start|load)|unable to|fails? to|error message)\b/i },
    { kind: "bug", weight: 2, match: /\bbugs?\b/i },
    { kind: "feature", weight: 2, match: /\bsuggestion\b/i },
    { kind: "feedback", weight: 2, match: /\bfeedback\b/i },
    { kind: "question", weight: 1, match: /\b(?:question|wondering|how do|how can|can you|could you)\b|\?/i },
    { kind: "thanks", weight: 0, match: /\b(?:thank(?:s| you)?|appreciat\w*)\b/i },
  ];
  let best: { kind: string; weight: number; sentence: string } | undefined;
  for (const sentence of sentences) {
    // Exclude common negated topic phrases, without trying to interpret arbitrary prose.
    const intent = sentence.replace(/\b(?:not a|no)\s+(?:bugs?|bug report|feature request|question)\b|\b(?:isn't|is not|not)\s+(?:broken|crashing)\b/gi, "");
    for (const rule of rules) {
      if (rule.match.test(intent) && (!best || rule.weight > best.weight)) best = { ...rule, sentence };
    }
  }
  const context = best?.sentence ?? text;
  const website = /\b(?:website|site|contact form|homepage)\b/i.test(context);
  const product = subjectProduct(context) || (website ? "" : subjectProduct(text));
  switch (best?.kind) {
    case "collaboration": return "A potential collaboration";
    case "job": return "A potential job opportunity";
    case "bug": return product ? `Bug report for ${product}` : website ? "A website bug report" : "A software bug report";
    case "feature": return product ? `Feature idea for ${product}` : website ? "A website feature idea" : "A feature suggestion";
    case "feedback": return product ? `Some feedback on ${product}` : website ? "Feedback on your website" : "Some feedback for Fischer";
    case "question": return product ? `A question about ${product}` : website ? "A website question" : "A question for Fischer";
    case "thanks": return "A note of thanks";
    default: return product ? `A note about ${product}` : website ? "About your personal website" : "A note for Fischer";
  }
}
