const axios = require("axios");

const CHATWOOT_BASE = process.env.CHATWOOT_BASE_URL; // https://aligndesk.ai
const ACCOUNT_ID = process.env.CHATWOOT_ACCOUNT_ID; // 2
const API_TOKEN = process.env.CHATWOOT_API_TOKEN;

const api = axios.create({
  baseURL: `${CHATWOOT_BASE}/api/v1/accounts/${ACCOUNT_ID}`,
  headers: {
    api_access_token: API_TOKEN,
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
    // Fallback: no whatsapp key, send as plain text
    return;
  }

  if (whatsapp.type === "list") {
    // WhatsApp List Message
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
    // WhatsApp Quick Reply Buttons
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
  // Remove bot assignment so human agents can pick up
  await api.post(`/conversations/${conversationId}/assignments`, {
    assignee_id: null,
  });
}

module.exports = { sendMessage, sendInteractiveMessage, handoffToHuman };
