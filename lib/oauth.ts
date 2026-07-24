import 'server-only';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';

export type Provider = 'google' | 'spotify';

type Connection = {
  user_id: string; provider: Provider; encrypted_access_token: string; encrypted_refresh_token: string | null;
  expires_at: string | null; scopes: string[] | null; account_email: string | null; provider_account_id: string | null;
};

function encryptionKey() {
  const raw = process.env.OAUTH_TOKEN_ENCRYPTION_KEY || process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error('OAuth token encryption key is missing.');
  const decoded = Buffer.from(raw, 'base64');
  return decoded.length === 32 ? decoded : createHash('sha256').update(raw).digest();
}

export function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url')).join('.');
}

export function decrypt(value: string) {
  const [iv, tag, encrypted] = value.split('.').map((part) => Buffer.from(part, 'base64url'));
  if (!iv || !tag || !encrypted) throw new Error('Stored OAuth token is invalid.');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

export function pkce() {
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge, state: randomBytes(32).toString('base64url') };
}

export function redirectUri(provider: Provider, origin: string) {
  return provider === 'google'
    ? process.env.GOOGLE_REDIRECT_URI || `${origin}/api/oauth/google/callback`
    : process.env.SPOTIFY_REDIRECT_URI || `${origin}/api/oauth/spotify/callback`;
}

export function authorizationUrl(provider: Provider, origin: string, state: string, challenge: string) {
  if (provider === 'google') {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) throw new Error('GOOGLE_CLIENT_ID is missing.');
    const params = new URLSearchParams({ client_id:clientId, redirect_uri:redirectUri(provider,origin), response_type:'code', scope:'openid email https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.compose', access_type:'offline', prompt:'consent', include_granted_scopes:'true', state, code_challenge:challenge, code_challenge_method:'S256' });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  if (!clientId) throw new Error('SPOTIFY_CLIENT_ID is missing.');
  const params = new URLSearchParams({ client_id:clientId, redirect_uri:redirectUri(provider,origin), response_type:'code', scope:'user-read-email user-read-private playlist-read-private', state, code_challenge:challenge, code_challenge_method:'S256', show_dialog:'true' });
  return `https://accounts.spotify.com/authorize?${params}`;
}

export async function exchangeCode(provider: Provider, origin: string, code: string, verifier: string) {
  const body = new URLSearchParams({ grant_type:'authorization_code', code, redirect_uri:redirectUri(provider,origin), code_verifier:verifier });
  const headers: Record<string,string> = { 'content-type':'application/x-www-form-urlencoded' };
  if (provider === 'google') {
    const id = process.env.GOOGLE_CLIENT_ID, secret = process.env.GOOGLE_CLIENT_SECRET;
    if (!id || !secret) throw new Error('Google OAuth credentials are incomplete.');
    body.set('client_id', id); body.set('client_secret', secret);
  } else {
    const id = process.env.SPOTIFY_CLIENT_ID, secret = process.env.SPOTIFY_CLIENT_SECRET;
    if (!id || !secret) throw new Error('Spotify OAuth credentials are incomplete.');
    headers.authorization = `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`;
  }
  const endpoint = provider === 'google' ? 'https://oauth2.googleapis.com/token' : 'https://accounts.spotify.com/api/token';
  const response = await fetch(endpoint, { method:'POST', headers, body, cache:'no-store' });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error_description || result.error || 'OAuth token exchange failed.');
  return result as { access_token:string; refresh_token?:string; expires_in?:number; scope?:string; token_type?:string };
}

export async function fetchIdentity(provider: Provider, accessToken: string) {
  const headers = { authorization:`Bearer ${accessToken}` };
  if (provider === 'google') {
    const [identityResponse, gmailResponse] = await Promise.all([
      fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers, cache:'no-store' }),
      fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', { headers, cache:'no-store' }),
    ]);
    const identity = await identityResponse.json();
    const gmail = await gmailResponse.json();
    if (!identityResponse.ok) throw new Error(identity.error?.message || 'Google identity test failed.');
    if (!gmailResponse.ok) throw new Error(gmail.error?.message || 'Gmail API test failed.');
    return { id:String(identity.sub), email:String(identity.email || gmail.emailAddress || ''), metadata:{ email_verified:identity.email_verified, name:identity.name, gmail_email_address:gmail.emailAddress, messages_total:gmail.messagesTotal, threads_total:gmail.threadsTotal } };
  }
  const response = await fetch('https://api.spotify.com/v1/me', { headers, cache:'no-store' });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || 'Spotify identity test failed.');
  return { id:String(result.id), email:String(result.email || ''), metadata:{ display_name:result.display_name, product:result.product, country:result.country } };
}

export async function saveConnection(provider: Provider, token: Awaited<ReturnType<typeof exchangeCode>>, identity: Awaited<ReturnType<typeof fetchIdentity>>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sign in before connecting an integration.');
  const previous = await supabase.from('oauth_connections').select('encrypted_refresh_token').eq('user_id', user.id).eq('provider', provider).maybeSingle();
  const refresh = token.refresh_token ? encrypt(token.refresh_token) : previous.data?.encrypted_refresh_token ?? null;
  const expiresAt = token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null;
  const { error } = await supabase.from('oauth_connections').upsert({
    user_id:user.id, provider, provider_account_id:identity.id, account_email:identity.email || null,
    encrypted_access_token:encrypt(token.access_token), encrypted_refresh_token:refresh, token_type:token.token_type || 'Bearer',
    expires_at:expiresAt, scopes:(token.scope || '').split(' ').filter(Boolean), metadata:identity.metadata,
    last_success_at:new Date().toISOString(), last_error:null, updated_at:new Date().toISOString(),
  }, { onConflict:'user_id,provider' });
  if (error) throw new Error(error.message);
}

async function refresh(provider: Provider, connection: Connection) {
  if (!connection.encrypted_refresh_token) throw new Error(`Reconnect ${provider}; no refresh token is stored.`);
  const refreshToken = decrypt(connection.encrypted_refresh_token);
  const body = new URLSearchParams({ grant_type:'refresh_token', refresh_token:refreshToken });
  const headers: Record<string,string> = { 'content-type':'application/x-www-form-urlencoded' };
  if (provider === 'google') {
    const id=process.env.GOOGLE_CLIENT_ID, secret=process.env.GOOGLE_CLIENT_SECRET;
    if (!id || !secret) throw new Error('Google OAuth credentials are incomplete.');
    body.set('client_id',id); body.set('client_secret',secret);
  } else {
    const id=process.env.SPOTIFY_CLIENT_ID, secret=process.env.SPOTIFY_CLIENT_SECRET;
    if (!id || !secret) throw new Error('Spotify OAuth credentials are incomplete.');
    headers.authorization=`Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`;
  }
  const endpoint=provider==='google'?'https://oauth2.googleapis.com/token':'https://accounts.spotify.com/api/token';
  const response=await fetch(endpoint,{method:'POST',headers,body,cache:'no-store'});
  const result=await response.json();
  if(!response.ok) throw new Error(result.error_description||result.error||'Token refresh failed.');
  const supabase=await createClient();
  const encryptedRefresh=result.refresh_token?encrypt(result.refresh_token):connection.encrypted_refresh_token;
  const expiresAt=result.expires_in?new Date(Date.now()+result.expires_in*1000).toISOString():null;
  const { error }=await supabase.from('oauth_connections').update({encrypted_access_token:encrypt(result.access_token),encrypted_refresh_token:encryptedRefresh,expires_at:expiresAt,last_success_at:new Date().toISOString(),last_error:null,updated_at:new Date().toISOString()}).eq('user_id',connection.user_id).eq('provider',provider);
  if(error) throw new Error(error.message);
  return result.access_token as string;
}

export async function getValidAccessToken(provider: Provider) {
  const supabase=await createClient();
  const { data:{user} }=await supabase.auth.getUser();
  if(!user) throw new Error('Authentication required.');
  const { data, error }=await supabase.from('oauth_connections').select('*').eq('user_id',user.id).eq('provider',provider).maybeSingle();
  if(error) throw new Error(error.message);
  if(!data) throw new Error(`${provider} is not connected.`);
  const connection=data as Connection;
  if(connection.expires_at && new Date(connection.expires_at).getTime() < Date.now()+60000) return refresh(provider,connection);
  return decrypt(connection.encrypted_access_token);
}
