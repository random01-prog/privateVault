/* ============================================================
   PERSONAL DIARY / MEMORY VAULT
   app.js

   Frontend storage:
   localStorage

   Future:
   Flask API
   PostgreSQL
   Google Drive
   ============================================================ */


/* ============================================================
   GLOBAL STATE
   ============================================================ */

const STORAGE_KEY = "personalDiaryData";
const THEME_KEY = "personalDiaryTheme";

let data = {
    folders: [],
    items: []
};

let currentFolderId = null;
let currentFilter = "all";
let currentMemoryType = null;
let currentEditingId = null;


/* ============================================================
   DEFAULT FOLDERS
   ============================================================ */

const DEFAULT_FOLDERS = [
    {
        id: "folder_personal",
        name: "Personal",
        createdAt: new Date().toISOString()
    },
    {
        id: "folder_college",
        name: "College",
        createdAt: new Date().toISOString()
    },
    {
        id: "folder_trips",
        name: "Trips",
        createdAt: new Date().toISOString()
    }
];


/* ============================================================
   INITIALIZATION
   ============================================================ */

document.addEventListener("DOMContentLoaded", function () {

    loadData();
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

    renderEverything();

    /*
     * Start on Home.
     */
    showPage("home");
});


/* ============================================================
   STORAGE
   ============================================================ */

function loadData() {

    try {

        const saved =
            localStorage.getItem(STORAGE_KEY);

        if (!saved) {

            data = {
                folders: JSON.parse(
                    JSON.stringify(DEFAULT_FOLDERS)
                ),
                items: []
            };

            saveData();
            return;
        }


        const parsed =
            JSON.parse(saved);


        data = {
            folders:
                Array.isArray(parsed.folders)
                    ? parsed.folders
                    : [],

            items:
                Array.isArray(parsed.items)
                    ? parsed.items
                    : []
        };


        /*
         * If an older version had no folders,
         * restore the default folders.
         */
        if (data.folders.length === 0) {

            data.folders =
                JSON.parse(
                    JSON.stringify(DEFAULT_FOLDERS)
                );

            saveData();
        }

    } catch (error) {

        console.error(
            "Could not load diary data:",
            error
        );

        data = {
            folders:
                JSON.parse(
                    JSON.stringify(DEFAULT_FOLDERS)
                ),

            items: []
        };

        saveData();
    }
}


function saveData() {

    try {

        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(data)
        );

    } catch (error) {

        console.error(
            "Could not save diary data:",
            error
        );

        showToast(
            "Could not save your changes.",
            "error"
        );
    }
}


/* ============================================================
   ID
   ============================================================ */

function generateId(prefix = "item") {

    return (
        prefix +
        "_" +
        Date.now() +
        "_" +
        Math.random()
            .toString(36)
            .substring(2, 9)
    );
}


/* ============================================================
   HELPERS
   ============================================================ */

function getFolder(folderId) {

    return data.folders.find(
        folder =>
            String(folder.id) ===
            String(folderId)
    );
}


function getItem(itemId) {

    return data.items.find(
        item =>
            String(item.id) ===
            String(itemId)
    );
}


function getActiveItems() {

    return data.items.filter(
        item => !item.trashed
    );
}


function getFolderItems(folderId) {

    return data.items.filter(
        item =>
            String(item.folderId) ===
                String(folderId) &&
            !item.trashed
    );
}


function escapeHTML(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function stripHTML(html) {

    const div =
        document.createElement("div");

    div.innerHTML = html || "";

    return (
        div.textContent ||
        div.innerText ||
        ""
    );
}


function capitalize(value) {

    if (!value) {
        return "";
    }

    return (
        value.charAt(0).toUpperCase() +
        value.slice(1)
    );
}


function formatDate(value) {

    if (!value) {
        return "";
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "";
    }

    return date.toLocaleDateString(
        undefined,
        {
            day: "numeric",
            month: "short",
            year: "numeric"
        }
    );
}


function formatFileSize(bytes) {

    if (!bytes || bytes <= 0) {
        return "0 B";
    }

    const units = [
        "B",
        "KB",
        "MB",
        "GB"
    ];

    const index = Math.min(
        Math.floor(
            Math.log(bytes) /
            Math.log(1024)
        ),
        units.length - 1
    );

    const size =
        bytes /
        Math.pow(1024, index);

    return (
        size.toFixed(
            index === 0 ? 0 : 1
        ) +
        " " +
        units[index]
    );
}


function removeExtension(filename) {

    if (!filename) {
        return "";
    }

    const index =
        filename.lastIndexOf(".");

    if (index <= 0) {
        return filename;
    }

    return filename.substring(
        0,
        index
    );
}


/* ============================================================
   THEME
   ============================================================ */

function setupThemeToggle() {

    const button =
        document.getElementById(
            "themeToggle"
        );

    if (!button) {
        return;
    }

    button.addEventListener(
        "click",
        function (event) {

            event.preventDefault();

            const current =
                localStorage.getItem(
                    THEME_KEY
                );

            setTheme(
                current === "light"
                    ? "dark"
                    : "light"
            );
        }
    );
}


function loadTheme() {

    const saved =
        localStorage.getItem(
            THEME_KEY
        );

    setTheme(
        saved === "light"
            ? "light"
            : "dark"
    );
}


function setTheme(theme) {

    document.body.setAttribute(
        "data-theme",
        theme
    );

    /*
     * Also support CSS that uses a class.
     */
    document.body.classList.toggle(
        "light-theme",
        theme === "light"
    );

    localStorage.setItem(
        THEME_KEY,
        theme
    );

    updateThemeIcon(theme);
}


function updateThemeIcon(theme) {

    const button =
        document.getElementById(
            "themeToggle"
        );

    if (!button) {
        return;
    }

    const icon =
        button.querySelector("i");

    if (!icon) {
        return;
    }

    icon.className =
        theme === "light"
            ? "bi bi-sun"
            : "bi bi-moon-stars";
}


/* ============================================================
   NAVIGATION
   ============================================================ */

function setupNavigation() {

    document.addEventListener(
        "click",
        function (event) {

            const nav =
                event.target.closest(
                    ".nav-item[data-page]"
                );

            if (!nav) {
                return;
            }

            event.preventDefault();

            const page =
                nav.dataset.page;

            if (!page) {
                return;
            }

            showPage(page);

            closeMobileSidebar();
        }
    );
}


function showPage(page) {

    const pages = [
        "homePage",
        "foldersPage",
        "favoritesPage",
        "trashPage",
        "folderPage"
    ];


    pages.forEach(function (id) {

        const element =
            document.getElementById(id);

        if (!element) {
            return;
        }

        element.classList.remove(
            "active"
        );

        /*
         * We intentionally do not force
         * display:none here because the
         * project's CSS controls page layout.
         */
    });


    let targetId = "";


    if (page === "home") {
        targetId = "homePage";
    }

    else if (page === "folders") {
        targetId = "foldersPage";
    }

    else if (page === "favorites") {
        targetId = "favoritesPage";
    }

    else if (page === "trash") {
        targetId = "trashPage";
    }

    else if (page === "folder") {
        targetId = "folderPage";
    }


    const target =
        document.getElementById(
            targetId
        );

    if (target) {

        target.classList.add(
            "active"
        );
    }


    updateNavigation(page);
    updateHeader(page);


    if (page === "home") {
        renderHome();
    }

    else if (page === "folders") {
        renderFoldersPage();
    }

    else if (page === "favorites") {
        renderFavorites();
    }

    else if (page === "trash") {
        renderTrash();
    }

    else if (page === "folder") {
        renderCurrentFolder();
    }
}


function updateNavigation(page) {

    document
        .querySelectorAll(
            ".nav-item[data-page]"
        )
        .forEach(function (item) {

            item.classList.toggle(
                "active",
                item.dataset.page === page
            );
        });
}


function updateHeader(page) {

    const title =
        document.getElementById(
            "pageTitle"
        );

    const subtitle =
        document.getElementById(
            "pageSubtitle"
        );

    if (!title || !subtitle) {
        return;
    }


    if (page === "home") {

        title.textContent =
            "Memory Vault";

        subtitle.textContent =
            "Your personal space for memories.";

        return;
    }


    if (page === "folders") {

        title.textContent =
            "My Folders";

        subtitle.textContent =
            "Organize your memories your way.";

        return;
    }


    if (page === "favorites") {

        title.textContent =
            "Favorites";

        subtitle.textContent =
            "Your most treasured memories.";

        return;
    }


    if (page === "trash") {

        title.textContent =
            "Trash";

        subtitle.textContent =
            "Deleted memories.";

        return;
    }


    if (page === "folder") {

        const folder =
            getFolder(
                currentFolderId
            );

        title.textContent =
            folder
                ? folder.name
                : "Folder";

        subtitle.textContent =
            "Memories in this folder.";
    }
}


/* ============================================================
   MOBILE MENU
   ============================================================ */

function setupMobileMenu() {

    const menu =
        document.getElementById(
            "menuToggle"
        );

    const sidebar =
        document.getElementById(
            "sidebar"
        );

    const backdrop =
        document.getElementById(
            "sidebarBackdrop"
        );


    if (!menu || !sidebar) {
        return;
    }


    menu.addEventListener(
        "click",
        function (event) {

            event.preventDefault();

            sidebar.classList.toggle(
                "open"
            );

            if (backdrop) {

                backdrop.classList.toggle(
                    "show"
                );
            }
        }
    );


    if (backdrop) {

        backdrop.addEventListener(
            "click",
            closeMobileSidebar
        );
    }
}


function closeMobileSidebar() {

    const sidebar =
        document.getElementById(
            "sidebar"
        );

    const backdrop =
        document.getElementById(
            "sidebarBackdrop"
        );


    if (sidebar) {

        sidebar.classList.remove(
            "open"
        );
    }


    if (backdrop) {

        backdrop.classList.remove(
            "show"
        );
    }
}


/* ============================================================
   FOLDER BUTTONS
   ============================================================ */

function setupFolderButtons() {

    /*
     * EVENT DELEGATION
     *
     * This is intentional.
     *
     * Even if folder grids are re-rendered,
     * New Folder will continue working.
     */

    document.addEventListener(
        "click",
        function (event) {

            const button =
                event.target.closest(
                    "#newFolderBtn, #newFolderBtn2"
                );

            if (!button) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            openNewFolderModal();
        }
    );


    document.addEventListener(
        "click",
        function (event) {

            const createButton =
                event.target.closest(
                    "#createFolderBtn"
                );

            if (!createButton) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            createFolder();
        }
    );


    document.addEventListener(
        "keydown",
        function (event) {

            if (
                event.target &&
                event.target.id ===
                    "folderNameInput" &&
                event.key === "Enter"
            ) {

                event.preventDefault();

                createFolder();
            }
        }
    );
}


function openNewFolderModal() {

    const input =
        document.getElementById(
            "folderNameInput"
        );


    if (input) {
        input.value = "";
    }


    openModal(
        "folderModal"
    );


    setTimeout(
        function () {

            if (input) {
                input.focus();
            }

        },
        100
    );
}


function createFolder() {

    const input =
        document.getElementById(
            "folderNameInput"
        );


    if (!input) {

        showToast(
            "Folder input was not found.",
            "error"
        );

        return;
    }


    const name =
        input.value.trim();


    if (!name) {

        showToast(
            "Please enter a folder name.",
            "error"
        );

        input.focus();

        return;
    }


    const duplicate =
        data.folders.some(
            folder =>
                folder.name
                    .trim()
                    .toLowerCase() ===
                name.toLowerCase()
        );


    if (duplicate) {

        showToast(
            "A folder with this name already exists.",
            "error"
        );

        return;
    }


    data.folders.push({

        id:
            generateId("folder"),

        name:
            name,

        createdAt:
            new Date().toISOString()

    });


    saveData();

    closeModal(
        "folderModal"
    );

    renderEverything();

    showToast(
        "Folder created successfully.",
        "success"
    );
}
/* ============================================================
   CONTINUE MEDIA
   ============================================================ */

    ) +
        " " +
        (units[index] || "B");
}


/* ============================================================
   FILTERS
   ============================================================ */

function setupFilters() {

    document.addEventListener(
        "click",
        function (event) {

            const button =
                event.target.closest(
                    ".filter-btn[data-filter]"
                );

            if (!button) {
                return;
            }

            event.preventDefault();

            currentFilter =
                button.dataset.filter ||
                "all";

            document
                .querySelectorAll(
                    ".filter-btn[data-filter]"
                )
                .forEach(function (item) {

                    item.classList.toggle(
                        "active",
                        item === button
                    );
                });

            renderCurrentFolder();
        }
    );
}


/* ============================================================
   SEARCH
   ============================================================ */

function setupSearch() {

    const searchInput =
        document.getElementById(
            "searchInput"
        );

    const clearSearch =
        document.getElementById(
            "clearSearch"
        );


    if (searchInput) {

        searchInput.addEventListener(
            "input",
            function () {

                const value =
                    searchInput.value
                        .trim()
                        .toLowerCase();

                if (clearSearch) {

                    clearSearch.style.display =
                        value
                            ? "block"
                            : "none";
                }

                renderSearchResults(
                    value
                );
            }
        );
    }


    if (clearSearch) {

        clearSearch.addEventListener(
            "click",
            function () {

                if (searchInput) {
                    searchInput.value = "";
                }

                clearSearch.style.display =
                    "none";

                renderSearchResults("");
            }
        );
    }
}


function renderSearchResults(query) {

    /*
     * If there is no search query,
     * simply refresh the normal page.
     */
    if (!query) {

        renderEverything();

        return;
    }


    const results =
        getActiveItems()
            .filter(function (item) {

                const folder =
                    getFolder(
                        item.folderId
                    );

                const searchable =
                    [
                        item.title,
                        item.plainText,
                        item.fileName,
                        folder
                            ? folder.name
                            : "",
                        item.type
                    ]
                        .join(" ")
                        .toLowerCase();

                return searchable.includes(
                    query
                );
            });


    /*
     * Search can work globally,
     * so show results in the current
     * memory grid when possible.
     */
    const containers = [
        document.getElementById(
            "recentMemoryGrid"
        ),
        document.getElementById(
            "folderMemoryGrid"
        )
    ];


    let container = null;


    if (
        document
            .getElementById("homePage")
            ?.classList.contains("active")
    ) {

        container =
            document.getElementById(
                "recentMemoryGrid"
            );

    } else {

        container =
            document.getElementById(
                "folderMemoryGrid"
            );
    }


    if (!container) {

        container =
            containers.find(
                element => element
            );
    }


    if (!container) {
        return;
    }


    container.innerHTML = "";


    if (results.length === 0) {

        container.innerHTML =
            createEmptyStateHTML(
                "No memories found",
                "Try a different search."
            );

        return;
    }


    results
        .sort(function (a, b) {

            return (
                new Date(
                    b.updatedAt ||
                    b.createdAt
                ) -
                new Date(
                    a.updatedAt ||
                    a.createdAt
                )
            );
        })
        .forEach(function (item) {

            container.appendChild(
                createMemoryCard(item)
            );
        });
}


/* ============================================================
   FAVORITES
   ============================================================ */

function toggleFavorite(itemId) {

    const item =
        getItem(itemId);

    if (!item || item.trashed) {
        return;
    }


    item.favorite =
        !Boolean(item.favorite);

    item.updatedAt =
        new Date().toISOString();


    saveData();

    renderEverything();


    showToast(
        item.favorite
            ? "Added to favorites."
            : "Removed from favorites.",
        "success"
    );
}


/* ============================================================
   TRASH
   ============================================================ */

function setupTrash() {

    document.addEventListener(
        "click",
        function (event) {

            const emptyButton =
                event.target.closest(
                    "#emptyTrashBtn"
                );

            if (!emptyButton) {
                return;
            }

            event.preventDefault();

            emptyTrash();
        }
    );
}


function moveMemoryToTrash(itemId) {

    const item =
        getItem(itemId);

    if (!item) {
        return;
    }


    item.trashed = true;

    item.deletedAt =
        new Date().toISOString();

    item.updatedAt =
        new Date().toISOString();


    saveData();

    closeActionMenu();

    renderEverything();


    showToast(
        "Memory moved to Trash.",
        "success"
    );
}


function restoreMemory(itemId) {

    const item =
        getItem(itemId);

    if (!item) {
        return;
    }


    item.trashed = false;

    item.deletedAt = null;

    item.updatedAt =
        new Date().toISOString();


    saveData();

    renderEverything();


    showToast(
        "Memory restored.",
        "success"
    );
}


function permanentlyDeleteMemory(itemId) {

    const item =
        getItem(itemId);

    if (!item) {
        return;
    }


    showUIDialog({
        title: "Delete Permanently",
        message:
            "This memory will be permanently deleted. This cannot be undone.",
        confirmText: "Delete Permanently",
        danger: true,

        onConfirm: function () {

            data.items =
                data.items.filter(
                    memory =>
                        memory.id !== itemId
                );

            saveData();

            renderEverything();

            showToast(
                "Memory permanently deleted.",
                "success"
            );
        }
    });
}


function emptyTrash() {

    const trashCount =
        data.items.filter(
            item => item.trashed
        ).length;


    if (trashCount === 0) {

        showToast(
            "Trash is already empty.",
            "warning"
        );

        return;
    }


    showUIDialog({
        title: "Empty Trash",
        message:
            `Delete all ${trashCount} deleted ${
                trashCount === 1
                    ? "memory"
                    : "memories"
            } permanently? This cannot be undone.`,
        confirmText: "Empty Trash",
        danger: true,

        onConfirm: function () {

            data.items =
                data.items.filter(
                    item => !item.trashed
                );

            saveData();

            renderEverything();

            showToast(
                "Trash emptied.",
                "success"
            );
        }
    });
}


/* ============================================================
   FOLDER RENDERING
   ============================================================ */

function renderFolders() {

    renderFolderGrid(
        document.getElementById(
            "folderGrid"
        )
    );

    renderFolderGrid(
        document.getElementById(
            "allFolderGrid"
        )
    );
}


function renderFolderGrid(container) {

    if (!container) {
        return;
    }


    container.innerHTML = "";


    data.folders.forEach(
        function (folder) {

            const count =
                getFolderItems(
                    folder.id
                ).length;


            const card =
                document.createElement(
                    "div"
                );

            card.className =
                "folder-card";

            card.dataset.folderId =
                folder.id;


            card.innerHTML = `

                <div class="folder-icon">
                    <i class="bi bi-folder2"></i>
                </div>

                <h3>
                    ${escapeHTML(folder.name)}
                </h3>

                <p>
                    ${count}
                    ${
                        count === 1
                            ? "memory"
                            : "memories"
                    }
                </p>

                <button
                    class="folder-menu"
                    type="button"
                    title="Folder options"
                >
                    <i class="bi bi-three-dots"></i>
                </button>

            `;


            card.addEventListener(
                "click",
                function (event) {

                    if (
                        event.target.closest(
                            ".folder-menu"
                        )
                    ) {
                        return;
                    }

                    openFolder(
                        folder.id
                    );
                }
            );


            const menu =
                card.querySelector(
                    ".folder-menu"
                );


            if (menu) {

                menu.addEventListener(
                    "click",
                    function (event) {

                        event.preventDefault();
                        event.stopPropagation();

                        showFolderMenu(
                            folder
                        );
                    }
                );
            }


            container.appendChild(
                card
            );
        }
    );


    /*
     * New Folder card
     */
    const newCard =
        document.createElement(
            "button"
        );

    newCard.type = "button";

    newCard.className =
        "new-folder-card";


    newCard.innerHTML = `

        <span class="new-folder-icon">
            <i class="bi bi-plus-lg"></i>
        </span>

        <strong>
            New Folder
        </strong>

        <span>
            Organize your memories
        </span>

    `;


    newCard.addEventListener(
        "click",
        function (event) {

            event.preventDefault();

            openNewFolderModal();
        }
    );


    container.appendChild(
        newCard
    );
}


/* ============================================================
   FOLDER MENU
   ============================================================ */

function showFolderMenu(folder) {

    if (!folder) {
        return;
    }


    openActionMenu({

        title:
            folder.name,

        actions: [

            {
                label: "Rename",
                icon: "bi-pencil",
                className: "",
                action: function () {

                    closeActionMenu();

                    renameFolder(
                        folder.id
                    );
                }
            },

            {
                label: "Delete",
                icon: "bi-trash3",
                className:
                    "danger",
                action: function () {

                    closeActionMenu();

                    deleteFolder(
                        folder.id
                    );
                }
            }

        ]

    });
}


function renameFolder(folderId) {

    const folder =
        getFolder(folderId);

    if (!folder) {
        return;
    }


    showUIDialog({

        title: "Rename Folder",

        message:
            "Enter a new name for this folder.",

        input: true,

        inputValue:
            folder.name,

        confirmText:
            "Rename",

        onConfirm:
            function (value) {

                const newName =
                    String(
                        value || ""
                    ).trim();


                if (!newName) {

                    showToast(
                        "Folder name cannot be empty.",
                        "error"
                    );

                    return false;
                }


                const duplicate =
                    data.folders.some(
                        item =>
                            item.id !==
                                folderId &&
                            item.name
                                .toLowerCase() ===
                                newName.toLowerCase()
                    );


                if (duplicate) {

                    showToast(
                        "A folder with this name already exists.",
                        "error"
                    );

                    return false;
                }


                folder.name =
                    newName;


                saveData();

                renderEverything();


                if (
                    currentFolderId ===
                    folderId
                ) {

                    const currentName =
                        document.getElementById(
                            "currentFolderName"
                        );

                    if (currentName) {

                        currentName.textContent =
                            newName;
                    }

                    updateHeader(
                        "folder"
                    );
                }


                showToast(
                    "Folder renamed.",
                    "success"
                );

                return true;
            }

    });
}


function deleteFolder(folderId) {

    const folder =
        getFolder(folderId);

    if (!folder) {
        return;
    }


    if (data.folders.length <= 1) {

        showToast(
            "You need at least one folder.",
            "error"
        );

        return;
    }


    showUIDialog({

        title:
            "Delete Folder",

        message:
            `"${folder.name}" will be deleted and its memories will be moved to Trash.`,

        confirmText:
            "Delete Folder",

        danger: true,

        onConfirm:
            function () {

                data.items.forEach(
                    function (item) {

                        if (
                            item.folderId ===
                                folderId &&
                            !item.trashed
                        ) {

                            item.trashed =
                                true;

                            item.deletedAt =
                                new Date()
                                    .toISOString();
                        }
                    }
                );


                data.folders =
                    data.folders.filter(
                        item =>
                            item.id !==
                            folderId
                    );


                saveData();


                if (
                    currentFolderId ===
                    folderId
                ) {

                    currentFolderId =
                        null;

                    showPage(
                        "folders"
                    );
                }


                renderEverything();


                showToast(
                    "Folder deleted. Its memories were moved to Trash.",
                    "success"
                );

                return true;
            }

    });
}


/* ============================================================
   OPEN FOLDER
   ============================================================ */

function openFolder(folderId) {

    const folder =
        getFolder(folderId);

    if (!folder) {
        return;
    }


    currentFolderId =
        folderId;

    currentFilter =
        "all";


    const folderName =
        document.getElementById(
            "currentFolderName"
        );


    if (folderName) {

        folderName.textContent =
            folder.name;
    }


    document
        .querySelectorAll(
            ".filter-btn[data-filter]"
        )
        .forEach(
            function (button) {

                button.classList.toggle(
                    "active",
                    button.dataset.filter ===
                        "all"
                );
            }
        );


    showPage(
        "folder"
    );
}


/* ============================================================
   MEMORY BUTTONS
   ============================================================ */

function setupMemoryButtons() {

    /*
     * EVENT DELEGATION
     *
     * This fixes the + button even when
     * the page gets re-rendered.
     */

    document.addEventListener(
        "click",
        function (event) {

            const button =
                event.target.closest(
                    "#addMemoryBtn, #floatingAdd"
                );

            if (!button) {
                return;
            }


            event.preventDefault();
            event.stopPropagation();


            if (!currentFolderId) {

                showPage(
                    "folders"
                );

                showToast(
                    "Please open a folder first.",
                    "warning"
                );

                return;
            }


            openMemoryTypeModal();
        }
    );


    /*
     * Memory type cards.
     */

    document.addEventListener(
        "click",
        function (event) {

            const card =
                event.target.closest(
                    ".memory-type-card[data-type]"
                );

            if (!card) {
                return;
            }


            event.preventDefault();
            event.stopPropagation();


            const type =
                card.dataset.type;


            if (!type) {
                return;
            }


            currentMemoryType =
                type;


            closeModal(
                "memoryTypeModal"
            );


            if (type === "text") {

                openTextEditor();

            } else {

                openMediaModal(
                    type
                );
            }
        }
    );
}


function openMemoryTypeModal() {

    if (!currentFolderId) {

        showToast(
            "Please open a folder first.",
            "warning"
        );

        return;
    }


    openModal(
        "memoryTypeModal"
    );
}


/* ============================================================
   MEMORY CARDS
   ============================================================ */

function createMemoryCard(item) {

    const card =
        document.createElement(
            "div"
        );

    card.className =
        "memory-card";

    card.dataset.memoryId =
        item.id;


    const folder =
        getFolder(
            item.folderId
        );


    const preview =
        getMemoryPreview(
            item
        );


    const icon =
        getMemoryIcon(
            item.type
        );


    const favoriteClass =
        item.favorite
            ? "active"
            : "";


    card.innerHTML = `

        <div class="memory-card-top">

            <div class="memory-type-icon">
                <i class="bi ${icon}"></i>
            </div>

            <button
                type="button"
                class="favorite-btn ${favoriteClass}"
                title="${
                    item.favorite
                        ? "Remove from favorites"
                        : "Add to favorites"
                }"
            >
                <i class="bi ${
                    item.favorite
                        ? "bi-star-fill"
                        : "bi-star"
                }"></i>
            </button>

            <button
                type="button"
                class="memory-menu-btn"
                title="Memory options"
            >
                <i class="bi bi-three-dots"></i>
            </button>

        </div>


        <div class="memory-card-content">

            <h3>
                ${escapeHTML(
                    item.title ||
                    "Untitled"
                )}
            </h3>

            <p class="memory-preview">
                ${preview}
            </p>

        </div>


        <div class="memory-card-meta">

            <span>
                <i class="bi bi-calendar3"></i>
                ${formatDate(
                    item.createdAt
                )}
            </span>

            ${
                folder
                    ? `
                        <span>
                            <i class="bi bi-folder2"></i>
                            ${escapeHTML(
                                folder.name
                            )}
                        </span>
                    `
                    : ""
            }

        </div>

    `;


    const favoriteButton =
        card.querySelector(
            ".favorite-btn"
        );


    if (favoriteButton) {

        favoriteButton.addEventListener(
            "click",
            function (event) {

                event.preventDefault();
                event.stopPropagation();

                toggleFavorite(
                    item.id
                );
            }
        );
    }


    const menuButton =
        card.querySelector(
            ".memory-menu-btn"
        );


    if (menuButton) {

        menuButton.addEventListener(
            "click",
            function (event) {

                event.preventDefault();
                event.stopPropagation();

                showMemoryMenu(
                    item
                );
            }
        );
    }


    card.addEventListener(
        "click",
        function (event) {

            if (
                event.target.closest(
                    ".favorite-btn"
                ) ||
                event.target.closest(
                    ".memory-menu-btn"
                )
            ) {
                return;
            }


            openMemory(
                item.id
            );
        }
    );


    return card;
}


/* ============================================================
   MEMORY ICON
   ============================================================ */

function getMemoryIcon(type) {

    if (type === "text") {
        return "bi-file-text";
    }

    if (type === "photo") {
        return "bi-image";
    }

    if (type === "video") {
        return "bi-camera-video";
    }

    if (type === "voice") {
        return "bi-mic";
    }

    return "bi-file-earmark";
}


/* ============================================================
   MEMORY PREVIEW
   ============================================================ */

function getMemoryPreview(item) {

    if (item.type === "text") {

        const text =
            item.plainText ||
            stripHTML(
                item.content ||
                ""
            );


        const clean =
            text
                .replace(
                    /\s+/g,
                    " "
                )
                .trim();


        if (!clean) {
            return "Text note";
        }


        return escapeHTML(
            clean.length > 90
                ? clean.substring(
                    0,
                    90
                ) + "..."
                : clean
        );
    }


    if (item.type === "photo") {

        return escapeHTML(
            item.fileName ||
            "Photo memory"
        );
    }


    if (item.type === "video") {

        return escapeHTML(
            item.fileName ||
            "Video memory"
        );
    }


    if (item.type === "voice") {

        return escapeHTML(
            item.fileName ||
            "Voice recording"
        );
    }


    return "Memory";
}


/* ============================================================
   OPEN MEMORY
   ============================================================ */

function openMemory(memoryId) {

    const item =
        getItem(
            memoryId
        );


    if (!item || item.trashed) {
        return;
    }


    if (item.type === "text") {

        openTextMemory(
            item
        );

    } else {

        showUIDialog({

            title:
                item.title ||
                capitalize(
                    item.type
                ),

            message:
                `${capitalize(item.type)} file: ${
                    item.fileName ||
                    "Unnamed file"
                }`,

            confirmText:
                "Close",

            hideCancel:
                true

        });
    }
}


function openTextMemory(item) {

    const title =
        document.getElementById(
            "memoryTitleInput"
        );

    const editor =
        document.getElementById(
            "richTextEditor"
        );


    if (!title || !editor) {
        return;
    }


    currentEditingId =
        item.id;


    title.value =
        item.title || "";


    editor.innerHTML =
        item.content || "";


    updateWordCount();

    openModal(
        "editorModal"
    );
}
        "flex";

        actions.style.gap =
            "7px";

        actions.style.marginTop =
            "13px";


        actions.innerHTML = `

            <button
                class="secondary-btn"
                type="button"
                style="flex:1; min-height:36px; padding:7px;"
                data-restore
            >
                <i class="bi bi-arrow-counterclockwise"></i>
                Restore
            </button>

            <button
                class="danger-btn"
                type="button"
                style="flex:1; min-height:36px; padding:7px;"
                data-delete
            >
                <i class="bi bi-trash3"></i>
                Delete
            </button>

        `;


        actions
            .querySelector("[data-restore]")
            .addEventListener(
                "click",
                function (event) {

                    event.stopPropagation();

                    restoreMemory(
                        item.id
                    );
                }
            );


        actions
            .querySelector("[data-delete]")
            .addEventListener(
                "click",
                function (event) {

                    event.stopPropagation();

                    permanentlyDeleteMemory(
                        item.id
                    );
                }
            );


        card.appendChild(
            actions
        );

        container.appendChild(
            card
        );
    });
}


/* ============================================================
   CURRENT FOLDER RENDER
   ============================================================ */

function renderCurrentFolder() {

    const container =
        document.getElementById(
            "folderMemoryGrid"
        );


    if (!container) {
        return;
    }


    container.innerHTML = "";


    const folder =
        getCurrentFolder();


    if (!folder) {

        container.innerHTML =
            createEmptyStateHTML(
                "Folder not found",
                "Please choose another folder."
            );

        return;
    }


    let items =
        getFolderItems(
            folder.id
        );


    /*
     * Apply filter.
     */

    if (currentFilter === "text") {

        items =
            items.filter(
                item =>
                    item.type === "text"
            );

    } else if (currentFilter === "photo") {

        items =
            items.filter(
                item =>
                    item.type === "photo"
            );

    } else if (currentFilter === "video") {

        items =
            items.filter(
                item =>
                    item.type === "video"
            );

    } else if (currentFilter === "voice") {

        items =
            items.filter(
                item =>
                    item.type === "voice"
            );

    } else if (currentFilter === "favorite") {

        items =
            items.filter(
                item =>
                    item.favorite
            );
    }


    items.sort(
        function (a, b) {

            return (
                new Date(
                    b.updatedAt ||
                    b.createdAt
                ) -
                new Date(
                    a.updatedAt ||
                    a.createdAt
                )
            );
        }
    );


    if (items.length === 0) {

        container.innerHTML =
            createEmptyStateHTML(
                "No memories yet",
                "Click the + button to add your first memory."
            );

        return;
    }


    items.forEach(
        function (item) {

            container.appendChild(
                createMemoryCard(item)
            );
        }
    );
}


/* ============================================================
   HOME PAGE
   ============================================================ */

function renderHome() {

    const recentContainer =
        document.getElementById(
            "recentMemoryGrid"
        );


    if (!recentContainer) {
        return;
    }


    let recent =
        getActiveItems()
            .slice()
            .sort(
                function (a, b) {

                    return (
                        new Date(
                            b.updatedAt ||
                            b.createdAt
                        ) -
                        new Date(
                            a.updatedAt ||
                            a.createdAt
                        )
                    );
                }
            );


    /*
     * Show only recent memories.
     */

    recent =
        recent.slice(
            0,
            8
        );


    recentContainer.innerHTML =
        "";


    if (recent.length === 0) {

        recentContainer.innerHTML =
            createEmptyStateHTML(
                "No memories yet",
                "Create a folder and add your first memory."
            );

    } else {

        recent.forEach(
            function (item) {

                recentContainer.appendChild(
                    createMemoryCard(item)
                );
            }
        );
    }


    renderFolders();
}


/* ============================================================
   FOLDERS PAGE
   ============================================================ */

function renderFoldersPage() {

    renderFolders();
}


/* ============================================================
   EMPTY STATE
   ============================================================ */

function createEmptyStateHTML(
    title,
    message
) {

    return `

        <div class="empty-state">

            <div class="empty-state-icon">
                <i class="bi bi-journal-heart"></i>
            </div>

            <h3>
                ${escapeHTML(title)}
            </h3>

            <p>
                ${escapeHTML(message)}
            </p>

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

    if (currentFolderId) {

        renderCurrentFolder();
    }
}


/* ============================================================
   MODALS
   ============================================================ */

function setupModals() {

    /*
     * Close buttons using [data-close].
     */

    document.addEventListener(
        "click",
        function (event) {

            const closeButton =
                event.target.closest(
                    "[data-close]"
                );

            if (!closeButton) {
                return;
            }


            event.preventDefault();


            const modal =
                closeButton.closest(
                    ".modal-overlay"
                );


            if (modal) {

                closeModal(
                    modal.id
                );
            }
        }
    );


    /*
     * Clicking the dark overlay closes
     * the modal.
     */

    document.addEventListener(
        "click",
        function (event) {

            const modal =
                event.target.closest(
                    ".modal-overlay"
                );


            if (!modal) {
                return;
            }


            if (
                event.target ===
                modal
            ) {

                closeModal(
                    modal.id
                );
            }
        }
    );
}


function openModal(id) {

    const modal =
        document.getElementById(
            id
        );


    if (!modal) {

        console.error(
            `Modal not found: ${id}`
        );

        showToast(
            "This window could not be opened.",
            "error"
        );

        return false;
    }


    modal.classList.add(
        "show"
    );

    modal.classList.add(
        "active"
    );


    /*
     * These inline styles make the
     * modal work even if CSS only
     * defines one of the classes.
     */

    modal.style.display =
        "flex";


    modal.setAttribute(
        "aria-hidden",
        "false"
    );


    return true;
}


function closeModal(id) {

    if (!id) {
        return;
    }


    const modal =
        document.getElementById(
            id
        );


    if (!modal) {
        return;
    }


    modal.classList.remove(
        "show"
    );

    modal.classList.remove(
        "active"
    );


    modal.style.display =
        "none";


    modal.setAttribute(
        "aria-hidden",
        "true"
    );
}


/* ============================================================
   CUSTOM UI DIALOG
   ============================================================ */

function createUIDialog() {

    let overlay =
        document.getElementById(
            "customUIDialog"
        );


    if (overlay) {
        return overlay;
    }


    overlay =
        document.createElement(
            "div"
        );


    overlay.id =
        "customUIDialog";


    overlay.className =
        "custom-ui-dialog";


    overlay.innerHTML = `

        <div class="custom-ui-dialog-backdrop"></div>

        <div class="custom-ui-dialog-box">

            <div class="custom-ui-dialog-header">

                <h3
                    id="customUIDialogTitle"
                >
                    Confirm
                </h3>

                <button
                    type="button"
                    id="customUIDialogClose"
                    class="custom-ui-dialog-close"
                >
                    <i class="bi bi-x-lg"></i>
                </button>

            </div>


            <div
                id="customUIDialogMessage"
                class="custom-ui-dialog-message"
            ></div>


            <div
                id="customUIDialogInputWrapper"
                style="display:none;"
            >

                <input
                    type="text"
                    id="customUIDialogInput"
                    class="form-control"
                    autocomplete="off"
                >

            </div>


            <div class="custom-ui-dialog-actions">

                <button
                    type="button"
                    id="customUIDialogCancel"
                    class="secondary-btn"
                >
                    Cancel
                </button>

                <button
                    type="button"
                    id="customUIDialogConfirm"
                    class="primary-btn"
                >
                    Confirm
                </button>

            </div>

        </div>

    `;


    /*
     * Inline styling keeps this dialog
     * independent of the existing CSS.
     */

    overlay.style.position =
        "fixed";

    overlay.style.inset =
        "0";

    overlay.style.zIndex =
        "10000";

    overlay.style.display =
        "none";

    overlay.style.alignItems =
        "center";

    overlay.style.justifyContent =
        "center";


    const backdrop =
        overlay.querySelector(
            ".custom-ui-dialog-backdrop"
        );


    if (backdrop) {

        backdrop.style.position =
            "absolute";

        backdrop.style.inset =
            "0";

        backdrop.style.background =
            "rgba(0,0,0,0.65)";
    }


    const box =
        overlay.querySelector(
            ".custom-ui-dialog-box"
        );


    if (box) {

        box.style.position =
            "relative";

        box.style.zIndex =
            "2";

        box.style.width =
            "min(92vw, 430px)";

        box.style.padding =
            "22px";

        box.style.borderRadius =
            "18px";

        box.style.background =
            "var(--card-bg, #1f1f1f)";

        box.style.color =
            "var(--text-color, #fff)";

        box.style.boxShadow =
            "0 20px 70px rgba(0,0,0,0.4)";
    }


    const header =
        overlay.querySelector(
            ".custom-ui-dialog-header"
        );


    if (header) {

        header.style.display =
            "flex";

        header.style.alignItems =
            "center";

        header.style.justifyContent =
            "space-between";

        header.style.gap =
            "10px";
    }


    const message =
        overlay.querySelector(
            ".custom-ui-dialog-message"
        );


    if (message) {

        message.style.margin =
            "14px 0";
    }


    const actions =
        overlay.querySelector(
            ".custom-ui-dialog-actions"
        );


    if (actions) {

        actions.style.display =
            "flex";

        actions.style.justifyContent =
            "flex-end";

        actions.style.gap =
            "10px";

        actions.style.marginTop =
            "18px";
    }


    document.body.appendChild(
        overlay
    );


    return overlay;
}


let activeUIDialogConfirm = null;


function showUIDialog(options = {}) {

    const overlay =
        createUIDialog();


    const title =
        document.getElementById(
            "customUIDialogTitle"
        );

    const message =
        document.getElementById(
            "customUIDialogMessage"
        );

    const inputWrapper =
        document.getElementById(
            "customUIDialogInputWrapper"
        );

    const input =
        document.getElementById(
            "customUIDialogInput"
        );

    const cancel =
        document.getElementById(
            "customUIDialogCancel"
        );

    const confirmButton =
        document.getElementById(
            "customUIDialogConfirm"
        );

    const close =
        document.getElementById(
            "customUIDialogClose"
        );


    if (title) {

        title.textContent =
            options.title ||
            "Confirm";
    }


    if (message) {

        message.textContent =
            options.message ||
            "";
    }


    const hasInput =
        Boolean(
            options.input
        );


    if (inputWrapper) {

        inputWrapper.style.display =
            hasInput
                ? "block"
                : "none";
    }


    if (input) {

        input.value =
            options.inputValue ||
            "";
    }


    if (cancel) {

        cancel.style.display =
            options.hideCancel
                ? "none"
                : "inline-flex";
    }


    if (confirmButton) {

        confirmButton.textContent =
            options.confirmText ||
            "Confirm";


        confirmButton.classList.toggle(
            "danger-btn",
            Boolean(options.danger)
        );


        confirmButton.classList.toggle(
            "primary-btn",
            !options.danger
        );
    }


    overlay.style.display =
        "flex";


    activeUIDialogConfirm =
        options.onConfirm ||
        null;


    function closeDialog() {

        overlay.style.display =
            "none";

        activeUIDialogConfirm =
            null;
    }


    close.onclick =
        closeDialog;

    cancel.onclick =
        closeDialog;


    if (options.hideCancel) {

        cancel.onclick =
            closeDialog;
    }


    confirmButton.onclick =
        function () {

            if (
                typeof activeUIDialogConfirm ===
                "function"
            ) {

                const value =
                    hasInput
                        ? input.value
                        : undefined;


                const result =
                    activeUIDialogConfirm(
                        value
                    );


                /*
                 * Returning false keeps
                 * the dialog open.
                 */

                if (result === false) {
                    return;
                }
            }


            closeDialog();
        };


    if (hasInput) {

        setTimeout(
            function () {

                input.focus();

                input.select();

            },
            50
        );


        input.onkeydown =
            function (event) {

                if (
                    event.key === "Enter"
                ) {

                    event.preventDefault();

                    confirmButton.click();
                }


                if (
                    event.key === "Escape"
                ) {

                    event.preventDefault();

                    closeDialog();
                }
            };
    }
}


/* ============================================================
   ACTION MENU
   ============================================================ */

function openActionMenu(options = {}) {

    closeActionMenu();


    const overlay =
        document.createElement(
            "div"
        );


    overlay.id =
        "temporaryActionMenu";


    overlay.style.position =
        "fixed";

    overlay.style.inset =
        "0";

    overlay.style.zIndex =
        "9998";


    const box =
        document.createElement(
            "div"
        );


    box.style.position =
        "absolute";

    box.style.left =
        "50%";

    box.style.top =
        "50%";

    box.style.transform =
        "translate(-50%, -50%)";

    box.style.width =
        "min(90vw, 340px)";

    box.style.padding =
        "18px";

    box.style.borderRadius =
        "18px";

    box.style.background =
        "var(--card-bg, #1f1f1f)";

    box.style.boxShadow =
        "0 20px 70px rgba(0,0,0,0.45)";


    const title =
        document.createElement(
            "h3"
        );


    title.textContent =
        options.title ||
        "Options";


    title.style.margin =
        "0 0 14px";


    box.appendChild(
        title
    );


    (options.actions || [])
        .forEach(
            function (action) {

                const button =
                    document.createElement(
                        "button"
                    );


                button.type =
                    "button";


                button.className =
                    "secondary-btn";


                button.style.width =
                    "100%";


                button.style.justifyContent =
                    "flex-start";


                button.style.marginBottom =
                    "8px";


                if (
                    action.className
                ) {

                    button.classList.add(
                        action.className
                    );
                }


                button.innerHTML = `

                    <i class="bi ${
                        action.icon ||
                        "bi-three-dots"
                    }"></i>

                    <span>
                        ${escapeHTML(
                            action.label
                        )}
                    </span>

                `;


                button.addEventListener(
                    "click",
                    function (event) {

                        event.stopPropagation();

                        if (
                            typeof action.action ===
                            "function"
                        ) {

                            action.action();
                        }
                    }
                );


                box.appendChild(
                    button
                );
            }
        );


    overlay.appendChild(
        box
    );


    overlay.addEventListener(
        "click",
        function (event) {

            if (
                event.target ===
                overlay
            ) {

                closeActionMenu();
            }
        }
    );


    document.body.appendChild(
        overlay
    );
}


function closeActionMenu() {

    const menu =
        document.getElementById(
            "temporaryActionMenu"
        );


    if (menu) {

        menu.remove();
    }
}


/* ============================================================
   TOAST
   ============================================================ */

function showToast(
    message,
    type = "success"
) {

    const toast =
        document.getElementById(
            "toast"
        );


    if (!toast) {

        console.log(
            `[${type}] ${message}`
        );

        return;
    }


    toast.textContent =
        message;


    toast.className =
        "toast";


    toast.classList.add(
        type
    );


    toast.classList.add(
        "show"
    );


    clearTimeout(
        window.__diaryToastTimer
    );


    window.__diaryToastTimer =
        setTimeout(
            function () {

                toast.classList.remove(
                    "show"
                );

            },
            5000
        );
}


/* ============================================================
   BACK BUTTON
   ============================================================ */

function setupBackButton() {

    document.addEventListener(
        "click",
        function (event) {

            const button =
                event.target.closest(
                    "#backToFolders"
                );

            if (!button) {
                return;
            }


            event.preventDefault();


            currentFolderId =
                null;


            currentFilter =
                "all";


            showPage(
                "folders"
            );
        }
    );
}


/* ============================================================
   KEYBOARD SHORTCUTS
   ============================================================ */

function setupKeyboardShortcuts() {

    document.addEventListener(
        "keydown",
        function (event) {

            /*
             * Escape
             */

            if (
                event.key ===
                "Escape"
            ) {

                document
                    .querySelectorAll(
                        ".modal-overlay.show, .modal-overlay.active"
                    )
                    .forEach(
                        function (modal) {

                            closeModal(
                                modal.id
                            );
                        }
                    );


                closeActionMenu();

                return;
            }


            /*
             * Ctrl + K / Cmd + K
             */

            if (
                (
                    event.ctrlKey ||
                    event.metaKey
                ) &&
                event.key.toLowerCase() ===
                    "k"
            ) {

                event.preventDefault();


                const search =
                    document.getElementById(
                        "searchInput"
                    );


                if (search) {

                    search.focus();

                    search.select();
                }
            }
        }
    );
}


/* ============================================================
   INITIAL PAGE
   ============================================================ */

function initializePage() {

    currentFolderId =
        null;

    currentFilter =
        "all";

    showPage(
        "home"
    );
}


/* ============================================================
   SAVE BEFORE LEAVING
   ============================================================ */

window.addEventListener(
    "beforeunload",
    function () {

        saveData();
    }
);


/* ============================================================
   SAFETY: HANDLE STORAGE CHANGES
   ============================================================ */

window.addEventListener(
    "storage",
    function (event) {

        if (
            event.key !==
            STORAGE_KEY
        ) {
            return;
        }


        loadData();

        renderEverything();
    }
);


/* ============================================================
   FINAL SAFETY HELPERS
   ============================================================ */

function safeText(value) {

    return escapeHTML(
        value || ""
    );
}


function hasItemsInFolder(
    folderId
) {

    return data.items.some(
        function (item) {

            return (
                item.folderId ===
                    folderId &&
                !item.trashed
            );
        }
    );
}


/* ============================================================
   END OF APP.JS
   ============================================================ */
   // ============================================================
// CUSTOM UI DIALOG
// ============================================================

function createUIDialog() {
    if (document.getElementById("customUIDialog")) {
        return;
    }

    const dialog = document.createElement("div");
    dialog.id = "customUIDialog";

    dialog.innerHTML = `
        <div class="ui-dialog-backdrop">
            <div class="ui-dialog">

                <div class="ui-dialog-icon">
                    <i id="uiDialogIcon" class="bi bi-question-circle"></i>
                </div>

                <h3 id="uiDialogTitle">
                    Are you sure?
                </h3>

                <p id="uiDialogMessage"></p>

                <input
                    id="uiDialogInput"
                    type="text"
                    autocomplete="off"
                >

                <div class="ui-dialog-actions">

                    <button
                        type="button"
                        id="uiDialogCancel"
                        class="secondary-btn"
                    >
                        Cancel
                    </button>

                    <button
                        type="button"
                        id="uiDialogConfirm"
                        class="primary-btn"
                    >
                        Confirm
                    </button>

                </div>

            </div>
        </div>
    `;

    document.body.appendChild(dialog);

    const style = document.createElement("style");

    style.textContent = `
        #customUIDialog {
            position: fixed;
            inset: 0;
            z-index: 99999;
            display: none;
        }

        #customUIDialog.show {
            display: block;
        }

        .ui-dialog-backdrop {
            position: absolute;
            inset: 0;
            background: rgba(0, 0, 0, .68);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }

        .ui-dialog {
            width: min(430px, 100%);
            box-sizing: border-box;
            background: var(--card-bg, #1e1e2e);
            color: var(--text-color, #fff);
            border: 1px solid var(--border-color, rgba(255,255,255,.1));
            border-radius: 18px;
            padding: 26px;
            box-shadow: 0 24px 70px rgba(0,0,0,.45);
            text-align: center;
            animation: diaryDialogIn .16s ease-out;
        }

        .ui-dialog-icon {
            font-size: 34px;
            margin-bottom: 10px;
        }

        .ui-dialog h3 {
            margin: 0 0 9px;
        }

        .ui-dialog p {
            margin: 0 0 18px;
            line-height: 1.5;
            opacity: .75;
        }

        #uiDialogInput {
            width: 100%;
            box-sizing: border-box;
            padding: 12px 13px;
            margin-bottom: 18px;
            border-radius: 10px;
            border: 1px solid var(--border-color, rgba(255,255,255,.15));
            background: var(--input-bg, rgba(0,0,0,.2));
            color: inherit;
            outline: none;
        }

        #uiDialogInput:focus {
            border-color: #8b5cf6;
        }

        .ui-dialog-actions {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
        }

        .ui-dialog-actions button {
            min-width: 105px;
        }

        .ui-dialog .danger-btn {
            background: #e74c3c;
            color: #fff;
            border: none;
        }

        @keyframes diaryDialogIn {
            from {
                opacity: 0;
                transform: translateY(8px) scale(.98);
            }

            to {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }
    `;

    document.head.appendChild(style);
}


function showUIDialog({
    title = "Are you sure?",
    message = "",
    icon = "bi-question-circle",
    input = false,
    inputValue = "",
    confirmText = "Confirm",
    danger = false
} = {}) {

    createUIDialog();

    return new Promise(resolve => {

        const dialog =
            document.getElementById(
                "customUIDialog"
            );

        const titleElement =
            document.getElementById(
                "uiDialogTitle"
            );

        const messageElement =
            document.getElementById(
                "uiDialogMessage"
            );

        const iconElement =
            document.getElementById(
                "uiDialogIcon"
            );

        const inputElement =
            document.getElementById(
                "uiDialogInput"
            );

        const confirmButton =
            document.getElementById(
                "uiDialogConfirm"
            );

        const cancelButton =
            document.getElementById(
                "uiDialogCancel"
            );


        titleElement.textContent =
            title;

        messageElement.textContent =
            message;

        iconElement.className =
            `bi ${icon}`;


        inputElement.style.display =
            input
                ? "block"
                : "none";

        inputElement.value =
            inputValue;


        confirmButton.textContent =
            confirmText;


        confirmButton.classList.toggle(
            "danger-btn",
            danger
        );


        if (!danger) {

            confirmButton.classList.add(
                "primary-btn"
            );
        }


        dialog.classList.add(
            "show"
        );


        let finished = false;


        const finish = result => {

            if (finished) {
                return;
            }


            finished = true;


            dialog.classList.remove(
                "show"
            );


            confirmButton.onclick =
                null;

            cancelButton.onclick =
                null;

            inputElement.onkeydown =
                null;


            resolve(result);
        };


        confirmButton.onclick =
            () => {

                finish(
                    input
                        ? {
                            confirmed: true,
                            value:
                                inputElement.value.trim()
                        }
                        : {
                            confirmed: true
                        }
                );
            };


        cancelButton.onclick =
            () => {

                finish({
                    confirmed: false
                });
            };


        inputElement.onkeydown =
            event => {

                if (
                    event.key ===
                    "Enter"
                ) {

                    event.preventDefault();

                    confirmButton.click();
                }


                if (
                    event.key ===
                    "Escape"
                ) {

                    event.preventDefault();

                    cancelButton.click();
                }
            };


        if (input) {

            setTimeout(
                () => {

                    inputElement.focus();
                    inputElement.select();

                },
                50
            );

        } else {

            setTimeout(
                () => {

                    confirmButton.focus();

                },
                50
            );
        }
    });
}


// ============================================================
// SMALL ACTION MENU
// ============================================================

function openActionMenu({
    title,
    options,
    onSelect
}) {

    closeActionMenu();


    const menu =
        document.createElement(
            "div"
        );

    menu.id =
        "diaryActionMenu";

    menu.className =
        "diary-action-menu";


    menu.innerHTML = `

        <div class="diary-action-menu-inner">

            <div class="diary-action-menu-title">
                ${escapeHtml(title)}
            </div>

            ${options.map(option => `

                <button
                    type="button"
                    class="diary-action-option ${
                        option.danger
                            ? "danger"
                            : ""
                    }"
                    data-value="${escapeHtml(
                        option.value
                    )}"
                >

                    <i class="bi ${
                        escapeHtml(
                            option.icon ||
                            "bi-dot"
                        )
                    }"></i>

                    <span>
                        ${escapeHtml(
                            option.label
                        )}
                    </span>

                </button>

            `).join("")}

        </div>

    `;


    const style =
        document.createElement(
            "style"
        );

    style.id =
        "diaryActionMenuStyle";


    style.textContent = `

        .diary-action-menu {
            position: fixed;
            inset: 0;
            z-index: 99990;
            background: rgba(0,0,0,.12);
        }

        .diary-action-menu-inner {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: min(330px, calc(100% - 32px));
            padding: 8px;
            border-radius: 16px;
            background: var(--card-bg, #1e1e2e);
            border: 1px solid
                var(--border-color, rgba(255,255,255,.12));
            box-shadow:
                0 20px 60px rgba(0,0,0,.4);
        }

        .diary-action-menu-title {
            padding: 12px 13px 10px;
            font-weight: 700;
            opacity: .75;
        }

        .diary-action-option {
            width: 100%;
            display: flex;
            align-items: center;
            gap: 11px;
            border: 0;
            background: transparent;
            color: inherit;
            padding: 12px 13px;
            border-radius: 10px;
            cursor: pointer;
            text-align: left;
        }

        .diary-action-option:hover {
            background: rgba(255,255,255,.07);
        }

        .diary-action-option.danger {
            color: #e74c3c;
        }

    `;


    document.head.appendChild(
        style
    );

    document.body.appendChild(
        menu
    );


    menu.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                menu
            ) {

                closeActionMenu();

                return;
            }


            const option =
                event.target.closest(
                    ".diary-action-option"
                );


            if (!option) {
                return;
            }


            const value =
                option.dataset.value;


            closeActionMenu();


            onSelect(value);
        }
    );
}


function closeActionMenu() {

    document
        .getElementById(
            "diaryActionMenu"
        )
        ?.remove();


    document
        .getElementById(
            "diaryActionMenuStyle"
        )
        ?.remove();
}


// ============================================================
// TOAST
// ============================================================

function showToast(
    message,
    type = "default"
) {

    const toast =
        document.getElementById(
            "toast"
        );


    if (!toast) {

        console.log(message);

        return;
    }


    toast.textContent =
        message;


    toast.className =
        "toast";


    toast.classList.add(
        type
    );


    toast.classList.add(
        "show"
    );


    clearTimeout(
        toastTimer
    );


    toastTimer =
        setTimeout(
            () => {

                toast.classList.remove(
                    "show"
                );

            },
            5000
        );
}


// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================

function setupKeyboardShortcuts() {

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.ctrlKey &&
                event.key.toLowerCase() ===
                    "k"
            ) {

                event.preventDefault();

                document
                    .getElementById(
                        "searchInput"
                    )
                    ?.focus();
            }


            if (
                event.key ===
                "Escape"
            ) {

                closeActionMenu();


                document
                    .querySelectorAll(
                        ".modal-overlay.show, .modal-overlay.active"
                    )
                    .forEach(
                        modal =>
                            closeModal(
                                modal.id
                            )
                    );


                document
                    .getElementById(
                        "customUIDialog"
                    )
                    ?.classList.remove(
                        "show"
                    );


                closeMobileSidebar();
            }
        }
    );
}


// ============================================================
// INITIAL PAGE
// ============================================================

function initializePage() {

    document
        .querySelectorAll(
            ".page"
        )
        .forEach(
            page => {

                page.style.display =
                    "none";

                page.classList.remove(
                    "active"
                );
            }
        );


    const home =
        document.getElementById(
            "homePage"
        );


    if (home) {

        home.style.display =
            "block";

        home.classList.add(
            "active"
        );
    }


    updateActiveNavigation(
        "home"
    );

    updatePageHeader(
        "home"
    );
}


// ============================================================
// UTILITIES
// ============================================================

function emptyState(
    icon,
    title,
    message
) {

    return `

        <div class="empty-state">

            <i class="bi ${
                escapeHtml(icon)
            }"></i>

            <h3>
                ${escapeHtml(title)}
            </h3>

            <p>
                ${escapeHtml(message)}
            </p>

        </div>

    `;
}


function formatDate(
    dateString
) {

    if (!dateString) {
        return "";
    }


    const date =
        new Date(
            dateString
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "";
    }


    return date.toLocaleDateString(
        undefined,
        {
            day: "numeric",
            month: "short",
            year: "numeric"
        }
    );
}


function capitalize(
    value
) {

    if (!value) {
        return "";
    }


    return (
        value.charAt(0).toUpperCase() +
        value.slice(1)
    );
}


function escapeHtml(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";
    }


    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}


function getPreviousPage() {

    return (
        sessionStorage.getItem(
            "previousDiaryPage"
        ) ||
        "folders"
    );
}