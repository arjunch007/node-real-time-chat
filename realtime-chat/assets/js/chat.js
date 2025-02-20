// console.log({ apiUrl });
// console.log({ token });

const socket = io("http://localhost:5000");

const user = JSON.parse(localStorage.getItem('userData'))

if (!user) {
    window.location.href = "/"
}

const fromUserId = user.id
let username = user.firstName + " " + user.lastName

const form = document.getElementById("form");
const messageInput = document.getElementById("messageInput");
const messages = document.getElementById("messages");
const typingDiv = document.getElementById("typing");
let typingTimeout = null;

const userList = document.getElementById("userList");
const chatUserList = document.getElementById("chatUserList");
const chatList = document.getElementById("chatList");

let chatContainer = document.querySelector('.chatbox .modal-body');
let activeTab = document.querySelector('#myTab .nav-link.active');

let currentPage = 1;
let chatUserCurrentPage = 1;
let loadNewMessages = false;
let loadOldMessages = true;
let hasMoreChatUsers = true;
let hasMoreUsers = true;
let searchUserString = '';

let toUserId = null
let toUserName = null

function cleanup() {
    ["sender_last_message", "receiver_last_message", "typing", "stop_typing", "user_status", "get_online_users", "offline_users"].forEach(event => {
        socket.off(event);
    });
}

// Add this before window closes
window.addEventListener('beforeunload', cleanup);

socket.on("connect", () => {
    // console.log("Connected to socket server");
    // Register user as online with userId
    socket.emit("online_user", {
        userId: user.id,
        username: username
    });
});

// Socket event listener for sender's messages
socket.on("sender_last_message", (msg) => {
    // console.log("Sender received message:", msg);

    // Only process if this is the relevant chat window
    if (toUserId === msg.toUserId) {

        chatList.appendChild(createLatestMessageHtml(msg, 'reply')); // Always 'reply' for sender
        // Update chat list
        updateChatUserList(msg.toUserId, msg.content);

        if (chatContainer) {
            chatContainer.scrollBy({
                top: chatContainer.scrollHeight,
                behavior: 'smooth'
            });
        }
    }
});

function createLatestMessageHtml(msg, messageClass) {

    const newDate = new Date().toLocaleString();
    const newChatItem = document.createElement("li");
    newChatItem.setAttribute('data-message-id', msg.messageId);

    newChatItem.className = messageClass;
    const readStatus = messageClass === 'reply' ? '<span class="read-status"><i class="fa fa-check"></i></span>' : ''

    newChatItem.innerHTML = `
        <p>${msg.content}</p>
        <span class="time">${newDate}</span>
        ${readStatus}
    `;
    return newChatItem;
}

// Socket event listener for receiver's messages
socket.on("receiver_last_message", (msg) => {
    // Add message to chat if this is the current active chat
    if (toUserId === msg.fromUserId) {

        // Check if sender exists and is not at the top
        const existingUser = document.querySelector(`#chatUserList [data-user-id="${msg.fromUserId}"]`);
        const isNotAtTop = existingUser && existingUser !== chatUserList.firstChild;

        if (isNotAtTop || !existingUser) {
            // Move sender to top only if they're not already at top or don't exist in the list
            moveSenderToTop(msg.fromUserId, msg.content);
        } else {
            // Just update the message preview if user is already at top
            const messagePreview = existingUser.querySelector('.flex-grow-1 p');
            if (messagePreview) {
                messagePreview.textContent = msg.content;
            }
        }

        chatList.appendChild(createLatestMessageHtml(msg, 'sender')); // Always 'sender' for receiver

        // Update chat list
        updateChatUserList(msg.fromUserId, msg.content, 'receive');

        updateUnreadCount(msg.fromUserId, 1, 'unread');
    } else {
        updateUnreadCount(msg.fromUserId, 1, 'unread');
        moveSenderToTop(msg.fromUserId, msg.content);
    }
});

socket.on("typing", (user) => {
    const activeUser = document.querySelector('#chatUserList .active-user');
    if (activeUser && activeUser.getAttribute('data-user-id') === user.fromUserId) {
        typingDiv.textContent = `${user.username} is typing...`;
    }
});

socket.on("stop_typing", () => {
    typingDiv.textContent = "";
});

socket.on("user_status", (data) => {
    const { userId, username, status } = data;
    // Don't update status for current user
    if (userId !== user.id) {
        updateUserOnlineStatus(userId, status === 'online');
    }
});

socket.on("get_online_users", (data) => {
    // Store online users for later use
    window.onlineUsers = data;

    // Update online status for all users in both lists
    data.forEach(onlineUser => {
        updateUserOnlineStatus(onlineUser.userId, true);
    });
});

// Update offline users handling
socket.on("offline_users", (offlineUsers) => {
    offlineUsers.forEach(offlineUser => {
        updateUserOnlineStatus(offlineUser.userId, false);
    });
});


// ######################################################

messageInput.addEventListener("input", () => {
    const isTargetUserOnline = window.onlineUsers.some(u => u.userId === toUserId);

    if (isTargetUserOnline) {
        socket.emit("typing", {
            fromUserId: user.id,
            toUserId: toUserId,
            username: username
        });

        // Clear existing timeout
        if (typingTimeout) clearTimeout(typingTimeout);

        // Set new timeout
        typingTimeout = setTimeout(() => {
            socket.emit("stop_typing", {
                toUserId: toUserId
            });
        }, 2000); // Stop typing event after 2 second of no input
    }
});

form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (messageInput.value && toUserId) {

        fetch(`${apiUrl}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content: messageInput.value,
                to_user_id: toUserId
            })
        })
            .then(response => response.json())
            .then(data => {
                if (data) {
                    handleUnauthorized(data)
                }

                // Remove "no messages" element if it exists
                const noMessagesElement = chatList.querySelector('.no-messages');
                if (noMessagesElement) {
                    noMessagesElement.remove();
                }

                socket.emit("send_message", {
                    toUserId: toUserId,
                    message: messageInput.value,
                    messageId: data._id
                });

                // Emit stop typing when message is sent
                socket.emit("stop_typing", {
                    toUserId: toUserId
                });

                updateChatUserList(toUserId, messageInput.value);

                messageInput.value = "";
            }).catch(error => {
                console.error("There was a problem with the fetch operation:", error);
            })
    }
});

// Add new function to update chat user list
function updateChatUserList(userId, lastMessage, messageType = 'sent') {
    // Check if user already exists in chat user list
    const existingUser = document.querySelector(`#chatUserList [data-user-id="${userId}"]`);
    const isNotAtTop = existingUser && existingUser !== chatUserList.firstChild;

    if (existingUser) {
        // Update last message
        const messagePreview = existingUser.querySelector('.flex-grow-1 p');
        if (messagePreview) {
            messagePreview.textContent = lastMessage;
        }

        // Move user to top if they're not already first
        /* const firstUser = chatUserList.firstChild;
        if (firstUser && firstUser !== existingUser) {
            chatUserList.removeChild(existingUser);
            chatUserList.insertBefore(existingUser, firstUser);

            // Scroll the moved user into view at the top
            const sideBar = document.getElementById('side-bar');
            sideBar.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        } */

        // Move user to top if they're not already first (for both sent and received messages)
        if (isNotAtTop) {
            chatUserList.removeChild(existingUser);
            chatUserList.insertBefore(existingUser, chatUserList.firstChild);

            // Scroll the moved user into view at the top
            const sideBar = document.getElementById('side-bar');
            sideBar.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        }

        // Also move in the all users list
        const userInAllList = document.querySelector(`#userList [data-user-id="${userId}"]`);
        if (userInAllList) {
            const firstUserInAll = userList.firstChild;
            if (firstUserInAll && firstUserInAll !== userInAllList) {
                userList.removeChild(userInAllList);
                userList.insertBefore(userInAllList, firstUserInAll);
            }
        }
    }
}

// Function to update online status for a user
function updateUserOnlineStatus(userId, isOnline) {
    ['userList', 'chatUserList'].forEach(listId => {
        const userElements = document.querySelectorAll(`#${listId} .user-list-item`);
        userElements.forEach(element => {
            if (element.getAttribute('data-user-id') === userId) {
                const statusSpan = element.querySelector('.online-status');
                if (statusSpan) {
                    if (isOnline) {
                        statusSpan.classList.add('online');
                    } else {
                        statusSpan.classList.remove('online');
                    }
                }
            }
        });
    });
}

document.querySelectorAll('#myTab .nav-link').forEach(tab => {
    tab.addEventListener('shown.bs.tab', function() {
        activeTab = document.querySelector('#myTab .nav-link.active');
    });
});