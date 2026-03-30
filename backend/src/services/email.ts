import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const sesConfig: any = {
  region: process.env.AWS_REGION || "ap-northeast-1",
};

// ローカルテスト等でエンドポイントが指定されている場合は上書き(LocalStack等)
if (process.env.AWS_SES_ENDPOINT_URL) {
  sesConfig.endpoint = process.env.AWS_SES_ENDPOINT_URL;
  // LocalStackを利用する場合の汎用的なダミー認証情報
  sesConfig.credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "test",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "test",
  };
}

const sesClient = new SESClient(sesConfig);
const EMAIL_FROM = process.env.EMAIL_FROM || "noreply@projecthub.local";

export const sendWelcomeEmail = async (toEmail: string, firstName: string, lastName: string) => {
  const params = {
    Destination: {
      ToAddresses: [toEmail],
    },
    Message: {
      Body: {
        Text: {
          Charset: "UTF-8",
          Data: `${lastName} ${firstName} 様\n\nProjectHubのアカウントが作成されました。\nログイン用のメールアドレスは以下の通りです。\n\nメールアドレス: ${toEmail}\n\nパスワードについてはシステム管理者にお問い合わせください。\n\n※このメールは送信専用です。\n`,
        },
      },
      Subject: {
        Charset: "UTF-8",
        Data: "[ProjectHub] アカウント作成のお知らせ",
      },
    },
    Source: EMAIL_FROM,
  };

  try {
    const command = new SendEmailCommand(params);
    const response = await sesClient.send(command);
    console.log(`Welcome email sent to ${toEmail}. MessageId: ${response.MessageId}`);
    return response;
  } catch (error) {
    console.error(`Failed to send welcome email to ${toEmail}:`, error);
    // メール送信失敗がユーザー作成フロー全体を止めるのを防ぐため、エラーを投げるかは要件によりますが
    // ここではログ出力のみとし、呼び出し側で制御できるようにthrowします。
    throw error;
  }
};
