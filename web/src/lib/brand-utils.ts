/**
 * AI 厂商/品牌定义
 */
export interface BrandInfo {
    id: string;
    name: string;
    keywords: string[];
}

export const KNOWN_BRANDS: BrandInfo[] = [
    { id: 'qwen', name: '通义千问', keywords: ['qwen', 'qwq', 'wan'] },
    { id: 'openai', name: 'OpenAI', keywords: ['openai', 'gpt-', 'o1-', 'o3-', 'dall-e', 'text-embedding', 'tts-', 'whisper'] },
    { id: 'google', name: 'Google', keywords: ['google', 'gemini', 'gemma', 'veo', 'imagen'] },
    { id: 'xai', name: 'xAI', keywords: ['xai', 'grok'] },
    { id: 'meta', name: 'Meta', keywords: ['meta', 'llama'] },
    { id: 'bytedance', name: 'ByteDance/豆包', keywords: ['bytedance', 'doubao', 'seed', 'happyhorse', 'seedance', 'seedream', 'nano-banana'] },
    { id: 'nvidia', name: 'NVIDIA', keywords: ['nvidia', 'nemotron', 'nv-'] },
    { id: 'zhipu', name: '智谱 AI', keywords: ['z-ai', 'zhipu', 'glm', 'cogview'] },
    { id: 'deepseek', name: 'DeepSeek', keywords: ['deepseek'] },
    { id: 'moonshot', name: 'Moonshot/Kimi', keywords: ['moonshot', 'kimi'] },
    { id: 'mistral', name: 'Mistral', keywords: ['mistral', 'codestral', 'mixtral'] },
    { id: 'jina', name: 'Jina AI', keywords: ['jina'] },
    { id: 'anthropic', name: 'Anthropic', keywords: ['anthropic', 'claude'] },
    { id: 'minimax', name: 'MiniMax', keywords: ['minimax'] },
    { id: 'doubao', name: '豆包', keywords: ['doubao'] },
    { id: 'ibm', name: 'IBM', keywords: ['ibm', 'granite'] },
    { id: 'microsoft', name: 'Microsoft', keywords: ['microsoft', 'phi-'] },
    { id: 'stepfun', name: '阶跃星辰', keywords: ['stepfun', 'step-'] },
    { id: 'mimo', name: 'Xiaomi MiMo', keywords: ['mimo'] },
    { id: 'yi', name: '零一万物', keywords: ['01-ai', 'yi-'] },
    { id: 'baai', name: 'BAAI', keywords: ['baai', 'bge-'] },
    { id: 'cohere', name: 'Cohere', keywords: ['cohere', 'command-'] },
    { id: 'nous', name: 'Nous Research', keywords: ['nousresearch', 'hermes'] },
    { id: 'perplexity', name: 'Perplexity', keywords: ['perplexity', 'sonar'] },
    { id: 'ai21', name: 'AI21 Labs', keywords: ['ai21labs', 'jamba'] },
];

/**
 * 根据组名/模型名判断所属厂商品牌
 */
export function detectBrand(name: string): { id: string; name: string } {
    const raw = (name || '').toLowerCase().trim();
    // 先清理前导的 ~ 或修饰符
    const clean = raw.replace(/^~/, '');

    // 1. 尝试匹配已知品牌关键词
    for (const b of KNOWN_BRANDS) {
        for (const kw of b.keywords) {
            if (clean.includes(kw)) {
                return { id: b.id, name: b.name };
            }
        }
    }

    // 2. 若带有/前缀且未命中已知品牌，取斜线前的名字首字母大写
    const slashIdx = clean.indexOf('/');
    if (slashIdx > 0) {
        const prefix = clean.substring(0, slashIdx);
        if (prefix && prefix.length < 20) {
            const formatted = prefix.charAt(0).toUpperCase() + prefix.slice(1);
            return { id: prefix, name: formatted };
        }
    }

    // 3. 兜底分类：其他
    return { id: 'other', name: '其他' };
}
