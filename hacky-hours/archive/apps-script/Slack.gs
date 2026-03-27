/**
 * Slack API helpers — request verification, Block Kit formatting, modal definitions.
 */

// ─── Request Verification ───────────────────────────────────────────────────
//
// Google Apps Script web apps do NOT expose HTTP request headers in doPost(e).
// This means HMAC-SHA256 signing secret verification (Slack's recommended
// approach) is not possible in this runtime.
//
// We use the verification token instead. While Slack has deprecated this in
// favor of signing secrets, it remains functional and is the only verification
// method available in Apps Script. The token is sent in the request body (not
// headers), so we can access it.
//
// See: ARCHITECTURE.md — Request Verification
// See: hacky-hours/02-design/SECURITY_PRIVACY.md
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verifies the request is from Slack using the verification token.
 * Returns true if the token matches, false otherwise.
 */
function verifySlackRequest(e) {
  var expectedToken = PropertiesService.getScriptProperties().getProperty('SLACK_VERIFICATION_TOKEN');
  if (!expectedToken) {
    Logger.log('WARNING: SLACK_VERIFICATION_TOKEN not set — skipping verification.');
    return false;
  }

  // Slash commands: token is in form-encoded parameters
  if (e.parameter && e.parameter.token) {
    return e.parameter.token === expectedToken;
  }

  // Interaction payloads: token is in the JSON payload
  if (e.parameter && e.parameter.payload) {
    var interaction = JSON.parse(e.parameter.payload);
    return interaction.token === expectedToken;
  }

  return false;
}

// ─── Bot Token ──────────────────────────────────────────────────────────────

/**
 * Returns the Slack Bot Token from Script Properties.
 */
function getSlackBotToken() {
  var token = PropertiesService.getScriptProperties().getProperty('SLACK_BOT_TOKEN');
  if (!token) {
    throw new Error('SLACK_BOT_TOKEN not set in Script Properties.');
  }
  return token;
}

// ─── Modal ──────────────────────────────────────────────────────────────────

/**
 * Opens a Slack modal using the views.open API.
 */
function openModal(trigger_id, view) {
  var token = getSlackBotToken();
  var response = UrlFetchApp.fetch('https://slack.com/api/views.open', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': 'Bearer ' + token },
    payload: JSON.stringify({
      trigger_id: trigger_id,
      view: view
    })
  });

  var result = JSON.parse(response.getContentText());
  if (!result.ok) {
    Logger.log('views.open error: ' + result.error);
  }
  return result;
}

/**
 * Returns the modal view definition for the idea submission form.
 */
function getSubmitModalView() {
  return {
    type: 'modal',
    callback_id: 'submit_idea',
    title: { type: 'plain_text', text: 'Submit an Idea' },
    submit: { type: 'plain_text', text: 'Submit' },
    close: { type: 'plain_text', text: 'Cancel' },
    blocks: [
      {
        type: 'input',
        block_id: 'name_block',
        label: { type: 'plain_text', text: 'Idea Name' },
        element: {
          type: 'plain_text_input',
          action_id: 'name_input',
          placeholder: { type: 'plain_text', text: 'A short, descriptive name for your idea' }
        }
      },
      {
        type: 'input',
        block_id: 'description_block',
        label: { type: 'plain_text', text: 'Description' },
        element: {
          type: 'plain_text_input',
          action_id: 'description_input',
          multiline: true,
          placeholder: { type: 'plain_text', text: 'What is this idea about?' }
        }
      },
      {
        type: 'input',
        block_id: 'features_block',
        label: { type: 'plain_text', text: 'Features' },
        optional: true,
        element: {
          type: 'plain_text_input',
          action_id: 'features_input',
          multiline: true,
          placeholder: { type: 'plain_text', text: 'What features or scope would this include?' }
        }
      }
    ]
  };
}

// ─── Thread Reading ─────────────────────────────────────────────────────────

/**
 * Reads all messages from a Slack thread using conversations.replies.
 * Requires channels:history and/or groups:history bot scopes.
 */
function getThreadMessages(channel_id, thread_ts) {
  var token = getSlackBotToken();
  var url = 'https://slack.com/api/conversations.replies'
    + '?channel=' + encodeURIComponent(channel_id)
    + '&ts=' + encodeURIComponent(thread_ts);

  var response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { 'Authorization': 'Bearer ' + token }
  });

  var result = JSON.parse(response.getContentText());
  if (!result.ok) {
    Logger.log('conversations.replies error: ' + result.error);
    return null;
  }
  return result.messages || [];
}

/**
 * Formats an array of Slack thread messages as readable markdown.
 */
function formatThreadAsMarkdown(messages) {
  return messages.map(function(msg) {
    var user = msg.user ? '<@' + msg.user + '>' : 'Unknown';
    var date = new Date(parseFloat(msg.ts) * 1000);
    var timestamp = Utilities.formatDate(date, Session.getScriptTimeZone(), 'MMM d, yyyy h:mm a');
    var text = msg.text || '';
    return '**' + user + '** (' + timestamp + '):\n' + text;
  }).join('\n\n');
}

/**
 * Returns the submit modal view pre-filled with thread content in description.
 */
function getSubmitModalViewWithDescription(description) {
  return {
    type: 'modal',
    callback_id: 'submit_idea',
    title: { type: 'plain_text', text: 'Save Thread as Idea' },
    submit: { type: 'plain_text', text: 'Submit' },
    close: { type: 'plain_text', text: 'Cancel' },
    blocks: [
      {
        type: 'input',
        block_id: 'name_block',
        label: { type: 'plain_text', text: 'Idea Name' },
        element: {
          type: 'plain_text_input',
          action_id: 'name_input',
          placeholder: { type: 'plain_text', text: 'Give this thread a name' }
        }
      },
      {
        type: 'input',
        block_id: 'description_block',
        label: { type: 'plain_text', text: 'Description' },
        element: {
          type: 'plain_text_input',
          action_id: 'description_input',
          multiline: true,
          initial_value: description
        }
      },
      {
        type: 'input',
        block_id: 'features_block',
        label: { type: 'plain_text', text: 'Features' },
        optional: true,
        element: {
          type: 'plain_text_input',
          action_id: 'features_input',
          multiline: true,
          placeholder: { type: 'plain_text', text: 'What features or scope would this include?' }
        }
      }
    ]
  };
}

// ─── Block Kit Formatting ───────────────────────────────────────────────────

/**
 * Formats an idea as Block Kit blocks for display in Slack.
 */
function formatIdeaBlocks(idea) {
  var blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: idea.name }
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: idea.description }
    }
  ];

  if (idea.features && idea.features.trim()) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: '*Features:*\n' + idea.features }
    });
  }

  blocks.push({
    type: 'context',
    elements: [
      { type: 'mrkdwn', text: '*Submitted by:* <@' + idea.submitter_id + '>' },
      { type: 'mrkdwn', text: '*Date:* ' + formatDate(idea.submitted_at) }
    ]
  });

  return blocks;
}

/**
 * Formats an idea as a compact single-line summary for list views.
 */
function formatIdeaListItem(idea, index) {
  return {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: '*' + (index + 1) + '. ' + idea.name + '*\n'
        + truncate(idea.description, 100)
        + '\n_by <@' + idea.submitter_id + '> on ' + formatDate(idea.submitted_at) + '_'
    }
  };
}

/**
 * Truncates a string to maxLength, adding "..." if truncated.
 */
function truncate(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Formats a Date object as a readable string.
 */
function formatDate(date) {
  if (!(date instanceof Date)) return String(date);
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'MMM d, yyyy h:mm a');
}
