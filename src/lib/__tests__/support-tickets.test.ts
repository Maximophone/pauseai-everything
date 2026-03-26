import { describe, it, expect } from "vitest";
import {
  CreateTicketInput,
  UpdateTicketInput,
  CreateTicketReplyInput,
} from "../schemas/support-tickets";

describe("Support Ticket Schemas", () => {
  describe("CreateTicketInput", () => {
    it("accepts valid input", () => {
      const result = CreateTicketInput.safeParse({
        title: "Button doesn't work",
        description: "When I click the save button, nothing happens.",
        type: "bug",
        priority: "high",
      });
      expect(result.success).toBe(true);
    });

    it("accepts input without priority (optional)", () => {
      const result = CreateTicketInput.safeParse({
        title: "Add dark mode",
        description: "Would be great to have dark mode support.",
        type: "feature",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty title", () => {
      const result = CreateTicketInput.safeParse({
        title: "",
        description: "Some description",
        type: "bug",
      });
      expect(result.success).toBe(false);
    });

    it("rejects empty description", () => {
      const result = CreateTicketInput.safeParse({
        title: "Some title",
        description: "",
        type: "bug",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid type", () => {
      const result = CreateTicketInput.safeParse({
        title: "Some title",
        description: "Some description",
        type: "question",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid priority", () => {
      const result = CreateTicketInput.safeParse({
        title: "Some title",
        description: "Some description",
        type: "bug",
        priority: "critical",
      });
      expect(result.success).toBe(false);
    });

    it("rejects title over 200 chars", () => {
      const result = CreateTicketInput.safeParse({
        title: "a".repeat(201),
        description: "Some description",
        type: "bug",
      });
      expect(result.success).toBe(false);
    });

    it("rejects description over 5000 chars", () => {
      const result = CreateTicketInput.safeParse({
        title: "Some title",
        description: "a".repeat(5001),
        type: "bug",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("UpdateTicketInput", () => {
    it("accepts partial update with status", () => {
      const result = UpdateTicketInput.safeParse({
        status: "in_progress",
      });
      expect(result.success).toBe(true);
    });

    it("accepts partial update with title and description", () => {
      const result = UpdateTicketInput.safeParse({
        title: "Updated title",
        description: "Updated description",
      });
      expect(result.success).toBe(true);
    });

    it("accepts empty object (all fields optional)", () => {
      const result = UpdateTicketInput.safeParse({});
      expect(result.success).toBe(true);
    });

    it("rejects invalid status", () => {
      const result = UpdateTicketInput.safeParse({
        status: "pending",
      });
      expect(result.success).toBe(false);
    });

    it("accepts all valid statuses", () => {
      for (const status of ["open", "in_progress", "resolved", "closed"]) {
        const result = UpdateTicketInput.safeParse({ status });
        expect(result.success).toBe(true);
      }
    });
  });

  describe("CreateTicketReplyInput", () => {
    it("accepts valid reply", () => {
      const result = CreateTicketReplyInput.safeParse({
        body: "Thanks for the report, we're looking into it.",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty body", () => {
      const result = CreateTicketReplyInput.safeParse({
        body: "",
      });
      expect(result.success).toBe(false);
    });

    it("rejects body over 5000 chars", () => {
      const result = CreateTicketReplyInput.safeParse({
        body: "a".repeat(5001),
      });
      expect(result.success).toBe(false);
    });
  });
});
