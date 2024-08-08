import { Redis as RedisConnect } from "ioredis";


export const Redis = new RedisConnect()
// export const Redis = new RedisConnect("/tmp/redis.sock")
