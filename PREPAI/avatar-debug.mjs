 const BASE = "http://localhost:3000";
const email = `dbg${Date.now()}@test.dev`;

// tiny 1x1 png data url
const avatar =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const jar = [];
const fetchB = (url, opts = {}) => {
  opts.headers = { ...(opts.headers || {}), Cookie: jar.join("; ") };
  return fetch(BASE + url, opts).then((res) => {
    const set = res.headers.getSetCookie?.() ?? [];
    for (const c of set) jar.push(c.split(";")[0]);
    return res;
  });
};

const log = async (label, res) => {
  const t = await res.text();
  console.log(`--- ${label}: ${res.status}`);
  console.log(t.slice(0, 400));
};

// signup
const su = await fetchB("/api/auth", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    action: "signup",
    name: "Debug User",
    email,
    password: "secret123",
  }),
});
await log("signup", su);

// POST profile with avatar
const post = await fetchB("/api/profile", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ avatar, username: "dbguser" }),
});
await log("POST /api/profile", post);

// GET profile
const get = await fetchB("/api/profile", { cache: "no-store" });
const gText = await get.text();
console.log(`--- GET /api/profile: ${get.status}`);
console.log(gText.slice(0, 300));
const g = JSON.parse(gText);
console.log(
  "avatar stored?",
  !!g?.profile?.avatar,
  "len",
  (g?.profile?.avatar || "").length,
);
