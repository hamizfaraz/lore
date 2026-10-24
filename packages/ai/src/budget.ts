export interface CounterStore {
  increment(key: string, ttlSeconds: number): Promise<{ value: number; ttlSeconds: number }>;
}

export interface ValkeyCounterClient {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
  ttl(key: string): Promise<number>;
}

export class ValkeyCounterStore implements CounterStore {
  constructor(private readonly client: ValkeyCounterClient) {}

  async increment(key: string, ttlSeconds: number): Promise<{ value: number; ttlSeconds: number }> {
    const value = await this.client.incr(key);
    if (value === 1) await this.client.expire(key, ttlSeconds);
    const ttl = await this.client.ttl(key);
    return { value, ttlSeconds: ttl > 0 ? ttl : ttlSeconds };
  }
}

interface MemoryCounter {
  value: number;
  expiresAt: number;
}

export class InMemoryCounterStore implements CounterStore {
  private readonly counters = new Map<string, MemoryCounter>();

  async increment(key: string, ttlSeconds: number): Promise<{ value: number; ttlSeconds: number }> {
    const now = Date.now();
    const current = this.counters.get(key);
    const counter =
      !current || current.expiresAt <= now ? { value: 0, expiresAt: now + ttlSeconds * 1_000 } : current;
    counter.value += 1;
    this.counters.set(key, counter);
    return {
      value: counter.value,
      ttlSeconds: Math.max(1, Math.ceil((counter.expiresAt - now) / 1_000)),
    };
  }
}

export interface BudgetDecision {
  allowed: boolean;
  used: number;
  remaining: number;
  limit: number;
  resetSeconds: number;
}

export interface BudgetLimits {
  textCallsPerConversationPerHour: number;
  imagesPerHourGlobal: number;
  surpriseImagesPerConversationPerWeek: number;
}

const DEFAULT_LIMITS: BudgetLimits = {
  textCallsPerConversationPerHour: 60,
  imagesPerHourGlobal: 40,
  surpriseImagesPerConversationPerWeek: 1,
};

export class AiBudget {
  constructor(
    private readonly store: CounterStore,
    private readonly limits: BudgetLimits = DEFAULT_LIMITS,
  ) {}

  consumeText(conversationId: string): Promise<BudgetDecision> {
    return this.consume(
      `lore:ai:budget:text:${conversationId}`,
      this.limits.textCallsPerConversationPerHour,
      60 * 60,
    );
  }

  consumeImage(): Promise<BudgetDecision> {
    return this.consume('lore:ai:budget:image:global', this.limits.imagesPerHourGlobal, 60 * 60);
  }

  consumeSurpriseImage(conversationId: string): Promise<BudgetDecision> {
    return this.consume(
      `lore:ai:budget:surprise:${conversationId}`,
      this.limits.surpriseImagesPerConversationPerWeek,
      7 * 24 * 60 * 60,
    );
  }

  private async consume(key: string, limit: number, ttlSeconds: number): Promise<BudgetDecision> {
    const counter = await this.store.increment(key, ttlSeconds);
    return {
      allowed: counter.value <= limit,
      used: counter.value,
      remaining: Math.max(0, limit - counter.value),
      limit,
      resetSeconds: counter.ttlSeconds,
    };
  }
}
