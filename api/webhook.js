const { detectIntent } = require("../lib/dialogflow");
const {
  sendMessage,
  sendInteractiveMessage,
  handoffToHuman,
} = require("../lib/chatwoot");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const event = req.body;

    console.log("Webhook received:", JSON.stringify({
      event: event.event,
      message_type: event.message_type,
      content: event.content,
      inbox_id: event.inbox_id,
      conversation_id: event.conversation?.id,
      sender_id: event.sender?.id,
      keys: Object.keys(event),
    }));

    // Only process incoming customer messages
    if (
      event.message_type !== "incoming" ||
      event.event !== "message_created"
    ) {
      console.log("Skipped: not an incoming message_created event");
      return res.status(200).json({ ok: true });
    }

    // Extract message content — handles both text and button taps
    const userMessage =
      event.content ||
      event.content_attributes?.submitted_values?.[0]?.value ||
      "";
    const conversationId = event.conversation?.id || event.conversation;
    const contactId = event.sender?.id || event.sender;
    const inboxId = event.inbox?.id || event.inbox_id;
    const phoneNumber = event.sender?.phone_number?.replace("+", "") || "";

    console.log("Extracted:", JSON.stringify({ userMessage, conversationId, contactId, inboxId, phoneNumber }));
    console.log("Sender object:", JSON.stringify(event.sender));

    if (!userMessage || !conversationId || !contactId) {
      console.log("Skipped: missing data", { userMessage: !!userMessage, conversationId: !!conversationId, contactId: !!contactId });
      return res.status(200).json({ ok: true });
    }

    // Use contact ID as Dialogflow session for conversation continuity
    const sessionId = `contact-${contactId}`;

    // Send user message to Dialogflow CX
    console.log("Sending to Dialogflow...");
    const { textMessages, customPayloads, handoff } = await detectIntent(
      sessionId,
      userMessage
    );
    console.log("Dialogflow response:", JSON.stringify({ textMessages, customPayloadCount: customPayloads.length, handoff }));

    // Send responses back through Chatwoot
    for (const payload of customPayloads) {
      console.log("Sending interactive message...");
      await sendInteractiveMessage(conversationId, payload, phoneNumber);
    }

    // If no custom payload was sent, send text messages as fallback
    if (customPayloads.length === 0) {
      for (const text of textMessages) {
        if (text.trim()) {
          console.log("Sending text message:", text.substring(0, 50));
          await sendMessage(conversationId, text, phoneNumber);
        }
      }
    }

    // Hand off to human agent if needed
    if (handoff) {
      await handoffToHuman(conversationId);
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
