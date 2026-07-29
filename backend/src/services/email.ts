import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import nodemailer from "nodemailer";
import { PrismaClient } from "@prisma/client";
import { decryptSecret } from "./emailCrypto";

const prisma = new PrismaClient();

function buildSesClient() {
  const sesConfig: Record<string, unknown> = {
    region: process.env.AWS_REGION || "ap-northeast-1",
  };
  if (process.env.AWS_SES_ENDPOINT_URL) {
    (sesConfig as { endpoint: string }).endpoint = process.env.AWS_SES_ENDPOINT_URL;
    (sesConfig as { credentials: { accessKeyId: string; secretAccessKey: string } }).credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "test",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "test",
    };
  }
  return new SESClient(sesConfig);
}

const sesClient = buildSesClient();

const ENV_EMAIL_FROM = process.env.EMAIL_FROM || "noreply@projecthub.local";

function resolveFromAddress(emailFromOverride: string | null | undefined): string {
  const o = emailFromOverride?.trim();
  if (o) return o;
  return ENV_EMAIL_FROM;
}

async function loadSettingsRow() {
  return prisma.systemSetting.findUnique({ where: { id: "default" } });
}

export type MailPayload = {
  to: string;
  subject: string;
  text: string;
};

export async function sendMailMessage(payload: MailPayload): Promise<void> {
  const row = await loadSettingsRow();
  const from = resolveFromAddress(row?.emailFromOverride);
  const transport = row?.emailTransport === "smtp" ? "smtp" : "ses";

  if (transport === "smtp") {
    if (!row?.smtpHost?.trim() || !row?.smtpUser?.trim()) {
      throw new Error("SMTP が未設定です（管理画面のメール設定を確認してください）");
    }
    if (!row.smtpPasswordEnc) {
      throw new Error("SMTP パスワードが保存されていません");
    }
    let pass: string;
    try {
      pass = decryptSecret(row.smtpPasswordEnc);
    } catch (e) {
      console.error("SMTP password decrypt failed:", e);
      throw new Error(
        "SMTP パスワードの復号に失敗しました。EMAIL_ENCRYPTION_KEY または JWT_SECRET を設定変更した場合は、パスワードを再入力して保存してください。"
      );
    }
    const transporter = nodemailer.createTransport({
      host: row.smtpHost.trim(),
      port: row.smtpPort ?? 587,
      secure: row.smtpSecure === true,
      auth: { user: row.smtpUser.trim(), pass },
    });
    await transporter.sendMail({
      from,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
    });
    console.log(`Email sent via SMTP to ${payload.to}`);
    return;
  }

  const params = {
    Destination: { ToAddresses: [payload.to] },
    Message: {
      Body: {
        Text: { Charset: "UTF-8", Data: payload.text },
      },
      Subject: { Charset: "UTF-8", Data: payload.subject },
    },
    Source: from,
  };
  const command = new SendEmailCommand(params);
  const response = await sesClient.send(command);
  console.log(`Email sent via SES to ${payload.to}. MessageId: ${response.MessageId}`);
}

function resolveFrontendBaseUrl(): string {
  return (process.env.FRONTEND_URL || "http://localhost:5173").trim().replace(/\/$/, "");
}

export async function sendTemporaryPasswordEmail(
  toEmail: string,
  firstName: string,
  lastName: string,
  temporaryPassword: string
) {
  const loginUrl = resolveFrontendBaseUrl();
  const text = `${lastName} ${firstName} 様\n\nProjectHubのアカウントが作成されました。\nログイン情報は以下の通りです。\n\nログインURL: ${loginUrl}\nメールアドレス: ${toEmail}\n仮パスワード: ${temporaryPassword}\n\n初回ログイン後は、パスワード変更が必須です。\n\n※このメールは送信専用です。\n`;
  await sendMailMessage({
    to: toEmail,
    subject: "[ProjectHub] アカウント作成のお知らせ",
    text,
  });
}

export async function sendTestEmail(toEmail: string) {
  await sendMailMessage({
    to: toEmail,
    subject: "[ProjectHub] メール送信テスト",
    text: `これは ProjectHub からのテスト送信です。\n時刻: ${new Date().toISOString()}\n`,
  });
}
