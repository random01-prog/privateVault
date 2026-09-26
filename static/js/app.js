/* ============================================================
   PERSONAL DIARY / MEMORY VAULT
   app.js

   Talks to the Flask backend:
     GET    /api/data
     POST   /api/folders            {name}
     PATCH  /api/folders/<id>       {name}
     DELETE /api/folders/<id>
     POST   /api/items              {folderId, title, content, plainText} (text only)
     PATCH  /api/items/<id>         {title, content, plainText, favorite, trashed}
     DELETE /api/items/<id>
     POST   /api/upload             FormData: folderId, type, title, file
     GET    /api/media/<id>         streams the actual photo/video/voice file
   ============================================================ */


/* ============================================================
   GLOBAL STATE
   ============================================================ */

const THEME_KEY = "personalDiaryTheme";

let state = {
    folders: [],
    items: []
};

let currentFolderId = null;
let currentFilter = "all";
let currentEditingId = null;
let selectedMediaFile = null;
let currentMemoryType = null;


/* ============================================================
   INITIALIZATION
   ============================================================ */

document.addEventListener("DOMContentLoaded", async function () {

    loadTheme();

    setupNavigation();
    setupMobileMenu();
    setupThemeToggle();

    setupFolderButtons();
    setupMemoryButtons();

    setupModals();
    setupEditor();
    setupMedia();

    setupFilters();
    setupSearch();
    setupTrash();

    setupKeyboardShortcuts();
    setupBackButton();

    await refreshData();
    refreshDriveStatus();

    showPage("home");
});


/* ============================================================
   API HELPERS
   ============================================================ */

async function apiGet(url) {
    const res = await fetch(url);
    if (!res.ok) throw await apiError(res);
    return res.json();
}

async function apiSend(url, method, body) {
    const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {})
    });
    if (!res.ok) throw await apiError(res);
    return res.json();
}

async function apiDelete(url) {
    const res = await fetch(url, { method: "DELETE" });
    if (!res.ok) throw await apiError(res);
    return res.json();
}

async function apiUpload(url, formData) {
    const res = await fetch(url, { method: "POST", body: formData });
    if (!res.ok) throw await apiError(res);
    return res.json();
}

async function apiError(res) {
    let message = "Something went wrong.";
    try {
        const data = await res.json();
        message = data.error || message;
    } catch (e) {
        // ignore parse errors
    }
    const error = new Error(message);
    error.status = res.status;
    return error;
}


/* ============================================================
   DATA REFRESH
   ============================================================ */

async function refreshData() {

    try {

        state = await apiGet("/api/data");

    } catch (error) {

        console.error("Could not load diary data:", error);

        showToast("Could not load your memories.", "error");

        state = { folders: [], items: [] };
    }

    renderEverything();
}


async function refreshDriveStatus() {

    const statusText = document.getElementById("driveStatusText");
    const connectBtn = document.getElementById("driveConnectBtn");

    if (!statusText || !connectBtn) {
        return;
    }

    try {

        const status = await apiGet("/google/status");

        if (status.connected) {

            statusText.textContent = "Connected — ready for your memories.";
            connectBtn.style.display = "none";

        } else if (status.hasClientCredentials) {

            statusText.textContent = "Not connected yet.";
            connectBtn.style.display = "block";

        } else {

            statusText.textContent = "credentials.json not set up yet.";
            connectBtn.style.display = "none";
        }

    } catch (error) {

        statusText.textContent = "Could not check connection.";
    }

    connectBtn.onclick = function () {
        window.location.href = "/google/authorize";
    };
}


/* ============================================================
   HELPERS
   ============================================================ */

function getFolder(folderId) {
    return state.folders.find(folder => String(folder.id) === String(folderId));
}

function getItem(itemId) {
    return state.items.find(item => String(item.id) === String(itemId));
}

function getActiveItems() {
    return state.items.filter(item => !item.trashed);
}

function getFolderItems(folderId) {
    return state.items.filter(
        item => String(item.folderId) === String(folderId) && !item.trashed
    );
}

function escapeHTML(value) {
    if (value === null || value === undefined) return "";
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function stripHTML(html) {
    const div = document.createElement("div");
    div.innerHTML = html || "";
    return div.textContent || div.innerText || "";
}

function capitalize(value) {
    if (!value) return "";
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString(undefined, {
        day: "numeric", month: "short", year: "numeric"
    });
}

function formatFileSize(bytes) {
    if (!bytes || bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const index = Math.min(
        Math.floor(Math.log(bytes) / Math.log(1024)),
        units.length - 1
    );
    const size = bytes / Math.pow(1024, index);
    return size.toFixed(index === 0 ? 0 : 1) + " " + units[index];
}


/* ============================================================
   THEME (this stays local — it's a display preference, not data)
   ============================================================ */

function setupThemeToggle() {
    const button = document.getElementById("themeToggle");
    if (!button) return;

    button.addEventListener("click", function (event) {
        event.preventDefault();
        const current = localStorage.getItem(THEME_KEY);
        setTheme(current === "light" ? "dark" : "light");
    });
}

function loadTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    setTheme(saved === "light" ? "light" : "dark");
}

function setTheme(theme) {
    document.body.setAttribute("data-theme", theme);
    document.body.classList.toggle("light-theme", theme === "light");
    localStorage.setItem(THEME_KEY, theme);
    updateThemeIcon(theme);
}

function updateThemeIcon(theme) {
    const button = document.getElementById("themeToggle");
    if (!button) return;
    const icon = button.querySelector("i");
    if (!icon) return;
    icon.className = theme === "light" ? "bi bi-sun" : "bi bi-moon-stars";
}


/* ============================================================
   NAVIGATION
   ============================================================ */

function setupNavigation() {
    document.addEventListener("click", function (event) {
        const nav = event.target.closest(".nav-item[data-page]");
        if (!nav) return;

        event.preventDefault();
        const page = nav.dataset.page;
        if (!page) return;

        showPage(page);
        closeMobileSidebar();
    });
}

function showPage(page) {
    const pages = ["homePage", "foldersPage", "favoritesPage", "trashPage", "folderPage"];

    pages.forEach(function (id) {
        const element = document.getElementById(id);
        if (element) element.classList.remove("active");
    });

    const map = {
        home: "homePage",
        folders: "foldersPage",
        favorites: "favoritesPage",
        trash: "trashPage",
        folder: "folderPage"
    };

    const target = document.getElementById(map[page] || "");
    if (target) target.classList.add("active");

    updateNavigation(page);
    updateHeader(page);

    if (page === "home") renderHome();
    else if (page === "folders") renderFoldersPage();
    else if (page === "favorites") renderFavorites();
    else if (page === "trash") renderTrash();
    else if (page === "folder") renderCurrentFolder();
}

function updateNavigation(page) {
    document.querySelectorAll(".nav-item[data-page]").forEach(function (item) {
        item.classList.toggle("active", item.dataset.page === page);
    });
}

function updateHeader(page) {
    const title = document.getElementById("pageTitle");
    const subtitle = document.getElementById("pageSubtitle");
    if (!title || !subtitle) return;

    if (page === "home") {
        title.textContent = "Memory Vault";
        subtitle.textContent = "Your personal space for memories.";
    } else if (page === "folders") {
        title.textContent = "My Folders";
        subtitle.textContent = "Organize your memories your way.";
    } else if (page === "favorites") {
        title.textContent = "Favorites";
        subtitle.textContent = "Your most treasured memories.";
    } else if (page === "trash") {
        title.textContent = "Trash";
        subtitle.textContent = "Deleted memories.";
    } else if (page === "folder") {
        const folder = getFolder(currentFolderId);
        title.textContent = folder ? folder.name : "Folder";
        subtitle.textContent = "Memories in this folder.";
    }
}


/* ============================================================
   MOBILE MENU
   ============================================================ */

function setupMobileMenu() {
    const menu = document.getElementById("menuToggle");
    const sidebar = document.getElementById("sidebar");
    const backdrop = document.getElementById("sidebarBackdrop");

    if (!menu || !sidebar) return;

    menu.addEventListener("click", function (event) {
        event.preventDefault();
        sidebar.classList.toggle("open");
        if (backdrop) {
            backdrop.classList.toggle("show");
            backdrop.style.display = sidebar.classList.contains("open") ? "block" : "none";
        }
    });

    if (backdrop) backdrop.addEventListener("click", closeMobileSidebar);
}

function closeMobileSidebar() {
    const sidebar = document.getElementById("sidebar");
    const backdrop = document.getElementById("sidebarBackdrop");
    if (sidebar) sidebar.classList.remove("open");
    if (backdrop) {
        backdrop.classList.remove("show");
        backdrop.style.display = "none";
    }
}


/* ============================================================
   FOLDER BUTTONS
   ============================================================ */

function setupFolderButtons() {

    document.addEventListener("click", function (event) {
        const button = event.target.closest("#newFolderBtn, #newFolderBtn2");
        if (!button) return;
        event.preventDefault();
        event.stopPropagation();
        openNewFolderModal();
    });

    document.addEventListener("click", function (event) {
        const createButton = event.target.closest("#createFolderBtn");
        if (!createButton) return;
        event.preventDefault();
        event.stopPropagation();
        createFolder();
    });

    document.addEventListener("keydown", function (event) {
        if (event.target && event.target.id === "folderNameInput" && event.key === "Enter") {
            event.preventDefault();
            createFolder();
        }
    });
}

function openNewFolderModal() {
    const input = document.getElementById("folderNameInput");
    if (input) input.value = "";
    openModal("folderModal");
    setTimeout(function () { if (input) input.focus(); }, 100);
}

async function createFolder() {
    const input = document.getElementById("folderNameInput");
    if (!input) return;

    const name = input.value.trim();
    if (!name) {
        showToast("Please enter a folder name.", "error");
        input.focus();
        return;
    }

    try {
        await apiSend("/api/folders", "POST", { name });
        await refreshData();
        closeModal("folderModal");
        showToast("Folder created successfully.", "success");
    } catch (error) {
        showToast(error.message, "error");
    }
}


/* ============================================================
   FOLDER MENU (rename / delete)
   ============================================================ */

function showFolderMenu(folder, anchorEl) {
    if (!folder) return;

    openActionMenu(anchorEl, [
        { label: "Rename", icon: "bi-pencil", action: () => renameFolder(folder.id) },
        { label: "Delete", icon: "bi-trash3", danger: true, action: () => deleteFolder(folder.id) }
    ]);
}

function renameFolder(folderId) {
    const folder = getFolder(folderId);
    if (!folder) return;

    showConfirmDialog({
        title: "Rename Folder",
        message: "Enter a new name for this folder.",
        input: true,
        inputValue: folder.name,
        confirmText: "Rename",
        onConfirm: async function (value) {
            const newName = String(value || "").trim();
            if (!newName) {
                showToast("Folder name cannot be empty.", "error");
                return false;
            }
            try {
                await apiSend(`/api/folders/${folderId}`, "PATCH", { name: newName });
                await refreshData();
                if (currentFolderId === folderId) updateHeader("folder");
                showToast("Folder renamed.", "success");
                return true;
            } catch (error) {
                showToast(error.message, "error");
                return false;
            }
        }
    });
}

function deleteFolder(folderId) {
    const folder = getFolder(folderId);
    if (!folder) return;

    if (state.folders.length <= 1) {
        showToast("You need at least one folder.", "error");
        return;
    }

    showConfirmDialog({
        title: "Delete Folder",
        message: `"${folder.name}" will be deleted and its memories will be moved to Trash.`,
        confirmText: "Delete Folder",
        danger: true,
        onConfirm: async function () {
            try {
                await apiDelete(`/api/folders/${folderId}`);
                if (currentFolderId === folderId) {
                    currentFolderId = null;
                    showPage("folders");
                }
                await refreshData();
                showToast("Folder deleted. Its memories were moved to Trash.", "success");
                return true;
            } catch (error) {
                showToast(error.message, "error");
                return false;
            }
        }
    });
}


/* ============================================================
   OPEN FOLDER
   ============================================================ */

function openFolder(folderId) {
    const folder = getFolder(folderId);
    if (!folder) return;

    currentFolderId = folderId;
    currentFilter = "all";

    const folderName = document.getElementById("currentFolderName");
    if (folderName) folderName.textContent = folder.name;

    document.querySelectorAll(".filter-btn[data-filter]").forEach(function (button) {
        button.classList.toggle("active", button.dataset.filter === "all");
    });

    showPage("folder");
}


/* ============================================================
   MEMORY BUTTONS (+ / add memory)
   ============================================================ */

function setupMemoryButtons() {

    document.addEventListener("click", function (event) {
        const button = event.target.closest("#addMemoryBtn, #floatingAdd");
        if (!button) return;

        event.preventDefault();
        event.stopPropagation();

        if (!currentFolderId) {
            showPage("folders");
            showToast("Please open a folder first.", "warning");
            return;
        }

        openMemoryTypeModal();
    });

    document.addEventListener("click", function (event) {
        const card = event.target.closest(".memory-type-card[data-type]");
        if (!card) return;

        event.preventDefault();
        event.stopPropagation();

        const type = card.dataset.type;
        if (!type) return;

        currentMemoryType = type;
        closeModal("memoryTypeModal");

        if (type === "text") {
            openTextEditor();
        } else {
            openMediaModal(type);
        }
    });
}

function openMemoryTypeModal() {
    if (!currentFolderId) {
        showToast("Please open a folder first.", "warning");
        return;
    }
    openModal("memoryTypeModal");
}


/* ============================================================
   TEXT EDITOR
   ============================================================ */

function setupEditor() {

    document.addEventListener("click", function (event) {
        const button = event.target.closest(".editor-btn[data-command]");
        if (!button) return;

        event.preventDefault();
        const command = button.dataset.command;
        document.execCommand(command, false, null);
        document.getElementById("richTextEditor")?.focus();
        updateEditorToolbarState();
    });

    const fontFamily = document.getElementById("fontFamily");
    if (fontFamily) {
        fontFamily.addEventListener("change", function () {
            document.execCommand("fontName", false, fontFamily.value);
        });
    }

    const fontSize = document.getElementById("fontSize");
    if (fontSize) {
        fontSize.addEventListener("change", function () {
            document.execCommand("fontSize", false, fontSize.value);
        });
    }

    const textColor = document.getElementById("textColor");
    if (textColor) {
        textColor.addEventListener("input", function () {
            document.execCommand("foreColor", false, textColor.value);
        });
    }

    const highlightColor = document.getElementById("highlightColor");
    if (highlightColor) {
        highlightColor.addEventListener("input", function () {
            document.execCommand("hiliteColor", false, highlightColor.value);
        });
    }

    const editor = document.getElementById("richTextEditor");
    if (editor) {
        editor.addEventListener("input", updateWordCount);
        editor.addEventListener("keyup", updateEditorToolbarState);
        editor.addEventListener("mouseup", updateEditorToolbarState);
    }

    const saveButton = document.getElementById("saveTextMemory");
    if (saveButton) {
        saveButton.addEventListener("click", saveTextMemory);
    }
}

function updateEditorToolbarState() {
    ["bold", "italic", "underline", "strikeThrough", "justifyLeft", "justifyCenter", "justifyRight",
        "insertUnorderedList", "insertOrderedList"].forEach(function (command) {
        const button = document.querySelector(`.editor-btn[data-command="${command}"]`);
        if (!button) return;
        try {
            button.classList.toggle("active", document.queryCommandState(command));
        } catch (e) { /* ignore */ }
    });
}

function updateWordCount() {
    const editor = document.getElementById("richTextEditor");
    const counter = document.getElementById("wordCount");
    if (!editor || !counter) return;

    const text = stripHTML(editor.innerHTML).trim();
    const words = text ? text.split(/\s+/).length : 0;
    counter.textContent = `${words} ${words === 1 ? "word" : "words"}`;
}

function openTextEditor() {
    currentEditingId = null;

    const title = document.getElementById("memoryTitleInput");
    const editor = document.getElementById("richTextEditor");

    if (title) title.value = "";
    if (editor) editor.innerHTML = "";

    updateWordCount();
    openModal("editorModal");
    setTimeout(() => title?.focus(), 100);
}

function openTextMemoryForEdit(item) {
    currentEditingId = item.id;

    const title = document.getElementById("memoryTitleInput");
    const editor = document.getElementById("richTextEditor");

    if (title) title.value = item.title || "";
    if (editor) editor.innerHTML = item.content || "";

    updateWordCount();
    openModal("editorModal");
}

async function saveTextMemory() {
    const title = document.getElementById("memoryTitleInput");
    const editor = document.getElementById("richTextEditor");
    if (!title || !editor) return;

    const content = editor.innerHTML;
    const plainText = stripHTML(content).trim();
    const titleValue = title.value.trim() || "Untitled";

    if (!plainText) {
        showToast("Please write something before saving.", "error");
        return;
    }

    try {

        if (currentEditingId) {
            await apiSend(`/api/items/${currentEditingId}`, "PATCH", {
                title: titleValue, content, plainText
            });
        } else {
            await apiSend("/api/items", "POST", {
                folderId: currentFolderId, title: titleValue, content, plainText
            });
        }

        await refreshData();
        closeModal("editorModal");
        showToast("Memory saved.", "success");

    } catch (error) {
        showToast(error.message, "error");
    }
}


/* ============================================================
   MEDIA (photo / video / voice) UPLOAD
   ============================================================ */

function setupMedia() {

    const fileInput = document.getElementById("mediaFileInput");
    const fileName = document.getElementById("selectedFileName");

    if (fileInput) {
        fileInput.addEventListener("change", function () {
            selectedMediaFile = fileInput.files[0] || null;
            if (fileName) {
                fileName.textContent = selectedMediaFile
                    ? `${selectedMediaFile.name} (${formatFileSize(selectedMediaFile.size)})`
                    : "No file selected";
            }
        });
    }

    const saveButton = document.getElementById("saveMediaBtn");
    if (saveButton) {
        saveButton.addEventListener("click", saveMediaMemory);
    }
}

function openMediaModal(type) {
    const icon = document.getElementById("mediaModalIcon")?.querySelector("i");
    const titleEl = document.getElementById("mediaModalTitle");
    const fileInput = document.getElementById("mediaFileInput");
    const fileName = document.getElementById("selectedFileName");
    const memoryTitle = document.getElementById("mediaTitleInput");

    const config = {
        photo: { icon: "bi-image", title: "Add Photo", accept: "image/*" },
        video: { icon: "bi-camera-video", title: "Add Video", accept: "video/*" },
        voice: { icon: "bi-mic", title: "Add Voice Recording", accept: "audio/*" }
    }[type] || { icon: "bi-file-earmark", title: "Upload Media", accept: "*/*" };

    if (icon) icon.className = `bi ${config.icon}`;
    if (titleEl) titleEl.textContent = config.title;
    if (fileInput) {
        fileInput.accept = config.accept;
        fileInput.value = "";
    }
    if (fileName) fileName.textContent = "No file selected";
    if (memoryTitle) memoryTitle.value = "";

    selectedMediaFile = null;
    currentMemoryType = type;

    openModal("mediaModal");
}

async function saveMediaMemory() {

    if (!selectedMediaFile) {
        showToast("Please choose a file first.", "error");
        return;
    }

    const titleInput = document.getElementById("mediaTitleInput");
    const title = titleInput ? titleInput.value.trim() : "";

    const formData = new FormData();
    formData.append("folderId", currentFolderId);
    formData.append("type", currentMemoryType);
    formData.append("title", title || selectedMediaFile.name);
    formData.append("file", selectedMediaFile);

    const saveButton = document.getElementById("saveMediaBtn");
    if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = "Uploading...";
    }

    try {

        await apiUpload("/api/upload", formData);
        await refreshData();
        closeModal("mediaModal");
        showToast("Memory saved to Google Drive.", "success");

    } catch (error) {

        if (error.status === 409) {
            showConfirmDialog({
                title: "Connect Google Drive",
                message: "Google Drive isn't connected yet. Connect it now to save photos, videos and recordings.",
                confirmText: "Connect",
                onConfirm: function () {
                    window.location.href = "/google/authorize";
                    return true;
                }
            });
        } else {
            showToast(error.message, "error");
        }

    } finally {
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.innerHTML = '<i class="bi bi-cloud-arrow-up me-1"></i> Save';
        }
    }
}


/* ============================================================
   MEMORY CARDS
   ============================================================ */

function getMemoryIcon(type) {
    if (type === "text") return "bi-file-text";
    if (type === "photo") return "bi-image";
    if (type === "video") return "bi-camera-video";
    if (type === "voice") return "bi-mic";
    return "bi-file-earmark";
}

function getMemoryPreview(item) {
    if (item.type === "text") {
        const clean = (item.plainText || stripHTML(item.content || "")).replace(/\s+/g, " ").trim();
        if (!clean) return "Text note";
        return escapeHTML(clean.length > 90 ? clean.substring(0, 90) + "..." : clean);
    }
    if (item.type === "photo") return escapeHTML(item.fileName || "Photo memory");
    if (item.type === "video") return escapeHTML(item.fileName || "Video memory");
    if (item.type === "voice") return escapeHTML(item.fileName || "Voice recording");
    return "Memory";
}

function createMemoryCard(item) {

    const card = document.createElement("div");
    card.className = "memory-card";
    card.dataset.memoryId = item.id;

    const folder = getFolder(item.folderId);
    const preview = getMemoryPreview(item);
    const icon = getMemoryIcon(item.type);
    const favoriteClass = item.favorite ? "active" : "";

    const thumb = item.type === "photo"
        ? `<img class="memory-preview-thumb" src="/api/media/${item.id}" alt="${escapeHTML(item.title || "Photo")}" loading="lazy">`
        : "";

    card.innerHTML = `
        <div class="memory-card-top">
            <div class="memory-type-icon"><i class="bi ${icon}"></i></div>
            <button type="button" class="favorite-btn ${favoriteClass}" title="${item.favorite ? "Remove from favorites" : "Add to favorites"}">
                <i class="bi ${item.favorite ? "bi-star-fill" : "bi-star"}"></i>
            </button>
            <button type="button" class="memory-menu-btn" title="Memory options">
                <i class="bi bi-three-dots"></i>
            </button>
        </div>

        <div class="memory-card-content">
            ${thumb}
            <h3>${escapeHTML(item.title || "Untitled")}</h3>
            <p class="memory-preview">${preview}</p>
        </div>

        <div class="memory-card-meta">
            <span><i class="bi bi-calendar3"></i> ${formatDate(item.createdAt)}</span>
            ${folder ? `<span><i class="bi bi-folder2"></i> ${escapeHTML(folder.name)}</span>` : ""}
        </div>
    `;

    card.querySelector(".favorite-btn")?.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        toggleFavorite(item.id);
    });

    card.querySelector(".memory-menu-btn")?.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        showMemoryMenu(item, event.currentTarget);
    });

    card.addEventListener("click", function (event) {
        if (event.target.closest(".favorite-btn") || event.target.closest(".memory-menu-btn")) return;
        openMemory(item.id);
    });

    return card;
}

function showMemoryMenu(item, anchorEl) {

    const actions = [];

    if (!item.trashed) {
        actions.push({ label: "Open", icon: "bi-box-arrow-up-right", action: () => openMemory(item.id) });
        actions.push({
            label: item.favorite ? "Remove from favorites" : "Add to favorites",
            icon: "bi-star",
            action: () => toggleFavorite(item.id)
        });
        actions.push({ label: "Move to Trash", icon: "bi-trash3", danger: true, action: () => moveMemoryToTrash(item.id) });
    } else {
        actions.push({ label: "Restore", icon: "bi-arrow-counterclockwise", action: () => restoreMemory(item.id) });
        actions.push({ label: "Delete Permanently", icon: "bi-trash3", danger: true, action: () => permanentlyDeleteMemory(item.id) });
    }

    openActionMenu(anchorEl, actions);
}


/* ============================================================
   OPEN / VIEW MEMORY
   ============================================================ */

function openMemory(memoryId) {
    const item = getItem(memoryId);
    if (!item) return;

    if (item.type === "text") {
        openTextMemoryForEdit(item);
    } else {
        openMediaViewer(item);
    }
}

function openMediaViewer(item) {

    let mediaHtml = "";

    if (item.type === "photo") {
        mediaHtml = `<img src="/api/media/${item.id}" alt="${escapeHTML(item.title || "Photo")}">`;
    } else if (item.type === "video") {
        mediaHtml = `<video src="/api/media/${item.id}" controls autoplay></video>`;
    } else if (item.type === "voice") {
        mediaHtml = `<audio src="/api/media/${item.id}" controls autoplay></audio>`;
    }

    showViewerDialog({
        title: item.title || capitalize(item.type),
        bodyHtml: `
            <div class="media-view">
                ${mediaHtml}
                <div class="media-view-meta">
                    ${escapeHTML(item.fileName || "")} ${item.size ? "· " + formatFileSize(item.size) : ""}
                </div>
            </div>
        `
    });
}


/* ============================================================
   FAVORITES / TRASH ACTIONS
   ============================================================ */

async function toggleFavorite(itemId) {
    const item = getItem(itemId);
    if (!item || item.trashed) return;

    try {
        await apiSend(`/api/items/${itemId}`, "PATCH", { favorite: !item.favorite });
        await refreshData();
        showToast(item.favorite ? "Removed from favorites." : "Added to favorites.", "success");
    } catch (error) {
        showToast(error.message, "error");
    }
}

async function moveMemoryToTrash(itemId) {
    try {
        await apiSend(`/api/items/${itemId}`, "PATCH", { trashed: true });
        await refreshData();
        showToast("Memory moved to Trash.", "success");
    } catch (error) {
        showToast(error.message, "error");
    }
}

async function restoreMemory(itemId) {
    try {
        await apiSend(`/api/items/${itemId}`, "PATCH", { trashed: false });
        await refreshData();
        showToast("Memory restored.", "success");
    } catch (error) {
        showToast(error.message, "error");
    }
}

function permanentlyDeleteMemory(itemId) {
    showConfirmDialog({
        title: "Delete Permanently",
        message: "This memory will be permanently deleted, including its file in Google Drive. This cannot be undone.",
        confirmText: "Delete Permanently",
        danger: true,
        onConfirm: async function () {
            try {
                await apiDelete(`/api/items/${itemId}`);
                await refreshData();
                showToast("Memory permanently deleted.", "success");
                return true;
            } catch (error) {
                showToast(error.message, "error");
                return false;
            }
        }
    });
}

function setupTrash() {
    document.addEventListener("click", function (event) {
        const emptyButton = event.target.closest("#emptyTrashBtn");
        if (!emptyButton) return;
        event.preventDefault();
        emptyTrash();
    });
}

function emptyTrash() {
    const trashItems = state.items.filter(item => item.trashed);

    if (trashItems.length === 0) {
        showToast("Trash is already empty.", "warning");
        return;
    }

    showConfirmDialog({
        title: "Empty Trash",
        message: `Delete all ${trashItems.length} deleted ${trashItems.length === 1 ? "memory" : "memories"} permanently? This cannot be undone.`,
        confirmText: "Empty Trash",
        danger: true,
        onConfirm: async function () {
            try {
                for (const item of trashItems) {
                    await apiDelete(`/api/items/${item.id}`);
                }
                await refreshData();
                showToast("Trash emptied.", "success");
                return true;
            } catch (error) {
                showToast(error.message, "error");
                return false;
            }
        }
    });
}


/* ============================================================
   FILTERS
   ============================================================ */

function setupFilters() {
    document.addEventListener("click", function (event) {
        const button = event.target.closest(".filter-btn[data-filter]");
        if (!button) return;

        event.preventDefault();
        currentFilter = button.dataset.filter || "all";

        document.querySelectorAll(".filter-btn[data-filter]").forEach(function (item) {
            item.classList.toggle("active", item === button);
        });

        renderCurrentFolder();
    });
}


/* ============================================================
   SEARCH
   ============================================================ */

function setupSearch() {
    const searchInput = document.getElementById("searchInput");
    const clearSearch = document.getElementById("clearSearch");

    if (searchInput) {
        searchInput.addEventListener("input", function () {
            const value = searchInput.value.trim().toLowerCase();
            if (clearSearch) clearSearch.style.display = value ? "block" : "none";
            renderSearchResults(value);
        });
    }

    if (clearSearch) {
        clearSearch.addEventListener("click", function () {
            if (searchInput) searchInput.value = "";
            clearSearch.style.display = "none";
            renderSearchResults("");
        });
    }
}

function renderSearchResults(query) {

    if (!query) {
        renderEverything();
        return;
    }

    const results = getActiveItems().filter(function (item) {
        const folder = getFolder(item.folderId);
        const searchable = [item.title, item.plainText, item.fileName, folder ? folder.name : "", item.type]
            .join(" ").toLowerCase();
        return searchable.includes(query);
    });

    const container = document.getElementById("homePage")?.classList.contains("active")
        ? document.getElementById("recentMemoryGrid")
        : document.getElementById("folderMemoryGrid");

    if (!container) return;

    container.innerHTML = "";

    if (results.length === 0) {
        container.innerHTML = createEmptyStateHTML("No memories found", "Try a different search.");
        return;
    }

    results
        .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
        .forEach(item => container.appendChild(createMemoryCard(item)));
}


/* ============================================================
   FOLDER RENDERING
   ============================================================ */

function renderFolders() {
    renderFolderGrid(document.getElementById("folderGrid"));
    renderFolderGrid(document.getElementById("allFolderGrid"));
}

function renderFolderGrid(container) {
    if (!container) return;

    container.innerHTML = "";

    state.folders.forEach(function (folder) {

        const count = getFolderItems(folder.id).length;

        const card = document.createElement("div");
        card.className = "folder-card";
        card.dataset.folderId = folder.id;

        card.innerHTML = `
            <div class="folder-icon"><i class="bi bi-folder2"></i></div>
            <h3>${escapeHTML(folder.name)}</h3>
            <p>${count} ${count === 1 ? "memory" : "memories"}</p>
            <button class="folder-menu" type="button" title="Folder options">
                <i class="bi bi-three-dots"></i>
            </button>
        `;

        card.addEventListener("click", function (event) {
            if (event.target.closest(".folder-menu")) return;
            openFolder(folder.id);
        });

        card.querySelector(".folder-menu")?.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            showFolderMenu(folder, event.currentTarget);
        });

        container.appendChild(card);
    });

    const newCard = document.createElement("button");
    newCard.type = "button";
    newCard.className = "new-folder-card";
    newCard.innerHTML = `
        <span class="new-folder-icon"><i class="bi bi-plus-lg"></i></span>
        <strong>New Folder</strong>
        <span>Organize your memories</span>
    `;
    newCard.addEventListener("click", function (event) {
        event.preventDefault();
        openNewFolderModal();
    });

    container.appendChild(newCard);
}


/* ============================================================
   CURRENT FOLDER RENDER
   ============================================================ */

function renderCurrentFolder() {

    const container = document.getElementById("folderMemoryGrid");
    if (!container) return;

    container.innerHTML = "";

    const folder = getFolder(currentFolderId);
    if (!folder) {
        container.innerHTML = createEmptyStateHTML("Folder not found", "Please choose another folder.");
        return;
    }

    let items = getFolderItems(folder.id);

    if (currentFilter !== "all") {
        items = items.filter(item => item.type === currentFilter);
    }

    items.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

    if (items.length === 0) {
        container.innerHTML = createEmptyStateHTML("No memories yet", "Click the + button to add your first memory.");
        return;
    }

    items.forEach(item => container.appendChild(createMemoryCard(item)));
}


/* ============================================================
   HOME PAGE
   ============================================================ */

function renderHome() {
    const recentContainer = document.getElementById("recentMemoryGrid");
    if (!recentContainer) return;

    let recent = getActiveItems()
        .slice()
        .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
        .slice(0, 8);

    recentContainer.innerHTML = "";

    if (recent.length === 0) {
        recentContainer.innerHTML = createEmptyStateHTML("No memories yet", "Create a folder and add your first memory.");
    } else {
        recent.forEach(item => recentContainer.appendChild(createMemoryCard(item)));
    }

    renderFolders();
}

function renderFoldersPage() {
    renderFolders();
}


/* ============================================================
   FAVORITES / TRASH PAGES
   ============================================================ */

function renderFavorites() {
    const container = document.getElementById("favoriteMemoryGrid");
    if (!container) return;

    container.innerHTML = "";

    const favorites = getActiveItems()
        .filter(item => item.favorite)
        .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

    if (favorites.length === 0) {
        container.innerHTML = createEmptyStateHTML("No favorites yet", "Star a memory to see it here.");
        return;
    }

    favorites.forEach(item => container.appendChild(createMemoryCard(item)));
}

function renderTrash() {
    const container = document.getElementById("trashMemoryGrid");
    if (!container) return;

    container.innerHTML = "";

    const trashed = state.items
        .filter(item => item.trashed)
        .sort((a, b) => new Date(b.deletedAt || b.updatedAt) - new Date(a.deletedAt || a.updatedAt));

    if (trashed.length === 0) {
        container.innerHTML = createEmptyStateHTML("Trash is empty", "Deleted memories will show up here.");
        return;
    }

    trashed.forEach(function (item) {
        const card = createMemoryCard(item);

        const actions = document.createElement("div");
        actions.style.display = "flex";
        actions.style.gap = "7px";
        actions.style.marginTop = "13px";

        actions.innerHTML = `
            <button class="secondary-btn" type="button" style="flex:1; min-height:36px; padding:7px;" data-restore>
                <i class="bi bi-arrow-counterclockwise"></i> Restore
            </button>
            <button class="danger-btn" type="button" style="flex:1; min-height:36px; padding:7px;" data-delete>
                <i class="bi bi-trash3"></i> Delete
            </button>
        `;

        actions.querySelector("[data-restore]").addEventListener("click", function (event) {
            event.stopPropagation();
            restoreMemory(item.id);
        });

        actions.querySelector("[data-delete]").addEventListener("click", function (event) {
            event.stopPropagation();
            permanentlyDeleteMemory(item.id);
        });

        card.appendChild(actions);
        container.appendChild(card);
    });
}


/* ============================================================
   EMPTY STATE
   ============================================================ */

function createEmptyStateHTML(title, message) {
    return `
        <div class="empty-state">
            <div class="empty-state-icon"><i class="bi bi-journal-heart"></i></div>
            <h3>${escapeHTML(title)}</h3>
            <p>${escapeHTML(message)}</p>
        </div>
    `;
}


/* ============================================================
   RENDER EVERYTHING
   ============================================================ */

function renderEverything() {
    renderFolders();
    renderHome();
    renderFavorites();
    renderTrash();
    if (currentFolderId) renderCurrentFolder();
}


/* ============================================================
   MODALS
   ============================================================ */

function setupModals() {

    document.addEventListener("click", function (event) {
        const closeButton = event.target.closest("[data-close]");
        if (!closeButton) return;
        event.preventDefault();
        const modal = closeButton.closest(".modal-overlay");
        if (modal) closeModal(modal.id);
    });

    document.addEventListener("click", function (event) {
        const modal = event.target.closest(".modal-overlay");
        if (!modal) return;
        if (event.target === modal) closeModal(modal.id);
    });
}

function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) {
        console.error(`Modal not found: ${id}`);
        showToast("This window could not be opened.", "error");
        return false;
    }
    modal.classList.add("show", "active");
    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
    return true;
}

function closeModal(id) {
    if (!id) return;
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove("show", "active");
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
}


/* ============================================================
   CONFIRM DIALOG (rename / delete / connect prompts)
   ============================================================ */

function ensureConfirmDialog() {
    let overlay = document.getElementById("confirmDialogOverlay");
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.id = "confirmDialogOverlay";
    overlay.className = "modal-overlay";

    overlay.innerHTML = `
        <div class="modal confirm-modal">
            <h3 id="confirmDialogTitle">Confirm</h3>
            <p id="confirmDialogMessage"></p>
            <div class="form-group" id="confirmDialogInputWrapper" style="display:none; margin-top:12px;">
                <input type="text" class="form-control" id="confirmDialogInput" autocomplete="off">
            </div>
            <div class="confirm-actions">
                <button type="button" class="secondary-btn" id="confirmDialogCancel">Cancel</button>
                <button type="button" class="primary-btn" id="confirmDialogConfirm">Confirm</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    overlay.addEventListener("click", function (event) {
        if (event.target === overlay) closeConfirmDialog();
    });

    return overlay;
}

function closeConfirmDialog() {
    const overlay = document.getElementById("confirmDialogOverlay");
    if (overlay) {
        overlay.classList.remove("show", "active");
        overlay.style.display = "none";
    }
}

function showConfirmDialog(options = {}) {
    const overlay = ensureConfirmDialog();

    const title = document.getElementById("confirmDialogTitle");
    const message = document.getElementById("confirmDialogMessage");
    const inputWrapper = document.getElementById("confirmDialogInputWrapper");
    const input = document.getElementById("confirmDialogInput");
    const cancel = document.getElementById("confirmDialogCancel");
    const confirmButton = document.getElementById("confirmDialogConfirm");

    title.textContent = options.title || "Confirm";
    message.textContent = options.message || "";

    const hasInput = Boolean(options.input);
    inputWrapper.style.display = hasInput ? "block" : "none";
    input.value = options.inputValue || "";

    confirmButton.textContent = options.confirmText || "Confirm";
    confirmButton.classList.toggle("danger-btn", Boolean(options.danger));
    confirmButton.classList.toggle("primary-btn", !options.danger);

    overlay.classList.add("show", "active");
    overlay.style.display = "flex";

    cancel.onclick = closeConfirmDialog;

    confirmButton.onclick = async function () {
        const value = hasInput ? input.value : undefined;
        const onConfirm = options.onConfirm;
        let result = true;

        if (typeof onConfirm === "function") {
            result = await onConfirm(value);
        }

        if (result !== false) closeConfirmDialog();
    };

    if (hasInput) {
        setTimeout(() => { input.focus(); input.select(); }, 50);
        input.onkeydown = function (event) {
            if (event.key === "Enter") { event.preventDefault(); confirmButton.click(); }
            if (event.key === "Escape") { event.preventDefault(); closeConfirmDialog(); }
        };
    }
}


/* ============================================================
   VIEWER DIALOG (view photo / video / voice memory)
   ============================================================ */

function ensureViewerDialog() {
    let overlay = document.getElementById("viewerDialogOverlay");
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.id = "viewerDialogOverlay";
    overlay.className = "modal-overlay";

    overlay.innerHTML = `
        <div class="modal" style="max-width: 720px;">
            <div class="modal-header">
                <h2 id="viewerDialogTitle">Memory</h2>
                <button class="modal-close" id="viewerDialogClose" type="button">
                    <i class="bi bi-x-lg"></i>
                </button>
            </div>
            <div class="modal-body" id="viewerDialogBody"></div>
        </div>
    `;

    document.body.appendChild(overlay);

    overlay.addEventListener("click", function (event) {
        if (event.target === overlay) closeViewerDialog();
    });

    overlay.querySelector("#viewerDialogClose").addEventListener("click", closeViewerDialog);

    return overlay;
}

function closeViewerDialog() {
    const overlay = document.getElementById("viewerDialogOverlay");
    if (!overlay) return;

    // Stop any playing media before hiding.
    overlay.querySelectorAll("video, audio").forEach(el => el.pause());

    overlay.classList.remove("show", "active");
    overlay.style.display = "none";
}

function showViewerDialog(options = {}) {
    const overlay = ensureViewerDialog();

    overlay.querySelector("#viewerDialogTitle").textContent = options.title || "Memory";
    overlay.querySelector("#viewerDialogBody").innerHTML = options.bodyHtml || "";

    overlay.classList.add("show", "active");
    overlay.style.display = "flex";
}


/* ============================================================
   ACTION MENU (small dropdown near a button)
   ============================================================ */

function closeActionMenu() {
    document.getElementById("appActionMenu")?.remove();
}

function openActionMenu(anchorEl, actions) {
    closeActionMenu();

    const menu = document.createElement("div");
    menu.id = "appActionMenu";
    menu.className = "action-menu";

    actions.forEach(function (action) {
        const button = document.createElement("button");
        button.type = "button";
        if (action.danger) button.classList.add("danger");
        button.innerHTML = `<i class="bi ${action.icon || "bi-dot"}"></i><span>${escapeHTML(action.label)}</span>`;
        button.addEventListener("click", function (event) {
            event.stopPropagation();
            closeActionMenu();
            action.action();
        });
        menu.appendChild(button);
    });

    document.body.appendChild(menu);

    // Position near the anchor, staying inside the viewport.
    const rect = anchorEl ? anchorEl.getBoundingClientRect() : { bottom: 100, left: 100, right: 100 };
    const menuRect = menu.getBoundingClientRect();

    let top = rect.bottom + 6;
    let left = rect.right - menuRect.width;

    if (left < 8) left = 8;
    if (top + menuRect.height > window.innerHeight - 8) {
        top = rect.top - menuRect.height - 6;
    }

    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;

    setTimeout(function () {
        document.addEventListener("click", onOutsideClick);
    }, 0);

    function onOutsideClick(event) {
        if (!menu.contains(event.target)) {
            closeActionMenu();
            document.removeEventListener("click", onOutsideClick);
        }
    }
}


/* ============================================================
   TOAST
   ============================================================ */

let toastTimer = null;

function showToast(message, type = "success") {
    const toast = document.getElementById("toast");

    if (!toast) {
        console.log(`[${type}] ${message}`);
        return;
    }

    toast.textContent = message;
    toast.className = "toast";
    toast.classList.add(type, "show");

    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
        toast.classList.remove("show");
    }, 5000);
}


/* ============================================================
   BACK BUTTON
   ============================================================ */

function setupBackButton() {
    document.addEventListener("click", function (event) {
        const button = event.target.closest("#backToFolders");
        if (!button) return;

        event.preventDefault();
        currentFolderId = null;
        currentFilter = "all";
        showPage("folders");
    });
}


/* ============================================================
   KEYBOARD SHORTCUTS
   ============================================================ */

function setupKeyboardShortcuts() {
    document.addEventListener("keydown", function (event) {

        if (event.key === "Escape") {
            document.querySelectorAll(".modal-overlay.show, .modal-overlay.active").forEach(function (modal) {
                closeModal(modal.id);
            });
            closeActionMenu();
            return;
        }

        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
            event.preventDefault();
            const search = document.getElementById("searchInput");
            if (search) { search.focus(); search.select(); }
        }
    });
}


/* ============================================================
   END OF APP.JS
   ============================================================ */