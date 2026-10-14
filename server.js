// Stand-alone server for running the service outside Vercel (e.g. locally or in a container).
// Copyright (C) 2026 Scryway. AGPL-3.0-or-later (see LICENSE).
//
//   PORT=8787 node server.js

import http from "node:http";
import { computeHandler, info, sourceRedirect } from "./lib/http.js";

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/compute" || url.pathname === "/api/compute") {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > 64 * 1024) req.destroy();
    });
    req.on("end", () => {
      req.body = data;
      computeHandler(req, res);
    });
    return;
  }
  if (url.pathname === "/source") return sourceRedirect(req, res);
  return info(req, res);
});

const port = Number(process.env.PORT ?? 8787);
server.listen(port, () => console.log(`scryway-ephemeris on http://localhost:${port}`));
