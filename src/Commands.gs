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
            + '`/hacky-hours pick [name]` — Claim an idea for your session'
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
