window.existingAtsFolders = new Set();
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('/api/ats-folders');
    if (res.ok) window.existingAtsFolders = new Set(await res.json());
  } catch(err) {
    console.error("Failed to load ATS folders", err);
  }
  // Load state from localStorage
  let state = null;
  try {
    state = JSON.parse(localStorage.getItem('careerTrackerState'));
  } catch(err) {
    console.warn("localStorage read failed:", err);
  }


  
  let rolesData = [];
  try {
    const res = await fetch('/data/data.json?t=' + Date.now());
    if (res.ok) {
      rolesData = await res.json();
    }
  } catch(err) {
    console.error("Failed to load data.json", err);
  }

  if (!state || state.length === 0) {
    state = rolesData; 
    saveState(state);
  } else {
    // Merge any new roles from data.json that aren't in localStorage yet, and update existing
    let hasUpdates = false;
    rolesData.forEach(roleData => {
      const existingRole = state.find(r => r.id === roleData.id);
      if (!existingRole) {
        state.push(roleData);
        hasUpdates = true;
      } else {
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

  document.getElementById('add-btn').addEventListener('click', async (e) => {
    if (e.currentTarget.dataset.running) return;
    const url = prompt("Enter the URL of the job posting:");
    if (url && url.trim() !== "") {
      const promptText = `CRITICAL: You are acting strictly as a data parser. DO NOT install packages, write code, or modify the server.
1. Read the job posting at: ${url.trim()}
2. Parse the details into a JSON object matching the existing schema in data.js.
3. Stop and reply with a summary of the parsed job details, AND the parsed JSON object enclosed in a \`\`\`json block. DO NOT modify data.js yourself.
CRITICAL: Please "think aloud" and stream a highly verbose, step-by-step log of your actions as you go (e.g. "Reading job description...", "Parsing details...", etc) so the user can see your progress.`;
      const output = await runAgy(promptText, document.getElementById('add-btn'));
      
      const jsonMatch = output.match(/```(?:json)?\s*\n([\s\S]*?)\n```/i);
      if (jsonMatch) {
        try {
          const newRole = JSON.parse(jsonMatch[1]);
          if (!newRole.id) newRole.id = 'r' + Date.now();
          if (!newRole.status) newRole.status = 'to_apply';
          state.push(newRole);
          saveState(state);
          renderBoard(state);
        } catch(err) {
          console.error("Failed to parse JSON from agent", err);
        }
      }
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
        <img src="https://www.google.com/s2/favicons?domain=${domain}&sz=128" class="company-logo" onerror="this.onerror=null; this.style.display='none'; this.nextElementSibling.style.display='flex';" alt="" draggable="false">
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
        ${window.existingAtsFolders.has(role.company + '_' + role.title.replace(/[^a-zA-Z0-9]/g, '')) ? `
        <button class="open-resume-btn" aria-label="View Resume" data-tooltip="View Resume">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6,2A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2H6M6,4H13V9H18V20H6V4M8,12V14H16V12H8M8,16V18H13V16H8Z" />
          </svg>
        </button>
        <button class="open-cl-btn" aria-label="View Cover Letter" data-tooltip="View Cover Letter">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.7 12.9L14 18.6H11.7V16.3L17.4 10.6L19.7 12.9M23.1 12.1C23.1 12.4 22.8 12.7 22.5 13L20 15.5L19.1 14.6L21.7 12L21.1 11.4L20.4 12.1L18.1 9.8L20.3 7.7C20.5 7.5 20.9 7.5 21.2 7.7L22.6 9.1C22.8 9.3 22.8 9.7 22.6 10C22.4 10.2 22.2 10.4 22.2 10.6C22.2 10.8 22.4 11 22.6 11.2C22.9 11.5 23.2 11.8 23.1 12.1M3 20V4H10V9H15V10.5L17 8.5V8L11 2H3C1.9 2 1 2.9 1 4V20C1 21.1 1.9 22 3 22H15C16.1 22 17 21.1 17 20H3M11 17.1C10.8 17.1 10.6 17.2 10.5 17.2L10 15H8.5L6.4 16.7L7 14H5.5L4.5 19H6L8.9 16.4L9.5 18.7H10.5L11 18.6V17.1Z" />
          </svg>
        </button>
        ` : `
        <button class="generate-btn" aria-label="Generate ATS Materials" data-tooltip="Generate ATS">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7.5,5.6L5,7L6.4,4.5L5,2L7.5,3.4L10,2L8.6,4.5L10,7L7.5,5.6M19.5,15.4L22,14L20.6,16.5L22,19L19.5,17.6L17,19L18.4,16.5L17,14L19.5,15.4M22,2L20.6,4.5L22,7L19.5,5.6L17,7L18.4,4.5L17,2L19.5,3.4L22,2M13.34,12.78L15.78,10.34L13.66,8.22L11.22,10.66L13.34,12.78M14.37,7.29L16.71,9.63C17.1,10 17.1,10.65 16.71,11.04L5.04,22.71C4.65,23.1 4,23.1 3.63,22.71L1.29,20.37C0.9,20 0.9,19.35 1.29,18.96L12.96,7.29C13.35,6.9 14,6.9 14.37,7.29Z"/>
          </svg>
        </button>
        `}
        <a href="${role.url}" class="apply-link" target="_blank" draggable="false" data-tooltip="View Role">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
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
    generateBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (generateBtn.dataset.running) return;
      if(confirm(`Generate custom ATS Resume and Cover Letter for the ${role.title} role at ${role.company}?`)) {
        const promptText = `CRITICAL: You are acting strictly as a document generator. DO NOT install packages, write code, or modify the server.
1. Read the ATS templates in data/templates/.
2. Read the job description at: ${role.url}.
3. Generate an ATS-optimized Resume and Cover Letter for the ${role.title} role at ${role.company}.
4. Save the outputs into data/ats/${role.company}_${role.title.replace(/[^a-zA-Z0-9]/g, '')}/ Resume.md and CoverLetter.md.
5. Stop and reply with the file paths.
CRITICAL: Please "think aloud" and stream a highly verbose, step-by-step log of your actions as you go (e.g. "Reading templates...", "Reading job description...", "Generating Resume...", etc) so the user can see your progress.`;
        
        await runAgy(promptText, generateBtn, 'high');
        
        // Mark as generated
        const folderName = `${role.company}_${role.title.replace(/[^a-zA-Z0-9]/g, '')}`;
        window.existingAtsFolders.add(folderName);
        let currentState = JSON.parse(localStorage.getItem('careerTrackerState')) || [];
        renderBoard(currentState); // Rerender to show View ATS button
      }
    });
  }

  const openResumeBtn = card.querySelector('.open-resume-btn');
  if (openResumeBtn) {
    openResumeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const folderName = `${role.company}_${role.title.replace(/[^a-zA-Z0-9]/g, '')}`;
      window.open(`/data/ats/${folderName}/Resume.md`, '_blank');
    });
  }

  const openClBtn = card.querySelector('.open-cl-btn');
  if (openClBtn) {
    openClBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const folderName = `${role.company}_${role.title.replace(/[^a-zA-Z0-9]/g, '')}`;
      window.open(`/data/ats/${folderName}/CoverLetter.md`, '_blank');
    });
  }

  let touchTimer;
  card.addEventListener('touchstart', (e) => {
    touchTimer = setTimeout(() => {
      openStatusModal(role);
    }, 500);
  }, {passive: true});
  card.addEventListener('touchend', () => clearTimeout(touchTimer));
  card.addEventListener('touchmove', () => clearTimeout(touchTimer));
  
  card.addEventListener('contextmenu', (e) => {
    if (window.innerWidth <= 768) {
      e.preventDefault();
      openStatusModal(role);
    }
  });

  return card;
}

function openStatusModal(role) {
  const statusModal = document.getElementById('status-modal');
  statusModal.classList.add('active');
  
  const options = statusModal.querySelectorAll('.status-option-btn');
  const closeBtn = document.getElementById('status-modal-close-btn');
  
  const closeModal = () => {
    statusModal.classList.remove('active');
    options.forEach(opt => opt.replaceWith(opt.cloneNode(true)));
    closeBtn.replaceWith(closeBtn.cloneNode(true));
  };
  
  closeBtn.addEventListener('click', closeModal, {once: true});
  
  options.forEach(opt => {
    opt.addEventListener('click', () => {
      let state = [];
      try { state = JSON.parse(localStorage.getItem('careerTrackerState')); } catch(e){}
      const targetRole = state.find(r => r.id === role.id);
      if (targetRole && targetRole.status !== opt.dataset.value) {
        targetRole.status = opt.dataset.value;
        saveState(state);
        renderBoard(state);
      }
      closeModal();
    });
  });
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
  try {
    localStorage.setItem('careerTrackerState', JSON.stringify(data));
  } catch (err) {
    console.warn('localStorage is blocked or unavailable:', err);
  }
  
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

async function runAgy(promptText, buttonElement, effort = 'medium') {
  const originalHtml = buttonElement.innerHTML;
  buttonElement.innerHTML = `<div class="spinner"></div>`;
  buttonElement.dataset.running = "true";
  buttonElement.style.pointerEvents = 'auto'; // ensure click works
  
  const timestamp = new Date().toLocaleTimeString();
  let output = `[${timestamp}] > agy "${promptText}"\n\n`;
  
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
      body: JSON.stringify({ prompt: promptText, effort })
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
  return output;
}
