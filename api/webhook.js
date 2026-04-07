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

    // Only process incoming customer messages
    if (
      event.message_type !== "incoming" ||
      event.event !== "message_created"
    ) {
      return res.status(200).json({ ok: true });
    }

    // Extract message content — handles both text and button taps
    const userMessage =
      event.content ||
      event.content_attributes?.submitted_values?.[0]?.value ||
      "";
    const conversationId = event.conversation?.id;
    const contactId = event.sender?.id;
    const inboxId = event.inbox_id;

    if (!userMessage || !conversationId || !contactId) {
      return res.status(200).json({ ok: true });
    }

    // Only respond to messages from the configured inbox
    if (
      process.env.CHATWOOT_INBOX_ID &&
      String(inboxId) !== String(process.env.CHATWOOT_INBOX_ID)
    ) {
      return res.status(200).json({ ok: true });
    }

    // Use contact ID as Dialogflow session for conversation continuity
    const sessionId = `contact-${contactId}`;

    // Send user message to Dialogflow CX
    const { textMessages, customPayloads, handoff } = await detectIntent(
      sessionId,
      userMessage
    );

    // Send responses back through Chatwoot
    for (const payload of customPayloads) {
      await sendInteractiveMessage(conversationId, payload);
    }

    // If no custom payload was sent, send text messages as fallback
    if (customPayloads.length === 0) {
      for (const text of textMessages) {
        if (text.trim()) {
          await sendMessage(conversationId, text);
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
