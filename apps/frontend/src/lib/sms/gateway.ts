// ============================================================
// LEGALIR — SMS gateway adapter
// ============================================================
// ONE outbound SMS interface for every notification the contract
// lifecycle sends: signature OTP codes, per-party draft invitations,
// and the final-approval notice.
//
// The transport is chosen by environment, never by the caller:
//
//   LEGALIR_SMS_PROVIDER=kavenegar + KAVENEGAR_API_KEY  → real SMS
//   NODE_ENV !== "production"                          → dev console
//   otherwise                                          → NOT CONFIGURED
//
// A real gateway is NOT bundled with the repository. Rather than
// pretending a message was delivered, an unconfigured production
// deployment returns `{ ok: false, reason: "NOT_CONFIGURED" }` and the
// caller surfaces that failure — the same rule the signature workflow
// already applies to OTP delivery.
//
// The development channel is a genuine delivery channel (the server
// console) and reports `channel: "dev-console"`, so nothing in the UI
// or the logs claims an SMS reached a phone when it did not.
// ============================================================

import crypto from "node:crypto";

/** One outbound message. `to` is an Iranian mobile in 09… form. */
export interface SmsMessage {
  to: string;
  body: string;
  /** Where the message came from, for logs and future analytics. */
  tag: "signature-otp" | "draft-invitation" | "final-approval";
}

export type SmsSendOutcome =
  | { ok: true; channel: "sms" | "dev-console"; messageId: string | null }
  | {
      ok: false;
      reason: "NOT_CONFIGURED" | "PROVIDER_ERROR";
      /** Persian message the UI can show verbatim. */
      detailFa: string;
    };

export interface SmsGateway {
  readonly id: "kavenegar" | "dev-console" | "unconfigured";
  send(message: SmsMessage): Promise<SmsSendOutcome>;
}

// ------------------------------------------------------------
// Kavenegar (the provider named by the existing adapter contract)
// ------------------------------------------------------------

class KavenegarGateway implements SmsGateway {
  readonly id = "kavenegar" as const;

  constructor(
    private readonly apiKey: string,
    private readonly sender: string
  ) {}

  async send(message: SmsMessage): Promise<SmsSendOutcome> {
    const url =
      `https://api.kavenegar.com/v1/${encodeURIComponent(this.apiKey)}/sms/send.json` +
      `?receptor=${encodeURIComponent(message.to)}` +
      `&sender=${encodeURIComponent(this.sender)}` +
      `&message=${encodeURIComponent(message.body)}`;

    try {
      const response = await fetch(url, { method: "GET", cache: "no-store" });
      const json = (await response.json().catch(() => null)) as
        | { return?: { status?: number; message?: string }; entries?: { messageid?: number }[] }
        | null;
      const status = json?.return?.status;
      if (!response.ok || status !== 200) {
        return {
          ok: false,
          reason: "PROVIDER_ERROR",
          detailFa: "سرویس پیامک ارسال را نپذیرفت. دوباره تلاش کنید.",
        };
      }
      return {
        ok: true,
        channel: "sms",
        messageId: json?.entries?.[0]?.messageid ? String(json.entries[0]!.messageid) : null,
      };
    } catch {
      return {
        ok: false,
        reason: "PROVIDER_ERROR",
        detailFa: "ارتباط با سرویس پیامک برقرار نشد.",
      };
    }
  }
}

// ------------------------------------------------------------
// Development console transport
// ------------------------------------------------------------

class DevConsoleGateway implements SmsGateway {
  readonly id = "dev-console" as const;

  async send(message: SmsMessage): Promise<SmsSendOutcome> {
    // Delivered to the developer's console — a real transport whose
    // destination is the terminal, not a phone. Callers report
    // `channel: "dev-console"`, never "sms".
    // eslint-disable-next-line no-console
    console.info(`[legalir:sms:${message.tag}] to=${message.to}\n${message.body}`);
    return { ok: true, channel: "dev-console", messageId: null };
  }
}

// ------------------------------------------------------------
// Unconfigured
// ------------------------------------------------------------

class UnconfiguredGateway implements SmsGateway {
  readonly id = "unconfigured" as const;

  async send(): Promise<SmsSendOutcome> {
    return {
      ok: false,
      reason: "NOT_CONFIGURED",
      detailFa:
        "سامانهٔ پیامک پیکربندی نشده است. برای ارسال واقعی، متغیرهای LEGALIR_SMS_PROVIDER و KAVENEGAR_API_KEY و KAVENEGAR_SENDER را تنظیم کنید.",
    };
  }
}

/** The active gateway, resolved from the environment on each call. */
export function getSmsGateway(): SmsGateway {
  const provider = process.env["LEGALIR_SMS_PROVIDER"];
  const apiKey = process.env["KAVENEGAR_API_KEY"];
  const sender = process.env["KAVENEGAR_SENDER"];

  if (provider === "kavenegar" && apiKey && sender) {
    return new KavenegarGateway(apiKey, sender);
  }
  if (process.env.NODE_ENV !== "production") {
    return new DevConsoleGateway();
  }
  return new UnconfiguredGateway();
}

/** True when a REAL SMS transport is configured (never true for dev). */
export function smsConfigured(): boolean {
  return getSmsGateway().id === "kavenegar";
}

/**
 * A short opaque reference for an invitation link, included in the SMS
 * body. The link itself is built by the caller, which owns the token.
 */
export function newSmsReference(): string {
  return crypto.randomBytes(6).toString("hex");
}
