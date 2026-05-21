import { google } from 'googleapis';

const GOOGLE_DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
];

export function createGoogleOAuthClient(redirectUri: string) {
  return new google.auth.OAuth2(
    process.env.GOOGLE_DRIVE_CLIENT_ID,
    process.env.GOOGLE_DRIVE_CLIENT_SECRET,
    redirectUri,
  );
}

export function buildGoogleAuthUrl(redirectUri: string, state: string) {
  const client = createGoogleOAuthClient(redirectUri);
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GOOGLE_DRIVE_SCOPES,
    state,
    include_granted_scopes: true,
  });
}

export async function exchangeGoogleCode(
  redirectUri: string,
  code: string,
): Promise<{
  accessToken: string;
  refreshToken: string;
  expiryDate: Date;
  email: string;
}> {
  const client = createGoogleOAuthClient(redirectUri);
  const { tokens } = await client.getToken(code);
  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error('Google did not return both access + refresh tokens');
  }
  client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: 'v2', auth: client });
  const { data: userinfo } = await oauth2.userinfo.get();

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiryDate: tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 60 * 60 * 1000),
    email: userinfo.email ?? '',
  };
}

export async function refreshGoogleAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  expiryDate: Date;
}> {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_DRIVE_CLIENT_ID,
    process.env.GOOGLE_DRIVE_CLIENT_SECRET,
  );
  client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await client.refreshAccessToken();
  if (!credentials.access_token) {
    throw new Error('No access token returned on refresh');
  }
  return {
    accessToken: credentials.access_token,
    expiryDate: credentials.expiry_date
      ? new Date(credentials.expiry_date)
      : new Date(Date.now() + 60 * 60 * 1000),
  };
}
