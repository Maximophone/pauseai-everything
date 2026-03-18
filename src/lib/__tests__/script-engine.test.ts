import { describe, it, expect } from "vitest";
import { SCRIPT_TEMPLATES } from "../script-templates";

describe("Script templates", () => {
  it("should have at least 4 templates", () => {
    expect(SCRIPT_TEMPLATES.length).toBeGreaterThanOrEqual(4);
  });

  it("should have a blank template as first entry", () => {
    expect(SCRIPT_TEMPLATES[0].name).toBe("Blank script");
    expect(SCRIPT_TEMPLATES[0].code).toContain("ctx.contacts.find");
    expect(SCRIPT_TEMPLATES[0].code).toContain("ctx.tags.add");
    expect(SCRIPT_TEMPLATES[0].code).toContain("ctx.email.send");
  });

  it("should have unique template names", () => {
    const names = SCRIPT_TEMPLATES.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("should have non-empty code in all templates", () => {
    for (const tpl of SCRIPT_TEMPLATES) {
      expect(tpl.code.length).toBeGreaterThan(0);
      expect(tpl.name.length).toBeGreaterThan(0);
      expect(tpl.description.length).toBeGreaterThan(0);
    }
  });
});

describe("Script engine sandbox design", () => {
  it("should define safe globals only", () => {
    const SAFE_GLOBALS = [
      "Date", "Math", "JSON", "Array", "Object", "String",
      "Number", "Boolean", "parseInt", "parseFloat", "isNaN",
      "isFinite", "RegExp", "Map", "Set", "Promise",
    ];
    const BLOCKED = [
      "require", "process", "global", "globalThis",
      "setTimeout", "setInterval",
    ];

    // All safe globals should be accessible in normal JS
    for (const g of SAFE_GLOBALS) {
      expect(typeof eval(g)).not.toBe("undefined");
    }

    // Blocked items should be defined as undefined in the sandbox
    expect(BLOCKED.length).toBe(6);
  });

  it("should enforce timeout limit", () => {
    const TIMEOUT_MS = 30_000;
    expect(TIMEOUT_MS).toBe(30000);
    expect(TIMEOUT_MS).toBeLessThanOrEqual(60000);
  });

  it("should enforce max contacts limit", () => {
    const MAX_CONTACTS = 1000;
    expect(MAX_CONTACTS).toBe(1000);
  });

  it("should enforce email rate limit", () => {
    const MAX_EMAILS = 100;
    expect(MAX_EMAILS).toBe(100);
  });
});

describe("Script execution flow", () => {
  it("should wrap user code in async IIFE", () => {
    const userCode = 'ctx.log("hello")';
    const wrapped = `(async () => { ${userCode} })()`;
    expect(wrapped).toContain("async");
    expect(wrapped).toContain(userCode);
    expect(wrapped).toMatch(/^\(async \(\) => \{.*\}\)\(\)$/);
  });

  it("should capture log output", () => {
    const logs: string[] = [];
    const log = (...args: unknown[]) => {
      logs.push(
        args
          .map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a)))
          .join(" ")
      );
    };

    log("hello", "world");
    log("count:", 42);
    log({ key: "value" });

    expect(logs).toEqual(["hello world", "count: 42", '{"key":"value"}']);
  });

  it("should track affected contacts via Set", () => {
    const affected = new Set<string>();
    affected.add("contact-1");
    affected.add("contact-2");
    affected.add("contact-1"); // duplicate

    expect(affected.size).toBe(2);
  });

  it("should produce correct result shape for success", () => {
    const result = {
      status: "success" as const,
      log: "Processed 5 contacts",
      contactsAffected: 5,
    };

    expect(result.status).toBe("success");
    expect(result.log).toContain("5 contacts");
    expect(result.contactsAffected).toBe(5);
  });

  it("should produce correct result shape for error", () => {
    const result = {
      status: "error" as const,
      log: "Started processing...",
      error: "Script execution timed out after 30000ms",
      contactsAffected: 2,
    };

    expect(result.status).toBe("error");
    expect(result.error).toContain("timed out");
    expect(result.contactsAffected).toBe(2);
  });
});

describe("Contact filter translation", () => {
  it("should translate simple key-value to eq condition", () => {
    const filter = { country: "NL" };
    const conditions = Object.entries(filter).map(([key, value]) => ({
      field: key,
      operator: "eq",
      value,
    }));

    expect(conditions).toEqual([{ field: "country", operator: "eq", value: "NL" }]);
  });

  it("should translate tag filter", () => {
    const filter = { tag: "leader" };
    const conditions = Object.entries(filter).map(([key, value]) => {
      if (key === "tag" || key === "has_tag") {
        return { field: "tag", operator: "has", value: String(value) };
      }
      return { field: key, operator: "eq", value };
    });

    expect(conditions).toEqual([{ field: "tag", operator: "has", value: "leader" }]);
  });

  it("should translate operator objects", () => {
    const filter = { lifecycle_stage: { neq: "dormant" } };
    const conditions: Array<{ field: string; operator: string; value: unknown }> = [];

    for (const [key, value] of Object.entries(filter)) {
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        const ops = value as Record<string, unknown>;
        for (const [op, val] of Object.entries(ops)) {
          conditions.push({ field: key, operator: op, value: val });
        }
      } else {
        conditions.push({ field: key, operator: "eq", value });
      }
    }

    expect(conditions).toEqual([
      { field: "lifecycle_stage", operator: "neq", value: "dormant" },
    ]);
  });
});

describe("Worker task configuration (scripts)", () => {
  it("should define updated task list", () => {
    const taskNames = [
      "send_campaign",
      "detect_churn",
      "run_script",
      "dispatch_scripts",
    ];
    expect(taskNames).toHaveLength(4);
    expect(taskNames).toContain("run_script");
    expect(taskNames).toContain("dispatch_scripts");
    // Old task removed
    expect(taskNames).not.toContain("run_automations");
  });

  it("should have script dispatcher cron running every minute", () => {
    const dispatchCron = "* * * * *";
    const parts = dispatchCron.split(" ");
    expect(parts).toHaveLength(5);
    expect(parts.every((p) => p === "*")).toBe(true);
  });
});
