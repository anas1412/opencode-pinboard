#!/usr/bin/env bun
import { startServer } from "./index";

const PORT = parseInt(process.env.OPENDEV_PORT || "3000", 10);

startServer(PORT).catch((err) => {
  console.error("Failed to start OpenDev:", err);
  process.exit(1);
});
