const axios = require("axios");

const CHATWOOT_BASE = process.env.CHATWOOT_BASE_URL;
const ACCOUNT_ID = process.env.CHATWOOT_ACCOUNT_ID;
const USER_TOKEN = process.env.CHATWOOT_API_TOKEN;

const api = axios.create({
  baseURL: `${CHATWOOT_BASE}/api/v1/accounts/${ACCOUNT_ID}`,
  headers: {
    api_access_token: USER_TOKEN,
    "Content-Type": "application/json",
  },
});

// Send a plain text message via WhatsApp Cloud API + record in Chatwoot
async function sendMessage(conversationId, content, phoneNumber) {
  const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const WA_TOKEN = process.env.WHATSAPP_API_TOKEN;

  await axios.post(
    `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phoneNumber,
      type: "text",
      text: { body: content },
    },
    {
      headers: {
        Authorization: `Bearer ${WA_TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  );

  // Record in Chatwoot so agents can see the message
  try {
    await api.post(`/conversations/${conversationId}/messages`, {
      content,
      message_type: "outgoing",
      private: false,
    });
  } catch (e) {
    console.log("Chatwoot record failed (non-critical):", e.message);
  }
}

// Send WhatsApp interactive message directly via WhatsApp Cloud API
// then record it in Chatwoot as an outgoing message
async function sendInteractiveMessage(conversationId, payload, phoneNumber) {
  const whatsapp = payload.whatsapp;
  if (!whatsapp) return;

  const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const WA_TOKEN = process.env.WHATSAPP_API_TOKEN;

  let interactive;

  if (whatsapp.type === "list") {
    interactive = {
      type: "list",
      header: whatsapp.header ? { type: "text", text: whatsapp.header } : undefined,
      body: { text: whatsapp.body },
      footer: whatsapp.footer ? { text: whatsapp.footer } : undefined,
      action: {
        button: whatsapp.button || "Options",
        sections: whatsapp.sections.map((section) => ({
          title: section.title,
          rows: section.rows.map((row) => ({
            id: row.id,
            title: row.title.substring(0, 24), // WhatsApp limit: 24 chars
            description: row.description || "",
          })),
        })),
      },
    };
  } else if (whatsapp.type === "button") {
    interactive = {
      type: "button",
      body: { text: whatsapp.body },
      action: {
        buttons: whatsapp.buttons.map((btn) => ({
          type: "reply",
          reply: {
            id: btn.id,
            title: btn.title.substring(0, 20), // WhatsApp limit: 20 chars
          },
        })),
      },
    };
  }

  if (!interactive) return;

  // Remove undefined fields
  Object.keys(interactive).forEach(
    (key) => interactive[key] === undefined && delete interactive[key]
  );

  // Send via WhatsApp Cloud API
  await axios.post(
    `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phoneNumber,
      type: "interactive",
      interactive,
    },
    {
      headers: {
        Authorization: `Bearer ${WA_TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  );

  // Record in Chatwoot so agents can see the message
  try {
    await api.post(`/conversations/${conversationId}/messages`, {
      content: whatsapp.body,
      message_type: "outgoing",
      private: false,
    });
  } catch (e) {
    console.log("Chatwoot record failed (non-critical):", e.message);
  }
}

// Hand off — agent manually adds "human_agent" label in Chatwoot
async function handoffToHuman(conversationId) {
  // No automatic label — agent adds it manually when they pick up the conversation
}

// Check if conversation has "human_agent" label (bot should not respond)
async function isHandledByHuman(conversationId) {
  try {
    const convResponse = await api.get(`/conversations/${conversationId}`);
    const labels = convResponse.data?.labels || [];
    return labels.includes("human_agent");
  } catch {
    return false;
  }
}

module.exports = { sendMessage, sendInteractiveMessage, handoffToHuman, isHandledByHuman };
