import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from "dotenv";
import { MCPManager, MCPClient } from './mcpClient.js';

dotenv.config();

const app = express();
const port = 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(bodyParser.json());
app.use(session({
  secret: 'mcp-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

const mcpManager = new MCPManager();

// API routes
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const sessionId = req.session.id;
    const mcpClient = await mcpManager.getOrCreateClient(sessionId);
    
    const result = await mcpClient.processQuery(message);
    
    res.json(result);
  } catch (error) {
    console.error('Error processing chat message:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

app.post('/api/chat/clear', (req, res) => {
  const sessionId = req.session.id;
  mcpManager.removeClient(sessionId);
  res.json({ success: true, message: 'Chat history cleared' });
});

app.get('/api/chat/history', async (req, res) => {
  try {
    const sessionId = req.session.id;
    const mcpClient = await mcpManager.getOrCreateClient(sessionId);
    res.json({ chatHistory: mcpClient.chatHistory });
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

process.on('SIGINT', async () => {
  console.log('Shutting down...');
  for (const [sessionId, client] of mcpManager.sessions.entries()) {
    await client.cleanup();
    console.log(`Cleaned up session ${sessionId}`);
  }
  process.exit(0);
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`MCP API server running on port ${port}`);
  
  (async () => {
    try {
      console.log('Initializing persistent MCP client...');
      const persistentClient = new MCPClient();
      await persistentClient.initialize();
      console.log('Persistent MCP client initialized successfully with tools:', 
                 persistentClient.tools.map(t => t.name).join(', '));
      
      mcpManager.sessions.set('persistent-session', persistentClient);
      
    } catch (error) {
      console.error('Failed to initialize persistent MCP client:', error);
      console.log('The API server is running, but MCP functionality may not work correctly.');
      console.log('Check your server.js file and make sure it can be executed properly.');
    }
  })();
}).on('error', (err) => {
  console.error('Failed to start server:', err);
}); 