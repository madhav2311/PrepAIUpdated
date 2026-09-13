export default async function run(page) {
  const attrs = await page.evaluate(() => {
    const html = document.documentElement;
    const style = getComputedStyle(html);
    return {
      mode: html.dataset.mode || "(none)",
      palette: html.dataset.palette || "(none)",
      accent: style.getPropertyValue("--accent") || "(not set)",
      glassCount: document.querySelectorAll(".glass").length,
      orangeBgCount: document.querySelectorAll('[class*="bg-orange-9"]').length,
      gradientBtnBg: getComputedStyle(document.querySelector("button") || html)
        .backgroundColor,
    };
  });

  // Now switch palette to ocean and check if --accent changes
  await page.evaluate(() => {
    document.documentElement.dataset.palette = "ocean";
  });
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return { accent: style.getPropertyValue("--accent") || "(not set)" };
  });

  return { attrs, after };
}
