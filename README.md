
# Random Chat Test

This document provides an in-depth explanation of the `client.js`, `server.js` and `nsfw.py` files for the chat application.

---
- [Introduction](#introduction)
- [Client.js](#clientjs)
  - [Initialization](#initialization)
  - [DOM Elements](#dom-elements)
  - [Typing Indicator Setup](#typing-indicator-setup)
  - [State Variables](#state-variables)
  - [Event Listeners](#event-listeners)
  - [Socket Event Handlers](#socket-event-handlers)
  - [Message Functions](#message-functions)
- [Server.js](#serverjs)
  - [Initialization](#initialization-1)
  - [Middleware](#middleware)
  - [State Management](#state-management)
  - [Socket.IO Event Handlers](#socketio-event-handlers)
  - [Partner Functions](#partner-functions)
  - [Server Start](#server-start)
- [Nsfw.py](#nsfwpy)
  - [Initialization](#initialization-2)
  - [Route](#route-for-checking-nsfw-images)
  - [Flask](#flask-application-runner)
  
## client.js

`client.js` handles the client-side functionality of the chat application. It manages user interactions, DOM updates, and communication with the server through WebSocket events.

### Initialization

```javascript
const socket = io();
```

**Purpose**: Establishes a WebSocket connection between the client and the server using Socket.IO.<br>
**How It Works**: The `io()` function automatically tries to connect to the server where the client was served from.

### DOM Elements

```javascript
const messages = document.getElementById("messages");
const messageInput = document.getElementById("message-input");
const sendButton = document.getElementById("send-button");
const skipButton = document.getElementById("skip-button");
```

**Purpose**: Selects and stores references to important DOM elements for easy manipulation.<br>
**How It Works**: Utilizes `document.getElementById` to get elements by their ID, allowing interaction with the chat interface.

### Typing Indicator Setup

```javascript
const typingIndicator = document.createElement("div");
typingIndicator.classList.add("typing-indicator");
typingIndicator.textContent = "Partner is typing...";
typingIndicator.style.display = "none";
messages.appendChild(typingIndicator);
```

**Purpose**: Creates a typing indicator to show when the chat partner is typing.<br>
**How It Works**: A `<div>` element is created and styled. It is initially hidden and appended to the `messages` container. It can be shown or hidden based on events from the server.

### State Variables

```javascript
let typingTimeout;
let isSearchingForPartner = false;
```

**Purpose**: Manages state within the client.
- `typingTimeout`: Tracks the timeout for hiding the typing indicator.
- `isSearchingForPartner`: Tracks whether the client is currently searching for a new chat partner.

**How It Works**: These variables are updated based on user actions and server events to maintain the current state of the chat session.

### Event Listeners

```javascript
sendButton.addEventListener("click", sendMessage);
skipButton.addEventListener("click", skipPartner);
messageInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    sendMessage();
  } else if (!isSearchingForPartner) {
    socket.emit("typing");
  }
});
```

**Purpose**: Listens for user interactions and triggers appropriate actions.<br>
**How It Works**:
- `sendButton`: Sends a message when clicked.
- `skipButton`: Skips the current partner when clicked.
- `messageInput`: Sends a message on Enter key press or emits a "typing" event on other key presses.

### Socket Event Handlers

```javascript
socket.on("message", (msg) => {
  displayMessage(msg, "theirs");
  hideTypingIndicator();
});

socket.on("partnerFound", () => {
  clearChat();
  displayMessage("Oh, we’ve found a new buddy for you. Start chatting with them!", "system");
  hideTypingIndicator();
  isSearchingForPartner = false;
  messageInput.placeholder = "Type a message...";
});

socket.on("partnerDisconnected", () => {
  displayMessage("Oops, your buddy has left you. We are finding another one", "system");
  hideTypingIndicator();
  skipPartner();
  isSearchingForPartner = true;
  messageInput.placeholder = "Wait for a new partner";
});

socket.on("noPartner", () => {
  displayMessage("There are no new buddies available right now. Please wait for someone to connect...", "system");
  hideTypingIndicator();
  isSearchingForPartner = true;
  messageInput.placeholder = "Wait for a new partner";
});

socket.on("typing", () => {
  if (!isSearchingForPartner) {
    showTypingIndicator();
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(hideTypingIndicator, 10000);
  }
});
```

**Purpose**: Handles incoming events from the server and updates the client UI accordingly.<br>
**How It Works**:
- `message`: Displays the received message from the chat partner.
- `partnerFound`: Clears the chat and notifies the user of a new partner.
- `partnerDisconnected`: Notifies the user when the partner disconnects and searches for a new one.
- `noPartner`: Alerts the user that no partners are available and waits.
- `typing`: Shows a typing indicator when the partner is typing.

### Message Functions

```javascript
function sendMessage() {
  if (!isSearchingForPartner) {
    const msg = messageInput.value.trim();
    if (msg) {
      socket.emit("message", { text: msg, from: "mine" });
      displayMessage(msg, "mine");
      messageInput.value = "";
      hideTypingIndicator();
    }
  }
}

// Function to skip the current partner
function skipPartner() {
  socket.emit("skip");
}

// Function to display a message in the chat window
function displayMessage(msg, type) {
  const div = document.createElement("div");
  div.classList.add("message");
  if (type === "mine") {
    div.classList.add("mine");
    div.textContent = `You: ${msg}`;
  } else if (type === "theirs") {
    div.classList.add("theirs");
    div.textContent = msg;
  } else {
    div.classList.add("system");
    div.textContent = msg;
  }
  messages.insertBefore(div, typingIndicator);
  messages.scrollTop = messages.scrollHeight;
}

// Function to show the typing indicator
function showTypingIndicator() {
  typingIndicator.style.display = "block";
}

// Function to hide the typing indicator
function hideTypingIndicator() {
  typingIndicator.style.display = "none";
}

// Function to clear the chat window, preserving system messages
function clearChat() {
  Array.from(messages.children).forEach((child) => {
    if (child !== typingIndicator) {
      messages.removeChild(child);
    }
  });
}
```

**Purpose**: Provides utility functions for various actions in the chat.<br>
**How It Works**:
- `sendMessage`: Sends the message to the server and displays it locally.
- `skipPartner`: Sends a skip request to the server to find a new partner.
- `displayMessage`: Adds a message to the chat window based on the type (`mine`, `theirs`, or `system`).
- `showTypingIndicator` and `hideTypingIndicator`: Controls the visibility of the typing indicator.
- `clearChat`: Clears all chat messages except for the typing indicator.
---

## server.js

`server.js` handles the server-side logic of the chat application. It manages user connections, pairing, and communication between clients.

### Initialization

```javascript
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
```

**Purpose**: Sets up the server and integrates Socket.IO for WebSocket communication.<br>
**How It Works**:
- Initializes Express, HTTP server, and Socket.IO.
- Express serves static files from the `public` directory.

### Middleware

```javascript
app.use(express.static("public"));
```

**Purpose**: Serves static files (like `index.html`, `client.js`, and CSS) to clients.<br>
**How It Works**: Uses Express's static middleware to serve files from the "public" directory.

### State Management

```javascript
let waitingUsers = [];
let onlineUsers = 0;
```

**Purpose**: Tracks the state of connected users.
- `waitingUsers`: An array of users waiting to be paired.
- `onlineUsers`: A count of currently connected users (not visible on the page).

### Socket.IO Event Handlers

```javascript
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);
  onlineUsers++;
  io.emit("updateUserCount", onlineUsers);

  socket.on("message", (msg) => {
    if (socket.partner) {
      socket.partner.emit("message", msg.text);
    }
  });

  socket.on("typing", () => {
    if (socket.partner) {
      socket.partner.emit("typing");
    }
  });

  socket.on("skip", () => {
    if (socket.partner) {
      socket.partner.emit("partnerDisconnected");
      socket.partner.partner = null;
      socket.partner = null;
    }
    matchUser(socket);
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected:", socket.id);
    onlineUsers--;
    io.emit("updateUserCount", onlineUsers);
    if (socket.partner) {
      socket.partner.emit("partnerDisconnected");
      socket.partner.partner = null;
    }
    waitingUsers = waitingUsers.filter((user) => user !== socket);
  });

  matchUser(socket);
});
```

**Purpose**: Manages client-server communication.
- `connection`: Triggered when a new client connects. Increases the `onlineUsers` count and tries to match the user.
- `message`: Forwards messages to the connected chat partner.
- `typing`: Notifies the partner that the user is typing.
- `skip`: Disconnects the current partner and searches for a new one.
- `disconnect`: Cleans up when a user disconnects, including notifying partners and removing them from the waiting list.

### Partner Functions

```javascript
function matchUser(socket) {
  if

 (waitingUsers.length > 0) {
    let partner = waitingUsers.pop();
    if (partner === socket) {
      waitingUsers.push(partner);
      socket.emit("noPartner");
    } else {
      socket.partner = partner;
      partner.partner = socket;
      socket.emit("partnerFound");
      partner.emit("partnerFound");
    }
  } else {
    waitingUsers.push(socket);
    socket.emit("noPartner");
  }
}
```

**Purpose**: Matches users who are waiting for a chat partner.<br>
**How It Works**:
- Checks if there are any users waiting.
- If a user is available, pairs them with the current socket.
- If no users are available, adds the current socket to the `waitingUsers` list.

### Server Start

```javascript
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
```

**Purpose**: Starts the server on the specified port.<br>
**How It Works**: Uses the environment variable `PORT` or defaults to 3000. Listens for incoming connections and logs a message when the server is ready.

## nsfw.py

`nsfw.py` is a Flask-based application designed to check whether uploaded images contain NSFW content. It uses the `opennsfw2` library for image classification.

### Initialization

```python

from flask import Flask, request, jsonify
import opennsfw2 as n2
import os

app = Flask(__name__)

```

<p><strong>Purpose</strong>: Sets up the Flask application and imports necessary libraries.<br>
<strong>How It Works</strong>:
<ul>
<li><code>Flask</code>: Initializes the Flask application.</li>
<li><code>opennsfw2</code>: Imports the NSFW classification model.</li>
<li><code>os</code>: Handles file system operations, such as saving and deleting files.</li>
</ul></p>

### Route for Checking NSFW Images

```python

# Route for checking NSFW images
@app.route('/check_nsfw', methods=['POST'])
def check_nsfw():
    if 'image' not in request.files:
        return jsonify({"error": "No image part"}), 400
    image_file = request.files['image']
    if image_file.filename == '':
        return jsonify({"error": "No selected image"}), 400
    temp_path = os.path.join('temp', image_file.filename)
    image_file.save(temp_path)
    check = round(n2.predict_image(temp_path))
    os.remove(temp_path)
    result = 1 if check > 0 else 0
    return jsonify({"nsfw": result})

```

<p><strong>Purpose</strong>: Defines an endpoint to upload an image and check if it contains NSFW content.<br>
<strong>How It Works</strong>:
<ul>
<li><code>@app.route('/check_nsfw', methods=['POST'])</code>: Specifies the route and method for the image check endpoint.</li>
<li>Checks if an image file is present in the request and if a file is selected.</li>
<li>Saves the image temporarily to the <code>temp</code> directory.</li>
<li>Uses the <code>opennsfw2</code> library to predict if the image is NSFW.</li>
<li>Deletes the temporary image file after processing.</li>
<li>Returns a JSON response indicating whether the image is NSFW (1) or not (0).</li>
</ul></p>

### Flask Application Runner

```python
# Run the Flask application
if __name__ == '__main__':
    if not os.path.exists('temp'):
        os.makedirs('temp')
    app.run(debug=True)
```

<p><strong>Purpose</strong>: Runs the Flask application and sets up the necessary directory for temporary files.<br>
<strong>How It Works</strong>:
<ul>
<li>Checks if the <code>temp</code> directory exists and creates it if not.</li>
<li>Starts the Flask server in debug mode, allowing you to see detailed error messages and automatically reload the server on code changes.</li>
</ul></p>

---
