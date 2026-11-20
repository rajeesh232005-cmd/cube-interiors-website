const encoder = new TextEncoder();
const decoder = new TextDecoder();
const allowedCategories = new Set(['residential', 'kitchens', 'commercial']);
const allowedEnquiryServices = new Set([
  'Residential interiors',
  'Commercial spaces',
  'Modular kitchen',
  'Renovation & consultation'
]);

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'", 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', ...headers }
});

const html = (title, message, status = 400) => new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(title)}</title><style>body{font:16px/1.6 Arial,sans-serif;background:#fcf7ef;color:#493328;display:grid;min-height:100vh;place-items:center;margin:0}.box{max-width:560px;margin:24px;padding:34px;border:1px solid #d8bda3;background:#fffaf3}a{color:#8b4b34}</style><div class="box"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><a href="/manage.html">Return to CUBE Website Manager</a></div></html>`, {
  status,
  headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'", 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' }
});

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

function bytesToBase64(bytes) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

const base64Url = bytes => bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
const fromBase64Url = value => base64ToBytes(value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '='));

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return base64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value))));
}

async function createSession(secret, payload) {
  const encoded = base64Url(encoder.encode(JSON.stringify(payload)));
  return `${encoded}.${await hmac(secret, encoded)}`;
}

async function readSession(secret, token) {
  if (!secret || !token || !token.includes('.')) return null;
  const [encoded, signature] = token.split('.');
  if (signature !== await hmac(secret, encoded)) return null;
  try {
    const payload = JSON.parse(decoder.decode(fromBase64Url(encoded)));
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

function cookies(request) {
  return Object.fromEntries((request.headers.get('Cookie') || '').split(';').map(item => item.trim()).filter(Boolean).map(item => {
    const separator = item.indexOf('=');
    return [decodeURIComponent(item.slice(0, separator)), decodeURIComponent(item.slice(separator + 1))];
  }));
}

const cookie = (name, value, maxAge) => `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
const clearCookie = name => `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

function missingConfig(env) {
  return ['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'DISCORD_GUILD_ID', 'DISCORD_MANAGER_ROLE_ID', 'GITHUB_TOKEN', 'SESSION_SECRET'].filter(key => !env[key]);
}

function githubSettings(env) {
  return {
    owner: env.GITHUB_OWNER || 'rajeesh232005-cmd',
    repository: env.GITHUB_REPO || 'cube-interiors-website',
    branch: env.GITHUB_BRANCH || 'main'
  };
}

async function githubRequest(env, path, options = {}) {
  const settings = githubSettings(env);
  const response = await fetch(`https://api.github.com/repos/${settings.owner}/${settings.repository}${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'CUBE-Website-Manager',
      ...(options.headers || {})
    }
  });
  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(`GitHub request failed (${response.status}).`);
    error.status = response.status;
    error.detail = detail.slice(0, 500);
    throw error;
  }
  return response.status === 204 ? null : response.json();
}

async function getProjects(env) {
  const settings = githubSettings(env);
  const file = await githubRequest(env, `/contents/dist/data/projects.json?ref=${encodeURIComponent(settings.branch)}`);
  const data = JSON.parse(decoder.decode(base64ToBytes(file.content.replace(/\s/g, ''))));
  if (!Array.isArray(data.projects)) throw new Error('Project data is invalid.');
  return { data, sha: file.sha };
}

async function saveProjects(env, data, sha, actor, action) {
  const settings = githubSettings(env);
  const content = bytesToBase64(encoder.encode(`${JSON.stringify(data, null, 2)}\n`));
  await githubRequest(env, '/contents/dist/data/projects.json', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `Website manager: ${action} by ${actor.name}`,
      content,
      sha,
      branch: settings.branch,
      committer: { name: 'CUBE Website Manager', email: 'cubeinteriorsukl@gmail.com' }
    })
  });
}

async function uploadImage(env, path, file, actor) {
  const settings = githubSettings(env);
  const content = bytesToBase64(new Uint8Array(await file.arrayBuffer()));
  await githubRequest(env, `/contents/dist/${path.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `Website manager: upload image by ${actor.name}`,
      content,
      branch: settings.branch,
      committer: { name: 'CUBE Website Manager', email: 'cubeinteriorsukl@gmail.com' }
    })
  });
}

async function notify(env, message) {
  if (!env.DISCORD_WEBHOOK_URL) return;
  await fetch(env.DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: `🖼️ **CUBE Website Manager**\n${message}` })
  }).catch(() => {});
}

function cleanText(value, maximum, required = false) {
  const text = String(value || '').trim().replace(/[\u0000-\u001f\u007f]/g, ' ');
  if (required && !text) throw Object.assign(new Error('A required field is empty.'), { status: 400 });
  if (text.length > maximum) throw Object.assign(new Error(`Text is longer than ${maximum} characters.`), { status: 400 });
  return text;
}

function slug(value) {
  return cleanText(value, 120, true).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'project';
}

function validateProject(input, existing = {}) {
  const category = String(input.category || existing.category || '');
  if (!allowedCategories.has(category)) throw Object.assign(new Error('Choose a valid project category.'), { status: 400 });
  const images = Array.isArray(input.images) ? input.images.slice(0, 30).map(image => ({
    id: cleanText(image.id, 100, true),
    file: cleanText(image.file, 260, true),
    alt: cleanText(image.alt, 250, true),
    caption: cleanText(image.caption, 160),
    deleted: Boolean(image.deleted)
  })) : (existing.images || []);
  if (images.some(image => !/^assets\/[a-zA-Z0-9/_-]+\.(?:jpe?g|png|webp)$/i.test(image.file) || image.file.includes('..'))) {
    throw Object.assign(new Error('An image path is invalid.'), { status: 400 });
  }
  return {
    ...existing,
    title: cleanText(input.title ?? existing.title, 120, true),
    category,
    location: cleanText(input.location ?? existing.location, 160),
    description: cleanText(input.description ?? existing.description, 1500),
    images
  };
}

function requireSameOrigin(request) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;
  const origin = request.headers.get('Origin');
  if (!origin || origin !== new URL(request.url).origin) throw Object.assign(new Error('Request origin was rejected.'), { status: 403 });
}

function validPhone(value) {
  const digits = value.replace(/\D/g, '');
  return /^[+()0-9 .-]+$/.test(value) && digits.length >= 7 && digits.length <= 15;
}

async function handleEnquiry(context) {
  requireSameOrigin(context.request);
  if (!context.env.FORM_RECIPIENT) return json({ error: 'The contact form is being configured. Please call or email CUBE.' }, 503);

  const input = await context.request.json();
  const honey = cleanText(input._honey, 200);
  if (honey) return json({ ok: true });

  const name = cleanText(input.name, 100, true);
  const phone = cleanText(input.phone, 20, true);
  const alternativePhone = cleanText(input.alternative_phone, 20);
  const email = cleanText(input.email, 200, true).toLowerCase();
  const projectLocation = cleanText(input.project_location, 200, true);
  const service = cleanText(input.service, 80, true);
  const message = cleanText(input.message, 3000);

  if (!validPhone(phone) || (alternativePhone && !validPhone(alternativePhone))) {
    throw Object.assign(new Error('Enter a valid phone number with 7 to 15 digits.'), { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw Object.assign(new Error('Enter a valid email address.'), { status: 400 });
  }
  if (!allowedEnquiryServices.has(service)) {
    throw Object.assign(new Error('Choose a valid service.'), { status: 400 });
  }
  if (input.contact_consent !== 'Agreed') {
    throw Object.assign(new Error('Please agree to be contacted about this enquiry.'), { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  let response;
  try {
    response = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(context.env.FORM_RECIPIENT)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        name,
        phone,
        alternative_phone: alternativePhone || 'Not provided',
        email,
        project_location: projectLocation,
        service,
        message: message || 'Not provided',
        contact_consent: 'Agreed',
        _subject: 'New CUBE website project enquiry',
        _template: 'table',
        _url: `${new URL(context.request.url).origin}/contact.html`
      }),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) throw Object.assign(new Error('The enquiry service did not accept the request.'), { status: 502 });
  return json({ ok: true });
}

async function currentUser(context) {
  const token = cookies(context.request).cube_manager_session;
  return readSession(context.env.SESSION_SECRET, token);
}

async function handleLogin(context) {
  const missing = missingConfig(context.env);
  if (missing.length) return html('Manager setup required', `Cloudflare is missing: ${missing.join(', ')}.`, 503);
  const stateBytes = crypto.getRandomValues(new Uint8Array(24));
  const state = base64Url(stateBytes);
  const redirectUri = `${new URL(context.request.url).origin}/api/auth/callback`;
  const parameters = new URLSearchParams({
    response_type: 'code',
    client_id: context.env.DISCORD_CLIENT_ID,
    scope: 'identify guilds.members.read',
    state,
    redirect_uri: redirectUri,
    prompt: 'consent'
  });
  return new Response(null, {
    status: 302,
    headers: { Location: `https://discord.com/oauth2/authorize?${parameters}`, 'Set-Cookie': cookie('cube_oauth_state', state, 600), 'Cache-Control': 'no-store' }
  });
}

async function handleCallback(context) {
  const url = new URL(context.request.url);
  const state = url.searchParams.get('state');
  const storedState = cookies(context.request).cube_oauth_state;
  if (!state || !storedState || state !== storedState) return html('Sign-in rejected', 'The Discord sign-in state did not match. Please try again.');
  if (url.searchParams.get('iss') && url.searchParams.get('iss') !== 'https://discord.com') return html('Sign-in rejected', 'The sign-in provider was not Discord.');
  const code = url.searchParams.get('code');
  if (!code) return html('Sign-in cancelled', 'Discord did not return an authorization code.');
  const redirectUri = `${url.origin}/api/auth/callback`;
  const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: context.env.DISCORD_CLIENT_ID,
      client_secret: context.env.DISCORD_CLIENT_SECRET
    })
  });
  if (!tokenResponse.ok) return html('Discord sign-in failed', 'The authorization code could not be exchanged. Please try again.', 502);
  const token = await tokenResponse.json();
  const authorization = { Authorization: `Bearer ${token.access_token}` };
  const [userResponse, memberResponse] = await Promise.all([
    fetch('https://discord.com/api/v10/users/@me', { headers: authorization }),
    fetch(`https://discord.com/api/v10/users/@me/guilds/${context.env.DISCORD_GUILD_ID}/member`, { headers: authorization })
  ]);
  if (!userResponse.ok || !memberResponse.ok) return html('Access denied', 'Your Discord account is not an eligible member of the CUBE server.', 403);
  const discordUser = await userResponse.json();
  const member = await memberResponse.json();
  if (!member.roles?.includes(context.env.DISCORD_MANAGER_ROLE_ID)) return html('Access denied', 'Your Discord account does not have the site management role.', 403);
  const canPublish = !context.env.DISCORD_PUBLISHER_ROLE_ID || member.roles.includes(context.env.DISCORD_PUBLISHER_ROLE_ID);
  const session = await createSession(context.env.SESSION_SECRET, {
    sub: discordUser.id,
    name: discordUser.global_name || discordUser.username,
    avatar: discordUser.avatar ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=96` : '',
    canPublish,
    exp: Date.now() + 4 * 60 * 60 * 1000
  });
  const headers = new Headers({ Location: '/manage.html', 'Cache-Control': 'no-store' });
  headers.append('Set-Cookie', cookie('cube_manager_session', session, 4 * 60 * 60));
  headers.append('Set-Cookie', clearCookie('cube_oauth_state'));
  return new Response(null, { status: 302, headers });
}

async function handleProjects(context, segments, user) {
  const { request, env } = context;
  const { data, sha } = await getProjects(env);
  const projectId = segments[1];

  if (request.method === 'GET' && !projectId) return json(data);

  if (request.method === 'POST' && !projectId) {
    const input = await request.json();
    const now = new Date().toISOString();
    const project = validateProject(input);
    project.id = `${slug(project.title)}-${Date.now().toString(36)}`;
    project.status = user.canPublish && input.status === 'published' ? 'published' : 'draft';
    project.archived = false;
    project.createdAt = now;
    project.updatedAt = now;
    project.updatedBy = { id: user.sub, name: user.name };
    data.projects.unshift(project);
    await saveProjects(env, data, sha, user, `add ${project.title}`);
    await notify(env, `${user.name} added **${project.title}** as ${project.status}.`);
    return json({ project }, 201);
  }

  const index = data.projects.findIndex(project => project.id === projectId);
  if (index < 0) return json({ error: 'Project not found.' }, 404);
  const existing = data.projects[index];

  if (request.method === 'PUT' && segments.length === 2) {
    const input = await request.json();
    const updated = validateProject(input, existing);
    updated.id = existing.id;
    updated.createdAt = existing.createdAt;
    updated.status = user.canPublish && ['draft', 'published'].includes(input.status) ? input.status : existing.status;
    updated.archived = user.canPublish && typeof input.archived === 'boolean' ? input.archived : existing.archived;
    updated.updatedAt = new Date().toISOString();
    updated.updatedBy = { id: user.sub, name: user.name };
    data.projects[index] = updated;
    await saveProjects(env, data, sha, user, `update ${updated.title}`);
    await notify(env, `${user.name} updated **${updated.title}**.`);
    return json({ project: updated });
  }

  if (request.method === 'POST' && segments[2] === 'images') {
    const form = await request.formData();
    const file = form.get('image');
    if (!(file instanceof File)) return json({ error: 'Choose an image.' }, 400);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return json({ error: 'Use a JPG, PNG or WebP image.' }, 400);
    if (file.size > 800000) return json({ error: 'The compressed image must be smaller than 800 KB.' }, 400);
    const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const imageId = `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
    const path = `assets/projects/${slug(existing.title)}-${imageId}.${extension}`;
    await uploadImage(env, path, file, user);
    const image = {
      id: imageId,
      file: path,
      alt: cleanText(form.get('alt'), 250, true),
      caption: cleanText(form.get('caption'), 160),
      deleted: false
    };
    existing.images = [...(existing.images || []), image];
    existing.updatedAt = new Date().toISOString();
    existing.updatedBy = { id: user.sub, name: user.name };
    data.projects[index] = existing;
    const latest = await getProjects(env);
    const latestIndex = latest.data.projects.findIndex(project => project.id === projectId);
    if (latestIndex < 0) return json({ error: 'Project changed during upload. The image was stored but not attached.' }, 409);
    latest.data.projects[latestIndex] = existing;
    await saveProjects(env, latest.data, latest.sha, user, `attach image to ${existing.title}`);
    await notify(env, `${user.name} added an image to **${existing.title}**.`);
    return json({ project: existing }, 201);
  }

  if (request.method === 'DELETE' && segments.length === 2) {
    if (!user.canPublish) return json({ error: 'Publishing permission is required.' }, 403);
    existing.archived = true;
    existing.status = 'draft';
    existing.updatedAt = new Date().toISOString();
    existing.updatedBy = { id: user.sub, name: user.name };
    data.projects[index] = existing;
    await saveProjects(env, data, sha, user, `archive ${existing.title}`);
    await notify(env, `${user.name} archived **${existing.title}**.`);
    return json({ project: existing });
  }

  if (request.method === 'POST' && segments[2] === 'restore') {
    if (!user.canPublish) return json({ error: 'Publishing permission is required.' }, 403);
    existing.archived = false;
    existing.updatedAt = new Date().toISOString();
    existing.updatedBy = { id: user.sub, name: user.name };
    data.projects[index] = existing;
    await saveProjects(env, data, sha, user, `restore ${existing.title}`);
    await notify(env, `${user.name} restored **${existing.title}**.`);
    return json({ project: existing });
  }

  return json({ error: 'Unsupported project action.' }, 405);
}

export async function onRequest(context) {
  try {
    const path = Array.isArray(context.params.path) ? context.params.path : [context.params.path].filter(Boolean);
    if (path[0] === 'auth' && path[1] === 'login' && context.request.method === 'GET') return handleLogin(context);
    if (path[0] === 'auth' && path[1] === 'callback' && context.request.method === 'GET') {
      const missing = missingConfig(context.env);
      return missing.length ? html('Manager setup required', `Cloudflare is missing: ${missing.join(', ')}.`, 503) : handleCallback(context);
    }
    if (path[0] === 'enquiry' && context.request.method === 'POST') return await handleEnquiry(context);

    const missing = missingConfig(context.env);
    if (missing.length) return json({ error: 'Manager setup is incomplete.', missing }, 503);
    requireSameOrigin(context.request);
    const user = await currentUser(context);

    if (path[0] === 'auth' && path[1] === 'logout' && context.request.method === 'POST') {
      return json({ ok: true }, 200, { 'Set-Cookie': clearCookie('cube_manager_session') });
    }
    if (path[0] === 'session' && context.request.method === 'GET') {
      return user ? json({ user }) : json({ error: 'Sign in required.' }, 401);
    }
    if (!user) return json({ error: 'Sign in required.' }, 401);
    if (path[0] === 'projects') return handleProjects(context, path, user);
    return json({ error: 'Not found.' }, 404);
  } catch (error) {
    const status = Number(error.status) || 500;
    const isEnquiry = (Array.isArray(context.params.path) ? context.params.path : [context.params.path]).filter(Boolean)[0] === 'enquiry';
    return json({ error: status >= 500 ? (isEnquiry ? 'We could not send your enquiry right now. Please call or email CUBE.' : 'The manager could not complete this request.') : error.message }, status);
  }
}
