const fs = require("fs");
const zlib = require("zlib");
const { execFileSync } = require("child_process");
const names = ["parts/part00", "parts/part01", "parts/part02", "parts/part03"];
const b64 = names.map((name) => fs.readFileSync(name, "utf8")).join("");
const compressed = Buffer.from(b64, "base64");
fs.writeFileSync("/tmp/artistos-runtime.tar", zlib.brotliDecompressSync(compressed));
execFileSync("tar", ["-xf", "/tmp/artistos-runtime.tar", "-C", process.cwd()], { stdio: "inherit" });
execFileSync("npx", ["next", "build"], { stdio: "inherit", env: process.env });
