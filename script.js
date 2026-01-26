
  const QUOTES = [
    { text: "Science is simply common sense at its best.", author: "Thomas Huxley" },
    { text: "The important thing is not to stop questioning.", author: "Albert Einstein" },
    { text: "Somewhere, something incredible is waiting to be known.", author: "Carl Sagan" },
    { text: "Research is formalized curiosity.", author: "Zora Neale Hurston" },
    { text: "What we know is a drop, what we don't know is an ocean.", author: "Isaac Newton" },
    { text: "Every brilliant experiment, like every great work of art, starts with an act of imagination.", author: "Jonah Lehrer" },
    { text: "Science is organized knowledge.", author: "Herbert Spencer" },
    { text: "Experiment is the sole judge of scientific truth.", author: "Richard Feynman" }
  ];

  let elements = [];
  let dropBuffer = [];
  let initialUnlocked = [];
  const MAX_DROP = 6; // limit to avoid UI overflow
  const infoBox = document.getElementById("infoBox");
  const DROP_ZONE_DEFAULT_TEXT = "Drop or tap elements here";
  let dropZoneEl = null;
  const HISTORY_KEY = "combineHistory";
  const MAX_HISTORY = 50;
  const FILTER_KEY = "elementFilters";
  const TUTORIAL_KEY = "tutorialSeen";
  let historyEntries = [];
  let filterState = {
    query: "",
    block: "all",
    showUnlocked: true,
    showLocked: true
  };

  document.addEventListener("DOMContentLoaded", () => {
    // Fade out splash after 2s
    setTimeout(() => {
      const opening = document.getElementById("openingAnimation");
      if(opening){
        opening.classList.add("hidden");
        // Remove after transition ends
        opening.addEventListener("transitionend", () => opening.remove());
      }
    }, 2500);
  });


  function showInfo(el) {
    const e = elements.find(x => x.name === el.dataset.name);
    if (!e) return;
    infoBox.innerHTML = `<strong>${e.name}</strong><br>${e.info || "No description available."}`;
    const rect = el.getBoundingClientRect();
    infoBox.style.top = `${rect.bottom + window.scrollY + 5}px`;
    infoBox.style.left = `${rect.left + window.scrollX}px`;
    infoBox.style.opacity = 1;
  }

  function hideInfo() { infoBox.style.opacity = 0; }

  function addHover(el, e) {
    el.addEventListener("mouseenter", () => showInfo(el));
    el.addEventListener("mouseleave", hideInfo);
  }

  document.getElementById("revealAllBtn").addEventListener("click", () => {
    elements.forEach(e => e.unlocked = true);
    renderElements();
    saveProgress();
  });

  function showDropZoneDefault(target = dropZoneEl) {
    if (!target) return;
    target.dataset.state = "empty";
    target.innerHTML = DROP_ZONE_DEFAULT_TEXT;
  }

  function runOnceAnimation(node, className) {
    if (!node) return;
    node.classList.remove(className);
    // force reflow so animation can restart
    void node.offsetWidth;
    node.classList.add(className);
    node.addEventListener("animationend", () => node.classList.remove(className), { once: true });
  }

  function createDropClone(elementData) {
    const safeName = typeof CSS !== "undefined" && typeof CSS.escape === "function"
      ? CSS.escape(elementData.name)
      : elementData.name.replace(/"/g, '\\"');
    const orig = document.querySelector(`.element[data-name="${safeName}"]`);
    const clone = orig ? orig.cloneNode(true) : document.createElement("div");

    if (!orig) {
      const blockClass = elementData.block ? (elementData.block === "none" ? "none-block" : `${elementData.block}-block`) : "";
      clone.className = `element ${blockClass}`.trim();
      const displayLabel = elementData.symbol || elementData.name || "";
      if (blockClass === "none-block" && displayLabel.length > 3) clone.classList.add("long-label");
      clone.textContent = displayLabel;
    }

    clone.classList.remove("locked");
    clone.classList.remove("newly-unlocked");
    clone.classList.add("drop-element");
    clone.style.cursor = "default";
    clone.draggable = false;
    return clone;
  }

  function addElementToBuffer(elementData, sourceNode = null) {
    if (!elementData || dropBuffer.length >= MAX_DROP || !dropZoneEl) return;
    if (dropZoneEl.dataset.state !== "active") {
      dropZoneEl.innerHTML = "";
      dropZoneEl.dataset.state = "active";
    }
    dropBuffer.push(elementData);
    const clone = createDropClone(elementData);
    dropZoneEl.appendChild(clone);
    runOnceAnimation(dropZoneEl, "dropzone-pulse");
    runOnceAnimation(clone, "buffer-pop");
    if (sourceNode) runOnceAnimation(sourceNode, "touch-pulse");
    updateDropZone(dropZoneEl);
  }

  function attachElementInteractions(div, elementData) {
    div.draggable = true;
    div.addEventListener("dragstart", ev => ev.dataTransfer.setData("text/plain", elementData.name));

    let touchStart = null;
    div.addEventListener("touchstart", evt => {
      if (evt.touches.length !== 1) { touchStart = null; return; }
      const touch = evt.touches[0];
      touchStart = { x: touch.clientX, y: touch.clientY };
    }, { passive: true });

    div.addEventListener("touchend", evt => {
      if (!touchStart) return;
      if (!dropZoneEl) { touchStart = null; return; }
      if (!evt.changedTouches || evt.changedTouches.length === 0) { touchStart = null; return; }
      const touch = evt.changedTouches[0];
      const dx = Math.abs(touch.clientX - touchStart.x);
      const dy = Math.abs(touch.clientY - touchStart.y);
      touchStart = null;
      if (dx > 15 || dy > 15) return; // allow scrolling/dragging
      evt.preventDefault();
      addElementToBuffer(elementData, div);
    }, { passive: false });

    div.addEventListener("touchcancel", () => { touchStart = null; });
  }

  function initQuoteCarousel() {
    const quoteText = document.getElementById("quoteText");
    const quoteAuthor = document.getElementById("quoteAuthor");
    if (!quoteText || !quoteAuthor || QUOTES.length === 0) return;

    let index = 0;
    const applyQuote = () => {
      const { text, author } = QUOTES[index];
      quoteText.textContent = `"${text}"`;
      quoteAuthor.textContent = author;
      index = (index + 1) % QUOTES.length;
    };

    applyQuote();

    setInterval(() => {
      quoteText.style.opacity = 0;
      quoteAuthor.style.opacity = 0;
      setTimeout(() => {
        applyQuote();
        quoteText.style.opacity = 1;
        quoteAuthor.style.opacity = 1;
      }, 300);
    }, 6000);
  }

  function loadElementsData() {
    if (window.ELEMENTS_DATA && Array.isArray(window.ELEMENTS_DATA.elements)) {
      return Promise.resolve(window.ELEMENTS_DATA);
    }
    return fetch("media/elements.json").then(response => {
      if (!response.ok) {
        throw new Error(`Failed to load elements data: ${response.status}`);
      }
      return response.json();
    });
  }

  function loadFilterState() {
    const saved = localStorage.getItem(FILTER_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      filterState = { ...filterState, ...parsed };
    } catch (err) {
      console.warn("Failed to parse saved filters.", err);
    }
  }

  function isTutorialOpen() {
    const overlay = document.getElementById("tutorialOverlay");
    return overlay && !overlay.hidden;
  }

  function showTutorial() {
    const overlay = document.getElementById("tutorialOverlay");
    if (!overlay) return;
    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("tutorial-open");
  }

  function hideTutorial({ markSeen = true } = {}) {
    const overlay = document.getElementById("tutorialOverlay");
    if (!overlay) return;
    overlay.hidden = true;
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("tutorial-open");
    if (markSeen) localStorage.setItem(TUTORIAL_KEY, "true");
  }

  function maybeShowTutorial() {
    const seen = localStorage.getItem(TUTORIAL_KEY);
    if (!seen) showTutorial();
  }

  function saveFilterState() {
    localStorage.setItem(FILTER_KEY, JSON.stringify(filterState));
  }

  function syncFilterControls() {
    const searchInput = document.getElementById("elementSearch");
    const blockFilter = document.getElementById("blockFilter");
    const showUnlocked = document.getElementById("showUnlocked");
    const showLocked = document.getElementById("showLocked");
    if (searchInput) searchInput.value = filterState.query;
    if (blockFilter) blockFilter.value = filterState.block;
    if (showUnlocked) showUnlocked.checked = filterState.showUnlocked;
    if (showLocked) showLocked.checked = filterState.showLocked;
  }

  function matchesFilter(elementData) {
    const query = filterState.query.trim().toLowerCase();
    const name = (elementData.name || "").toLowerCase();
    const symbol = (elementData.symbol || "").toLowerCase();
    const matchesQuery = !query || name.includes(query) || symbol.includes(query);
    const matchesBlock = filterState.block === "all" || elementData.block === filterState.block;
    const matchesUnlockState = (elementData.unlocked && filterState.showUnlocked) || (!elementData.unlocked && filterState.showLocked);
    return matchesQuery && matchesBlock && matchesUnlockState;
  }

  function updateStatusCounts(matchCount) {
    const matchEl = document.getElementById("matchCount");
    const progressEl = document.getElementById("progressCount");
    if (matchEl) matchEl.textContent = `Showing ${matchCount} / ${elements.length}`;
    if (progressEl) {
      const unlocked = elements.filter(e => e.unlocked).length;
      progressEl.textContent = `Unlocked ${unlocked} / ${elements.length}`;
    }
  }


  function renderElements() {
    const container = document.getElementById("periodicGrid");
    if (!container) return;
    const fragment = document.createDocumentFragment();
    const usedCells = new Set();
    let matchCount = 0;

    const minPeriods = Array(19).fill(null);
    elements.forEach(el => {
      const col = Number(el.group);
      const period = Number(el.period);
      if (Number.isNaN(col) || Number.isNaN(period) || col < 1 || col > 18) return;
      if (minPeriods[col] === null || period < minPeriods[col]) minPeriods[col] = period;
    });

    // For each column, find the first (smallest) period where an element exists.
    // Place the column number in the last empty cell before that element by
    // rendering the header at gridRow = minPeriod (note: element gridRow = period + 1).
    for (let c = 1; c <= 18; c++) {
      // compute min period for this column among all elements (use Number coercion)
      const headerRow = Math.max(1, minPeriods[c] || 1);

      const header = document.createElement("div");
      header.className = "column-header";
      header.style.gridColumn = c;
      header.style.gridRow = headerRow; // place above the first element in this column
      header.textContent = c;
      fragment.appendChild(header);
    }

    // Add grid spacers (these refer to period rows). Because we keep a header
    // position relative to periods, spacers that separate blocks shift to 9 and 12.
    for (let i = 1; i <= 18; i++) {
      [9, 12].forEach(row => {
        const spacer = document.createElement("div");
        spacer.className = "grid-spacer";
        spacer.style.gridColumn = i;
        spacer.style.gridRow = row;
        fragment.appendChild(spacer);
      });
    }

    elements
      .forEach(e => {
        if (!matchesFilter(e)) return;
        matchCount += 1;
        const cellKey = `${e.period}-${e.group}`;
        if (usedCells.has(cellKey)) {
          console.warn(`Duplicate cell: ${e.name} at period ${e.period}, group ${e.group}`);
          return; // skip or adjust
        }
        usedCells.add(cellKey);

    const div = document.createElement("div");
    // map block (s,p,d,f,none) to a CSS class like 's-block'
    const blockClass = e.block ? (e.block === "none" ? "none-block" : `${e.block}-block`) : "";
    div.className = `element ${blockClass}${!e.unlocked ? " locked" : ""}`;
    // if this is a 'none' block and the displayed label is long, add a helper class
    const displayLabel = e.symbol || e.name || "";
    if (blockClass === 'none-block' && displayLabel.length > 3) {
      div.classList.add('long-label');
    }
    // shift elements down by 1 to account for the header row
    div.style.gridColumn = e.group;
    div.style.gridRow = (Number(e.period) || 0) + 1;
        div.textContent = e.unlocked ? e.symbol : "?";
        if (e.unlocked) {
          div.dataset.name = e.name;
          attachElementInteractions(div, e);
          addHover(div, e);
        }
        fragment.appendChild(div);
      });

      container.replaceChildren(fragment);
      updateStatusCounts(matchCount);
  }


  function unlockElement(name) {
    const e = elements.find(x => x.name === name);
    if(e && !e.unlocked){
      e.unlocked = true;
      saveProgress();
      renderElements();
      const el = document.querySelector(`.element[data-name="${e.name}"]`);
      if(el){ el.classList.add("newly-unlocked"); setTimeout(()=>el.classList.remove("newly-unlocked"),1600); }
    }
  }

  function saveProgress() {
    localStorage.setItem("unlockedElements", JSON.stringify(elements.filter(e=>e.unlocked).map(e=>e.name)));
  }

  function resetProgress() {
    localStorage.removeItem("unlockedElements");
    elements.forEach(e=>e.unlocked=initialUnlocked.includes(e.name));
    renderElements();
    const dz = document.getElementById("dropZone");
    if (dz) showDropZoneDefault(dz);
    const info = document.getElementById("infoBox");
    if (info) info.innerHTML = "";
    const combineBtn = document.getElementById("combineBtn"); if(combineBtn) combineBtn.style.display="none";
    dropBuffer=[];
  }
  window.resetProgress=resetProgress;

  function updateDropZone(dropZone){
    const prev=dropZone.querySelector(".placeholder"); if(prev) prev.remove();
    if(dropBuffer.length>=1){
      const ph=document.createElement("div");
      ph.className="placeholder";
      ph.textContent = dropBuffer.length===1 ? "+ ____" : `+ ${dropBuffer.length-1} more`;
      dropZone.appendChild(ph);
    }
    const combineBtn=document.getElementById("combineBtn");
    if(combineBtn) combineBtn.style.display=(dropBuffer.length>=2?"inline-block":"none");
  }

  function combineElements(buffer, dropZone){
      dropZone.innerHTML = "";
      dropZone.dataset.state = "active";

      // Show dropped elements visually
      buffer.forEach(e => {
          const d = document.createElement("div");
          const blockClass = e.block ? (e.block === "none" ? "none-block" : `${e.block}-block`) : "";
          d.className = `element drop-element ${blockClass}`;
          const displayLabel = e.symbol || e.name || "";
          if (blockClass === 'none-block' && displayLabel.length > 3) d.classList.add('long-label');
          d.textContent = e.symbol;
          d.title = `${e.name} (${e.block})`;
          d.draggable = false;
          dropZone.appendChild(d);
      });

      // Determine combination result
      let current = buffer[0];
      let failed = false;
      let finalElement = null;

      for (let i = 1; i < buffer.length; i++) {
          const next = buffer[i];
          const resName = (current.combinations && current.combinations[next.name]) || 
                          (next.combinations && next.combinations[current.name]) || null;
          if (!resName) { failed = true; break; }
          const resElement = elements.find(x => x.name === resName);
          if (!resElement) { failed = true; break; }
          current = resElement;
      }
      if (!failed) finalElement = current;

      recordHistory({
        inputs: buffer.map(item => item.name),
        result: failed || !finalElement ? "No reaction" : finalElement.name,
        success: !failed && !!finalElement,
        timestamp: Date.now()
      });

      // Particle explosion
      const dzRect = dropZone.getBoundingClientRect();
      const particleCount = Math.min(80, 60 + (buffer.length - 2) * 8);
      const particleDistance = 110 + (buffer.length - 2) * 24;
      const speed = 2;

      for (let i = 0; i < particleCount; i++) {
          const p = document.createElement("div");
          p.className = `particle ${failed ? "fail" : "success"}`;

          if (failed) {
              // Randomly choose red/orange/yellow
              const colors = ["#ff3838","#ff9933","#ffdd00"];
              const color = colors[Math.floor(Math.random() * colors.length)];
              p.style.color = color;
              p.style.backgroundColor = color;
              p.style.animation = `flyParticle ${speed}s ease forwards`;
          }

          // Random direction within distance scaled by buffer length
          const angle = Math.random() * 2 * Math.PI;
          const distance = particleDistance * Math.random();
          const x = Math.cos(angle) * distance;
          const y = Math.sin(angle) * distance;

          p.style.setProperty("--x", `${x}px`);
          p.style.setProperty("--y", `${y}px`);

          // Center position
          p.style.left = `${dzRect.width / 2}px`;
          p.style.top = `${dzRect.height / 2}px`;

          p.style.animation = `flyParticle 0.8s ease forwards`;
          dropZone.appendChild(p);

          setTimeout(() => p.remove(), 800);
      }

      // Shake body if failed
      if (failed) {
          document.body.classList.add("shake");
          setTimeout(() => document.body.classList.remove("shake"), 500);
      }

      // Optional feedback text scaled by elements
      const msgDiv = document.createElement("div");
      msgDiv.textContent = !failed ? "✔ New Element Discovered!" : "❌ No Reaction";
      msgDiv.style.textShadow = !failed ? "" : "2px 2px 0 white, -2px -2px 0 white, 2px -2px 0 white, -2px 2px 0 white";
      msgDiv.className = !failed ? "explosion-success" : "explosion-fail";
      msgDiv.style.transform = `scale(${1 + 0.2 * (buffer.length - 2)})`;
      msgDiv.style.left = `${dzRect.width/2 - 50}px`;
      msgDiv.style.top = `${dzRect.height/2 - 25}px`;
      dropZone.appendChild(msgDiv);

      // Clear drop zone after animation
      setTimeout(() => {
          msgDiv.remove();
          if (!failed && finalElement) unlockElement(finalElement.name);
          showDropZoneDefault(dropZone);
          const btn = document.getElementById("combineBtn");
          if (btn) btn.style.display = "none";
      }, 1200);

      dropBuffer = [];
  }



  function spawnParticles(dropZone, type = "success", elementCount = 2) {
      const dzRect = dropZone.getBoundingClientRect();
      // Base particle count, scale with number of elements
      const count = 50 + (elementCount - 2) * 30; // 10 for 2 elements, +5 for each extra
      for (let i = 0; i < count; i++) {
          const p = document.createElement("div");
          p.className = `particle ${type}`;

          // Random X/Y movement
          const x = (Math.random() - 0.9) * 50 * elementCount; // scale distance by elementCount
          const y = (Math.random() - 0.9) * 50 * elementCount;

          p.style.setProperty("--x", `${x}px`);
          p.style.setProperty("--y", `${y}px`);

          // Position at center
          p.style.left = `${dzRect.width / 2}px`;
          p.style.top = `${dzRect.height / 2}px`;

          // Animate
          p.style.animation = `flyParticle 0.8s ease forwards`;
          dropZone.appendChild(p);

          // Remove after animation
          setTimeout(() => p.remove(), 800);
      }
  }

  function loadHistory() {
    const saved = localStorage.getItem(HISTORY_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) historyEntries = parsed;
    } catch (err) {
      console.warn("Failed to parse history.", err);
    }
  }

  function saveHistory() {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(historyEntries));
  }

  function recordHistory(entry) {
    historyEntries.unshift(entry);
    if (historyEntries.length > MAX_HISTORY) {
      historyEntries = historyEntries.slice(0, MAX_HISTORY);
    }
    saveHistory();
    renderHistory();
  }

  function renderHistory() {
    const list = document.getElementById("historyList");
    if (!list) return;
    list.innerHTML = "";
    if (!historyEntries.length) {
      const empty = document.createElement("li");
      empty.className = "history-empty";
      empty.textContent = "No combinations yet.";
      list.appendChild(empty);
      return;
    }

    historyEntries.forEach(entry => {
      const li = document.createElement("li");
      li.className = entry.success ? "history-item success" : "history-item fail";

      const inputs = document.createElement("span");
      inputs.className = "history-inputs";
      inputs.textContent = entry.inputs.join(" + ");

      const arrow = document.createElement("span");
      arrow.className = "history-arrow";
      arrow.textContent = "→";

      const result = document.createElement("span");
      result.className = "history-result";
      result.textContent = entry.result;

      const time = document.createElement("span");
      time.className = "history-time";
      const date = new Date(entry.timestamp);
      time.textContent = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      li.appendChild(inputs);
      li.appendChild(arrow);
      li.appendChild(result);
      li.appendChild(time);
      list.appendChild(li);
    });
  }



  document.addEventListener("DOMContentLoaded",()=>{
    setTimeout(()=>{ const ov=document.getElementById("openingAnimation"); if(ov) {ov.style.opacity=0; setTimeout(()=>ov.remove(),600); }},2000);
    initQuoteCarousel();
    loadFilterState();
    syncFilterControls();
    loadHistory();
    renderHistory();
    loadElementsData()
      .then(d => {
        elements = d.elements;
        initialUnlocked = elements.filter(e => e.unlocked).map(e => e.name);
        const saved = JSON.parse(localStorage.getItem("unlockedElements")) || [];
        elements.forEach(e => { if (saved.includes(e.name)) e.unlocked = true; });
        renderElements();
      })
      .catch(err => {
        console.error("Elements data failed to load.", err);
      });

    const tutorialBtn = document.getElementById("tutorialBtn");
    const closeTutorialBtn = document.getElementById("closeTutorialBtn");
    const tutorialOverlay = document.getElementById("tutorialOverlay");

    if (tutorialBtn) {
      tutorialBtn.addEventListener("click", () => showTutorial());
    }

    if (closeTutorialBtn) {
      closeTutorialBtn.addEventListener("click", () => hideTutorial());
    }

    if (tutorialOverlay) {
      tutorialOverlay.addEventListener("click", event => {
        if (event.target === tutorialOverlay) hideTutorial();
      });
    }

    maybeShowTutorial();

    const searchInput = document.getElementById("elementSearch");
    const blockFilter = document.getElementById("blockFilter");
    const showUnlocked = document.getElementById("showUnlocked");
    const showLocked = document.getElementById("showLocked");
    const clearFiltersBtn = document.getElementById("clearFiltersBtn");
    const shortcutHelpBtn = document.getElementById("shortcutHelpBtn");
    const shortcutHelp = document.getElementById("shortcutHelp");

    const debounce = (fn, delay = 200) => {
      let timer;
      return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
      };
    };

    if (searchInput) {
      searchInput.addEventListener("input", debounce(event => {
        filterState.query = event.target.value || "";
        saveFilterState();
        renderElements();
      }));
    }

    if (blockFilter) {
      blockFilter.addEventListener("change", event => {
        filterState.block = event.target.value;
        saveFilterState();
        renderElements();
      });
    }

    if (showUnlocked) {
      showUnlocked.addEventListener("change", event => {
        filterState.showUnlocked = event.target.checked;
        saveFilterState();
        renderElements();
      });
    }

    if (showLocked) {
      showLocked.addEventListener("change", event => {
        filterState.showLocked = event.target.checked;
        saveFilterState();
        renderElements();
      });
    }

    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener("click", () => {
        filterState = { query: "", block: "all", showUnlocked: true, showLocked: true };
        saveFilterState();
        syncFilterControls();
        renderElements();
      });
    }

    if (shortcutHelpBtn && shortcutHelp) {
      shortcutHelpBtn.addEventListener("click", () => {
        shortcutHelp.hidden = !shortcutHelp.hidden;
      });
    }

    const clearHistoryBtn = document.getElementById("clearHistoryBtn");
    if (clearHistoryBtn) {
      clearHistoryBtn.addEventListener("click", () => {
        historyEntries = [];
        saveHistory();
        renderHistory();
      });
    }

    dropZoneEl=document.getElementById("dropZone");
    if(!dropZoneEl) return;
    showDropZoneDefault(dropZoneEl);
    dropZoneEl.addEventListener("dragover",e=>{ e.preventDefault(); dropZoneEl.classList.add("hover"); });
    dropZoneEl.addEventListener("dragleave",()=>dropZoneEl.classList.remove("hover"));
    dropZoneEl.addEventListener("drop",e=>{
      e.preventDefault(); dropZoneEl.classList.remove("hover");
      const name=e.dataTransfer.getData("text/plain");
      const el=elements.find(x=>x.name===name);
      addElementToBuffer(el);
    });

    const combineBtn=document.getElementById("combineBtn");
    if(combineBtn){ combineBtn.style.display="none"; combineBtn.addEventListener("click",()=>{ if(dropBuffer.length<2) return alert("Drop two or more elements to combine!"); combineElements(dropBuffer,dropZoneEl);}); }

    const isTypingTarget = target => {
      if (!target) return false;
      const tag = target.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    };

    document.addEventListener("keydown", event => {
      if (isTutorialOpen()) {
        if (event.key === "Escape") {
          hideTutorial();
        }
        return;
      }

      if (isTypingTarget(event.target)) {
        if (event.key === "Escape" && searchInput) {
          searchInput.value = "";
          filterState.query = "";
          saveFilterState();
          renderElements();
          searchInput.blur();
        }
        return;
      }

      if (event.key === "Enter" && dropBuffer.length >= 2) {
        event.preventDefault();
        combineElements(dropBuffer, dropZoneEl);
      }

      if ((event.key === "r" || event.key === "R") && typeof resetProgress === "function") {
        resetProgress();
      }

      if ((event.key === "f" || event.key === "F") && searchInput) {
        searchInput.focus();
      }

      if (event.key === "Escape" && searchInput) {
        searchInput.value = "";
        filterState.query = "";
        saveFilterState();
        renderElements();
      }
    });
  });
