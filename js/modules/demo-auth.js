const DEMO_AUTH_SESSION_KEY = "cv_demo_authorized";
const DEMO_PASSWORD_SHA256 = "ed3b8bcea85db098a990a440b9edd40a5f6c024b26477db087de2c9880095877";

let authorizedInMemory = false;
let pendingAuthorization = null;

function sessionGet(key) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function sessionSet(key, value) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // In-memory authorization still supports browsers that block sessionStorage.
  }
}

function sessionRemove(key) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Nothing else is required when storage is unavailable.
  }
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function isDemoAuthorized() {
  return authorizedInMemory || sessionGet(DEMO_AUTH_SESSION_KEY) === "true";
}

export async function authorizeDemoPassword(password) {
  if (!globalThis.crypto?.subtle) return false;
  const matches = await sha256(String(password || "")) === DEMO_PASSWORD_SHA256;
  if (matches) {
    authorizedInMemory = true;
    sessionSet(DEMO_AUTH_SESSION_KEY, "true");
  }
  return matches;
}

export function revokeDemoAuthorization() {
  authorizedInMemory = false;
  sessionRemove(DEMO_AUTH_SESSION_KEY);
}

function ensureDialogStyles() {
  if (document.getElementById("demo-auth-styles")) return;
  const style = document.createElement("style");
  style.id = "demo-auth-styles";
  style.textContent = `
    .demo-auth-dialog {
      width: min(92vw, 440px);
      padding: 0;
      border: 1px solid rgba(167, 230, 82, 0.26);
      border-radius: 22px;
      color: #f4f7f5;
      background: #14231e;
      box-shadow: 0 28px 80px rgba(0, 0, 0, 0.55);
    }
    .demo-auth-dialog::backdrop { background: rgba(3, 10, 8, 0.78); backdrop-filter: blur(5px); }
    .demo-auth-dialog__form { display: grid; gap: 18px; padding: 28px; }
    .demo-auth-dialog__eyebrow { margin: 0; color: #a7e652; font-size: 0.78rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
    .demo-auth-dialog h2 { margin: 5px 0 7px; font: 600 1.55rem/1.2 "Space Grotesk", sans-serif; }
    .demo-auth-dialog__description { margin: 0; color: #9bb8ae; line-height: 1.55; }
    .demo-auth-dialog__field { display: grid; gap: 8px; color: #dce8e3; font-weight: 600; }
    .demo-auth-dialog__field input {
      width: 100%; box-sizing: border-box; padding: 12px 14px; border: 1px solid #355047;
      border-radius: 12px; color: #fff; background: #0d1a16; font: inherit; outline: none;
    }
    .demo-auth-dialog__field input:focus { border-color: #a7e652; box-shadow: 0 0 0 3px rgba(167, 230, 82, 0.13); }
    .demo-auth-dialog__error { min-height: 1.25em; margin: -8px 0 0; color: #ff9e92; font-size: 0.88rem; }
    .demo-auth-dialog__actions { display: flex; justify-content: flex-end; gap: 10px; }
    .demo-auth-dialog__button { padding: 10px 18px; border: 1px solid #355047; border-radius: 999px; color: #f4f7f5; background: #1d2d27; font: 700 0.9rem/1 "Inter", sans-serif; cursor: pointer; }
    .demo-auth-dialog__button--primary { border-color: #a7e652; color: #102016; background: #a7e652; }
    .demo-auth-dialog__button:disabled { cursor: wait; opacity: 0.65; }
  `;
  document.head.appendChild(style);
}

function ensureDialog() {
  let dialog = document.getElementById("demo-auth-dialog");
  if (dialog) return dialog;

  ensureDialogStyles();
  dialog = document.createElement("dialog");
  dialog.id = "demo-auth-dialog";
  dialog.className = "demo-auth-dialog";
  dialog.setAttribute("aria-labelledby", "demo-auth-title");
  dialog.innerHTML = `
    <form class="demo-auth-dialog__form" method="dialog">
      <header>
        <p class="demo-auth-dialog__eyebrow">Restricted demonstration tool</p>
        <h2 id="demo-auth-title">Enter demonstration password</h2>
        <p class="demo-auth-dialog__description">Authorization is required before simulated telemetry and demo controls can be enabled.</p>
      </header>
      <label class="demo-auth-dialog__field">
        Password
        <input id="demo-auth-password" type="password" autocomplete="current-password" required>
      </label>
      <p class="demo-auth-dialog__error" id="demo-auth-error" role="alert" aria-live="polite"></p>
      <div class="demo-auth-dialog__actions">
        <button class="demo-auth-dialog__button" type="button" data-demo-auth-cancel>Cancel</button>
        <button class="demo-auth-dialog__button demo-auth-dialog__button--primary" type="submit">Unlock demo</button>
      </div>
    </form>
  `;
  document.body.appendChild(dialog);
  return dialog;
}

export function requestDemoAuthorization() {
  if (isDemoAuthorized()) return Promise.resolve(true);
  if (pendingAuthorization) return pendingAuthorization;

  const dialog = ensureDialog();
  const form = dialog.querySelector("form");
  const passwordInput = dialog.querySelector("#demo-auth-password");
  const error = dialog.querySelector("#demo-auth-error");
  const submitButton = dialog.querySelector("[type='submit']");
  const cancelButton = dialog.querySelector("[data-demo-auth-cancel]");

  passwordInput.value = "";
  error.textContent = "";

  pendingAuthorization = new Promise((resolve) => {
    const finish = (authorized) => {
      form.removeEventListener("submit", onSubmit);
      cancelButton.removeEventListener("click", onCancel);
      dialog.removeEventListener("cancel", onCancel);
      dialog.removeEventListener("close", onClose);
      pendingAuthorization = null;
      resolve(authorized);
    };

    const closeWithResult = (authorized) => {
      dialog.dataset.authorized = String(authorized);
      dialog.close();
    };

    const onSubmit = async (event) => {
      event.preventDefault();
      submitButton.disabled = true;
      error.textContent = "";
      const authorized = await authorizeDemoPassword(passwordInput.value);
      submitButton.disabled = false;
      if (authorized) closeWithResult(true);
      else {
        error.textContent = "Incorrect password. Please try again.";
        passwordInput.select();
      }
    };

    const onCancel = (event) => {
      event.preventDefault();
      closeWithResult(false);
    };

    const onClose = () => finish(dialog.dataset.authorized === "true");

    dialog.dataset.authorized = "false";
    form.addEventListener("submit", onSubmit);
    cancelButton.addEventListener("click", onCancel);
    dialog.addEventListener("cancel", onCancel);
    dialog.addEventListener("close", onClose);
    dialog.showModal();
    setTimeout(() => passwordInput.focus(), 0);
  });

  return pendingAuthorization;
}
