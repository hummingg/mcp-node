# MCP Chat Application

A Simple chat application that uses the Model Context Protocol (MCP) to interact with AI models and tools.

## Overview

This application provides a simple and intuitive chat interface for interacting with AI models that support the Model Context Protocol (MCP). It enables calling external tools through the MCP server and displays the results in a user-friendly chat interface.

## Architecture

The application is structured as follows:

- **server.js**: Express server that handles HTTP requests and manages the chat sessions.
- **mcpClient.js**: Contains the client implementation for the Model Context Protocol.
- **mcpServer.js**: Server script that implements the tools accessible via MCP.
- **public/index.html**: Frontend chat interface.

### Components

1. **MCPClient**: Handles communication with the MCP server, processes user queries, and manages tool calls.
2. **MCPManager**: Manages multiple MCP client instances for different user sessions.
3. **Express Server**: Provides REST API endpoints for the chat functionality.
4. **Frontend**: A responsive chat UI built with HTML, CSS, and JavaScript.

## Installation

### Prerequisites

- Node.js (v14 or higher)
- npm (Node Package Manager)

### Setup

1. Clone the repository:
   ```
   git clone <repository-url>
   cd mcp-node
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file in the root directory with the following content:
   ```
   ANTHROPIC_API_KEY=your_anthropic_api_key
   ```

## Usage

1. Start the server:
   ```
   node server.js
   ```

2. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

3. Start chatting! You can ask questions that might require external tools.

## API Endpoints

- **POST /api/chat**: Send a message to the chat
  - Request body: `{ "message": "Your message here" }`
  - Response: JSON with chat response and history

- **POST /api/chat/clear**: Clear the current chat session

- **GET /api/chat/history**: Get the chat history for the current session

## Development

### Adding New Tools

To add new tools to the MCP server, modify the `mcpServer.js` file:

1. Define a new tool function
2. Register the tool with the MCP server
3. Implement the tool's functionality

## License

[MIT License](LICENSE)

## Acknowledgements

- Anthropic for the Claude AI model API
- Model Context Protocol (MCP) for enabling tool use with AI models 