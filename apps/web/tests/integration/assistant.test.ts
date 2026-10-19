import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeUser, publishedListing } from "../support/factory";

// The Anthropic API is replaced with a scripted fake: these tests check our tool loop and rules,
// not the model.
const create = vi.fn();
vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error {
    status = 529;
  }
  class Anthropic {
    static APIError = APIError;
    beta = { messages: { create } };
  }
  return { default: Anthropic, APIError };
});

const { askAssistant, assistantAvailable } = await import("@/server/assistant");

function reply(content: unknown[], stop_reason = "end_turn") {
  return { id: "msg_test", type: "message", role: "assistant", content, stop_reason, usage: {} };
}

describe("AI assistant", () => {
  beforeEach(() => create.mockReset());
  afterEach(() => vi.unstubAllEnvs());

  it("is switched on only when an API key is configured", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(assistantAvailable()).toBe(false);
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    expect(assistantAvailable()).toBe(true);
  });

  it("searches real listings with a tool and answers from the results", async () => {
    const owner = await makeUser(["OWNER"]);
    const moderator = await makeUser(["MODERATOR"]);
    const listing = await publishedListing(owner, moderator);

    create
      .mockResolvedValueOnce(reply([{ type: "tool_use", id: "tu_1", name: "search_listings", input: { purpose: "RENT", keywords: listing.title } }], "tool_use"))
      .mockResolvedValueOnce(reply([{ type: "text", text: `Here is one: [${listing.title}](/properties/${listing.slug})` }]));

    const answer = await askAssistant({ messages: [{ role: "user", content: "Any houses to rent with a garden?" }], page: "/" });
    expect(answer).toContain(`/properties/${listing.slug}`);

    expect(create).toHaveBeenCalledTimes(2);
    const first = create.mock.calls[0]![0];
    expect(first.tools.map((t: { name: string }) => t.name)).toEqual(["search_listings", "get_listing"]);
    expect(first.system).toContain("Never tell anyone a payment was made");
    const second = create.mock.calls[1]![0];
    const toolResult = second.messages.at(-1).content[0];
    expect(toolResult).toMatchObject({ type: "tool_result", tool_use_id: "tu_1", is_error: false });
    const found = JSON.parse(toolResult.content);
    expect(found.listings.map((l: { url: string }) => l.url)).toContain(`/properties/${listing.slug}`);
  });

  it("does not reveal unpublished listings", async () => {
    create
      .mockResolvedValueOnce(reply([{ type: "tool_use", id: "tu_2", name: "get_listing", input: { slug: "no-such-listing" } }], "tool_use"))
      .mockResolvedValueOnce(reply([{ type: "text", text: "I could not find that listing." }]));
    await askAssistant({ messages: [{ role: "user", content: "Tell me about no-such-listing" }] });
    const result = create.mock.calls[1]![0].messages.at(-1).content[0];
    expect(result.is_error).toBe(true);
  });

  it("hands over to a person when the model declines or the API is down", async () => {
    create.mockResolvedValueOnce(reply([], "refusal"));
    expect(await askAssistant({ messages: [{ role: "user", content: "hello" }] })).toMatch(/wa\.me|whatsapp/i);

    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    create.mockRejectedValueOnce(new (Anthropic as unknown as { APIError: new () => Error }).APIError());
    expect(await askAssistant({ messages: [{ role: "user", content: "hello" }] })).toMatch(/try again/i);
  });
});
