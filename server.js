const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const axios = require("axios");
const FormData = require("form-data");

const app = express();
const server = http.createServer(app);

// Configure Socket.IO with increased maxHttpBufferSize
const io = new Server(server, {
  maxHttpBufferSize: 1e8 // 100 MB
});

app.use(express.static("public"));

let waitingUsers = [];
let onlineUsers = 0;

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);
  onlineUsers++;
  io.emit("updateUserCount", onlineUsers);

  socket.on("message", (msg) => {
    if (socket.partner) {
      if (msg.type === "image") {
        checkNSFW(msg.content)
          .then((isNSFW) => {
            if (!isNSFW) {
              socket.partner.emit("message", msg);
            } else {
              socket.partner.emit("message", {
                type: "image",
                content: msg.content,
                nsfw: true,
              });
            }
          })
          .catch((err) => {
            console.error("NSFW check failed:", err);
            socket.emit("message", {
              type: "system",
              content: "There was an error. Please try again.",
            });
          });
      } else {
        socket.partner.emit("message", msg);
      }
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

function matchUser(socket) {
  if (waitingUsers.length > 0) {
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

// NSFW content filtering feature
function checkNSFW(imageBase64) {
  const buffer = Buffer.from(imageBase64.split(",")[1], "base64");
  const formData = new FormData();
  formData.append("image", buffer, "image.jpg");

  return axios
    .post("http://127.0.0.1:5000/check_nsfw", formData, {
      headers: {
        ...formData.getHeaders(),
      },
    })
    .then((response) => {
      return response.data.nsfw === 1;
    })
    .catch((error) => {
      console.error("Error in NSFW request:", error);
      throw error;
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
