require("dotenv").config();
const Redis = require("ioredis");

const redis = new Redis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || "Casper",
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

redis.on("connect", () => console.log("✅ Redis connected"));
redis.on("ready", () => console.log("⚡ Redis ready and authenticated"));
redis.on("error", (err) => console.error("❌ Redis error:", err));

module.exports = redis;