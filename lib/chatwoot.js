const axios = require("axios");

const CHATWOOT_BASE = process.env.CHATWOOT_BASE_URL; // https://aligndesk.ai
const ACCOUNT_ID = process.env.CHATWOOT_ACCOUNT_ID; // 2
const BOT_TOKEN = process.env.CHATWOOT_BOT_TOKEN; // Agent bot token
const USER_TOKEN = process.env.CHATWOOT_API_TOKEN; // User API token (fallback)

// Use user token for sending messages (more reliable)
const api = axios.create({
  baseURL: `${CHATWOOT_BASE}/api/v1/accounts/${ACCOUNT_ID}`,
  headers: {
    api_access_token: USER_TOKEN,
    "Content-Type": "application/json",
  },
});

// Send a plain text message
async function sendMessage(conversationId, content) {
  await api.post(`/conversations/${conversationId}/messages`, {
    content,
    message_type: "outgoing",
    private: false,
  });
}

// Send WhatsApp interactive message (buttons or list)
async function sendInteractiveMessage(conversationId, payload) {
  const whatsapp = payload.whatsapp;
  if (!whatsapp) {
    return;
  }

  if (whatsapp.type === "list") {
    await api.post(`/conversations/${conversationId}/messages`, {
      content: whatsapp.body,
      message_type: "outgoing",
      private: false,
      content_type: "input_select",
      content_attributes: {
        items: whatsapp.sections.flatMap((section) =>
          section.rows.map((row) => ({
            title: row.title,
            value: row.id,
          }))
        ),
      },
    });
  } else if (whatsapp.type === "button") {
    await api.post(`/conversations/${conversationId}/messages`, {
      content: whatsapp.body,
      message_type: "outgoing",
      private: false,
      content_type: "input_select",
      content_attributes: {
        items: whatsapp.buttons.map((btn) => ({
          title: btn.title,
          value: btn.id,
        })),
      },
    });
  }
}

// Hand off to human agent
async function handoffToHuman(conversationId) {
  await api.post(`/conversations/${conversationId}/assignments`, {
    assignee_id: null,
  });
}

module.exports = { sendMessage, sendInteractiveMessage, handoffToHuman };
