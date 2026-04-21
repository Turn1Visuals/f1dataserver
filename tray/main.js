const { app, Tray, Menu, shell, nativeImage, dialog } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const http = require("http");
const fs = require("fs");

const SERVER_URL = "http://localhost:5320";
const IS_PACKAGED = app.isPackaged;

// In packaged mode, data dir (sessions, token, chrome profile) lives in userData
const dataDir = app.getPath("userData");
const envFile = IS_PACKAGED ? path.join(dataDir, ".env") : path.join(__dirname, "../.env");

let tray = null;
let serverProcess = null;
let serverRunning = false;

app.setName("F1 Data Server");
app.dock?.hide();

// Only allow one instance
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

// --- First-run: ensure .env exists in userData ---
function ensureEnv() {
  if (!IS_PACKAGED) return true;
  if (fs.existsSync(envFile)) return true;

  const result = dialog.showMessageBoxSync({
    type: "info",
    title: "F1 Data Server — First Run",
    message: "No .env file found.\n\nPlease select your .env file to configure the database connection.",
    buttons: ["Select .env file", "Quit"],
  });

  if (result === 1) { app.quit(); return false; }

  const selected = dialog.showOpenDialogSync({
    title: "Select your .env file",
    filters: [{ name: "Env files", extensions: ["env"] }],
    properties: ["openFile"],
  });

  if (!selected || selected.length === 0) { app.quit(); return false; }

  fs.copyFileSync(selected[0], envFile);
  return true;
}

// --- Server health check ---
function checkServer() {
  return new Promise((resolve) => {
    http.get(`${SERVER_URL}/health`, (res) => {
      resolve(res.statusCode === 200);
    }).on("error", () => resolve(false));
  });
}

// --- Write to log ---
const logFile = path.join(dataDir, "server.log");
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(logFile, line);
}

// --- Start server ---
function startServer() {
  if (serverProcess) return;

  let cmd, args, cwd;

  if (IS_PACKAGED) {
    const serverBundle = path.join(process.resourcesPath, "server.cjs");
    cmd = `node "${serverBundle}"`;
    args = [];
    cwd = process.resourcesPath;
    log(`Starting packaged server: ${cmd} in ${cwd}`);
    log(`envFile: ${envFile} exists=${fs.existsSync(envFile)}`);
    log(`serverBundle exists=${fs.existsSync(serverBundle)}`);
  } else {
    cmd = "npm";
    args = ["run", "dev"];
    cwd = path.join(__dirname, "..");
    log(`Starting dev server in ${cwd}`);
  }

  const env = {
    ...process.env,
    NODE_PATH: IS_PACKAGED ? path.join(process.resourcesPath, "node_modules") : undefined,
    DOTENV_CONFIG_PATH: IS_PACKAGED ? envFile : undefined,
    F1_DATA_DIR: IS_PACKAGED ? dataDir : undefined,
    PUBLIC_DIR: IS_PACKAGED ? path.join(process.resourcesPath, "public") : undefined,
  };

  try {
    serverProcess = spawn(cmd, args, {
      cwd,
      shell: true,
      windowsHide: true,
      env,
    });
  } catch (e) {
    log(`spawn failed: ${e.message}`);
    dialog.showErrorBox("F1 Data Server", `Failed to start server:\n${e.message}`);
    return;
  }

  serverProcess.stdout?.on("data", (d) => fs.appendFileSync(logFile, d));
  serverProcess.stderr?.on("data", (d) => fs.appendFileSync(logFile, d));

  serverProcess.on("error", (e) => {
    log(`server process error: ${e.message}`);
    dialog.showErrorBox("F1 Data Server", `Server error:\n${e.message}`);
  });

  serverProcess.on("exit", (code) => {
    log(`server exited with code ${code}`);
    serverProcess = null;
    serverRunning = false;
    updateMenu();
  });

  // Poll until server responds
  const poll = setInterval(async () => {
    const up = await checkServer();
    if (up) {
      clearInterval(poll);
      serverRunning = true;
      updateMenu();
    }
  }, 1000);

  updateMenu();
}

// --- Stop server ---
async function stopServer() {
  try {
    await fetch(`${SERVER_URL}/shutdown`, { method: "POST" });
    await new Promise(r => setTimeout(r, 500));
  } catch {
    serverProcess?.kill();
  }
  serverProcess = null;
  serverRunning = false;
  updateMenu();
}

// --- Build tray menu ---
function updateMenu() {
  const menu = Menu.buildFromTemplate([
    {
      label: serverRunning ? "● Running on :5320" : serverProcess ? "○ Starting..." : "○ Stopped",
      enabled: false,
    },
    { type: "separator" },
    {
      label: "Start Server",
      enabled: !serverRunning,
      click: startServer,
    },
    {
      label: "Stop Server",
      enabled: serverRunning,
      click: stopServer,
    },
    { type: "separator" },
    {
      label: "Open UI",
      enabled: serverRunning,
      click: () => shell.openExternal(SERVER_URL),
    },
    { type: "separator" },
    {
      label: "Quit",
      click: async () => {
        if (serverProcess) await stopServer();
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(menu);
  tray.setToolTip(serverRunning ? "F1 Data Server — running" : "F1 Data Server — stopped");
}

// --- App ready ---
app.whenReady().then(() => {
  log(`App ready. IS_PACKAGED=${IS_PACKAGED} dataDir=${dataDir}`);
  if (!ensureEnv()) return;
  log("Env OK, starting tray...");

  const iconPath = IS_PACKAGED
    ? path.join(process.resourcesPath, "icon.png")
    : path.join(__dirname, "icon.png");

  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);
  tray.setToolTip("F1 Data Server");

  tray.on("click", () => {
    if (serverRunning) shell.openExternal(SERVER_URL);
    else tray.popUpContextMenu();
  });

  updateMenu();
  startServer();
});

app.on("window-all-closed", (e) => e.preventDefault());
