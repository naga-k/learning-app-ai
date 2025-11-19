import { z } from "zod";
import type { EngagementBlock } from "./types";

export type ToolExecutionContext = {
  moduleTitle: string;
  lessonTitle: string;
  domain?: string;
  learnerLevel?: string;
};

export type ToolExecutionSuccess = {
  success: true;
  block: EngagementBlock;
  toolName: string;
  metadata?: Record<string, unknown>;
};

export type ToolExecutionFailure = {
  success: false;
  toolName: string;
  error: string;
};

export type ToolExecutionResult = ToolExecutionSuccess | ToolExecutionFailure;

export type ToolSchema<TInput extends z.ZodTypeAny = z.ZodTypeAny> = {
  input: TInput;
  description: string;
  title: string;
};

export type RegisteredTool<TInput extends z.ZodTypeAny = z.ZodTypeAny> = {
  name: string;
  schema: ToolSchema<TInput>;
  execute: (
    input: z.infer<TInput>,
    context: ToolExecutionContext,
  ) => Promise<ToolExecutionResult> | ToolExecutionResult;
};

export interface ToolRegistry {
  register: <TInput extends z.ZodTypeAny>(tool: RegisteredTool<TInput>) => void;
  list: () => RegisteredTool<z.ZodTypeAny>[];
  execute: (
    toolName: string,
    input: unknown,
    context: ToolExecutionContext,
  ) => Promise<ToolExecutionResult>;
}

export class InMemoryToolRegistry implements ToolRegistry {
  private tools = new Map<string, RegisteredTool<z.ZodTypeAny>>();

  register<TInput extends z.ZodTypeAny>(tool: RegisteredTool<TInput>) {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool with name "${tool.name}" is already registered.`);
    }
    this.tools.set(tool.name, tool as unknown as RegisteredTool<z.ZodTypeAny>);
  }

  list() {
    return Array.from(this.tools.values());
  }

  async execute(
    toolName: string,
    input: unknown,
    context: ToolExecutionContext,
  ): Promise<ToolExecutionResult> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return {
        success: false,
        toolName,
        error: `Tool "${toolName}" is not registered.`,
      };
    }

    const parsed = tool.schema.input.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        toolName,
        error: parsed.error.flatten().formErrors.join("\n"),
      };
    }

    try {
      return await tool.execute(parsed.data, context);
    } catch (error) {
      return {
        success: false,
        toolName,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error while executing tool.",
      };
    }
  }
}
