/**
 * /hacky-hours help — lists available commands with Block Kit formatting.
 */
function handleHelp() {
  return jsonResponse({
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: 'Hacky Hours Bot' }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Submit, browse, and claim project ideas for Hacky Hours sessions.'
        }
      },
      { type: 'divider' },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Available commands:*\n\n'
            + '`/hacky-hours help` — Show this message\n'
            + '`/hacky-hours submit` — Submit a new idea\n'
            + '`/hacky-hours list [page]` — Browse open ideas (10 per page)\n'
            + '`/hacky-hours get [name]` — View details for a specific idea\n'
            + '`/hacky-hours random` — Get a random idea\n'
            + '`/hacky-hours pick [name]` — Claim an idea for your session\n'
            + '`/hacky-hours save` — Save a thread as an idea (run from inside a thread)'
        }
      }
    ]
  });
}

/**
 * /hacky-hours submit — opens the idea submission modal.
 * The trigger_id is ephemeral (~3 seconds), so the views.open call
 * must happen immediately.
 */
function handleSubmit(payload) {
  var view = getSubmitModalView();
  openModal(payload.trigger_id, view);

  // Return empty 200 — Slack expects an immediate ack for slash commands
  // that open modals. The modal handles the rest.
  return ContentService.createTextOutput('');
}

/**
 * /hacky-hours list [page] — paginated Block Kit list of open ideas.
 * 10 ideas per page. Default: page 1.
 */
function handleList(payload) {
  var pageNum = parseInt(payload.args, 10) || 1;
  if (pageNum < 1) pageNum = 1;

  var ideas = getAllOpenIdeas();

  if (ideas.length === 0) {
    return jsonResponse({
      blocks: [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: 'No open ideas yet. Be the first — run `/hacky-hours submit`!' }
        }
      ]
    });
  }

  var pageSize = 10;
  var totalPages = Math.ceil(ideas.length / pageSize);
  if (pageNum > totalPages) pageNum = totalPages;

  var startIndex = (pageNum - 1) * pageSize;
  var pageIdeas = ideas.slice(startIndex, startIndex + pageSize);

  var blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: 'Open Ideas' }
    }
  ];

  pageIdeas.forEach(function(idea, i) {
    blocks.push(formatIdeaListItem(idea, startIndex + i));
    blocks.push({ type: 'divider' });
  });

  // Footer with pagination info
  var footerText = 'Page ' + pageNum + ' of ' + totalPages
    + ' (' + ideas.length + ' total idea' + (ideas.length === 1 ? '' : 's') + ')';
  if (pageNum < totalPages) {
    footerText += ' — use `/hacky-hours list ' + (pageNum + 1) + '` for next page';
  }

  blocks.push({
    type: 'context',
    elements: [{ type: 'mrkdwn', text: footerText }]
  });

  return jsonResponse({ blocks: blocks });
}

/**
 * /hacky-hours get [name] — Block Kit detail view of a single idea.
 */
function handleGet(payload) {
  var name = payload.args;
  if (!name) {
    return jsonResponse({
      text: 'Please provide an idea name. Usage: `/hacky-hours get [name]`'
    });
  }

  var result = findOpenIdeaByName(name);
  if (!result) {
    return jsonResponse({
      text: 'No open idea found with the name "' + name + '". Try `/hacky-hours list` to see all ideas.'
    });
  }

  return jsonResponse({ blocks: formatIdeaBlocks(result.idea) });
}

/**
 * /hacky-hours random — returns a random idea from the open pool.
 */
function handleRandom(payload) {
  var ideas = getAllOpenIdeas();

  if (ideas.length === 0) {
    return jsonResponse({
      blocks: [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: 'No open ideas yet. Be the first — run `/hacky-hours submit`!' }
        }
      ]
    });
  }

  var randomIndex = Math.floor(Math.random() * ideas.length);
  var idea = ideas[randomIndex];

  var blocks = [
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: ':game_die: *Random pick from ' + ideas.length + ' open idea' + (ideas.length === 1 ? '' : 's') + ':*' }]
    }
  ];

  blocks = blocks.concat(formatIdeaBlocks(idea));

  return jsonResponse({ blocks: blocks });
}

/**
 * /hacky-hours pick [name] — claims an idea, moves it from Open to Closed Ideas.
 */
function handlePick(payload) {
  var name = payload.args;
  if (!name) {
    return jsonResponse({
      text: 'Please provide an idea name. Usage: `/hacky-hours pick [name]`'
    });
  }

  var result = findOpenIdeaByName(name);
  if (!result) {
    return jsonResponse({
      text: 'No open idea found with the name "' + name + '". Try `/hacky-hours list` to see available ideas.'
    });
  }

  moveIdeaToClosed(result.rowIndex, result.idea, payload.user_id);

  return jsonResponse({
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: ':white_check_mark: *Idea claimed!*\n\n'
            + '<@' + payload.user_id + '> picked *' + result.idea.name + '*'
        }
      },
      { type: 'divider' },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: result.idea.description }
      },
      {
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: '_Originally submitted by <@' + result.idea.submitter_id + '> on ' + formatDate(result.idea.submitted_at) + '_' }
        ]
      }
    ]
  });
}

/**
 * /hacky-hours save — reads the current thread, formats as markdown,
 * and opens the submit modal with the thread content pre-filled.
 *
 * Must be run from within a thread. Uses the channel_id from the payload
 * and the thread_ts (if the slash command was invoked inside a thread,
 * Slack doesn't directly provide thread_ts in the slash command payload,
 * so we check for it in the raw parameters).
 */
function handleSave(payload) {
  var channel_id = payload.channel_id;

  // Slack doesn't include thread_ts in slash command payloads directly.
  // The user must run this from within a thread — we check for the
  // undocumented but commonly available 'thread_ts' parameter, or
  // fall back to checking if the command was invoked in a thread context.
  // If not in a thread, we prompt the user.
  //
  // Note: Slack may not provide thread_ts for slash commands in all cases.
  // If this doesn't work reliably, the user can pass the thread link as an arg.

  // Try to get thread_ts from raw parameters
  var thread_ts = payload.raw.thread_ts;

  if (!thread_ts) {
    return jsonResponse({
      text: 'This command must be run from inside a thread. '
        + 'Open the thread you want to save, then type `/hacky-hours save` there.'
    });
  }

  var messages = getThreadMessages(channel_id, thread_ts);
  if (!messages || messages.length === 0) {
    return jsonResponse({
      text: 'Could not read the thread. Make sure the bot has `channels:history` '
        + '(and `groups:history` for private channels) permissions.'
    });
  }

  var markdown = formatThreadAsMarkdown(messages);

  // Slack modal text inputs have a 3000 char limit — truncate if needed
  if (markdown.length > 3000) {
    markdown = markdown.substring(0, 2990) + '\n\n[truncated]';
  }

  var view = getSubmitModalViewWithDescription(markdown);
  openModal(payload.trigger_id, view);

  return ContentService.createTextOutput('');
}

/**
 * Handles modal submission (view_submission) payloads from Slack.
 * Extracts fields from the modal, validates name uniqueness, writes to sheet.
 */
function handleViewSubmission(payload) {
  if (payload.callback_id !== 'submit_idea') {
    return jsonResponse({ response_action: 'clear' });
  }

  var values = payload.view.state.values;
  var name = values.name_block.name_input.value.trim();
  var description = values.description_block.description_input.value.trim();
  var features = values.features_block.features_input.value || '';
  features = features.trim();

  // Validate: reject empty name after trim
  if (!name) {
    return jsonResponse({
      response_action: 'errors',
      errors: { name_block: 'Idea name cannot be empty.' }
    });
  }

  // Validate: reject duplicate names
  if (ideaNameExists(name)) {
    return jsonResponse({
      response_action: 'errors',
      errors: { name_block: 'An idea with this name already exists — try a different name.' }
    });
  }

  appendOpenIdea(name, payload.user_id, description, features);

  return jsonResponse({ response_action: 'clear' });
}
