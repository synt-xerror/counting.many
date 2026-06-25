/**
 * teste
 * plugins/counting/index.js
 */
import fs from "node:fs";

// ── Helpers ───────────────────────────────────────────────

function loadState(storage) {
  try {
    return new Map(JSON.parse(fs.readFileSync(storage, "utf8")));
  } catch {
    return new Map();
  }
}

function saveState(storage, map) {
  fs.writeFileSync(storage, JSON.stringify([...map]));
}

function getState(map, chatId) {
  if (!map.has(chatId)) {
    map.set(chatId, { number: 0, lastFrom: null });
  }
  return map.get(chatId);
}

// ── Plugin ────────────────────────────────────────────────

export default async function (ctx) {
  const { msg, chat } = ctx;
  const { t }         = ctx.i18n.createT(import.meta.url);

  const storage = ctx.storage.resolve("chat_state.json");
  const map     = loadState(storage);

  // ── Chat filter ─────────────────────────────────────────
  const allowedChats = ctx.config.get("COUNTING_CHATS", []);
  if (allowedChats.length > 0 && !allowedChats.includes(chat.id)) return;

  // ── Info command ─────────────────────────────────────────
  if (msg.is("counting")) {
    const state = getState(map, chat.id);
    await ctx.send.text(
      `*${t("title")}*\n\n` +
      `${t("rulesLine1")}\n` +
      `${t("rulesLine2")}\n` +
      `${t("rulesLine3")}\n\n` +
      t("current", { number: state.number })
    );
    return;
  }

  // ── Game logic ───────────────────────────────────────────
  const n = Number(msg.body.trim());
  if (!Number.isInteger(n) || n === 0) return;

  const state = getState(map, chat.id);
  const from = await msg.getContact().then(c => c.id);

  // regra 1: não pode continuar sozinho (mas pode recomeçar do 1)
  if (from === state.lastFrom && n !== 1) {
    state.number   = 0;
    state.lastFrom = null;
    saveState(storage, map);
    await msg.react("❌").catch(() => {});
    return;
  }

  // regra 2: sequência numérica
  if (n === state.number + 1) {
    state.number   = n;
    state.lastFrom = from;
    saveState(storage, map);
    await msg.react("✅").catch(() => {});
  } else {
    state.number   = 0;
    state.lastFrom = null;
    saveState(storage, map);
    await msg.react("❌").catch(() => {});
  }
}
