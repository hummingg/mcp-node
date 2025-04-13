import { Anthropic } from "@anthropic-ai/sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import dotenv from "dotenv";
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const serverScriptPath = path.join(__dirname, 'mcpServer.js');

class MCPManager {
  constructor() {
    this.sessions = new Map();
  }
  
  async getOrCreateClient(sessionId) {
    if (!this.sessions.has(sessionId)) {
      console.log(`Creating new MCP client for session ${sessionId}`);
      const client = new MCPClient();
      await client.initialize();
      this.sessions.set(sessionId, client);
    }
    return this.sessions.get(sessionId);
  }
  
  removeClient(sessionId) {
    if (this.sessions.has(sessionId)) {
      const client = this.sessions.get(sessionId);
      client.cleanup();
      this.sessions.delete(sessionId);
      console.log(`Removed MCP client for session ${sessionId}`);
    }
  }
}

class MCPClient {
  constructor() {
    this.anthropic = new Anthropic({
      apiKey: ANTHROPIC_API_KEY,
    });
    this.mcp = new Client({ name: "mcp-client-api", version: "1.0.0" });
    this.transport = null;
    this.tools = [];
    this.chatHistory = [];
  }

  async initialize() {
    try {
      console.log(`Attempting to initialize MCP client with server script: ${serverScriptPath}`);
      
      try {
        const fs = await import('fs');
        if (!fs.existsSync(serverScriptPath)) {
          throw new Error(`Server script not found at path: ${serverScriptPath}`);
        }
      } catch (fsError) {
        console.error('Error checking server script file:', fsError);
        throw fsError;
      }
      
      const isJs = serverScriptPath.endsWith(".js");
      const isPy = serverScriptPath.endsWith(".py");
      
      if (!isJs && !isPy) {
        throw new Error("Server script must be a .js or .py file");
      }
      
      const command = isPy
        ? process.platform === "win32"
          ? "python"
          : "python3"
        : process.execPath;
      
      console.log(`Using command: ${command}, args: [${serverScriptPath}]`);
      
      this.transport = new StdioClientTransport({
        command,
        args: [serverScriptPath],
        options: {
          detached: false,
          env: { ...process.env },
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 10000
        }
      });
      
      console.log('Created transport, connecting to MCP server...');
      
      try {
        this.mcp.connect(this.transport);
        console.log('Successfully connected to MCP server');
      } catch (connError) {
        console.error('Failed to connect to MCP server:', connError);
        throw connError;
      }
      
      console.log('Fetching available tools...');
      let toolsResult;
      try {
        toolsResult = await this.mcp.listTools();
      } catch (toolsError) {
        console.error('Failed to list tools:', toolsError);
        throw toolsError;
      }
      
      this.tools = toolsResult.tools.map((tool) => {
        return {
          name: tool.name,
          description: tool.description,
          input_schema: tool.inputSchema,
        };
      });
      
      console.log(
        "Connected to server with tools:",
        this.tools.map(({ name }) => name)
      );
      
      return true;
    } catch (e) {
      console.error("Failed to initialize MCP client:", e);
      throw e;
    }
  }

  async processQuery(query) {
    this.chatHistory.push({ role: 'user', content: query });
    
    const messages = this.chatHistory.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    const response = await this.anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1000,
      messages,
      tools: this.tools,
    });

    let responseContent = [];

    for (const content of response.content) {
      if (content.type === "text") {
        responseContent.push({ type: "text", text: content.text });
      } else if (content.type === "tool_use") {
        const toolName = content.name;
        const toolArgs = content.input;

        responseContent.push({ 
          type: "tool_call", 
          name: toolName, 
          args: toolArgs 
        });

        const result = await this.mcp.callTool({
          name: toolName,
          arguments: toolArgs,
        });
        
        // Format the result content for better display
        const formattedResult = typeof result.content === 'object' 
          ? JSON.stringify(result.content, null, 2) 
          : result.content;

        responseContent.push({ 
          type: "tool_result", 
          result: formattedResult 
        });

        // Add formatted result to chat history
        this.chatHistory.push({
          role: "user",
          content: formattedResult,
        });

        const followUpResponse = await this.anthropic.messages.create({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 1000,
          messages: this.chatHistory.map(msg => ({
            role: msg.role,
            content: msg.content,
          })),
        });

        if (followUpResponse.content[0]?.type === "text") {
          responseContent.push({ 
            type: "text", 
            text: followUpResponse.content[0].text 
          });
        }
      }
    }

    const assistantResponse = responseContent
      .filter(item => item.type === "text")
      .map(item => item.text)
      .join("\n");
    
    this.chatHistory.push({
      role: "assistant",
      content: assistantResponse
    });

    return {
      response: responseContent,
      chatHistory: this.chatHistory
    };
  }

  async cleanup() {
    try {
      if (this.mcp) {
        console.log('Closing MCP connection...');
        await this.mcp.close().catch(err => {
          console.log('Error during MCP close (can be ignored if already closed):', err.message);
        });
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    } finally {
      this.transport = null;
      console.log('MCP client cleanup completed');
    }
  }
}

export { MCPManager, MCPClient }; 