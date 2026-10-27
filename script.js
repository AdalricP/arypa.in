const tabButtons = [...document.querySelectorAll(".menu-button")];
const tabPanels = [...document.querySelectorAll(".tab-panel")];
const subTabButtons = [...document.querySelectorAll(".sub-menu-button")];
const subTabPanels = [...document.querySelectorAll(".sub-tab-panel")];
const essayLinks = [...document.querySelectorAll("[data-essay]")];
const essayList = document.querySelector(".essay-list");
const essayReader = document.querySelector("#essay-reader");

const activeSubtabs = { reading: "recommendations" };

function activateTab(target) {
  tabButtons.forEach((button) => {
    const active = button.dataset.tab === target;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
  tabPanels.forEach((panel) => panel.classList.toggle("is-active", panel.id === target));

  subTabButtons.forEach((button) => {
    const active = button.dataset.parent === target && button.dataset.subtab === activeSubtabs[target];
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
}

function activateSubtab(parent, target) {
  activeSubtabs[parent] = target;
  subTabPanels
    .filter((panel) => panel.dataset.parent === parent)
    .forEach((panel) => panel.classList.toggle("is-active", panel.id === target));
  activateTab(parent);
}

function showEssayList() {
  essayReader.hidden = true;
  essayReader.replaceChildren();
  essayList.hidden = false;
}

async function showEssay(slug) {
  essayReader.hidden = false;
  essayList.hidden = true;
  essayReader.textContent = "Loading essay…";

  try {
    const response = await fetch(`essays/${slug}/index.html`);
    if (!response.ok) throw new Error("The essay could not be loaded.");

    const source = new DOMParser().parseFromString(await response.text(), "text/html");
    const article = source.querySelector("article");
    if (!article) throw new Error("The essay could not be loaded.");

    article.querySelector(".back")?.remove();
    article.querySelectorAll("[src]").forEach((element) => {
      const path = element.getAttribute("src");
      if (path && !/^(?:[a-z]+:|\/|data:)/i.test(path)) {
        element.setAttribute("src", `essays/${slug}/${path}`);
      }
    });

    essayReader.innerHTML = `${article.innerHTML}<a class="essay-back" href="#essays">← Essays</a>`;
    essayReader.querySelector(".essay-back").addEventListener("click", (event) => {
      event.preventDefault();
      showEssayList();
    });
    const typeset = () => window.MathJax?.typesetPromise?.([essayReader]);
    if (window.MathJax?.typesetPromise) typeset();
    else window.addEventListener("mathjax-ready", typeset, { once: true });
  } catch (error) {
    essayReader.innerHTML = `<p>${error.message}</p><a class="essay-back" href="#essays">← Essays</a>`;
    essayReader.querySelector(".essay-back").addEventListener("click", (event) => {
      event.preventDefault();
      showEssayList();
    });
  }
}

tabButtons.forEach((button) => button.addEventListener("click", () => {
  if (button.dataset.tab === "reading") {
    activateSubtab("reading", "recommendations");
  } else {
    activateTab(button.dataset.tab);
  }
  if (button.dataset.tab === "essays") showEssayList();
}));
subTabButtons.forEach((button) => button.addEventListener("click", () => activateSubtab(button.dataset.parent, button.dataset.subtab)));
essayLinks.forEach((link) => link.addEventListener("click", (event) => {
  event.preventDefault();
  activateTab("essays");
  showEssay(link.dataset.essay);
}));

document.querySelectorAll("[data-site-tab]").forEach((link) => link.addEventListener("click", (event) => {
  event.preventDefault();
  activateTab(link.dataset.siteTab);
}));

document.querySelectorAll(".secret-quest").forEach((link) => link.addEventListener("click", (event) => {
  if (link.dataset.armed === "true") return;
  event.preventDefault();
  link.dataset.armed = "true";
  window.setTimeout(() => delete link.dataset.armed, 1500);
}));


function articleItem(article) {
  const item = document.createElement("li");
  const link = document.createElement("a");
  link.href = article.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = article.title;
  item.append(link);
  if (article.note) item.append(` — ${article.note}`);
  return item;
}

fetch("articles.json", { cache: "no-cache" })
  .then((response) => response.json())
  .then((articles) => {
    const technical = articles.filter((article) => article.kind === "technical");
    const influences = articles.filter((article) => article.kind !== "technical");

    document.querySelector("#technical-list").append(...technical.map(articleItem));

    const list = document.querySelector("#article-list");
    list.append(...influences.slice(0, 3).map(articleItem));
    if (influences.length > 3) {
      const more = document.createElement("li");
      more.innerHTML = '<a href="influences/">more…</a>';
      list.append(more);
    }
  })
  .catch(() => {});
