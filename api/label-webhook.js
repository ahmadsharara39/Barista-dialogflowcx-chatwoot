const axios = require("axios");
const { HUMAN_HANDOFF_LABELS } = require("../lib/chatwoot");

// This webhook listens to Chatwoot account-level events
// specifically for when a human handoff label is removed.
module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const event = req.body;

    console.log(
      "Label webhook event:",
      JSON.stringify({
        event: event.event,
        id: event.id,
        labels: event.labels,
        changed_attributes: event.changed_attributes,
        keys: Object.keys(event),
      })
    );

    if (event.event !== "conversation_updated") {
      return res.status(200).json({ ok: true });
    }

    const conversationId = event.id;
    const currentLabels = event.labels || [];
    const previousLabels = event.changed_attributes?.labels?.previous_value || [];

    console.log(
      "Label check:",
      JSON.stringify({ currentLabels, previousLabels })
    );

    const removedLabel = HUMAN_HANDOFF_LABELS.find(
      (label) => previousLabels.includes(label) && !currentLabels.includes(label)
    );

    if (!removedLabel) {
      return res.status(200).json({ ok: true });
    }

    console.log("Label removed:", removedLabel, "on conversation", conversationId);

    const CHATWOOT_BASE = process.env.CHATWOOT_BASE_URL;
    const ACCOUNT_ID = process.env.CHATWOOT_ACCOUNT_ID;
    const USER_TOKEN = process.env.CHATWOOT_API_TOKEN;

    const convResponse = await axios.get(
      `${CHATWOOT_BASE}/api/v1/accounts/${ACCOUNT_ID}/conversations/${conversationId}`,
      { headers: { api_access_token: USER_TOKEN } }
    );

    const phoneNumber =
      convResponse.data?.meta?.sender?.phone_number?.replace("+", "") || "";

    if (!phoneNumber) {
      console.log("No phone number found for conversation", conversationId);
      return res.status(200).json({ ok: true });
    }

    const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const WA_TOKEN = process.env.WHATSAPP_API_TOKEN;
    const waHeaders = {
      Authorization: `Bearer ${WA_TOKEN}`,
      "Content-Type": "application/json",
    };

    await axios.post(
      `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: phoneNumber,
        type: "text",
        text: {
          body: "You are now connected back to the Barista Bot.\nHow can we help you today?",
        },
      },
      { headers: waHeaders }
    );

    await axios.post(
      `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: phoneNumber,
        type: "interactive",
        interactive: {
          type: "list",
          header: { type: "text", text: "Hello from Barista Team" },
          body: { text: "How can we help you today?" },
          footer: { text: "Tap to select an option" },
          action: {
            button: "View Options",
            sections: [
              {
                title: "Main Menu",
                rows: [
                  { id: "order", title: "Order", description: "" },
                  {
                    id: "check_products",
                    title: "Check Products",
                    description: "",
                  },
                  { id: "maintenance", title: "Maintenance", description: "" },
                  { id: "feedback", title: "Feedback", description: "" },
                  { id: "talk_agent", title: "Talk to an Agent", description: "" },
                ],
              },
            ],
          },
        },
      },
      { headers: waHeaders }
    );

    console.log("Sent welcome back message to", phoneNumber);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(
      "Label webhook error:",
      err.message,
      err.response?.data ? JSON.stringify(err.response.data) : ""
    );
    return res.status(500).json({ error: err.message });
  }
};
