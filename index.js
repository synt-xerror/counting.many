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
    map.set(chatId, {
      number: 0,
      lastMentionText: null,
      lastMention: null,
      lastContactId: null,
    });
  }
  return map.get(chatId);
}

function resetState(state) {
  state.number          = 0;
  state.lastMention     = null;
  state.lastMentionText = null;
  state.lastContactId   = null;
}

// ── Plugin ────────────────────────────────────────────────

/**
 * @param {import('@manybot/types/en').PluginContext} ctx
 */
export default async function (ctx) {
  const { msg, chat } = ctx;
  const { t }         = ctx.i18n.createT(import.meta.url);

  const storage = ctx.storage.resolve("chat_state.json");
  const map     = loadState(storage);

  // ── Comando !counting ───────────────────────────────────
  if (msg.is("counting")) {
    const [sub] = msg.args.map((a) => a.toLowerCase());

    // -- Ativar/desativar (apenas admin, apenas em grupo) --
    if (sub === "on" || sub === "off") {
      if (!chat.isGroup) {
        await msg.reply.text(t("onlyGroups"));
        return;
      }

      const contact = await msg.getContact();
      const isAdmin = contact ? await chat.isAdmin(contact.id) : false;
      if (!isAdmin) {
        await msg.reply.text(t("onlyAdmins"));
        return;
      }

      ctx.settings.set("enabled", sub === "on");
      await msg.reply.text(sub === "on" ? t("enabled") : t("disabled"));
      return;
    }

    // -- Info/status --
    if (!ctx.settings.get("enabled", false)) {
      await ctx.send.text(t("notEnabled"));
      return;
    }

    const state = getState(map, chat.id);

    await ctx.send.text(
      `*${t("title")}*\n\n` +
      `${t("rulesLine1")}\n` +
      `${t("rulesLine2")}\n` +
      `${t("rulesLine3")}\n\n` +
      t("current", { number: state.number }) +
      (state.lastMention
        ? "\n" + t("lastCounter") + `${state.lastMentionText}`
        : "")
    , state.lastMention);
    return;
  }

  // ── Filtro: só roda se ativado neste chat ───────────────
  if (!ctx.settings.get("enabled", false)) return;

  // ── Game logic ───────────────────────────────────────────
  const n = Number(msg.body.trim());
  if (!Number.isInteger(n) || n <= 0) return;

  const state   = getState(map, chat.id);
  const contact = await msg.getContact();
  if (!contact) return;
  const mentionText = contact.mention.text;
  const mention = contact.mention;

  // regra 1: não pode continuar sozinho (mas pode recomeçar do 1)
  if (contact.id === state.lastContactId && n !== 1) {
    resetState(state);
    saveState(storage, map);
    await msg.react("❌").catch(() => {});
    return;
  }

  // regra 2: sequência numérica
  if (n === state.number + 1) {
    state.number          = n;
    state.lastMention     = mention;
    state.lastMentionText = mentionText;
    state.lastContactId   = contact.id;
    saveState(storage, map);
    await msg.react("✅").catch(() => {});
  } else {
    resetState(state);
    saveState(storage, map);
    await msg.react("❌").catch(() => {});
  }
}
