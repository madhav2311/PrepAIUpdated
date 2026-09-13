export default async function run(page) {
  await page.evaluate(() => {
    document.documentElement.dataset.palette = "ocean";
  });
  await page.waitForTimeout(400);
  const oceanText = await page.evaluate(() => {
    const el = document.querySelector(".text-orange-400");
    return el ? getComputedStyle(el).color : "none found";
  });
  return { oceanAccentText: oceanText };
}
