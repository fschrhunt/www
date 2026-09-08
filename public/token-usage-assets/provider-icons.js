/* Resolve model creators independently of the harness or gateway serving their usage. */
(function (root) {
  'use strict';
  const families = [
    [/^(?:gpt(?:[ .-]|$)|chatgpt|o[134](?:[ .-]|$)|codex|dall-e|sora|whisper|text-embedding)/, 'openai'],
    [/^(?:claude|opus|sonnet|haiku|fable)(?:[ .-]|$)/, 'claude'],
    [/^(?:glm|chatglm|codegeex|cogview|cogvideo)(?:[ .-]|$)/, 'zai'],
    [/^(?:muse[ .-]?spark|llama|meta[ .-]llama)/, 'meta'],
    [/^(?:gemini|gemma|learnlm|imagen|veo|nano[ .-]?banana)/, 'google'],
    [/^deepseek/, 'deepseek'],
    [/^(?:minimax|abab|hailuo)/, 'minimax'],
    [/^(?:kimi|moonshot)/, 'moonshot'],
    [/^(?:qwen|qwq|qvq|wan[ .-]?\d)/, 'qwen'],
    [/^(?:xiaomi[ .-]?)?mimo/, 'xiaomi'],
    [/^(?:hunyuan|hy[ .-]?\d)/, 'hunyuan'],
    [/^longcat/, 'longcat'],
    [/^(?:grok|xai)(?:[ .-]|$)/, 'xai'],
    [/^(?:mistral|mixtral|magistral|ministral|codestral|devstral|pixtral|voxtral)/, 'mistral'],
    [/^(?:command[ .-]|c4ai|aya[ .-]|embed[ .-](?:english|multilingual)|rerank[ .-])/, 'cohere'],
    [/^(?:nova|titan)(?:[ .-]|$)/, 'aws'],
    [/^(?:phi[ .-]|mai[ .-])/,'microsoft'],
    [/^(?:nemotron|nvidia)/, 'nvidia'],
    [/^(?:jamba|j2[ .-]|jurassic)/, 'ai21'],
    [/^(?:olmo|molmo|tulu)/, 'ai2'],
    [/^(?:seed|doubao)/, 'bytedance'],
    [/^(?:ernie|wenxin)/, 'baidu'],
    [/^baichuan/, 'baichuan'],
    [/^(?:yi[ .-]|yi$)/, 'yi'],
    [/^lfm/, 'liquid'],
    [/^(?:granite|ibm)/, 'ibm'],
    [/^(?:deepcoder|deepcogito|cogito)/, 'deepcogito'],
    [/^(?:flux|black[ .-]?forest)/, 'bfl'],
    [/^(?:stable[ .-]?diffusion|stable[ .-]?image|sdxl)/, 'stability'],
    [/^(?:solar|upstage)/, 'upstage'],
    [/^(?:sonar|r1-1776)/, 'perplexity'],
  ];
  const aliases = {
    anthropic: 'claude', 'z.ai': 'zai', zhipu: 'zai', zhipuai: 'zai',
    'meta-llama': 'meta', metaai: 'meta', facebook: 'meta',
    alibaba: 'qwen', 'qwen-team': 'qwen', xiaomi: 'xiaomi',
    tencent: 'hunyuan', meituan: 'longcat', 'moonshotai': 'moonshot',
    'x.ai': 'xai', 'mistralai': 'mistral', amazon: 'aws',
    'allenai': 'ai2', '01-ai': 'yi', 'black-forest-labs': 'bfl',
    'stabilityai': 'stability', 'ibm-granite': 'ibm',
  };
  // Catalog is generated from the pinned, vendored canonical SVG filenames.
  const available = new Set(["ace","adobe","adobefirefly","agentvoice","agnesai","agui","ai2","ai21","ai302","ai360","aihubmix","aimass","aionlabs","airjelly","aistudio","akashchat","alephalpha","alibaba","alibabacloud","amp","anspire","antgroup","anthropic","antigravity","anyscale","apertis","apple","arcee","askverdict","assemblyai","atlascloud","automatic","aws","aya","azure","azureai","baai","baichuan","baidu","baiducloud","bailian","baseten","bedrock","bfl","bilibili","bilibiliindex","bing","bocha","brave","briaai","browserless","burncloud","bytedance","capcut","celestoai","centml","cerebras","chatglm","cherrystudio","civitai","claude","claudecode","cline","clipdrop","cloudflare","codebuddy","codeflicker","codegeex","codex","cogvideo","cogview","cohere","colab","cometapi","comfyui","commanda","copilot","copilotkit","coqui","coze","crewai","crusoe","cursor","cybercut","dalle","dbrx","deepai","deepcogito","deepinfra","deepl","deepmind","deepseek","devin","dify","doc2x","docsearch","dolphin","doubao","dreammachine","elevenlabs","elevenx","essentialai","exa","fal","fastgpt","featherless","figma","firecrawl","fireworks","fishaudio","flora","flowith","flux","friendli","gemini","geminicli","gemma","giteeai","github","githubcopilot","glama","glif","glmv","google","googlecloud","goose","gradio","greptile","grok","groq","hailuo","haiper","happyhorse","hedra","hermesagent","higress","huawei","huaweicloud","huggingface","hunyuan","hyperbolic","ibm","ideogram","iflytekcloud","inception","inference","infermatic","infinigence","inflection","internlm","jimeng","jina","junie","kagi","kilocode","kimi","kiro","kling","kluster","kolors","krea","kwaikat","kwaipilot","lambda","langchain","langfuse","langgraph","langsmith","leptonai","lg","lightricks","liquid","livekit","llamaindex","llava","llmapi","lmstudio","lobehub","longcat","lovable","lovart","luma","magic","make","manus","mastra","mcp","mcpso","menlo","meshy","meta","metaai","metagpt","microsoft","midjourney","minimax","mistral","modelscope","monica","moonshot","morph","moxt","myshell","n8n","nanobanana","nebius","newapi","notebooklm","notion","nousresearch","nova","novelai","novita","nplcloud","nvidia","obsidian","ollama","openai","openchat","openclaw","opencode","openhands","openhuman","openrouter","openwebui","palm","parasail","perplexity","phidata","phind","pi","pika","pixverse","player2","poe","pollinations","poolside","ppio","prunaai","pydanticai","qingyan","qiniu","qoder","qwen","railway","recraft","relace","replicate","replit","reve","roocode","rsshub","runway","rwkv","sambanova","search1api","searchapi","searxng","sensenova","siliconcloud","sillytavern","skywork","slock","smithery","snowflake","sophnet","sora","spark","speedai","stability","statecloud","stepfun","straico","streamlake","submodel","suno","sync","targon","tavily","tencent","tencentcloud","tiangong","tii","together","topazlabs","trae","tripo","turix","udio","unsloth","unstructured","upstage","v0","vectorizerai","venice","vercel","vertexai","vidu","viggle","vllm","volcengine","voyage","wenxin","windsurf","workersai","worldrouter","xai","xiaomi","xiaomimimo","xinference","xpay","xuanyuan","yandex","yi","youmind","yuanbao","zai","zapier","zeabur","zencoder","zenmux","zeroone","zhipu"]);
  const gateways = new Set(['opencode', 'opencode-go', 'codex', 'claude-code', 'openrouter', 'groq', 'together', 'togetherai', 'fireworks', 'fireworksai', 'azure', 'bedrock', 'ollama', 'lmstudio', 'litellm', 'vercel', 'deepinfra', 'siliconcloud', 'siliconflow']);

  /** Prefer a recognized model family; creator is optional author metadata, never a harness name. */
  function resolve(modelId, creator) {
    const id = String(modelId || '').toLowerCase().trim();
    const parts = id.split('/');
    const name = parts.at(-1).replace(/:[^:]+$/, '');
    for (const [pattern, icon] of families) {
      if (pattern.test(name) && available.has(icon)) return icon;
    }
    for (const hint of [creator, parts.length > 1 ? parts[0] : null, name]) {
      const raw = String(hint || '').toLowerCase().trim();
      if (!raw || gateways.has(raw)) continue;
      const icon = aliases[raw] || raw;
      if (available.has(icon)) return icon;
    }
    return 'unknown';
  }

  /** Create a same-origin mask; dynamic labels never become HTML or arbitrary URLs. */
  function create(modelId, creator) {
    const icon = resolve(modelId, creator);
    const element = document.createElement('span');
    element.className = 'mark provider-mark';
    element.setAttribute('aria-hidden', 'true');
    element.dataset.provider = icon;
    element.style.setProperty('--provider-icon', 'url("/token-usage-assets/icons/' + icon + '.svg")');
    return element;
  }

  root.ProviderIcons = Object.freeze({ resolve, create });
})(globalThis);
