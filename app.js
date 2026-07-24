document.addEventListener('DOMContentLoaded', () => {
  // Load state from localStorage or use default data.js
  let state = JSON.parse(localStorage.getItem('careerTrackerState'));

  // Purge mock items (r1 through r30) from localStorage
  if (state) {
    state = state.filter(r => r.id === 'r31' || !r.id.startsWith('r'));
    saveState(state);
  }
  
  if (!state || state.length === 0) {
    state = rolesData; // from data.js
    saveState(state);
  } else {
    // Merge any new roles from data.js that aren't in localStorage yet, and update existing
    let hasUpdates = false;
    rolesData.forEach(roleData => {
      const existingRole = state.find(r => r.id === roleData.id);
      if (!existingRole) {
        state.push(roleData);
        hasUpdates = true;
      } else {
        // Sync any new properties like salary or atsGenerated
        if (roleData.salary && existingRole.salary !== roleData.salary) {
          existingRole.salary = roleData.salary;
          hasUpdates = true;
        }
        if (roleData.atsGenerated !== undefined && existingRole.atsGenerated !== roleData.atsGenerated) {
          existingRole.atsGenerated = roleData.atsGenerated;
          hasUpdates = true;
        }
      }
    });
    if (hasUpdates) saveState(state);
  }

  // Render initial board
  renderBoard(state);

  // Subtle GSAP Entrance Animations
  gsap.from('.kanban-column', {
    y: 20,
    opacity: 0,
    duration: 0.8,
    stagger: 0.1,
    ease: 'power3.out',
    clearProps: 'all'
  });

  gsap.from('.role-card', {
    y: 15,
    opacity: 0,
    duration: 0.5,
    stagger: 0.04,
    ease: 'power2.out',
    delay: 0.3,
    clearProps: 'all',
    onComplete: function() {
      document.querySelectorAll('.role-card').forEach(c => c.classList.add('ready'));
    }
  });

  // Setup Add button
  document.getElementById('add-btn').addEventListener('click', (e) => {
    if (e.currentTarget.dataset.running) return;
    const url = prompt("Enter the URL of the job posting:");
    if (url && url.trim() !== "") {
      const promptText = `Please parse this job posting and add it to my Career Tracker dashboard: ${url.trim()}. Please also generate ATS documents by default and link to them when completed.`;
      runAgy(promptText, document.getElementById('add-btn'));
    }
  });

  // Setup Drag and Drop Zones
  const columns = document.querySelectorAll('.column-body');
  columns.forEach(col => {
    col.addEventListener('dragover', e => {
      e.preventDefault();
      col.classList.add('drag-over');
      const afterElement = getDragAfterElement(col, e.clientY);
      const draggable = document.querySelector('.dragging');
      if (afterElement == null) {
        col.appendChild(draggable);
      } else {
        col.insertBefore(draggable, afterElement);
      }
    });

    col.addEventListener('dragleave', () => {
      col.classList.remove('drag-over');
    });

    col.addEventListener('drop', e => {
      e.preventDefault();
      col.classList.remove('drag-over');
      const draggable = document.querySelector('.dragging');
      const roleId = draggable.dataset.id;
      const newStatus = col.parentElement.dataset.status;
      
      // Update state
      const roleIndex = state.findIndex(r => r.id === roleId);
      if(roleIndex > -1) {
        state[roleIndex].status = newStatus;
        saveState(state);
        updateCounts(state);
      }
    });
  });
});

function renderBoard(data) {
  const columns = {
    to_apply: document.getElementById('col-to_apply'),
    applied: document.getElementById('col-applied'),
    interviewing: document.getElementById('col-interviewing'),
    offer: document.getElementById('col-offer'),
    rejected: document.getElementById('col-rejected')
  };

  // Clear columns
  Object.values(columns).forEach(col => col.innerHTML = '');

  data.forEach(role => {
    const card = createCard(role);
    if(columns[role.status]) {
      columns[role.status].appendChild(card);
    }
  });

  updateCounts(data);
}

function updateCounts(data) {
  const counts = { to_apply: 0, applied: 0, interviewing: 0, offer: 0, rejected: 0 };
  data.forEach(role => {
    if(counts[role.status] !== undefined) counts[role.status]++;
  });

  for (const [status, count] of Object.entries(counts)) {
    const el = document.getElementById(`count-${status}`);
    if (el) el.innerText = count;
  }
}

function createCard(role) {
  const card = document.createElement('div');
  card.className = 'role-card';
  card.draggable = true;
  card.dataset.id = role.id;

  // Setup Match Color
  let matchColor = '#8b9a80'; // Sage Green
  if(role.match < 90) matchColor = '#d4a373'; // Wood Amber
  if(role.match < 85) matchColor = '#9a6a6a'; // Muted Rose/Rust

  // Parse Domain for Logo
  let domain = role.company.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';
  if (role.company.toLowerCase().includes('ford')) domain = 'ford.com';
  if (role.company.toLowerCase().includes('apple')) domain = 'apple.com';
  if (role.company.toLowerCase().includes('meta')) domain = 'meta.com';
  if (role.company.toLowerCase().includes('google')) domain = 'google.com';
  if (role.company.toLowerCase().includes('htc')) domain = 'htc.com';
  if (role.company.toLowerCase().includes('zoom')) domain = 'zoom.us';

  // Heatmap keywords based on Foo's resume
  const hotKeywords = ['xr', 'vr', 'ar', 'spatial', 'auto', 'vehicle', 'hardware', 'director', 'principal', 'head', 'physical'];
  const warmKeywords = ['manager', 'lead', 'strategy', 'system', 'ai', 'machine', 'design'];

  const tagsHtml = role.tags.map(t => {
    const text = t.toLowerCase();
    let heatClass = 'tag-cold';
    if (hotKeywords.some(k => text.includes(k))) {
      heatClass = 'tag-hot';
    } else if (warmKeywords.some(k => text.includes(k))) {
      heatClass = 'tag-warm';
    }
    return `<span class="tag ${heatClass}">${t}</span>`;
  }).join('');

  card.innerHTML = `
    <div class="card-header">
      <div class="company-info">
        <img src="https://logo.clearbit.com/${domain}" class="company-logo" onerror="this.onerror=null; this.src='https://www.google.com/s2/favicons?domain=${domain}&sz=128'; this.onerror=function(){this.style.display='none'; this.nextElementSibling.style.display='flex';};" alt="" draggable="false">
        <div class="company-initials" style="display:none;">${role.company.charAt(0)}</div>
        <div class="company">${role.company}</div>
      </div>
      <div class="match-score" style="--p: ${role.match}%; --success: ${matchColor};">
        <span>${role.match}</span>
      </div>
    </div>
    <div class="title">${role.title}</div>
    <div class="domain">${role.domain}</div>
    <div class="tags">${tagsHtml}</div>
    <div class="card-footer">
      <div class="footer-info" style="display:flex; flex-direction:column; gap:4px;">
        <div class="location">${role.location}</div>
        ${role.salary ? `<div class="salary" style="font-size: 0.75rem; color: var(--accent); opacity: 0.9; font-weight: 500;">${role.salary}</div>` : ''}
      </div>
      <div class="footer-actions">
        <button class="delete-btn" aria-label="Delete Role" data-tooltip="Delete Role">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18"></path>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
        ${role.atsGenerated ? `
        <button class="open-obsidian-btn" aria-label="Open ATS in Obsidian" data-tooltip="Open in Obsidian">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
        </button>
        ` : `
        <button class="generate-btn" aria-label="Generate ATS Materials" data-tooltip="Generate ATS">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <path d="M16 13H8"></path>
            <path d="M16 17H8"></path>
            <path d="M10 9H8"></path>
            <path d="M18.5 4.5l1.5 1.5-1.5 1.5L17 6l1.5-1.5z"></path>
          </svg>
        </button>
        `}
        <a href="${role.url}" class="apply-link" target="_blank" draggable="false" data-tooltip="View Role">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        </a>
      </div>
    </div>
  `;

  card.addEventListener('dragstart', () => {
    card.classList.add('dragging');
  });

  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
  });

  const deleteBtn = card.querySelector('.delete-btn');
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if(confirm("Are you sure you want to permanently delete this role?")) {
      card.remove();
      let currentState = JSON.parse(localStorage.getItem('careerTrackerState')) || [];
      currentState = currentState.filter(r => r.id !== role.id);
      saveState(currentState);
      updateCounts(currentState);
    }
  });

  const generateBtn = card.querySelector('.generate-btn');
  if (generateBtn) {
    generateBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (generateBtn.dataset.running) return;
      if(confirm(`Generate custom ATS Resume and Cover Letter for the ${role.title} role at ${role.company}?`)) {
        const promptText = `Please generate an ATS-optimized Resume and Cover Letter for the ${role.title} role at ${role.company} using my Obsidian Career DB and the ATS templates. Save the outputs into my Obsidian vault under 2-Areas/Professional/Career/Applications/${role.company}_${role.title.replace(/[^a-zA-Z0-9]/g, '')}/ and link to them when completed. Here is the URL for the job: ${role.url}`;
        
        runAgy(promptText, generateBtn);
      }
    });
  }

  const openObsidianBtn = card.querySelector('.open-obsidian-btn');
  if (openObsidianBtn) {
    openObsidianBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const folderName = `${role.company}_${role.title.replace(/[^a-zA-Z0-9]/g, '')}`;
      const encodedFile = encodeURIComponent(`2-Areas/Professional/Career/Applications/${folderName}/Resume.md`);
      window.open(`obsidian://open?file=${encodedFile}`, '_blank');
    });
  }

  return card;
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.role-card:not(.dragging)')];

  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function saveState(data) {
  localStorage.setItem('careerTrackerState', JSON.stringify(data));
  fetch('/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).catch(err => console.error('Failed to save to server', err));
}

// --- CLI Execution & Modal ---
let currentOutputElement = null;

function showModal() {
  const modal = document.getElementById('cli-modal');
  if (modal) modal.classList.add('active');
  currentOutputElement = document.getElementById('modal-output');
}

function updateModal(text) {
  if (currentOutputElement) {
    currentOutputElement.textContent = text;
    currentOutputElement.scrollTop = currentOutputElement.scrollHeight;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('modal-close-btn')?.addEventListener('click', () => {
    document.getElementById('cli-modal').classList.remove('active');
    currentOutputElement = null;
  });
});

async function runAgy(promptText, buttonElement) {
  const originalHtml = buttonElement.innerHTML;
  buttonElement.innerHTML = `<div class="spinner"></div>`;
  buttonElement.dataset.running = "true";
  buttonElement.style.pointerEvents = 'auto'; // ensure click works
  
  let output = 'Running command...\n';
  
  const clickHandler = (e) => {
    e.stopPropagation();
    showModal();
    updateModal(output);
  };
  
  buttonElement.addEventListener('click', clickHandler);
  
  try {
    const response = await fetch('/api/agy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: promptText })
    });
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      output += decoder.decode(value);
      updateModal(output);
    }
  } catch (err) {
    output += `\nError: ${err.message}`;
    updateModal(output);
  } finally {
    buttonElement.innerHTML = originalHtml;
    buttonElement.removeEventListener('click', clickHandler);
    delete buttonElement.dataset.running;
  }
}
