import type { Alert, Tenant } from "@shared/schema";
import crypto from "crypto";

interface WebhookPayload {
  event: string;
  timestamp: string;
  data: {
    alertId: string;
    severity: string;
    title: string;
    message: string;
    source?: string;
    oltId?: string;
    onuId?: string;
  };
}

export async function sendWebhookNotification(
  alert: Alert,
  tenant: Tenant
): Promise<{ success: boolean; error?: string }> {
  if (!tenant.webhookEnabled || !tenant.webhookUrl) {
    return { success: false, error: "Webhook not configured" };
  }

  if (tenant.alertCriticalOnly && alert.severity !== "critical") {
    return { success: false, error: "Alert severity below threshold" };
  }

  const payload: WebhookPayload = {
    event: "alert.created",
    timestamp: new Date().toISOString(),
    data: {
      alertId: alert.id,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      source: alert.source || undefined,
      oltId: alert.oltId || undefined,
      onuId: alert.onuId || undefined,
    },
  };

  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-OLT-Webhook-Event": "alert.created",
    "X-OLT-Webhook-Timestamp": payload.timestamp,
  };

  if (tenant.webhookSecret) {
    const signature = crypto
      .createHmac("sha256", tenant.webhookSecret)
      .update(body)
      .digest("hex");
    headers["X-OLT-Webhook-Signature"] = `sha256=${signature}`;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(tenant.webhookUrl, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`[webhook] Failed to send notification: HTTP ${response.status}`);
      return { success: false, error: `HTTP ${response.status}` };
    }

    console.log(`[webhook] Successfully sent notification for alert ${alert.id}`);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[webhook] Error sending notification:`, errorMessage);
    return { success: false, error: errorMessage };
  }
}

export async function testWebhook(
  webhookUrl: string,
  webhookSecret?: string
): Promise<{ success: boolean; error?: string }> {
  const payload = {
    event: "test",
    timestamp: new Date().toISOString(),
    message: "This is a test webhook from OLT Management System",
  };

  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-OLT-Webhook-Event": "test",
    "X-OLT-Webhook-Timestamp": payload.timestamp,
  };

  if (webhookSecret) {
    const signature = crypto
      .createHmac("sha256", webhookSecret)
      .update(body)
      .digest("hex");
    headers["X-OLT-Webhook-Signature"] = `sha256=${signature}`;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: errorMessage };
  }
}
