import { Planner } from '../planner/planner.js';
import { Executor } from '../executor/executor.js';
import { DeployTool, EmailSenderTool, TerminalTool, ToolRegistry, WebSearchTool, WhatsAppSenderTool } from '../tools/tools.js';

const toolRegistry = new ToolRegistry();
toolRegistry.register(new EmailSenderTool());
toolRegistry.register(new WebSearchTool());
toolRegistry.register(new WhatsAppSenderTool());
toolRegistry.register(new TerminalTool());
toolRegistry.register(new DeployTool());

const planner = new Planner(toolRegistry.tools);
const executor = new Executor(toolRegistry);

export { planner, executor };