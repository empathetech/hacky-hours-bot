import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as encodeHex } from "https://deno.land/std@0.224.0/encoding/hex.ts";

// ─── Types ──────────────────────────────────────────────────────────────────

interface SlashPayload {
  type: "slash_command";
  command: string;
  args: string;
  user_id: string;
  trigger_id: string;
  channel_id: string;
}

interface InteractionPayload {
  type: "view_submission";
  callback_id: string;
  user_id: string;
  view: {
    private_metadata?: string;
    state: {
      values: Record<string, Record<string, {
        value?: string | null;
        selected_options?: Array<{ value: string }>;
      }>>;
    };
  };
}

interface EventPayload {
  type: "event_callback" | "url_verification";
  challenge?: string;
  event?: {
    type: string;
    user: string;
    reaction: string;
    item: {
      type: string;
      channel: string;
      ts: string;
    };
  };
}

type Payload = SlashPayload | InteractionPayload | EventPayload;

interface Idea {
  id: string;
  name: string;
  submitter_id: string;
  description: string;
  features: string;
  submitted_at: string;
}

interface Vote {
  id: string;
  name: string;
  caller_id: string;
  channel_id: string;
  message_ts: string;
  emoji: string;
  max_winners: number;
  expires_at: string | null;
  created_at: string;
}

// ─── Supabase Client ────────────────────────────────────────────────────────

function getSupabaseClient() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

// ─── Request Verification (HMAC-SHA256) ─────────────────────────────────────

async function verifySlackRequest(
  req: Request,
  body: string,
): Promise<boolean> {
  const signingSecret = Deno.env.get("SLACK_SIGNING_SECRET");
  if (!signingSecret) {
    console.error("SLACK_SIGNING_SECRET not set");
    return false;
  }

  const timestamp = req.headers.get("x-slack-request-timestamp");
  const signature = req.headers.get("x-slack-signature");

  if (!timestamp || !signature) return false;

  // Reject requests older than 5 minutes (replay protection)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) return false;

  const sigBasestring = `v0:${timestamp}:${body}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signingSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(sigBasestring),
  );
  const computed = "v0=" + bytesToHex(new Uint8Array(sig));

  return timingSafeEqual(computed, signature);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// ─── Request Parsing ────────────────────────────────────────────────────────

function parsePayload(params: URLSearchParams, body: string): Payload {
  // Try parsing as JSON first (Events API sends JSON)
  if (body.startsWith("{")) {
    const json = JSON.parse(body);
    if (json.type === "url_verification" || json.type === "event_callback") {
      return json as EventPayload;
    }
  }

  // Interaction payloads (modals) come as a JSON string in a 'payload' parameter
  const payloadStr = params.get("payload");
  if (payloadStr) {
    const interaction = JSON.parse(payloadStr);
    return {
      type: "view_submission",
      callback_id: interaction.view?.callback_id ?? "",
      user_id: interaction.user.id,
      view: interaction.view,
    };
  }

  // Slash commands come as form-encoded parameters
  const text = params.get("text")?.trim() ?? "";
  const parts = text.split(/\s+/);

  return {
    type: "slash_command",
    command: parts[0]?.toLowerCase() || "help",
    args: parts.slice(1).join(" "),
    user_id: params.get("user_id") ?? "",
    trigger_id: params.get("trigger_id") ?? "",
    channel_id: params.get("channel_id") ?? "",
  };
}

// ─── Command Router ─────────────────────────────────────────────────────────

async function routeCommand(payload: SlashPayload): Promise<Response> {
  switch (payload.command) {
    case "help":
      return handleHelp();
    case "submit":
      return handleSubmit(payload);
    case "list":
      return handleList(payload);
    case "get":
      return handleGet(payload);
    case "random":
      return handleRandom();
    case "pick":
      return handlePick(payload);
    case "save":
      return handleSave(payload);
    case "vote":
      return handleVote(payload);
    case "close-vote":
      return handleCloseVote(payload);
    default:
      return jsonResponse({
        text: `Unknown command: \`${payload.command}\`. Try \`/hacky-hours help\` for a list of commands.`,
      });
  }
}

// ─── Command Handlers ───────────────────────────────────────────────────────

function handleHelp(): Response {
  return jsonResponse({
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "Hacky Hours Bot" },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "Submit, browse, and claim project ideas for Hacky Hours sessions.",
        },
      },
      { type: "divider" },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            "*Available commands:*\n\n" +
            "`/hacky-hours help` — Show this message\n" +
            "`/hacky-hours submit` — Submit a new idea\n" +
            "`/hacky-hours list [page]` — Browse open ideas (10 per page)\n" +
            "`/hacky-hours get [name]` — View details for a specific idea\n" +
            "`/hacky-hours random` — Get a random idea\n" +
            "`/hacky-hours pick [name]` — Claim an idea for your session\n" +
            "`/hacky-hours save [thread-link]` — Save a thread as an idea\n" +
            "`/hacky-hours vote` — Start a vote on one or more ideas\n" +
            "`/hacky-hours close-vote [name]` — Close a vote and pick the winner",
        },
      },
    ],
  });
}

async function handleSubmit(payload: SlashPayload): Promise<Response> {
  await openModal(payload.trigger_id, getSubmitModalView());
  return new Response("", { status: 200 });
}

async function handleList(payload: SlashPayload): Promise<Response> {
  const pageNum = Math.max(1, parseInt(payload.args) || 1);
  const pageSize = 10;
  const supabase = getSupabaseClient();

  // Get total count
  const { count } = await supabase
    .from("open_ideas")
    .select("*", { count: "exact", head: true });

  const total = count ?? 0;
  if (total === 0) {
    return jsonResponse({
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "No open ideas yet. Be the first — run `/hacky-hours submit`!",
          },
        },
      ],
    });
  }

  const totalPages = Math.ceil(total / pageSize);
  const page = Math.min(pageNum, totalPages);
  const offset = (page - 1) * pageSize;

  const { data: ideas } = await supabase
    .from("open_ideas")
    .select("*")
    .order("submitted_at")
    .range(offset, offset + pageSize - 1);

  const blocks: Record<string, unknown>[] = [
    { type: "header", text: { type: "plain_text", text: "Open Ideas" } },
  ];

  (ideas ?? []).forEach((idea: Idea, i: number) => {
    blocks.push(formatIdeaListItem(idea, offset + i));
    blocks.push({ type: "divider" });
  });

  let footerText = `Page ${page} of ${totalPages} (${total} total idea${total === 1 ? "" : "s"})`;
  if (page < totalPages) {
    footerText += ` — use \`/hacky-hours list ${page + 1}\` for next page`;
  }

  blocks.push({
    type: "context",
    elements: [{ type: "mrkdwn", text: footerText }],
  });

  return jsonResponse({ blocks });
}

async function handleGet(payload: SlashPayload): Promise<Response> {
  if (!payload.args) {
    return jsonResponse({
      text: "Please provide an idea name. Usage: `/hacky-hours get [name]`",
    });
  }

  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from("open_ideas")
    .select("*")
    .ilike("name", payload.args)
    .limit(1)
    .single();

  if (!data) {
    return jsonResponse({
      text: `No open idea found with the name "${payload.args}". Try \`/hacky-hours list\` to see all ideas.`,
    });
  }

  return jsonResponse({ blocks: formatIdeaBlocks(data) });
}

async function handleRandom(): Promise<Response> {
  const supabase = getSupabaseClient();

  // Supabase doesn't support ORDER BY random() directly via the client,
  // so we fetch all IDs and pick one randomly
  const { data: ideas, count } = await supabase
    .from("open_ideas")
    .select("*", { count: "exact" });

  if (!ideas || ideas.length === 0) {
    return jsonResponse({
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "No open ideas yet. Be the first — run `/hacky-hours submit`!",
          },
        },
      ],
    });
  }

  const idea = ideas[Math.floor(Math.random() * ideas.length)];
  const total = count ?? ideas.length;

  const blocks: Record<string, unknown>[] = [
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `:game_die: *Random pick from ${total} open idea${total === 1 ? "" : "s"}:*`,
        },
      ],
    },
    ...formatIdeaBlocks(idea),
  ];

  return jsonResponse({ blocks });
}

async function handlePick(payload: SlashPayload): Promise<Response> {
  if (!payload.args) {
    return jsonResponse({
      text: "Please provide an idea name. Usage: `/hacky-hours pick [name]`",
    });
  }

  const supabase = getSupabaseClient();

  // Find the idea
  const { data: idea } = await supabase
    .from("open_ideas")
    .select("*")
    .ilike("name", payload.args)
    .limit(1)
    .single();

  if (!idea) {
    return jsonResponse({
      text: `No open idea found with the name "${payload.args}". Try \`/hacky-hours list\` to see available ideas.`,
    });
  }

  // Insert into closed_ideas
  await supabase.from("closed_ideas").insert({
    name: idea.name,
    submitter_id: idea.submitter_id,
    description: idea.description,
    features: idea.features,
    submitted_at: idea.submitted_at,
    picked_by: payload.user_id,
  });

  // Delete from open_ideas
  await supabase.from("open_ideas").delete().eq("id", idea.id);

  return jsonResponse({
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `:white_check_mark: *Idea claimed!*\n\n<@${payload.user_id}> picked *${idea.name}*`,
        },
      },
      { type: "divider" },
      {
        type: "section",
        text: { type: "mrkdwn", text: idea.description },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `_Originally submitted by <@${idea.submitter_id}> on ${formatDate(idea.submitted_at)}_`,
          },
        ],
      },
    ],
  });
}

async function handleSave(payload: SlashPayload): Promise<Response> {
  // Slack slash commands don't include thread_ts, so we parse a thread URL
  const parsed = parseSlackThreadUrl(payload.args);
  if (!parsed) {
    return jsonResponse({
      text: "Please provide a thread link. " +
        "Right-click a message in the thread → *Copy link*, then:\n" +
        "`/hacky-hours save <thread-link>`",
    });
  }

  const result = await getThreadMessages(
    parsed.channelId,
    parsed.threadTs,
  );
  if (!result.ok) {
    const hint = result.error === "not_in_channel"
      ? "The bot isn't in this channel. Invite it first: `/invite @your-bot`"
      : result.error === "channel_not_found"
        ? "Channel not found. The bot may not have access to this channel."
        : `Slack API error: \`${result.error}\`. Check bot scopes and channel membership.`;
    return jsonResponse({ text: hint });
  }
  if (result.messages.length === 0) {
    return jsonResponse({
      text: "Thread appears to be empty. Double-check that the link points to a thread, " +
        "not a standalone message.",
    });
  }

  let markdown = formatThreadAsMarkdown(result.messages);

  // Slack modal text inputs have a 3000 char limit
  if (markdown.length > 3000) {
    markdown = markdown.substring(0, 2990) + "\n\n[truncated]";
  }

  await openModal(payload.trigger_id, getSubmitModalViewWithDescription(markdown));
  return new Response("", { status: 200 });
}

async function handleVote(payload: SlashPayload): Promise<Response> {
  const supabase = getSupabaseClient();

  // Check max concurrent votes
  const maxVotes = parseInt(Deno.env.get("MAX_OPEN_VOTES") ?? "5");
  const { count } = await supabase
    .from("votes")
    .select("*", { count: "exact", head: true });

  if ((count ?? 0) >= maxVotes) {
    return jsonResponse({
      text: `There are already ${count} active votes (max ${maxVotes}). Close one first with \`/hacky-hours close-vote [name]\`.`,
    });
  }

  // Fetch open ideas for the modal selector
  const { data: ideas } = await supabase
    .from("open_ideas")
    .select("id, name")
    .order("submitted_at");

  if (!ideas || ideas.length === 0) {
    return jsonResponse({
      text: "No open ideas to vote on. Submit one first with `/hacky-hours submit`.",
    });
  }

  const options = ideas.map((idea: { id: string; name: string }) => ({
    text: { type: "plain_text" as const, text: idea.name.substring(0, 75) },
    value: idea.id,
  }));

  await openModal(payload.trigger_id, {
    type: "modal",
    callback_id: "create_vote",
    title: { type: "plain_text", text: "Start a Vote" },
    submit: { type: "plain_text", text: "Start Vote" },
    close: { type: "plain_text", text: "Cancel" },
    private_metadata: JSON.stringify({
      channel_id: payload.channel_id,
      caller_id: payload.user_id,
    }),
    blocks: [
      {
        type: "input",
        block_id: "vote_name_block",
        label: { type: "plain_text", text: "Vote Name" },
        element: {
          type: "plain_text_input",
          action_id: "vote_name_input",
          placeholder: { type: "plain_text", text: "A short name for this vote" },
        },
      },
      {
        type: "input",
        block_id: "ideas_block",
        label: { type: "plain_text", text: "Ideas to Vote On" },
        element: {
          type: "multi_static_select",
          action_id: "ideas_select",
          placeholder: { type: "plain_text", text: "Select ideas..." },
          options,
        },
      },
      {
        type: "input",
        block_id: "duration_block",
        label: { type: "plain_text", text: "Duration (optional)" },
        optional: true,
        element: {
          type: "plain_text_input",
          action_id: "duration_input",
          placeholder: { type: "plain_text", text: "e.g. 5m, 1h, 30s — leave blank for manual close" },
        },
      },
    ],
  });

  return new Response("", { status: 200 });
}

async function handleCloseVote(payload: SlashPayload): Promise<Response> {
  if (!payload.args) {
    return jsonResponse({
      text: "Please provide the vote name. Usage: `/hacky-hours close-vote [name]`",
    });
  }

  const supabase = getSupabaseClient();

  // Find the vote
  const { data: vote } = await supabase
    .from("votes")
    .select("*")
    .ilike("name", payload.args)
    .limit(1)
    .single();

  if (!vote) {
    return jsonResponse({
      text: `No active vote found with the name "${payload.args}".`,
    });
  }

  // Only the caller can close (unless expired)
  const isExpired = vote.expires_at && new Date(vote.expires_at) <= new Date();
  if (vote.caller_id !== payload.user_id && !isExpired) {
    return jsonResponse({
      text: `Only the vote creator (<@${vote.caller_id}>) can close this vote.`,
    });
  }

  return await tallyAndCloseVote(vote, payload.channel_id);
}

async function tallyAndCloseVote(vote: Vote, responseChannelId: string): Promise<Response> {
  const supabase = getSupabaseClient();
  const token = Deno.env.get("SLACK_BOT_TOKEN")!;

  // Get the ideas in this vote
  const { data: voteIdeas } = await supabase
    .from("vote_ideas")
    .select("idea_id")
    .eq("vote_id", vote.id);

  if (!voteIdeas || voteIdeas.length === 0) {
    await supabase.from("votes").delete().eq("id", vote.id);
    return jsonResponse({ text: "Vote had no ideas. Cleaned up." });
  }

  // Get reactions on the vote message
  const reactionsUrl = `https://slack.com/api/reactions.get?channel=${encodeURIComponent(vote.channel_id)}&timestamp=${encodeURIComponent(vote.message_ts)}`;
  const reactionsRes = await fetch(reactionsUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const reactionsData = await reactionsRes.json();

  // Build a map of idea_index -> unique voter user IDs
  // The vote message uses numbered emoji reactions: one, two, three, etc.
  const numberEmojis = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "keycap_ten"];
  const ideaVotes: Map<number, Set<string>> = new Map();

  if (reactionsData.ok && reactionsData.message?.reactions) {
    for (const reaction of reactionsData.message.reactions) {
      const emojiIndex = numberEmojis.indexOf(reaction.name);
      if (emojiIndex === -1 || emojiIndex >= voteIdeas.length) continue;

      const voters = new Set<string>();
      for (const userId of reaction.users ?? []) {
        // Exclude the caller and the bot
        if (userId === vote.caller_id) continue;
        voters.add(userId);
      }
      ideaVotes.set(emojiIndex, voters);
    }
  }

  // Fetch the actual idea records
  const ideaIds = voteIdeas.map((vi: { idea_id: string }) => vi.idea_id);
  const { data: ideas } = await supabase
    .from("open_ideas")
    .select("*")
    .in("id", ideaIds);

  if (!ideas || ideas.length === 0) {
    await supabase.from("votes").delete().eq("id", vote.id);
    return jsonResponse({ text: "The ideas in this vote are no longer available." });
  }

  // Tally results
  const results: Array<{ idea: Idea; voteCount: number }> = ideas.map(
    (idea: Idea, index: number) => ({
      idea,
      voteCount: ideaVotes.get(index)?.size ?? 0,
    }),
  );
  results.sort((a, b) => b.voteCount - a.voteCount);

  const topCount = results[0].voteCount;
  const winners = results.filter((r) => r.voteCount === topCount);

  let winnerIdea: Idea;

  if (topCount === 0) {
    // No votes — bot picks randomly
    winnerIdea = results[Math.floor(Math.random() * results.length)].idea;
    // Post results and pick
    await postMessage(vote.channel_id, {
      text: `Vote *${vote.name}* closed — no reactions received. Bot randomly selected *${winnerIdea.name}*.`,
    });
  } else if (winners.length === 1) {
    winnerIdea = winners[0].idea;
    const resultsText = results
      .map((r) => `${r.idea.name}: ${r.voteCount} vote${r.voteCount === 1 ? "" : "s"}`)
      .join("\n");
    await postMessage(vote.channel_id, {
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: `Vote "${vote.name}" — Results` },
        },
        {
          type: "section",
          text: { type: "mrkdwn", text: resultsText },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:trophy: *Winner: ${winnerIdea.name}* with ${topCount} vote${topCount === 1 ? "" : "s"}!`,
          },
        },
      ],
    });
  } else {
    // Tie — bot decides (random among tied)
    winnerIdea = winners[Math.floor(Math.random() * winners.length)].idea;
    const tiedNames = winners.map((w) => w.idea.name).join(", ");
    const resultsText = results
      .map((r) => `${r.idea.name}: ${r.voteCount} vote${r.voteCount === 1 ? "" : "s"}`)
      .join("\n");
    await postMessage(vote.channel_id, {
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: `Vote "${vote.name}" — Results` },
        },
        {
          type: "section",
          text: { type: "mrkdwn", text: resultsText },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:scales: Tie between: ${tiedNames} (${topCount} vote${topCount === 1 ? "" : "s"} each)\n:game_die: Bot broke the tie — *${winnerIdea.name}* wins!`,
          },
        },
      ],
    });
  }

  // Pick the winning idea (move to closed_ideas)
  await supabase.from("closed_ideas").insert({
    name: winnerIdea.name,
    submitter_id: winnerIdea.submitter_id,
    description: winnerIdea.description,
    features: winnerIdea.features,
    submitted_at: winnerIdea.submitted_at,
    picked_by: vote.caller_id,
  });
  await supabase.from("open_ideas").delete().eq("id", winnerIdea.id);

  // Clean up the vote
  await supabase.from("votes").delete().eq("id", vote.id);

  return jsonResponse({
    text: `Vote *${vote.name}* closed. *${winnerIdea.name}* has been picked!`,
  });
}

async function handleCreateVoteSubmission(
  payload: InteractionPayload,
): Promise<Response> {
  const values = payload.view.state.values;
  const voteName = values.vote_name_block.vote_name_input.value?.trim() ?? "";
  const selectedIdeas = values.ideas_block.ideas_select.selected_options ?? [];
  const durationStr = values.duration_block.duration_input.value?.trim() ?? "";

  if (!voteName) {
    return jsonResponse({
      response_action: "errors",
      errors: { vote_name_block: "Vote name cannot be empty." },
    });
  }

  if (selectedIdeas.length === 0) {
    return jsonResponse({
      response_action: "errors",
      errors: { ideas_block: "Select at least one idea." },
    });
  }

  // Parse private_metadata for channel_id and caller_id
  const metadata = JSON.parse(payload.view.private_metadata ?? "{}");
  const channelId = metadata.channel_id;
  const callerId = metadata.caller_id ?? payload.user_id;

  if (!channelId) {
    return jsonResponse({
      response_action: "errors",
      errors: { vote_name_block: "Could not determine channel. Try again." },
    });
  }

  // Parse duration
  let expiresAt: string | null = null;
  if (durationStr) {
    const seconds = parseDuration(durationStr);
    if (seconds === null) {
      return jsonResponse({
        response_action: "errors",
        errors: { duration_block: "Invalid duration. Use formats like: 5m, 1h, 30s" },
      });
    }
    expiresAt = new Date(Date.now() + seconds * 1000).toISOString();
  }

  const supabase = getSupabaseClient();

  // Fetch the selected idea names for the vote message
  const ideaIds = selectedIdeas.map((o) => o.value);
  const { data: ideas } = await supabase
    .from("open_ideas")
    .select("id, name, description")
    .in("id", ideaIds);

  if (!ideas || ideas.length === 0) {
    return jsonResponse({
      response_action: "errors",
      errors: { ideas_block: "Selected ideas no longer exist." },
    });
  }

  // Post the vote message to the channel
  const numberEmojis = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "keycap_ten"];
  const ideaList = ideas
    .map((idea: { name: string; description: string }, i: number) => {
      const desc = idea.description.length > 80
        ? idea.description.substring(0, 77) + "..."
        : idea.description;
      return `:${numberEmojis[i]}: *${idea.name}*\n${desc}`;
    })
    .join("\n\n");

  const durationNote = expiresAt
    ? `\nThis vote closes automatically at <!date^${Math.floor(new Date(expiresAt).getTime() / 1000)}^{time}|${expiresAt}>.`
    : "\nThe vote creator will close this manually.";

  const messageResult = await postMessage(channelId, {
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: `Vote: ${voteName}` },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `<@${callerId}> started a vote! React with the number emoji to vote for your pick.\n_Vote caller cannot vote unless there's a tie._`,
        },
      },
      { type: "divider" },
      {
        type: "section",
        text: { type: "mrkdwn", text: ideaList },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Close with \`/hacky-hours close-vote ${voteName}\`${durationNote}`,
          },
        ],
      },
    ],
  });

  if (!messageResult.ok) {
    console.error("Failed to post vote message:", messageResult.error);
    return jsonResponse({
      response_action: "errors",
      errors: { vote_name_block: `Could not post to channel: ${messageResult.error}` },
    });
  }

  // Insert the vote record
  const { error: voteError } = await supabase.from("votes").insert({
    name: voteName,
    caller_id: callerId,
    channel_id: channelId,
    message_ts: messageResult.ts,
    expires_at: expiresAt,
  });

  if (voteError?.code === "23505") {
    return jsonResponse({
      response_action: "errors",
      errors: { vote_name_block: "A vote with this name already exists." },
    });
  }

  if (voteError) {
    console.error("Vote insert error:", voteError);
    return jsonResponse({
      response_action: "errors",
      errors: { vote_name_block: "Something went wrong. Please try again." },
    });
  }

  // Get the vote ID we just created
  const { data: newVote } = await supabase
    .from("votes")
    .select("id")
    .eq("name", voteName)
    .single();

  if (newVote) {
    // Insert vote_ideas
    const voteIdeaRows = ideas.map((idea: { id: string }) => ({
      vote_id: newVote.id,
      idea_id: idea.id,
    }));
    await supabase.from("vote_ideas").insert(voteIdeaRows);

    // Add the number emoji reactions to the message as prompts
    for (let i = 0; i < ideas.length && i < numberEmojis.length; i++) {
      await addReaction(channelId, messageResult.ts, numberEmojis[i]);
    }
  }

  return jsonResponse({ response_action: "clear" });
}

async function handleEventCallback(payload: EventPayload): Promise<Response> {
  const event = payload.event;
  if (!event) return new Response("", { status: 200 });

  // We only care about reactions on vote messages
  if (event.type !== "reaction_added" && event.type !== "reaction_removed") {
    return new Response("", { status: 200 });
  }

  if (event.item.type !== "message") return new Response("", { status: 200 });

  const supabase = getSupabaseClient();

  // Check if this reaction is on a vote message
  const { data: vote } = await supabase
    .from("votes")
    .select("*")
    .eq("channel_id", event.item.channel)
    .eq("message_ts", event.item.ts)
    .limit(1)
    .single();

  if (!vote) return new Response("", { status: 200 });

  // Check if vote has expired — if so, auto-close it
  if (vote.expires_at && new Date(vote.expires_at) <= new Date()) {
    await tallyAndCloseVote(vote, vote.channel_id);
    return new Response("", { status: 200 });
  }

  // If the caller reacted, remove their reaction
  if (event.type === "reaction_added" && event.user === vote.caller_id) {
    await removeReaction(event.item.channel, event.item.ts, event.reaction);
  }

  return new Response("", { status: 200 });
}

async function handleViewSubmission(
  payload: InteractionPayload,
): Promise<Response> {
  if (payload.callback_id === "create_vote") {
    return handleCreateVoteSubmission(payload);
  }

  if (payload.callback_id !== "submit_idea") {
    return jsonResponse({ response_action: "clear" });
  }

  const values = payload.view.state.values;
  const name = values.name_block.name_input.value?.trim() ?? "";
  const description =
    values.description_block.description_input.value?.trim() ?? "";
  const features = values.features_block.features_input.value?.trim() ?? "";

  if (!name) {
    return jsonResponse({
      response_action: "errors",
      errors: { name_block: "Idea name cannot be empty." },
    });
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.from("open_ideas").insert({
    name,
    submitter_id: payload.user_id,
    description,
    features,
  });

  // Handle unique constraint violation (duplicate name)
  if (error?.code === "23505") {
    return jsonResponse({
      response_action: "errors",
      errors: {
        name_block:
          "An idea with this name already exists — try a different name.",
      },
    });
  }

  if (error) {
    console.error("Insert error:", error);
    return jsonResponse({
      response_action: "errors",
      errors: { name_block: "Something went wrong. Please try again." },
    });
  }

  return jsonResponse({ response_action: "clear" });
}

// ─── Slack API Helpers ──────────────────────────────────────────────────────

async function openModal(
  triggerId: string,
  view: Record<string, unknown>,
): Promise<void> {
  const token = Deno.env.get("SLACK_BOT_TOKEN");
  if (!token) throw new Error("SLACK_BOT_TOKEN not set");

  const res = await fetch("https://slack.com/api/views.open", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ trigger_id: triggerId, view }),
  });

  const result = await res.json();
  if (!result.ok) {
    console.error("views.open error:", result.error);
  }
}

async function getThreadMessages(
  channelId: string,
  threadTs: string,
): Promise<
  | { ok: true; messages: Array<{ user?: string; ts: string; text?: string }> }
  | { ok: false; error: string }
> {
  const token = Deno.env.get("SLACK_BOT_TOKEN");
  if (!token) return { ok: false, error: "SLACK_BOT_TOKEN not set" };

  const url = `https://slack.com/api/conversations.replies?channel=${encodeURIComponent(channelId)}&ts=${encodeURIComponent(threadTs)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const result = await res.json();
  if (!result.ok) {
    console.error("conversations.replies error:", result.error);
    return { ok: false, error: result.error };
  }
  return { ok: true, messages: result.messages ?? [] };
}

async function postMessage(
  channelId: string,
  message: Record<string, unknown>,
): Promise<{ ok: boolean; ts: string; error?: string }> {
  const token = Deno.env.get("SLACK_BOT_TOKEN");
  if (!token) return { ok: false, ts: "", error: "SLACK_BOT_TOKEN not set" };

  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ channel: channelId, ...message }),
  });

  const result = await res.json();
  return { ok: result.ok, ts: result.ts ?? "", error: result.error };
}

async function addReaction(
  channelId: string,
  timestamp: string,
  emoji: string,
): Promise<void> {
  const token = Deno.env.get("SLACK_BOT_TOKEN");
  if (!token) return;

  await fetch("https://slack.com/api/reactions.add", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ channel: channelId, timestamp, name: emoji }),
  });
}

async function removeReaction(
  channelId: string,
  timestamp: string,
  emoji: string,
): Promise<void> {
  const token = Deno.env.get("SLACK_BOT_TOKEN");
  if (!token) return;

  await fetch("https://slack.com/api/reactions.remove", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ channel: channelId, timestamp, name: emoji }),
  });
}

// ─── Duration Parsing ──────────────────────────────────────────────────────

function parseDuration(input: string): number | null {
  const match = input.match(/^(\d+)\s*(s|m|h)$/i);
  if (!match) return null;

  const value = parseInt(match[1]);
  switch (match[2].toLowerCase()) {
    case "s": return value;
    case "m": return value * 60;
    case "h": return value * 3600;
    default: return null;
  }
}

// ─── Slack URL Parsing ─────────────────────────────────────────────────────

function parseSlackThreadUrl(
  url: string,
): { channelId: string; threadTs: string } | null {
  if (!url) return null;

  // Slack thread URLs look like:
  //   https://workspace.slack.com/archives/C12345/p1234567890123456
  // The "p" timestamp is the ts without the dot, zero-padded to 16 digits
  const match = url.match(
    /\/archives\/([A-Z0-9]+)\/p(\d{10})(\d{6})/i,
  );
  if (!match) return null;

  const channelId = match[1];
  const threadTs = `${match[2]}.${match[3]}`;
  return { channelId, threadTs };
}

// ─── Block Kit Formatting ───────────────────────────────────────────────────

function formatIdeaBlocks(idea: Idea): Record<string, unknown>[] {
  const blocks: Record<string, unknown>[] = [
    {
      type: "header",
      text: { type: "plain_text", text: idea.name },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: idea.description },
    },
  ];

  if (idea.features?.trim()) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*Features:*\n${idea.features}` },
    });
  }

  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `*Submitted by:* <@${idea.submitter_id}>`,
      },
      {
        type: "mrkdwn",
        text: `*Date:* ${formatDate(idea.submitted_at)}`,
      },
    ],
  });

  return blocks;
}

function formatIdeaListItem(
  idea: Idea,
  index: number,
): Record<string, unknown> {
  const desc = idea.description.length > 100
    ? idea.description.substring(0, 97) + "..."
    : idea.description;

  return {
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*${index + 1}. ${idea.name}*\n${desc}\n_by <@${idea.submitter_id}> on ${formatDate(idea.submitted_at)}_`,
    },
  };
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatThreadAsMarkdown(
  messages: Array<{ user?: string; ts: string; text?: string }>,
): string {
  return messages
    .map((msg) => {
      const user = msg.user ? `<@${msg.user}>` : "Unknown";
      const date = new Date(parseFloat(msg.ts) * 1000);
      const timestamp = date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
      return `**${user}** (${timestamp}):\n${msg.text ?? ""}`;
    })
    .join("\n\n");
}

// ─── Modal Definitions ──────────────────────────────────────────────────────

function getSubmitModalView(): Record<string, unknown> {
  return {
    type: "modal",
    callback_id: "submit_idea",
    title: { type: "plain_text", text: "Submit an Idea" },
    submit: { type: "plain_text", text: "Submit" },
    close: { type: "plain_text", text: "Cancel" },
    blocks: [
      {
        type: "input",
        block_id: "name_block",
        label: { type: "plain_text", text: "Idea Name" },
        element: {
          type: "plain_text_input",
          action_id: "name_input",
          placeholder: {
            type: "plain_text",
            text: "A short, descriptive name for your idea",
          },
        },
      },
      {
        type: "input",
        block_id: "description_block",
        label: { type: "plain_text", text: "Description" },
        element: {
          type: "plain_text_input",
          action_id: "description_input",
          multiline: true,
          placeholder: {
            type: "plain_text",
            text: "What is this idea about?",
          },
        },
      },
      {
        type: "input",
        block_id: "features_block",
        label: { type: "plain_text", text: "Features" },
        optional: true,
        element: {
          type: "plain_text_input",
          action_id: "features_input",
          multiline: true,
          placeholder: {
            type: "plain_text",
            text: "What features or scope would this include?",
          },
        },
      },
    ],
  };
}

function getSubmitModalViewWithDescription(
  description: string,
): Record<string, unknown> {
  return {
    type: "modal",
    callback_id: "submit_idea",
    title: { type: "plain_text", text: "Save Thread as Idea" },
    submit: { type: "plain_text", text: "Submit" },
    close: { type: "plain_text", text: "Cancel" },
    blocks: [
      {
        type: "input",
        block_id: "name_block",
        label: { type: "plain_text", text: "Idea Name" },
        element: {
          type: "plain_text_input",
          action_id: "name_input",
          placeholder: {
            type: "plain_text",
            text: "Give this thread a name",
          },
        },
      },
      {
        type: "input",
        block_id: "description_block",
        label: { type: "plain_text", text: "Description" },
        element: {
          type: "plain_text_input",
          action_id: "description_input",
          multiline: true,
          initial_value: description,
        },
      },
      {
        type: "input",
        block_id: "features_block",
        label: { type: "plain_text", text: "Features" },
        optional: true,
        element: {
          type: "plain_text_input",
          action_id: "features_input",
          multiline: true,
          placeholder: {
            type: "plain_text",
            text: "What features or scope would this include?",
          },
        },
      },
    ],
  };
}

// ─── Response Helpers ───────────────────────────────────────────────────────

function jsonResponse(body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
  });
}

// ─── Main Handler ───────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await req.text();

  // Handle url_verification before HMAC check — Slack sends this during
  // initial Event Subscriptions setup and expects the challenge back immediately
  if (body.startsWith("{")) {
    try {
      const json = JSON.parse(body);
      if (json.type === "url_verification") {
        return new Response(
          JSON.stringify({ challenge: json.challenge }),
          { headers: { "Content-Type": "application/json" } },
        );
      }
    } catch {
      // Not JSON — continue to normal flow
    }
  }

  // Verify request is from Slack
  const verified = await verifySlackRequest(req, body);
  if (!verified) {
    console.error("Request verification failed");
    return jsonResponse({ text: "Unauthorized." });
  }

  const params = new URLSearchParams(body);
  const payload = parsePayload(params, body);

  // Events API: reaction events
  if (payload.type === "event_callback") {
    return handleEventCallback(payload as EventPayload);
  }

  if (payload.type === "view_submission") {
    return handleViewSubmission(payload as InteractionPayload);
  }

  return routeCommand(payload as SlashPayload);
});
