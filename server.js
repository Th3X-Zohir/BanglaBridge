const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const clients = {};
const adminClients = new Set(); // Store admin connections
const restrictedUsernames = [
  "ADMINISTRATOR",
  "H3ker",
  "jihan",
  "Jihan",
  "Zohir Rayhan",
  "Zohir",
  "Rayhan",
  "zohir",
  "rayhan",
  "ZOHIR RAYHAN",
  "zohir rayhan",
  "ZOHIR",
  "RAYHAN",
  "zOHIR",
  "rAYHAN",
  "JIHAN",
  "Jihan",
  "JiHan",
  "JIhan",
  "JihAn",
  "JIHAAN",
  "jihaan",
  "Jihaan",
  "zOHiR",
  "RAyhan",
  "ZOhir RAYhan",
  "zOHiR rAYHan",
  "ZoHiR",
  "RAYhAN",
  "Jihan123",
  "Jihan_01",
  "Zohir123",
  "Rayhan2024",
];

const ADMIN_PASSWORD = "08052024";

wss.on("connection", (ws, req) => {
  const ipAddress =
    req.headers["x-forwarded-for"] || req.connection.remoteAddress;
  console.log("New connection established from IP:", ipAddress);

  ws.on("message", (message) => {
    const data = JSON.parse(message);
    console.log("Received message from IP:", ipAddress, "Data:", data);

    switch (data.type) {
      case "join":
        if (restrictedUsernames.includes(data.name)) {
          ws.send(
            JSON.stringify({
              type: "error",
              message: "This username is restricted.",
            })
          );
          ws.close();
          return;
        }
        if (
          clients[data.room] &&
          clients[data.room].some((client) => client.name === data.name)
        ) {
          ws.send(
            JSON.stringify({
              type: "error",
              message: "This username is already taken in the room.",
            })
          );
          ws.close();
          return;
        }
        if (!clients[data.room]) {
          clients[data.room] = [];
        }
        clients[data.room].push({ name: data.name, ws, messages: [] });
        console.log(`${data.name} joined room ${data.room}`);
        broadcastRoomData(data.room);
        broadcastToAdmins();
        notifyRoom(data.room, `${data.name} has joined the room.`, "join");
        break;
      case "message":
        if (clients[data.room]) {
          console.log(`Broadcasting message to room ${data.room}`);
          clients[data.room].forEach((client) => {
            client.ws.send(
              JSON.stringify({
                name: data.name,
                message: data.message,
                room: data.room,
              })
            );
            client.messages.push(`${data.name}: ${data.message}`);
          });
          broadcastToAdmins(data.room, data.name, data.message);
        }
        break;
      case "admin":
        if (data.password === "08052024") {
          adminClients.add(ws);
          sendAdminRooms(ws);
        } else {
          ws.send(
            JSON.stringify({
              type: "adminError",
              message: "Incorrect admin password.",
            })
          );
        }
        break;
      case "adminJoin":
        if (data.password === "08052024") {
          if (!clients[data.room]) {
            clients[data.room] = [];
          }
          clients[data.room].push({ name: data.name, ws, messages: [] });
          console.log(`${data.name} joined room ${data.room} as admin`);
          broadcastRoomData(data.room);
          notifyRoom(data.room, `${data.name} has joined the room.`);
        } else {
          ws.send(
            JSON.stringify({
              type: "adminError",
              message: "Incorrect admin password.",
            })
          );
        }
        break;
      case "removeUser":
        if (data.password === "08052024") {
          removeUserFromRoom(data.room, data.name);
        }
        break;
    }
  });

  ws.on("close", () => {
    console.log("Connection closed");
    adminClients.delete(ws);
    Object.keys(clients).forEach((room) => {
      const index = clients[room].findIndex((client) => client.ws === ws);
      if (index !== -1) {
        const clientName = clients[room][index].name;
        clients[room].splice(index, 1);
        broadcastRoomData(room);
        notifyRoom(room, `${clientName} has left the room.`, "system");
        broadcastToAdmins();
        if (clients[room].length === 0) {
          delete clients[room];
        }
      }
    });
  });
});

function broadcastRoomData(room) {
  const roomData = {
    type: "roomData",
    users: clients[room].map((client) => client.name),
    count: clients[room].length,
  };
  clients[room].forEach((client) => {
    client.ws.send(JSON.stringify(roomData));
  });
}

function notifyRoom(room, message, type = "system") {
  clients[room].forEach((client) => {
    client.ws.send(
      JSON.stringify({
        name: "System",
        message: message,
        room: room,
        type: type,
      })
    );
  });
}

function sendAdminRooms(ws) {
  const rooms = Object.keys(clients).map((room) => ({
    name: room,
    count: clients[room].length,
    users: clients[room].map((client) => ({
      name: client.name,
      messages: client.messages,
    })),
  }));

  ws.send(
    JSON.stringify({
      type: "adminRooms",
      rooms: rooms,
    })
  );
}

function broadcastToAdmins(room = null, name = null, message = null) {
  adminClients.forEach((adminWs) => {
    if (room && name && message) {
      adminWs.send(
        JSON.stringify({
          type: "updateChat",
          room: room,
          name: name,
          message: message,
        })
      );
    } else {
      sendAdminRooms(adminWs);
    }
  });
}

function removeUserFromRoom(room, name) {
  if (clients[room]) {
    const clientIndex = clients[room].findIndex(
      (client) => client.name === name
    );
    if (clientIndex !== -1) {
      clients[room][clientIndex].ws.close();
      clients[room].splice(clientIndex, 1);
      notifyRoom(room, `ADMIN Removed ${name}`, "kick");
      broadcastRoomData(room);
      broadcastToAdmins();
      if (clients[room].length === 0) {
        delete clients[room];
      }
    }
  }
}

app.use(express.static("public"));

// Admin page route
app.get("/bangladesh", (req, res) => {
  res.sendFile(__dirname + "/public/admin.html");
});

server.listen(4957, () => {
  console.log("Server is listening on port 4957");
});
