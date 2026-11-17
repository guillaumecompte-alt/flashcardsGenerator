// Flashcards – Worker Cloudflare
// - Sert l'application (interface prof sur "/", interface élève sur "/s/:id")
// - API de stockage des paquets publiés dans KV (binding DECKS)

import HTML from "./index.html";
import QR_LIB from "./vendor/qrcode.js.txt"; // qrcode-generator 1.4.4 (MIT, Kazuhiko Arase)

const MAX_BODY = 1_000_000; // 1 Mo
const LIMITS = { classe: 100, chapitre: 150, text: 2000, cards: 500, lang: 20 };
const ID_RE = /^[A-Za-z0-9]{6,16}$/;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

function randomId(n) {
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  let s = "";
  for (const b of bytes) s += ALPHABET[b % ALPHABET.length];
  return s;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function str(v, max) {
  return typeof v === "string" ? v.slice(0, max) : "";
}

// Nettoie et valide un paquet envoyé par l'interface prof
function cleanDeck(d) {
  if (!d || typeof d !== "object") return null;
  const cards = Array.isArray(d.cards) ? d.cards : [];
  const clean = {
    classe: str(d.classe, LIMITS.classe).trim(),
    chapitre: str(d.chapitre, LIMITS.chapitre).trim(),
    lang: str(d.lang, LIMITS.lang) || "en-GB",
    audio: !!d.audio,
    cards: cards
      .slice(0, LIMITS.cards)
      .map((c) => ({
        q: str(c && c.q, LIMITS.text).trim(),
        a: str(c && c.a, LIMITS.text).trim(),
        audio: !(c && c.audio === false),
      }))
      .filter((c) => c.q && c.a),
  };
  if (!clean.chapitre || clean.cards.length === 0) return null;
  return clean;
}

async function readBody(request) {
  const len = Number(request.headers.get("content-length") || 0);
  if (len > MAX_BODY) return null;
  const text = await request.text();
  if (text.length > MAX_BODY) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const htmlResponse = () =>
  new Response(HTML, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-cache",
      "x-content-type-options": "nosniff",
      "referrer-policy": "strict-origin-when-cross-origin",
    },
  });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // --- API ---
    if (path === "/api/decks") {
      if (method !== "POST") return json({ error: "Méthode non autorisée" }, 405);
      const deck = cleanDeck(await readBody(request));
      if (!deck) return json({ error: "Paquet invalide (titre et au moins une carte requis)" }, 400);
      const id = randomId(8);
      const key = randomId(24);
      const now = new Date().toISOString();
      await env.DECKS.put("deck:" + id, JSON.stringify({ deck, key, created: now, updated: now }));
      return json({ id, key }, 201);
    }

    const m = path.match(/^\/api\/decks\/([^/]+)$/);
    if (m) {
      const id = m[1];
      if (!ID_RE.test(id)) return json({ error: "Identifiant invalide" }, 400);
      const raw = await env.DECKS.get("deck:" + id);
      if (!raw) return json({ error: "Paquet introuvable" }, 404);
      const stored = JSON.parse(raw);

      if (method === "GET") return json(stored.deck);

      if (method === "PUT") {
        if (!safeEqual(request.headers.get("x-edit-key") || "", stored.key))
          return json({ error: "Clé de modification invalide" }, 403);
        const deck = cleanDeck(await readBody(request));
        if (!deck) return json({ error: "Paquet invalide" }, 400);
        stored.deck = deck;
        stored.updated = new Date().toISOString();
        await env.DECKS.put("deck:" + id, JSON.stringify(stored));
        return json({ id, key: stored.key });
      }

      if (method === "DELETE") {
        if (!safeEqual(request.headers.get("x-edit-key") || "", stored.key))
          return json({ error: "Clé de modification invalide" }, 403);
        await env.DECKS.delete("deck:" + id);
        return json({ ok: true });
      }

      return json({ error: "Méthode non autorisée" }, 405);
    }

    // --- Pages ---
    if (method === "GET" || method === "HEAD") {
      if (path === "/" || path === "/index.html" || /^\/s\/[A-Za-z0-9]+\/?$/.test(path)) return htmlResponse();
      if (path === "/qrcode.js")
        return new Response(QR_LIB, { headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "public, max-age=604800" } });
      if (path === "/favicon.ico") return new Response(null, { status: 204 });
    }
    return Response.redirect(url.origin + "/", 302);
  },
};
