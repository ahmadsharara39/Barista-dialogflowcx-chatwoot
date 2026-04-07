const { SessionsClient } = require("@google-cloud/dialogflow-cx").v3;

const credentials = JSON.parse(
  Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, "base64").toString("utf8")
);

const client = new SessionsClient({
  credentials,
  apiEndpoint: `${process.env.DIALOGFLOW_LOCATION}-dialogflow.googleapis.com`,
});

async function detectIntent(sessionId, userMessage) {
  const sessionPath = client.projectLocationAgentSessionPath(
    process.env.GOOGLE_PROJECT_ID,
    process.env.DIALOGFLOW_LOCATION,
    process.env.DIALOGFLOW_AGENT_ID,
    sessionId
  );

  const request = {
    session: sessionPath,
    queryInput: {
      text: { text: userMessage },
      languageCode: "en",
    },
  };

  const [response] = await client.detectIntent(request);
  const queryResult = response.queryResult;

  const textMessages = [];
  const customPayloads = [];

  if (queryResult.responseMessages) {
    for (const msg of queryResult.responseMessages) {
      if (msg.text && msg.text.text) {
        textMessages.push(...msg.text.text);
      }
      if (msg.payload) {
        // Custom payload contains our WhatsApp button definitions
        customPayloads.push(structToJson(msg.payload));
      }
    }
  }

  // Check if current page signals hand-off to human
  const currentPage = queryResult.currentPage?.displayName || "";
  const handoff =
    currentPage === "Talk to Agent" || currentPage === "Feedback Negative";

  return {
    textMessages,
    customPayloads,
    handoff,
    currentPage,
  };
}

// Convert Dialogflow's protobuf Struct to plain JSON
function structToJson(struct) {
  if (!struct || !struct.fields) return {};
  const result = {};
  for (const [key, value] of Object.entries(struct.fields)) {
    result[key] = valueToJson(value);
  }
  return result;
}

function valueToJson(value) {
  if (value.nullValue !== undefined) return null;
  if (value.numberValue !== undefined) return value.numberValue;
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.boolValue !== undefined) return value.boolValue;
  if (value.structValue) return structToJson(value.structValue);
  if (value.listValue && value.listValue.values) {
    return value.listValue.values.map(valueToJson);
  }
  return null;
}

module.exports = { detectIntent };
