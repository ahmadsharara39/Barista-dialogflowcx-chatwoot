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

// Send a plain text message via Chatwoot
async function sendMessage(conversationId, content) {
  await api.post(`/conversations/${conversationId}/messages`, {
    content,
    message_type: "outgoing",
    private: false,
  });
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

  // Chatwoot picks up the WhatsApp message automatically, no need to duplicate
}

// Hand off to human agent
async function handoffToHuman(conversationId) {
  await api.post(`/conversations/${conversationId}/assignments`, {
    assignee_id: null,
  });
}

module.exports = { sendMessage, sendInteractiveMessage, handoffToHuman };
