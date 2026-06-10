const { io } = require("socket.io-client");

const socket = io("http://localhost:5000");

socket.on("connect", () => {
  console.log("Connected to server! ID:", socket.id);
  
  // Join a dummy room
  const testUserId = "dummy-user-123";
  socket.emit("join-user", testUserId);
  console.log("Emitted join-user for", testUserId);
  
  // Also join super admin just to listen to everything
  socket.emit("join-super-admin");
  
  // Now we need to ask the server to emit something.
  // Since we don't have an auth token for the HTTP route, we can just listen to 'notification'
  // But we can't easily trigger the test route.
});

socket.on("notification", (data) => {
  console.log("RECEIVED NOTIFICATION:", data);
});

socket.on("admin-activity", (data) => {
  console.log("RECEIVED ADMIN ACTIVITY:", data);
});

socket.on("connect_error", (err) => {
  console.log("Connection error:", err.message);
});

setTimeout(() => {
  console.log("Test finished.");
  process.exit(0);
}, 10000);
