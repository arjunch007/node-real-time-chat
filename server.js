const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const { Server } = require("socket.io");


require('dotenv').config();

const app = express();
const path = require('path');

// Serve static files from node_modules
app.use('/assets', express.static(path.join(__dirname, 'node_modules/@fortawesome/fontawesome-free')));


const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 5000;

// Middleware Configuration
app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true,
}));




app.use(bodyParser.json());
app.use(cookieParser());

// Static Files & Routes
app.use(express.static("realtime-chat"));
app.get("/", (req, res) => {
    res.sendFile(__dirname + "/realtime-chat/index.html");
});
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/messages', require('./routes/chatRoutes'));
app.use('/api/users', require('./routes/userRoutes'));


// Store connected users
const connectedUsers = {};

// Socket.IO Configuration
io.on("connection", (socket) => {
    socket.on("online_user", ({ userId, username }) => {

        // Initialize user entry if it doesn't exist
        if (!connectedUsers[userId]) {
            connectedUsers[userId] = {
                userData: { userId, username },
                connections: {}
            };
        }

        // Remove stale connections (disconnected sockets)
        Object.keys(connectedUsers[userId].connections).forEach((socketId) => {
            if (!io.sockets.sockets.get(socketId)) {
                delete connectedUsers[userId].connections[socketId];
            }
        });

        // Add new connection for this user
        connectedUsers[userId].connections[socket.id] = {
            socketId: socket.id,
            lastActive: new Date().toISOString()
        };

        // Get unique online users (removing duplicates)
        const onlineUsers = Object.values(connectedUsers).map(user => ({
            userId: user.userData.userId,
            username: user.userData.username
        }));

        io.emit("get_online_users", onlineUsers);

        // Notify all clients
        io.emit("user_status", { userId, username, status: "online" });
    });

    // Handle private messages using userId
    socket.on("send_message", ({ toUserId, message, messageId }) => {

        if (!toUserId || !message) {
            socket.emit("error_message", { error: "Invalid recipient or empty message" });
            return;
        }

        const recipientUser = connectedUsers[toUserId];
        const senderUser = Object.values(connectedUsers).find(user =>
            Object.keys(user.connections).includes(socket.id)
        );

        // console.log({ recipientUser });
        // console.log({ senderUser });

        // Prepare message object
        const messageObject = {
            fromUserId: senderUser ? senderUser.userData.userId : null,
            content: message,
            toUserId: toUserId,
            messageId: messageId
        };

        // If sender is connected, emit sender_last_message to all their devices
        if (senderUser) {
            Object.keys(senderUser.connections).forEach(senderSocketId => {
                io.to(senderSocketId).emit("sender_last_message", messageObject);
            });
        }

        // If recipient is connected, emit receiver_last_message to all their devices
        if (recipientUser) {
            Object.keys(recipientUser.connections).forEach(recipientSocketId => {
                io.to(recipientSocketId).emit("receiver_last_message", messageObject);
            });
        }
    });

    socket.on("typing", ({ fromUserId, toUserId, username }) => {
        const recipientUser = connectedUsers[toUserId];
        if (recipientUser) {
            Object.keys(recipientUser.connections).forEach(recipientSocketId => {
                io.to(recipientSocketId).emit("typing", {
                    fromUserId,
                    username
                });
            });
        }
    });

    socket.on("stop_typing", ({ toUserId }) => {
        const recipientUser = connectedUsers[toUserId];
        if (recipientUser) {
            Object.keys(recipientUser.connections).forEach(recipientSocketId => {
                io.to(recipientSocketId).emit("stop_typing");
            });
        }
    });

    // Handle messages_read event
    socket.on('messages_read', async (data) => {
        const { fromUserId, toUserId, messageIds } = data;
        // Emit to the sender that their messages were read
        const toUserSocket = getUserSocket(toUserId);
        if (toUserSocket) {
            io.to(toUserSocket).emit('messages_read_ack', {
                fromUserId,
                messageIds
            });
        }
    });

    // Helper function to get user's socket
    function getUserSocket(userId) {
        const userEntry = connectedUsers[userId];
        if (userEntry && Object.keys(userEntry.connections).length > 0) {
            // Return the first active socket ID for this user
            return Object.keys(userEntry.connections)[0];
        }
        return null;
    }

    socket.on("disconnect", () => {
        // Find user that owns this socket
        const userEntry = Object.entries(connectedUsers).find(([_, userData]) =>
            userData.connections[socket.id]
        );

        if (userEntry) {
            const [userId, userData] = userEntry;

            // Remove this socket connection
            delete userData.connections[socket.id];

            // If user has no more connections, remove them completely
            if (Object.keys(userData.connections).length === 0) {
                // Notify all clients about user going offline
                io.emit("user_status", {
                    userId,
                    username: userData.userData.username,
                    status: "offline"
                });

                // Emit offline_users event
                io.emit("offline_users", [{ userId }]);

                // Remove user completely
                delete connectedUsers[userId];
            }

            // Emit updated online users list
            const onlineUsers = Object.values(connectedUsers).map(user => ({
                userId: user.userData.userId,
                username: user.userData.username
            }));

            io.emit("get_online_users", onlineUsers);
        }
    });

    socket.on("error", (error) => {
        console.error("Socket error:", error);
        // Implement proper error logging
    });
});

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