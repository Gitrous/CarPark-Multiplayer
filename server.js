// Servidor de salas de Car Park Multijugador.
//
// Sirve la página y reenvía los mensajes de la partida por HTTPS normal (sin WebRTC),
// así se puede jugar en redes que no dejan conectar a los jugadores entre sí
// (p. ej. la wifi del instituto). Pensado para un GitHub Codespace con el puerto público.
//
// Sin dependencias:  node server.js   (puerto 8080, o el de la variable PORT)

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 8080;
const GRACE_MS = 8000;        // margen para reconectar sin perder la sala
const MAX_BODY = 32 * 1024;   // tamaño máximo de un mensaje
const MAX_CLIENTS = 300;
const MAX_QUEUE = 200;        // mensajes guardados mientras alguien reconecta

// id -> { token, res, links: Set<id>, queue: [], goneTimer, heartbeat }
const clients = new Map();

function push(c, obj) {
  if (c.res) c.res.write(`data: ${JSON.stringify(obj)}\n\n`);
  else if (c.queue.length < MAX_QUEUE) c.queue.push(obj);
}

function remove(id) {
  const c = clients.get(id);
  if (!c) return;
  clients.delete(id);
  clearTimeout(c.goneTimer);
  clearInterval(c.heartbeat);
  if (c.res) c.res.end();
  for (const other of c.links) {
    const o = clients.get(other);
    if (o) { o.links.delete(id); push(o, { type: 'close', from: id }); }
  }
}

function json(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (ch) => {
      size += ch.length;
      if (size > MAX_BODY) { reject(new Error('too big')); req.destroy(); return; }
      chunks.push(ch);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

// Conexión de eventos (Server-Sent Events): un canal abierto por jugador para recibir mensajes.
function handleEvents(req, res, url) {
  const id = url.searchParams.get('id') || '';
  const token = url.searchParams.get('token') || '';
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  const fail = (errType) => { res.end(`data: ${JSON.stringify({ type: 'error', errType })}\n\n`); };
  if (!/^[\w-]{1,64}$/.test(id)) return fail('invalid-id');

  let c = clients.get(id);
  if (c && c.token !== token) return fail('unavailable-id');
  if (!c) {
    if (clients.size >= MAX_CLIENTS) return fail('server-error');
    c = { token: crypto.randomBytes(12).toString('hex'), res: null, links: new Set(), queue: [] };
    clients.set(id, c);
  }
  if (c.res) c.res.end();          // otra pestaña con el mismo id: se queda la nueva
  clearTimeout(c.goneTimer);
  clearInterval(c.heartbeat);
  c.res = res;
  res.write('retry: 100000\n\n');  // la página reconecta por su cuenta
  push(c, { type: 'open', id, token: c.token });
  for (const m of c.queue.splice(0)) push(c, m);
  c.heartbeat = setInterval(() => res.write(': ping\n\n'), 15000);

  req.on('close', () => {
    if (c.res !== res) return;
    clearInterval(c.heartbeat);
    c.res = null;
    c.goneTimer = setTimeout(() => remove(id), GRACE_MS);
  });
}

async function handleSend(req, res) {
  let m;
  try { m = await readBody(req); } catch { return json(res, 400, { ok: false }); }
  const from = clients.get(m.from);
  if (!from || from.token !== m.token) return json(res, 403, { ok: false, reason: 'auth' });
  if (!['connect', 'accept', 'data', 'close'].includes(m.kind)) return json(res, 400, { ok: false });
  const to = clients.get(m.to);
  if (!to) return json(res, 200, { ok: false, reason: 'unavailable' });
  if (m.kind === 'connect' || m.kind === 'accept') { from.links.add(m.to); to.links.add(m.from); }
  if (m.kind === 'close') { from.links.delete(m.to); to.links.delete(m.from); }
  push(to, { type: m.kind, from: m.from, data: m.data });
  json(res, 200, { ok: true });
}

async function handleLeave(req, res) {
  let m;
  try { m = await readBody(req); } catch { return json(res, 400, { ok: false }); }
  const c = clients.get(m.id);
  if (c && c.token === m.token) remove(m.id);
  json(res, 200, { ok: true });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;
  if (req.method === 'GET' && p.endsWith('/relay/ping')) return json(res, 200, { ok: true, relay: true });
  if (req.method === 'GET' && p.endsWith('/relay/events')) return handleEvents(req, res, url);
  if (req.method === 'POST' && p.endsWith('/relay/send')) return handleSend(req, res);
  if (req.method === 'POST' && p.endsWith('/relay/leave')) return handleLeave(req, res);
  if (req.method === 'GET' && (p === '/' || p === '/index.html')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    return fs.createReadStream(path.join(__dirname, 'index.html')).pipe(res);
  }
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('No encontrado');
});

server.listen(PORT, process.env.HOST || '0.0.0.0', () => {
  console.log(`\nCar Park Multijugador funcionando en el puerto ${PORT}.`);
  if (process.env.CODESPACE_NAME) {
    const domain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN || 'app.github.dev';
    console.log(`Dirección para tus amigos: https://${process.env.CODESPACE_NAME}-${PORT}.${domain}/`);
    console.log('Recuerda ponerlo público: pestaña PUERTOS -> clic derecho en el puerto ' + PORT +
      ' -> Visibilidad del puerto -> Público.');
  } else {
    console.log(`Abre http://localhost:${PORT}/`);
  }
  console.log('No cierres esta terminal mientras jugáis.\n');
});
