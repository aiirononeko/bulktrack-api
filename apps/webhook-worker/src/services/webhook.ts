import type {
  WebhookMessage,
  WebhookPayload,
} from "@bulktrack/queue-types";

interface WebhookEnv {
  WEBHOOK_CACHE: KVNamespace;
  WEBHOOK_TIMEOUT: string;
  MAX_WEBHOOK_SIZE: string;
}

export class WebhookService {
  private readonly timeout: number;
  private readonly maxSize: number;

  constructor(private env: WebhookEnv) {
    this.timeout = parseInt(env.WEBHOOK_TIMEOUT || "30000", 10);
    this.maxSize = parseInt(env.MAX_WEBHOOK_SIZE || "1048576", 10); // 1MB default
  }

  async sendWebhook(message: WebhookMessage): Promise<void> {
    const { webhookType, payload, retryCount = 0 } = message;
    
    console.log(`Sending ${webhookType} webhook to ${payload.url}`);

    // Check cache for rate limiting
    const rateLimitKey = `ratelimit:${payload.url}:${webhookType}`;
    const isRateLimited = await this.checkRateLimit(rateLimitKey);
    
    if (isRateLimited) {
      throw new Error(`Rate limited for ${payload.url}`);
    }

    // Validate payload size
    const payloadSize = new TextEncoder().encode(JSON.stringify(payload.body)).length;
    if (payloadSize > this.maxSize) {
      throw new Error(`Payload size ${payloadSize} exceeds max size ${this.maxSize}`);
    }

    // Send webhook
    try {
      const response = await this.executeWebhook(payload);
      
      if (!response.ok) {
        throw new Error(`Webhook failed with status ${response.status}: ${response.statusText}`);
      }

      // Cache successful webhook
      await this.cacheSuccess(message);
      
      console.log(`Successfully sent ${webhookType} webhook to ${payload.url}`);
    } catch (error) {
      console.error(`Webhook failed for ${payload.url}:`, error);
      
      // Update rate limit on failure
      await this.updateRateLimit(rateLimitKey);
      
      throw error;
    }
  }

  private async executeWebhook(payload: WebhookPayload): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(payload.url, {
        method: payload.method,
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "BulkTrack/1.0",
          ...payload.headers,
        },
        body: JSON.stringify(payload.body),
        signal: controller.signal,
      });

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async checkRateLimit(key: string): Promise<boolean> {
    const attempts = await this.env.WEBHOOK_CACHE.get(key);
    if (!attempts) return false;
    
    const parsed = JSON.parse(attempts);
    const { count, firstAttempt } = parsed;
    
    // Allow 5 failures per hour
    const hourAgo = Date.now() - 3600000;
    if (firstAttempt < hourAgo) {
      await this.env.WEBHOOK_CACHE.delete(key);
      return false;
    }
    
    return count >= 5;
  }

  private async updateRateLimit(key: string): Promise<void> {
    const existing = await this.env.WEBHOOK_CACHE.get(key);
    
    if (existing) {
      const parsed = JSON.parse(existing);
      parsed.count += 1;
      await this.env.WEBHOOK_CACHE.put(key, JSON.stringify(parsed), {
        expirationTtl: 3600, // 1 hour
      });
    } else {
      await this.env.WEBHOOK_CACHE.put(
        key,
        JSON.stringify({ count: 1, firstAttempt: Date.now() }),
        { expirationTtl: 3600 }
      );
    }
  }

  private async cacheSuccess(message: WebhookMessage): Promise<void> {
    const cacheKey = `webhook:${message.webhookType}:${message.aggregateId || 'system'}:${Date.now()}`;
    
    await this.env.WEBHOOK_CACHE.put(
      cacheKey,
      JSON.stringify({
        type: message.webhookType,
        sentAt: new Date().toISOString(),
        url: message.payload.url,
      }),
      { expirationTtl: 86400 } // 24 hours
    );
  }
}