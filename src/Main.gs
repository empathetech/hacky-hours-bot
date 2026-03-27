/**
 * Entry point for all incoming HTTP POST requests.
 * Handles both Slack slash commands and interaction payloads (modal submissions).
 */
function doPost(e) {
  if (!verifySlackRequest(e)) {
    Logger.log('Request verification failed — rejecting.');
    return jsonResponse({ text: 'Unauthorized.' });
  }

  var payload = parsePayload(e);

  if (payload.type === 'view_submission') {
    return handleViewSubmission(payload);
  }

  if (payload.type === 'slash_command') {
    return routeCommand(payload.command, payload);
  }

  return jsonResponse({ text: 'Unknown request type.' });
}

/**
 * Parses the incoming request into a normalized payload object.
 * Slack sends slash commands as form-encoded and interactions as JSON.
 */
function parsePayload(e) {
  // Interaction payloads (modals) come as a JSON string in a 'payload' parameter
  if (e.parameter && e.parameter.payload) {
    var interaction = JSON.parse(e.parameter.payload);
    return {
      type: interaction.type,
      callback_id: interaction.view ? interaction.view.callback_id : null,
      trigger_id: interaction.trigger_id,
      user_id: interaction.user.id,
      view: interaction.view,
      raw: interaction
    };
  }

  // Slash commands come as form-encoded parameters
  return {
    type: 'slash_command',
    command: parseCommandText(e.parameter.text || ''),
    args: parseCommandArgs(e.parameter.text || ''),
    user_id: e.parameter.user_id,
    trigger_id: e.parameter.trigger_id,
    channel_id: e.parameter.channel_id,
    raw: e.parameter
  };
}

/**
 * Extracts the subcommand from the slash command text.
 * e.g., "list 2" → "list", "get my idea" → "get"
 */
function parseCommandText(text) {
  var trimmed = text.trim();
  if (!trimmed) return 'help';
  return trimmed.split(/\s+/)[0].toLowerCase();
}

/**
 * Extracts the arguments after the subcommand.
 * e.g., "list 2" → "2", "get my idea" → "my idea"
 */
function parseCommandArgs(text) {
  var trimmed = text.trim();
  var parts = trimmed.split(/\s+/);
  return parts.slice(1).join(' ');
}

/**
 * Routes a parsed command to its handler function.
 */
function routeCommand(command, payload) {
  switch (command) {
    case 'help':
      return handleHelp();
    case 'submit':
      return handleSubmit(payload);
    case 'list':
      return handleList(payload);
    case 'get':
      return handleGet(payload);
    case 'random':
      return handleRandom(payload);
    case 'pick':
      return handlePick(payload);
    case 'save':
      return handleSave(payload);
    default:
      return jsonResponse({
        text: 'Unknown command: `' + command + '`. Try `/hacky-hours help` for a list of commands.'
      });
  }
}

/**
 * Returns a JSON response to Slack.
 */
function jsonResponse(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
