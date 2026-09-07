type NameReply = { name: string; reply?: never } | { name?: never; reply: string };

/** Recognize obvious non-name replies, without treating unusual names as invalid. */
export function readContactName(answer: string): NameReply {
  const introduction = /^(?:(?:hi+|hey+|hello+|hiya|yo+)[,!:.]?\s+)?(?:my name is|i['’]?m|i am|call me|it['’]?s)\s+/iu;
  const introduced = introduction.test(answer.trim());
  const extracted = answer.trim().replace(introduction, "").trim();
  const name = introduced ? extracted.replace(/[.!]+$/u, "").trim() : extracted;
  if (/https?:\/\/|www\.|[^\s@]+@[^\s@]+\.[^\s@]+/iu.test(answer)) {
    return { reply: "that's an address. I was hoping for the person who lives behind it. what should I call you?" };
  }
  const topic = contactAside(answer);
  if (topic) return { reply: topic.replies[0] };
  const conversational = normalizeContactReply(name);
  // A greeting plus unknown words is ambiguous, never an automatic full name.
  if (!introduced && /^(?:hi+|hey+|hello+|hiya|yo+|good morning|good evening|good afternoon)(?=$|[\s,!:.?])/iu.test(answer.trim())) {
    return { reply: "hey :) I caught the hello, but not your name. what should I call you?" };
  }
  if (!/\p{L}/u.test(name) || /[?？]/u.test(name) ||
    /^(?:how(?:'s| is| was| are| has| have| do| did)|what(?:'s| is| are| was| do| did| have)|why|when (?:is|are|do|did)|where (?:is|are|do|did)|who (?:is|are)|(?:can|could|would|do|did|are|have) you|tell me|ignore (?:all|the|previous))\s+\S/iu.test(conversational) ||
    /^(?:i (?:want|need|was|have|like|love|think|feel|am)|i'm (?:looking|trying|doing|feeling)|this is (?:a|an|the)|it is|it's (?:a|an|the)|thanks(?: for)?|thank you|nice to|just (?:wanted|checking|testing)|please|help me|you (?:are|have|look))\b/iu.test(conversational) ||
    name.split(/\s+/u).length > 6) {
    return { reply: "I had one job: ask your name. somehow I'm already off-script. what should I call you?" };
  }
  return { name };
}

export type ContactStep = "name" | "email" | "message" | "review";
export type ChatMemory = Record<string, number>;

const topics = [
  { key: "day", pattern: /^(?:how(?:'?s| is| was| has) your (?:day|morning|afternoon|evening|week|weekend)(?: been| going| been going)?(?: today| so far)?|how(?:'?s| is) (?:the day|today) going)$/i,
    replies: ["pretty quiet. someone just asked how my day was, so things are picking up.", "still sitting here. you've been here for most of it.", "no developments since the last report. I'll keep you posted."] },
  { key: "activity", pattern: /^(?:what (?:did you do|have you (?:done|been doing)) today|what (?:are you|you) (?:doing|up to)|what(?:'?ve| have) you been up to)$/i,
    replies: ["sat here. moved three dots up and down. a full schedule.", "the dots remain my main responsibility."] },
  { key: "wellbeing", pattern: /^(?:how (?:are )?you(?: doing)?|how(?:'?s| is) it going|how do you do|what(?:'?s| is) up|how(?:'?s| is) life|how have you been)$/i,
    replies: ["a little boxed in, being a contact form. thanks for asking.", "holding up. the rectangle helps."] },
  { key: "greeting", pattern: /^(?:hi+|hey+|hello+|hiya|yo+|good morning|good evening|good afternoon)(?:[,! ]+\s*(?:there|buddy|friend|bro|dude|mate|man|fischer))?$/i,
    replies: ["hey :) nice of you to stop by.", "hello again. I haven't gone anywhere."] },
  { key: "bot", pattern: /^(?:are you (?:an? )?(?:ai|bot|robot)|is this (?:ai|a bot)|are you chatgpt)$/i,
    replies: ["just a form with a few prepared lines. the acting budget is zero.", "still a form. this is my entire range."] },
  { key: "email-purpose", pattern: /^why (?:do you |would you )?(?:need|want|ask for|require) (?:my |an? )?email(?: address)?$/i,
    replies: ["so Fischer can reply. this stays in your browser until you open and send the email draft.", "a return address, that's all. otherwise the reply has nowhere to go."] },
];

/** Normalize only the matching copy; never rewrite the visitor's name or message. */
function normalizeContactReply(answer: string) {
  return answer.normalize("NFKC").trim().toLowerCase()
    .replace(/[‘’]/g, "'").replace(/\s+/g, " ")
    .replace(/\bur\b/g, "your").replace(/\bu\b/g, "you").replace(/\br\b/g, "are")
    .replace(/\b(how|what|who|where|when|why)s\b/g, "$1's")
    .replace(/\bwhatve\b/g, "what've")
    .replace(/\bgoin\b/g, "going").replace(/\bdoin\b/g, "doing")
    .replace(/^(?:hey+|hi+|hello+|hiya|yo+)[,!:.\s]+(?=how|what|why|where|when|who|are|is|can|could|would|do|did|have)/, "")
    .replace(/[?!.,…]+$/g, "").trim();
}

/** Match whole small-talk replies so a real message containing a question stays intact. */
export function contactAside(answer: string) {
  const normalized = normalizeContactReply(answer);
  return topics.find(topic => topic.pattern.test(normalized));
}

/** Vary repeated replies by topic and only occasionally return to the pending question. */
export function replyToAside(topic: NonNullable<ReturnType<typeof contactAside>>, memory: ChatMemory, step: ContactStep) {
  const count = memory[topic.key] ?? 0;
  const turns = memory.turns ?? 0;
  const prompts = { name: "what should I call you?", email: "what's a good email to reach you at?", message: "whenever you're ready, what's on your mind?", review: "your draft is ready when you are." };
  return {
    text: topic.replies[Math.min(count, topic.replies.length - 1)] + (turns % 3 === 0 ? ` ${prompts[step]}` : ""),
    memory: { ...memory, [topic.key]: count + 1, turns: turns + 1 },
  };
}

/** Recognize explicit corrections without interpreting ordinary message prose as a command. */
export function correctedName(answer: string) {
  return answer.trim().match(/^(?:actually[, ]+\s*)?(?:call me|my name is|change my name to)\s+(.+)$/iu)?.[1]?.trim();
}
