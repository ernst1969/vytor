// Run against an Expo static export. API responses are mocked; no user data is touched.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const root = resolve(process.env.EXPO_EXPORT_DIR ?? "/tmp/vytor-layout-export");
const output = resolve(process.env.UI_SCREENSHOT_DIR ?? "/tmp/vytor-layout-screenshots");
await mkdir(output, { recursive: true });
const server = createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  let file = resolve(root, `.${pathname}`);
  if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
  if (!extname(file)) file = pathname === "/" ? resolve(root, "index.html") : file + ".html";
  try {
    const data = await readFile(file);
    res.setHeader("Content-Type", { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".json": "application/json" }[extname(file)] ?? "application/octet-stream");
    res.end(data);
  } catch { res.writeHead(404).end(); }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const address = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const exercises = [
  { id: 1, name: "Barbell Back Squat", measurementType: "WEIGHT_REPS" },
  { id: 2, name: "Boxing", measurementType: "TIME" },
  { id: 3, name: "Muay Thai", measurementType: "TIME" },
  { id: 4, name: "Running", measurementType: "DISTANCE_TIME" },
  { id: 5, name: "Farmer's Carry", measurementType: "WEIGHT_DISTANCE" },
  { id: 6, name: "Push-Up with a deliberately long exercise name for layout verification", measurementType: "REPS" },
];
const user = { id: 1, username: "layout_test", displayName: "Layout Test", avatarData: null, xp: 120, level: 2, rank: 1, tier: "Bronze", levelStartXp: 100, nextLevelXp: 400 };
const settings = { preferredWeightUnit: "KG", preferredDistanceUnit: "KM", restSeconds: 90, theme: "DARK" };
let mutations = 0;
try {
  for (const width of [320, 344, 360, 390, 768, 1440]) {
    const height = width === 320 ? 568 : width === 344 ? 880 : 900;
    const context = await browser.newContext({ viewport: { width, height } });
    await context.addInitScript(() => { localStorage.setItem("vytor_user_id", "1"); localStorage.setItem("vytor_session_token", "layout-test"); });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const startedAt = new Date(Date.now() - 300000).toISOString();
    let active = { id: 101, userId: 1, revision: 0, notes: "Workout notes remain editable", startedAt, endedAt: null,
      exercises: exercises.map((exercise) => ({ id: exercise.id + 10, exerciseId: exercise.id, exercise, weightUnit: "KG", distanceUnit: "KM", restSeconds: 90, sets: [] })),
      draft: { restEndsAt: null, exercises: exercises.map((exercise) => ({ id: `e${exercise.id}`, workoutExerciseId: exercise.id + 10, exerciseId: exercise.id, name: exercise.name, measurementType: exercise.measurementType, weightUnit: "KG", distanceUnit: "KM", notes: "Brace and keep a controlled tempo", restSeconds: 90,
        previousSets: [{ setNumber: 1, weight: 80, reps: 8, distance: 1, durationSeconds: 83 }],
        sets: ["REGULAR", "WARMUP", "DROP"].map((setType, index) => ({ id: `e${exercise.id}s${index}`, setNumber: index + 1, weight: "85", reps: "8", targetReps: "10", distance: "1.5", durationSeconds: "83", completed: false, setType })) })) } };
    const finished = { ...active, endedAt: new Date().toISOString(), xpEvent: { points: 220 }, exercises: active.exercises.map((item) => ({ ...item, sets: [{ id: item.id * 10, setNumber: 1, weight: 85, reps: 8, distance: null, durationSeconds: null, setType: "REGULAR" }] })) };
    await page.route("**/api/**", async (route) => {
      const req = route.request(), path = new URL(req.url()).pathname;
      let data = null, status = 200;
      if (req.method() === "OPTIONS") data = {};
      else if (path === "/api/health") data = { status: "ok" };
      else if (path === "/api/settings") { if (req.method() === "PATCH") Object.assign(settings, req.postDataJSON()); data = settings; }
      else if (path === "/api/users/1") data = user;
      else if (path === "/api/leaderboard") data = [
        { id: 1, username: "layout_test", rank: 1, level: 2, xp: 120 },
        { id: 2, username: "A_deliberately_long_username_for_layout", rank: 1, level: 2, xp: 120 },
        { id: 3, username: "another_athlete", rank: 3, level: 1, xp: 90 },
      ];
      else if (path === "/api/friends/1") data = [{ id: 2, username: "A_deliberately_long_username_for_layout" }];
      else if (path === "/api/friends/1/requests") data = [];
      else if (path === "/api/friends/1/feed") data = [{ ...finished, user: { id: 2, username: "A_deliberately_long_username_for_layout" } }];
      else if (path === "/api/templates" || path === "/api/workouts/drafts/suspended") data = [];
      else if (path === "/api/workouts/active/current") data = active;
      else if (path === "/api/workouts/101/draft") {
        const body = req.postDataJSON();
        if (body.revision !== active.revision) { status = 409; data = { error: "Conflict" }; }
        else { active = { ...active, draft: body.draft, notes: body.notes, revision: active.revision + 1 }; mutations++; data = { revision: active.revision }; }
      } else if (path === "/api/workouts/1") data = [finished, { ...finished, id: 102, startedAt: new Date(Date.now() - 86400000 - 300000).toISOString(), endedAt: new Date(Date.now() - 86400000).toISOString(), exercises: [{ ...finished.exercises[0], exercise: { id: 20, name: "Biceps Curl", category: "Arms" } }] }];
      else if (path === "/api/workouts/detail/101") data = { ...finished, progress: user, highlights: [] };
      else if (path === "/api/exercises") data = exercises;
      else if (/last-workout$/.test(path)) data = null;
      else if (path === "/api/workouts/101/finish") { active = null; data = { ...finished, earnedXp: 220 }; }
      else if (path === "/api/workouts/101" && req.method() === "DELETE") { active = null; data = { success: true }; }
      else { status = 404; data = { error: `Unmocked ${path}` }; }
      await route.fulfill({ status, json: data, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS" } });
    });
    await page.goto(address);
    const weight = page.getByRole("textbox", { name: "Barbell Back Squat, set 1, weight in kg", exact: true });
    await weight.waitFor();
    await page.getByText("SESSION", { exact: true }).first().waitFor();
    assert.equal(await page.getByText("SESSION", { exact: true }).count(), 2);
    assert.equal(await page.getByText("+ SESSION", { exact: true }).count(), 2);
    const saveResponse = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/workouts/101/draft" && response.request().method() === "PUT");
    await weight.fill("92.5");
    const saved = await saveResponse;
    assert.equal(saved.status(), 200);
    assert.equal(saved.request().postDataJSON().draft.exercises[0].sets[0].weight, "92.5");
    assert.equal(await weight.inputValue(), "92.5");
    const units = await weight.evaluate((input) => { const unit = input.parentElement.lastElementChild; const a = input.getBoundingClientRect(), b = unit.getBoundingClientRect(); return { inputRight: a.right, unitLeft: b.left, unitRight: b.right, parentRight: input.parentElement.getBoundingClientRect().right }; });
    assert.ok(units.inputRight <= units.unitLeft + 1, JSON.stringify(units));
    assert.ok(units.unitRight <= units.parentRight + 1);
    const aligned = await weight.evaluate((input) => {
      const row = input.parentElement.parentElement;
      const table = row.parentElement.parentElement;
      const header = table.firstElementChild;
      return [...row.children].map((cell, index) => { const a = cell.getBoundingClientRect(), b = header.children[index].getBoundingClientRect(); return { deltaX: Math.abs(a.x - b.x), deltaWidth: Math.abs(a.width - b.width) }; });
    });
    assert.ok(aligned.every((cell) => cell.deltaX < 1 && cell.deltaWidth < 1), JSON.stringify(aligned));
    for (const heading of await page.getByText("SESSION", { exact: true }).all()) {
      const bounds = await heading.evaluate((el) => ({ height: el.getBoundingClientRect().height, scroll: el.scrollWidth, width: el.clientWidth }));
      assert.ok(bounds.height < 25 && bounds.scroll <= bounds.width + 1, JSON.stringify(bounds));
    }
    const footer = page.getByRole("button", { name: "Finish Workout", exact: true });
    const discard = page.getByRole("button", { name: "End / Discard", exact: true });
    const [a, b] = await Promise.all([footer.boundingBox(), discard.boundingBox()]);
    assert.ok(a && b && b.x + b.width <= a.x && a.y + a.height <= height);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `horizontal overflow at ${width}`);
    const boxingTime = page.getByRole("textbox", { name: "Boxing, session 1, time", exact: true });
    await boxingTime.fill("123");
    assert.equal(await boxingTime.inputValue(), "00:01:23");
    await page.getByRole("button", { name: "Session 1 options, regular", exact: true }).first().click();
    await page.getByRole("button", { name: "Add another Session", exact: true }).click();
    assert.equal(await page.getByRole("textbox", { name: /Boxing, session \d+, time/ }).count(), 4);
    await page.getByRole("checkbox", { name: "Complete session 1", exact: true }).first().click();
    await weight.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${output}/workout-${width}.png` });
    await footer.click();
    await page.getByText("Finish workout?", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await discard.click();
    await page.getByText("Discard workout?", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    if (width === 320) {
      await discard.click();
      await page.getByRole("button", { name: "Discard", exact: true }).click();
      await page.getByText("START WORKOUT", { exact: true }).waitFor();
    } else {
      await footer.click();
      await page.getByText("Finish workout?", { exact: true }).waitFor();
      const finishing = page.waitForRequest((request) => new URL(request.url()).pathname === "/api/workouts/101/finish");
      await page.getByRole("button", { name: "Finish Workout", exact: true }).last().click();
      const payload = (await finishing).postDataJSON();
      assert.ok(payload.exercises.some((exercise) => exercise.sets.length > 0));
      await page.getByText("Workout complete · 100 base XP", { exact: true }).waitFor();
    }
    await page.goto(`${address}/profile`);
    await page.getByText("RECENT WORKOUTS", { exact: true }).waitFor();
    const maps = page.locator('svg[aria-label$="muscle map"]');
    assert.equal(await maps.count(), 4, "each workout has a front and back thumbnail");
    const tiles = page.locator('[aria-label^="No workout on"], [aria-label^="Open workout from"]');
    assert.equal(await tiles.count(), 14);
    const positions = await tiles.evaluateAll((items) => items.map((item) => Math.round(item.getBoundingClientRect().top)));
    const rows = [...new Set(positions)];
    assert.equal(rows.length, 2);
    for (const top of rows) assert.equal(positions.filter((value) => value === top).length, 7);
    assert.equal(await page.getByText("Biceps Curl", { exact: true }).count(), 0);
    assert.ok(await maps.first().locator("path").count() > 30);
    const frontColors = await maps.nth(0).locator("path").evaluateAll((paths) => paths.map((path) => path.getAttribute("fill")));
    const otherColors = await maps.nth(2).locator("path").evaluateAll((paths) => paths.map((path) => path.getAttribute("fill")));
    assert.notDeepEqual(frontColors, otherColors, "thumbnails reflect each workout individually");
    assert.equal(await page.getByText("Direct", { exact: true }).count(), 0);
    assert.equal(await page.getByText("Female figure", { exact: true }).count(), 0);
    assert.equal(await page.getByLabel(/Workouts on/).count(), 0);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `profile overflow at ${width}`);
    await page.getByText("RECENT WORKOUTS", { exact: true }).evaluate((element) => element.scrollIntoView({ block: "start" }));
    await page.screenshot({ path: `${output}/muscles-${width}.png` });
    await maps.first().locator("../..").screenshot({ path: `${output}/muscle-map-${width}.png` });
    await maps.nth(2).click();
    await page.waitForURL("**/workout-detail?workoutId=101");
    await page.goto(`${address}/settings`);
    await page.getByRole("button", { name: /Rest timer/ }).waitFor();
    assert.equal(await page.getByRole("textbox").count(), 0, "settings fields are initially collapsed");
    await page.getByRole("button", { name: /Rest timer/ }).click();
    await page.getByLabel("Rest minutes", { exact: true }).fill("2");
    await page.getByLabel("Rest seconds", { exact: true }).fill("75");
    await page.getByRole("button", { name: "Save timer", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: /Seconds must be below 60/ }).waitFor();
    await page.getByLabel("Rest seconds", { exact: true }).fill("15");
    await page.getByRole("button", { name: "Save timer", exact: true }).click();
    await page.getByRole("button", { name: /Rest timer 2:15/ }).waitFor();
    assert.equal(settings.restSeconds, 135);
    await page.getByRole("button", { name: /Send feedback Share/ }).click();
    await page.getByLabel("Feedback", { exact: true }).waitFor();
    await page.getByRole("button", { name: /Change password Update/ }).click();
    assert.equal(await page.getByLabel("Feedback", { exact: true }).count(), 0);
    await page.getByLabel("Current password", { exact: true }).waitFor();
    await page.getByRole("button", { name: /Change password Update/ }).click();
    assert.equal(await page.getByRole("textbox").count(), 0);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `settings overflow at ${width}`);
    await page.screenshot({ path: `${output}/settings-${width}.png` });
    await page.goto(address);
    await page.getByText("Ready to train?", { exact: true }).waitFor();
    await page.getByText("20 / 300 XP", { exact: true }).waitFor();
    const quote = await page.getByTestId("home-motivation").textContent();
    await page.setViewportSize({ width: width + 1, height });
    await page.waitForTimeout(100);
    assert.equal(await page.getByTestId("home-motivation").textContent(), quote, "motivation stays stable during re-renders");
    await page.setViewportSize({ width, height });
    assert.equal(await page.getByText("Day streak", { exact: true }).count(), 1);
    assert.equal(await page.getByTestId("home-streak").textContent(), "2");
    assert.equal(await page.getByRole("button", { name: "Open Barbell Back Squat", exact: true }).locator("svg").count(), 0);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `home overflow at ${width}`);
    await page.screenshot({ path: `${output}/home-${width}.png` });
    await page.getByRole("button", { name: "Open Barbell Back Squat", exact: true }).click();
    await page.waitForURL("**/workout-detail?workoutId=101");
    await page.goto(address);
    await page.getByRole("button", { name: "START WORKOUT", exact: true }).click();
    await page.waitForURL("**/workout-setup");
    await page.getByText("FREESTYLE", { exact: true }).first().waitFor();

    await page.goto(`${address}/friends`);
    await page.getByText("Leaderboard", { exact: true }).waitFor();
    const leaders = page.getByRole("button", { name: /rank [13]$/ });
    assert.equal(await leaders.count(), 3);
    assert.equal(await page.getByText("#1", { exact: true }).count(), 2, "ties keep their server ranks");
    const leaderBoxes = await Promise.all((await leaders.all()).map((row) => row.boundingBox()));
    assert.ok(leaderBoxes.every((box) => box && box.width > 0 && Math.abs(box.height - leaderBoxes[0].height) <= 1));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `friends overflow at ${width}`);
    await page.screenshot({ path: `${output}/friends-${width}.png` });
    await page.getByText("Find friends", { exact: true }).first().click();
    await page.getByPlaceholder("Search username...").waitFor();
    if (width === 390) {
      await page.goto(`${address}/settings`);
      await page.getByRole("button", { name: /Appearance Dark/ }).click();
      await page.getByRole("button", { name: "Light", exact: true }).click();
      await page.getByRole("button", { name: /Appearance Light/ }).waitFor();
      assert.equal(settings.theme, "LIGHT");
      await page.screenshot({ path: `${output}/settings-light.png` });
      await page.getByRole("button", { name: /Appearance Light/ }).click();
      await page.getByRole("button", { name: "Dark", exact: true }).click();
      await page.getByRole("button", { name: /Appearance Dark/ }).waitFor();
    }
    if (width === 390) {
      await page.route("**/api/workouts/1", async (route) => {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(Array.from({ length: 5 }, (_, index) => ({ ...finished, id: 201 + index }))) });
      });
      await page.goto(address);
      await page.getByRole("button", { name: "See all", exact: true }).waitFor();
      assert.equal(await page.getByRole("button", { name: "Open Barbell Back Squat", exact: true }).count(), 3);
      await page.getByRole("button", { name: "See all", exact: true }).click();
      assert.equal(await page.getByRole("button", { name: "Open Barbell Back Squat", exact: true }).count(), 5);
      await page.getByRole("button", { name: "Show less", exact: true }).click();
      assert.equal(await page.getByRole("button", { name: "Open Barbell Back Squat", exact: true }).count(), 3);
      let historyReads = 0;
      const dates = await page.evaluate(() => ({
        start: new Date(2026, 9, 1, 11).toISOString(),
        end: new Date(2026, 9, 1, 12).toISOString(),
        beforeMidnight: new Date(2026, 9, 4, 23, 59, 59).getTime(),
      }));
      const lastWorkout = { ...finished, startedAt: dates.start, endedAt: dates.end };
      await page.route("**/api/workouts/1", async (route) => {
        historyReads++;
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([lastWorkout]) });
      });
      await page.clock.install({ time: new Date(dates.beforeMidnight) });
      await page.goto(address);
      await page.getByTestId("home-streak").waitFor();
      await page.waitForFunction(() => document.querySelector('[data-testid="home-streak"]')?.textContent === "1");
      const readsBeforeMidnight = historyReads;
      await page.clock.fastForward(2000);
      await page.waitForFunction(() => document.querySelector('[data-testid="home-streak"]')?.textContent === "0");
      assert.equal(historyReads, readsBeforeMidnight, "midnight recomputes from history without polling");
    }
    assert.deepEqual(errors, [], `browser errors at ${width}`);
    console.log(`PASS ${width}px: workout flow, 14-day tiles, settings, home progress/navigation, stable motivation, rest-day streak, leaderboard ties and overflow`);
    await context.close();
  }
  assert.ok(mutations > 0, "existing draft persistence still runs");
  console.log(`Screenshots: ${output}`);
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
}
