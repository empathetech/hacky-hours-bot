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
    state: {
      values: Record<string, Record<string, { value: string | null }>>;
    };
  };
}

type Payload = SlashPayload | InteractionPayload;

interface Idea {
  id: string;
  name: string;
  submitter_id: string;
  description: string;
  features: string;
  submitted_at: string;
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
            "`/hacky-hours save [thread-link]` — Save a thread as an idea",
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

  const messages = await getThreadMessages(
    parsed.channelId,
    parsed.threadTs,
  );
  if (!messages || messages.length === 0) {
    return jsonResponse({
      text: "Could not read the thread. Make sure the bot has `channels:history` " +
        "(and `groups:history` for private channels) permissions.",
    });
  }

  let markdown = formatThreadAsMarkdown(messages);

  // Slack modal text inputs have a 3000 char limit
  if (markdown.length > 3000) {
    markdown = markdown.substring(0, 2990) + "\n\n[truncated]";
  }

  await openModal(payload.trigger_id, getSubmitModalViewWithDescription(markdown));
  return new Response("", { status: 200 });
}

async function handleViewSubmission(
  payload: InteractionPayload,
): Promise<Response> {
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
): Promise<Array<{ user?: string; ts: string; text?: string }> | null> {
  const token = Deno.env.get("SLACK_BOT_TOKEN");
  if (!token) return null;

  const url = `https://slack.com/api/conversations.replies?channel=${encodeURIComponent(channelId)}&ts=${encodeURIComponent(threadTs)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const result = await res.json();
  if (!result.ok) {
    console.error("conversations.replies error:", result.error);
    return null;
  }
  return result.messages ?? [];
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

  // Verify request is from Slack
  const verified = await verifySlackRequest(req, body);
  if (!verified) {
    console.error("Request verification failed");
    return jsonResponse({ text: "Unauthorized." });
  }

  const params = new URLSearchParams(body);
  const payload = parsePayload(params, body);

  if (payload.type === "view_submission") {
    return handleViewSubmission(payload as InteractionPayload);
  }

  return routeCommand(payload as SlashPayload);
});
