import { io } from "socket.io-client";
import http from "http";

const socket = io("http://localhost:5000");

socket.on("connect", () => {
  console.log("✅ Connected! Triggering API...");
  
  const testUserId = "test-diag-user";
  socket.emit("join-user", testUserId);
  
  // Make HTTP request to test-notify route
  // We need to bypass auth for the test, or we'll just wait and I'll curl it externally
});

socket.on("notification", (data) => {
  console.log("🔔 RECEIVED NOTIFICATION:", JSON.stringify(data, null, 2));
  process.exit(0);
});

setTimeout(() => process.exit(0), 10000);
