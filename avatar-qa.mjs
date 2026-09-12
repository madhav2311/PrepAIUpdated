export default async function run(page, ui) {
  const result = {};
  // 1. Sign up a fresh test user
  await page.goto("http://localhost:3000/signup");
  await page.waitForTimeout(1000);
  const snap = await ui.snapshot();
  result.signupForm = /Full Name/i.test(snap);

  const nameRef = snap.match(/@(e\d+) textbox ".*[Ff]ull [Nn]ame.*"/)?.[1];
  // fallback: fill by placeholder
  await page.locator('input[type="text"]').first().fill("Test Avatar User");
  await page
    .locator('input[type="email"]')
    .first()
    .fill(`avtest${Date.now()}@test.dev`);
  await page.locator('input[type="password"]').first().fill("secret123");
  await page.locator('button[type="submit"]').click();
  await page.waitForURL("**/dashboard", { timeout: 15000 }).catch(() => {});
  result.afterSignupUrl = page.url();

  // 2. Go to profile, upload an avatar via the file input
  await page.goto("http://localhost:3000/profile");
  await page.waitForTimeout(1200);

  // Build a tiny valid PNG in-page and set it on the file input
  const dataUrl = await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext("2d");
    const g = ctx.createLinearGradient(0, 0, 512, 512);
    g.addColorStop(0, "#ff8a00");
    g.addColorStop(1, "#e52e71");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 220px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("T", 256, 340);
    return c.toDataURL("image/png");
  });
  result.dummyDataUrlLength = dataUrl.length;

  const b64 = dataUrl.split(",")[1];
  const file = await page.evaluateHandle(async (b) => {
    const res = await fetch(`data:image/png;base64,${b}`);
    return await res.blob();
  }, b64);
  const dt = await page.evaluateHandle((blob) => {
    return new DataTransfer();
  }, file);
  // Simpler: write blob to input via locator.setInputFiles with a temp file instead
  const fs = await import("fs");
  const path = "C:/Users/betta/OneDrive/Desktop/PREPAI/avatar-test.png";
  fs.writeFileSync(path, Buffer.from(b64, "base64"));
  await page.locator("#avatar-upload").setInputFiles(path);

  // Wait for the preview to show the data URL
  await page
    .waitForFunction(
      () => {
        const img = document.querySelector('img[alt="Profile picture"]');
        return img && (img.src || "").startsWith("data:image");
      },
      { timeout: 8000 },
    )
    .catch(() => {});
  result.previewIsDataUrl = await page.evaluate(() => {
    const img = document.querySelector('img[alt="Profile picture"]');
    return img ? img.src.slice(0, 22) : null;
  });

  // 3. Save
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(2000);
  result.saveError = await page.evaluate(() => {
    const spans = [...document.querySelectorAll("span")];
    const err = spans.find((s) => s.className.includes("text-rose"));
    return err ? err.textContent : null;
  });
  result.savedBadge = await page.evaluate(() =>
    document.body.innerText.includes("Saved!"),
  );

  // 4. Verify persistence from the server
  const serverProfile = await page.evaluate(async () => {
    const r = await fetch("/api/profile", { cache: "no-store" });
    const d = await r.json();
    return {
      hasAvatar: !!d?.profile?.avatar,
      avatarPrefix: (d?.profile?.avatar || "").slice(0, 22),
      username: d?.profile?.username,
      error: d?.error,
    };
  });
  result.serverProfile = serverProfile;

  // 5. Check the header badge shows the avatar img
  await page.goto("http://localhost:3000/dashboard");
  await page.waitForTimeout(2500);
  result.headerAvatar = await page.evaluate(() => {
    const btn = document.querySelector('button[title="Your profile"]');
    if (!btn) return "no badge button";
    const img = btn.querySelector("img");
    const div = btn.querySelector("div");
    if (img) return "img:" + img.src.slice(0, 22);
    return "fallback:" + (div ? div.textContent.trim() : "nothing");
  });

  // 6. Reload the profile page and see if the picture round-trips
  await page.goto("http://localhost:3000/profile");
  await page.waitForTimeout(1500);
  result.profileReloadAvatar = await page.evaluate(() => {
    const img = document.querySelector('img[alt="Profile picture"]');
    return img ? "img:" + img.src.slice(0, 22) : "fallback placeholder";
  });

  return result;
}
