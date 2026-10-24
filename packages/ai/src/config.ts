export type AiMode = 'live' | 'mock';

export interface AiConfig {
  mode: AiMode;
  metaApiKey?: string;
  metaApiBase: string;
  museTextModel: string;
  museImageModel: string;
  museVoiceModel: string;
  geminiApiKey?: string;
  geminiEmbedModel: string;
  geminiGuardModel?: string;
  serpApiKey?: string;
}

function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function getAiConfig(overrides: Partial<AiConfig> = {}): AiConfig {
  const configuredMode = optionalEnv('AI_MODE');
  const mode: AiMode = configuredMode === 'live' ? 'live' : 'mock';

  return {
    mode,
    metaApiKey: optionalEnv('META_API_KEY'),
    metaApiBase: optionalEnv('META_API_BASE') ?? 'https://api.meta.ai/v1',
    museTextModel: optionalEnv('MUSE_TEXT_MODEL') ?? 'muse-spark-1.1',
    museImageModel: optionalEnv('MUSE_IMAGE_MODEL') ?? 'muse-image-1.0',
    museVoiceModel: optionalEnv('MUSE_VOICE_MODEL') ?? 'muse-voice-transcribe-1.0',
    geminiApiKey: optionalEnv('GEMINI_API_KEY'),
    geminiEmbedModel: optionalEnv('GEMINI_EMBED_MODEL') ?? 'gemini-embedding-001',
    geminiGuardModel: optionalEnv('GEMINI_GUARD_MODEL'),
    serpApiKey: optionalEnv('SERPAPI_KEY'),
    ...overrides,
  };
}

export function requireLiveValue(value: string | undefined, envName: string): string {
  if (!value) {
    throw new Error(`${envName} is required when AI_MODE=live`);
  }
  return value;
}
