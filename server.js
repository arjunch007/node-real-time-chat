const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const { Server } = require("socket.io");
const initializeSocket = require('./socketHandler');
const path = require('path');

// Environment Configuration
require('dotenv').config();

// Express App Initialization
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 5000;

// Middleware Configuration
app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true,
}));
app.use(bodyParser.json());
// app.use(express.json());  will use this
app.use(cookieParser());

// Serve static files from node_modules
app.use('/assets', express.static(path.join(__dirname, 'node_modules/@fortawesome/fontawesome-free')));
app.use(express.static("realtime-chat"));
app.use('/storage/uploads/chat', express.static(path.join(__dirname, 'storage', 'uploads', 'chat')));

// Routes
app.get("/", (req, res) => {
    res.sendFile(__dirname + "/realtime-chat/index.html");
});
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/messages', require('./routes/chatRoutes'));
app.use('/api/users', require('./routes/userRoutes'));

// Initialize Socket.IO
initializeSocket(io);

// MongoDB Connection
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected');
    } catch (err) {
        console.error('MongoDB Connection Error:', err);
        process.exit(1);
    }
};

// Initialize Database & Server
connectDB().then(() => {
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}. Access it at: http://localhost:5000/`);
    });
});