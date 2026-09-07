/** Suggest a short subject from the message; keep the body untouched and allow editing. */
export function suggestContactSubject(message: string) {
  const text = message.trim().replace(/^(?:hi|hey|hello)(?: fischer)?[!,.]?\s+/i, "").trim();
  const product = /\bflip\b/i.test(text) ? "Flip" : /\bdiffuse\b/i.test(text) ? "Diffuse" : /(?:\b(?:about|using|with|for) e\b|𝑒)/iu.test(text) ? "𝑒" : "";
  const topic = /\b(?:bug|broken|crash(?:es|ing)?|not working|doesn't work)\b/i.test(text) ? "Bug report" :
    /\b(?:feature request|could you add|would love|suggestion)\b/i.test(text) ? "A suggestion" :
    /\b(?:collaborat\w*|work together)\b/i.test(text) ? "Working together" :
    /\b(?:question|wondering|how do|how can)\b/i.test(text) ? "A question" : "";
  if (topic) return product ? `${product}: ${topic.toLowerCase()}` : topic;
  const firstLine = text.split(/\n|[!?](?:\s|$)|\.(?:\s|$)/u)[0]?.trim() || "A note for Fischer";
  return firstLine.length <= 72 ? firstLine : firstLine.slice(0, 69).replace(/\s+\S*$/, "").trimEnd() + "…";
}
