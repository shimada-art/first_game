import "dotenv/config";
import { createServer } from "./createServer.js";

const port = Number(process.env["PORT"] ?? 3001);

createServer().listen(port, () => {
  console.log(`souk-el-kdoub server listening on :${port}`);
});
