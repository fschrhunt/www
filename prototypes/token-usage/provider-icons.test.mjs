/** Pin creator attribution independently of the harness reporting usage. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import './provider-icons.js';

test('OpenCode and OpenRouter model IDs resolve to their actual creators', () => {
  for (const [model, expected] of Object.entries({
    'opencode/glm-5.3-flash': 'zai',
    'meta-llama/llama-4': 'meta',
    'muse-spark-1.2-contributor': 'meta',
    'kimi-k2.6': 'moonshot',
    'mimo-v2.5-pro': 'xiaomi',
    'hy3': 'hunyuan',
    'qwen3.8-flash': 'qwen',
    'deepseek/deepseek-v4:free': 'deepseek',
    'minimax-m2.7': 'minimax',
    'gpt-5.5': 'openai',
    'claude-opus-4.8': 'claude',
  })) {
    const actual = ProviderIcons.resolve(model, 'opencode');
    assert.equal(actual, expected, model);
    assert.ok(fs.existsSync(path.join(__dirname, 'icons', actual + '.svg')));
  }
});

test('unrecognized models never inherit a gateway logo', () => {
  assert.equal(ProviderIcons.resolve('unknown-model', 'openrouter'), 'unknown');
  assert.equal(ProviderIcons.resolve('unknown-model', 'opencode-go'), 'unknown');
  assert.equal(ProviderIcons.resolve('new-model', 'meta'), 'meta');
  assert.equal(ProviderIcons.resolve('../../anything', 'https://bad.example/icon.svg'), 'unknown');
});
