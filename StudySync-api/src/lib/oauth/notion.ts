const NOTION_AUTH_URL = 'https://api.notion.com/v1/oauth/authorize';
const NOTION_TOKEN_URL = 'https://api.notion.com/v1/oauth/token';

export function buildNotionAuthUrl(redirectUri: string, state: string) {
  const params = new URLSearchParams({
    client_id: process.env.NOTION_OAUTH_CLIENT_ID ?? '',
    response_type: 'code',
    owner: 'user',
    redirect_uri: redirectUri,
    state,
  });
  return `${NOTION_AUTH_URL}?${params.toString()}`;
}

export async function exchangeNotionCode(
  redirectUri: string,
  code: string,
): Promise<{
  accessToken: string;
  workspaceName: string;
  workspaceIcon: string | null;
  botId: string;
}> {
  const id = process.env.NOTION_OAUTH_CLIENT_ID;
  const secret = process.env.NOTION_OAUTH_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error('Notion OAuth credentials not configured');
  }

  const basic = Buffer.from(`${id}:${secret}`).toString('base64');
  const res = await fetch(NOTION_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2025-09-03',
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Notion token exchange failed: ${res.status} ${text}`);
  }
  const body = (await res.json()) as {
    access_token: string;
    workspace_name?: string;
    workspace_icon?: string | null;
    bot_id: string;
  };

  return {
    accessToken: body.access_token,
    workspaceName: body.workspace_name ?? 'Notion workspace',
    workspaceIcon: body.workspace_icon ?? null,
    botId: body.bot_id,
  };
}
