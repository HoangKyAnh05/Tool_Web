// DevBlueprint AI - Renderer Process Logic

// Mock window.api for browser preview safety
if (typeof window !== 'undefined' && !window.api) {
  window.api = {
    getConfig: async () => {
      try {
        return { gemini_api_key: localStorage.getItem('gemini_api_key') || '' };
      } catch(e) { return { gemini_api_key: '' }; }
    },
    openLink: (url) => {
      console.log("Opening link:", url);
      window.open(url, '_blank');
    },
    saveActiveState: async (state) => {
      try {
        localStorage.setItem('active_project_state', JSON.stringify(state));
      } catch(e) {}
    },
    loadActiveState: async () => {
      try {
        return JSON.parse(localStorage.getItem('active_project_state'));
      } catch(e) { return null; }
    },
    saveProject: async (proj) => {
      try {
        const projects = JSON.parse(localStorage.getItem('saved_projects') || '[]');
        const idx = projects.findIndex(p => p.id === proj.id);
        if (idx !== -1) projects[idx] = proj;
        else projects.push(proj);
        localStorage.setItem('saved_projects', JSON.stringify(projects));
        return { success: true };
      } catch(e) { return { success: false, error: e.message }; }
    },
    loadProjects: async () => {
      try {
        return JSON.parse(localStorage.getItem('saved_projects') || '[]');
      } catch(e) { return []; }
    },
    exportPlan: async (plan) => {
      console.log("Exporting implementation plan:", plan);
      // Simulate file download
      const blob = new Blob([plan], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ImplementationPlan.md';
      a.click();
      return { success: true };
    }
  };
}

// State management
let appState = {
  apiKey: localStorage.getItem('gemini_api_key') || '',
  model: localStorage.getItem('gemini_model') || 'gemini-2.5-flash',
  language: localStorage.getItem('gemini_lang') || 'Vietnamese',
  currentTopic: '',
  selectedTech: [],
  featuresMust: '',
  featuresNice: '',
  currentRequirements: '',
  currentMermaidCode: '',
  suggestedTopics: [],
  similarWebs: [],
  targetBusinesses: []
};

// Initialize libraries & UI
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize Lucide Icons
  lucide.createIcons();
  
  // Initialize Mermaid
  mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    securityLevel: 'loose',
    flowchart: { useMaxWidth: true, htmlLabels: true }
  });

  // Load Settings from LocalStorage
  loadSettings();
  
  // Load config key from config.json if present
  await loadConfig();
  
  updateApiStatusBadge();
  
  // Bind Tab Navigation
  const navButtons = document.querySelectorAll('.nav-btn');
  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      showTab(tabId);
    });
  });

  // Sub-tab Navigation
  const subTabButtons = document.querySelectorAll('.sub-tab-btn');
  subTabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const subTabId = btn.getAttribute('data-subtab');
      showSubTab(subTabId);
    });
  });

  // Bind Settings actions
  document.getElementById('btn-save-settings').addEventListener('click', saveSettings);
  document.getElementById('btn-scan-models').addEventListener('click', scanModels);
  document.getElementById('link-get-api-key').addEventListener('click', (e) => {
    e.preventDefault();
    window.api.openLink('https://aistudio.google.com/app/apikey');
  });

  // Bind Project Creator actions
  document.getElementById('btn-suggest-topic').addEventListener('click', suggestTopics);
  document.getElementById('btn-suggest-tech').addEventListener('click', suggestTechStack);
  document.getElementById('btn-suggest-features').addEventListener('click', suggestFeatures);
  document.getElementById('btn-add-tech').addEventListener('click', addCustomTech);
  document.getElementById('btn-generate-blueprint').addEventListener('click', generateBlueprint);
  document.getElementById('btn-save-draft-project').addEventListener('click', saveProjectDraft);
  setupDraftAutosave();
  
  // Bind Requirements actions
  document.getElementById('btn-upgrade-requirements').addEventListener('click', upgradeRequirements);
  document.getElementById('btn-export-plan').addEventListener('click', exportImplementationPlan);
  document.getElementById('btn-copy-mermaid').addEventListener('click', copyMermaidCode);
  document.getElementById('btn-copy-requirements').addEventListener('click', copyRequirements);

  // Bind Diagram Editor & Zoom actions
  document.getElementById('btn-update-diagram').addEventListener('click', updateDiagramFromEditor);
  document.getElementById('btn-zoom-in').addEventListener('click', () => updateZoom(10));
  document.getElementById('btn-zoom-out').addEventListener('click', () => updateZoom(-10));
  document.getElementById('btn-zoom-reset').addEventListener('click', resetZoom);



  // Bind Popularity buttons
  document.getElementById('btn-popularity-topic').addEventListener('click', () => showPopularityAnalysis('topic'));
  document.getElementById('btn-popularity-tech').addEventListener('click', () => showPopularityAnalysis('tech'));
  document.getElementById('btn-popularity-features').addEventListener('click', () => showPopularityAnalysis('features'));
  document.getElementById('btn-popularity-blueprint').addEventListener('click', () => showPopularityAnalysis('blueprint'));
  document.getElementById('btn-popularity-upgrade').addEventListener('click', () => showPopularityAnalysis('upgrade'));

  // Bind Popularity Modal close actions
  document.getElementById('btn-close-popularity').addEventListener('click', () => {
    document.getElementById('popularity-modal').classList.add('hidden');
  });
  document.getElementById('btn-close-popularity-footer').addEventListener('click', () => {
    document.getElementById('popularity-modal').classList.add('hidden');
  });

  // Bind Import/Edit Requirements manual markdown input
  const editBtn = document.getElementById('btn-edit-requirements');
  const markdownInput = document.getElementById('requirements-markdown-input');
  const renderedContainer = document.getElementById('requirements-rendered');

  if (editBtn && markdownInput && renderedContainer) {
    editBtn.addEventListener('click', async () => {
      const isEditing = !markdownInput.classList.contains('hidden');
      if (isEditing) {
        // Save Mode
        const newMarkdown = markdownInput.value.trim();
        if (newMarkdown) {
          appState.currentRequirements = newMarkdown;
          renderedContainer.innerHTML = marked.parse(newMarkdown, { breaks: true });
          
          // Re-extract and draw diagram
          const newMermaid = extractMermaidCode(newMarkdown);
          appState.currentMermaidCode = newMermaid;
          drawDiagram(newMermaid);
          
          // Save active states
          await saveActiveProjectState();
          await saveCurrentProject(false);
          alert("Đã cập nhật nghiệp vụ & sơ đồ từ nội dung bạn nhập!");
        }
        
        markdownInput.classList.add('hidden');
        renderedContainer.classList.remove('hidden');
        editBtn.innerHTML = '<i data-lucide="edit-3"></i> Nhập/Sửa nghiệp vụ';
      } else {
        // Edit Mode
        markdownInput.value = appState.currentRequirements || '';
        markdownInput.classList.remove('hidden');
        renderedContainer.classList.add('hidden');
        editBtn.innerHTML = '<i data-lucide="check"></i> Lưu nghiệp vụ';
      }
      lucide.createIcons();
    });
  }

  // Bind History actions
  document.getElementById('btn-save-current-project').addEventListener('click', () => saveCurrentProject(true));

  // Render history list initially
  await renderHistoryProjects();

  // Load active project state if any
  await loadActiveProjectState();
});

// Tab navigation handler
function showTab(tabId) {
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.remove('active');
  });
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  const activePanel = document.getElementById(tabId);
  if (activePanel) activePanel.classList.add('active');

  const activeBtn = document.querySelector(`[data-tab="${tabId}"]`);
  if (activeBtn) activeBtn.classList.add('active');

  localStorage.setItem('active_tab', tabId);
}

// Subtab navigation handler
function showSubTab(subTabId) {
  document.querySelectorAll('.subtab-panel').forEach(panel => {
    panel.classList.remove('active');
  });
  document.querySelectorAll('.sub-tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  const activePanel = document.getElementById(subTabId);
  if (activePanel) activePanel.classList.add('active');

  const activeBtn = document.querySelector(`[data-subtab="${subTabId}"]`);
  if (activeBtn) activeBtn.classList.add('active');
  
  // Re-render mermaid if tab diagram is active
  if (subTabId === 'subtab-diagram' && appState.currentMermaidCode) {
    drawDiagram(appState.currentMermaidCode);
  }

  localStorage.setItem('active_subtab', subTabId);
}

// Load config.json securely without hardcoding API keys in the JS codebase
async function loadConfig() {
  try {
    const config = await window.api.getConfig();
    if (config && config.gemini_api_key) {
      if (!localStorage.getItem('gemini_api_key')) {
        appState.apiKey = config.gemini_api_key;
        localStorage.setItem('gemini_api_key', config.gemini_api_key);
        document.getElementById('settings-api-key').value = config.gemini_api_key;
      }
    }
  } catch (err) {
    console.error("Failed to read config.json:", err);
  }
}

// Load configurations
function loadSettings() {
  const savedKey = localStorage.getItem('gemini_api_key');
  const savedModel = localStorage.getItem('gemini_model');
  const savedLang = localStorage.getItem('gemini_lang');

  if (savedKey) {
    appState.apiKey = savedKey;
    document.getElementById('settings-api-key').value = savedKey;
  }

  if (savedModel && savedModel !== 'gemini-2.0-flash' && savedModel !== 'gemini-2.0-flash-exp') {
    appState.model = savedModel;
    document.getElementById('settings-model').value = savedModel;
  } else {
    appState.model = 'gemini-2.5-flash';
    localStorage.setItem('gemini_model', appState.model);
    document.getElementById('settings-model').value = appState.model;
  }

  if (savedLang) {
    appState.language = savedLang;
    document.getElementById('settings-lang').value = savedLang;
  }
}

// Save configuration action
function saveSettings() {
  const keyInput = document.getElementById('settings-api-key').value.trim();
  const modelInput = document.getElementById('settings-model').value;
  const langInput = document.getElementById('settings-lang').value;

  localStorage.setItem('gemini_api_key', keyInput);
  localStorage.setItem('gemini_model', modelInput);
  localStorage.setItem('gemini_lang', langInput);

  appState.apiKey = keyInput;
  appState.model = modelInput;
  appState.language = langInput;

  updateApiStatusBadge();

  const toast = document.getElementById('settings-save-toast');
  toast.classList.remove('hidden');
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 2500);
}

// Scan models supporting generateContent from user API Key
async function scanModels() {
  const apiKey = document.getElementById('settings-api-key').value.trim() || appState.apiKey;
  if (!apiKey) {
    alert("Vui lòng nhập API Key trước khi quét!");
    return;
  }
  
  const button = document.getElementById('btn-scan-models');
  const originalText = button.innerHTML;
  button.innerHTML = '<i data-lucide="refresh-cw" class="spin"></i> Đang quét...';
  
  const url = `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || `HTTP ${response.status}`);
    }
    
    const data = await response.json();
    if (!data.models || data.models.length === 0) {
      throw new Error("Không tìm thấy model nào khả dụng cho API Key này.");
    }
    
    const select = document.getElementById('settings-model');
    select.innerHTML = '';
    
    // Filter models supporting generateContent
    const validModels = data.models.filter(m => 
      m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent')
    );
    
    if (validModels.length === 0) {
      throw new Error("Không tìm thấy model nào hỗ trợ tính năng generateContent.");
    }
    
    validModels.forEach(m => {
      const shortName = m.name.replace(/^models\//, '');
      const option = document.createElement('option');
      option.value = shortName;
      option.textContent = `${m.displayName || shortName} (${shortName})`;
      
      if (shortName === appState.model) {
        option.selected = true;
      }
      select.appendChild(option);
    });
    
    document.getElementById('scan-models-hint').innerHTML = `<span style="color: var(--success); font-weight: 600;">Đã quét thành công ${validModels.length} model khả dụng!</span>`;
    
    const currentSelectValue = select.value;
    if (currentSelectValue) {
      localStorage.setItem('gemini_model', currentSelectValue);
      appState.model = currentSelectValue;
      updateApiStatusBadge();
    }
  } catch (error) {
    console.error("Scan Models Error:", error);
    document.getElementById('scan-models-hint').innerHTML = `<span style="color: var(--danger); font-weight: 600;">Lỗi quét model: ${error.message}</span>`;
    alert("Không thể quét danh sách Model. Vui lòng xác thực lại API Key hoặc kiểm tra dự án Google Cloud của bạn.");
  } finally {
    button.innerHTML = originalText;
    lucide.createIcons();
  }
}

// Update the badge at the top
function updateApiStatusBadge() {
  const badge = document.getElementById('api-status-badge');
  const dot = badge.querySelector('.status-dot');
  const text = badge.querySelector('.status-text');

  if (appState.apiKey) {
    dot.className = 'status-dot active';
    text.textContent = 'API Key Connected (' + appState.model + ')';
  } else {
    dot.className = 'status-dot warning';
    text.textContent = 'Chưa cấu hình API Key';
  }
}

// Show/Hide global loading overlay
function toggleLoading(show, text = 'AI đang làm việc...') {
  const overlay = document.getElementById('global-loading');
  const textEl = document.getElementById('global-loading-text');
  
  if (show) {
    textEl.textContent = text;
    overlay.classList.remove('hidden');
  } else {
    overlay.classList.add('hidden');
  }
}

// Standard REST Gemini Caller
async function callGemini(prompt, isJson = false) {
  if (!appState.apiKey) {
    alert("Vui lòng cấu hình Gemini API Key trước trong phần Cài đặt!");
    showTab('tab-settings');
    return null;
  }

  const url = `https://generativelanguage.googleapis.com/v1/models/${appState.model}:generateContent?key=${appState.apiKey}`;

  // Configure constraints for responses
  let requestPrompt = prompt;
  if (isJson) {
    requestPrompt += "\nIMPORTANT: Return ONLY a raw JSON string without any markdown backticks wrapper (no ```json). Ensure the JSON is syntactically correct.";
  }

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [{ text: requestPrompt }]
      }
    ]
  };

  const maxRetries = 3;
  let delay = 2000; // start with 2 seconds

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errBody = await response.json();
        const errMsg = errBody.error?.message || `HTTP ${response.status}`;
        
        // If it's a rate limit (429), service overloaded (503/high demand), or message suggests high load
        const isTemporaryError = response.status === 429 || 
                                 response.status === 503 || 
                                 errMsg.toLowerCase().includes("demand") || 
                                 errMsg.toLowerCase().includes("rate limit") || 
                                 errMsg.toLowerCase().includes("too many requests") || 
                                 errMsg.toLowerCase().includes("resource exhausted");
                                 
        if (isTemporaryError && attempt < maxRetries) {
          console.warn(`Gemini API overloaded/rate-limited. Retrying in ${delay}ms... (Attempt ${attempt}/${maxRetries})`);
          
          // Update the global loading text dynamically to notify the user
          const loadingTextEl = document.getElementById('global-loading-text');
          if (loadingTextEl) {
            loadingTextEl.textContent = `Máy chủ Google bận (Quá tải), đang tự động thử lại lần ${attempt}/3...`;
          }
          
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2; // exponential backoff (2s -> 4s -> 8s)
          continue;
        }
        throw new Error(errMsg);
      }

      const data = await response.json();
      let reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!reply) {
        throw new Error("Không tìm thấy phản hồi phù hợp từ AI");
      }

      let cleanText = reply.trim();
      if (isJson) {
        cleanText = cleanText.replace(/^```json\s*/i, '');
        cleanText = cleanText.replace(/^```\s*/i, '');
        cleanText = cleanText.replace(/\s*```$/i, '');
        cleanText = cleanText.trim();
      }

      return cleanText;
    } catch (error) {
      if (attempt === maxRetries) {
        console.error("Gemini Error after retries:", error);
        alert("Lỗi gọi API sau 3 lần thử lại: " + error.message);
        return null;
      }
      
      console.warn(`Temporary connection error. Retrying in ${delay}ms... (Attempt ${attempt}/${maxRetries})`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
}

// ================= AI ACTION: SUGGEST TOPICS =================
async function suggestTopics() {
  toggleLoading(true, "AI đang nghiên cứu ý tưởng website hot...");
  const prompt = `Bạn là một chuyên gia nghiên cứu thị trường phần mềm. Hãy gợi ý 4 chủ đề/ý tưởng thiết kế website cực kỳ tiềm năng, độc đáo hoặc có giá trị thương mại cao trong năm 2026. 
Trả về dữ liệu dưới định dạng JSON là một mảng các đối tượng có cấu trúc như sau (ngôn ngữ: ${appState.language}):
[
  {
    "title": "Tên chủ đề ngắn gọn",
    "description": "Mô tả ngắn gọn về giải pháp website này",
    "value": "Tại sao chủ đề này lại có giá trị cao hoặc cần thiết"
  }
]`;

  const responseText = await callGemini(prompt, true);
  toggleLoading(false);

  if (!responseText) return;

  try {
    const data = JSON.parse(responseText);
    appState.suggestedTopics = data;
    renderSuggestedTopics();
    saveActiveProjectState();
  } catch (e) {
    console.error("Failed to parse JSON for topics:", responseText, e);
    alert("Có lỗi khi chuyển đổi cấu trúc phản hồi của AI. Thử lại sau!");
  }
}

function renderSuggestedTopics() {
  const container = document.getElementById('suggested-topics-list');
  const box = document.getElementById('topic-suggestions-box');
  
  container.innerHTML = '';
  
  appState.suggestedTopics.forEach(item => {
    const div = document.createElement('div');
    div.className = 'suggest-item';
    div.innerHTML = `
      <h4>${item.title}</h4>
      <p><strong>Mô tả:</strong> ${item.description}</p>
      <p style="margin-top: 4px; color: var(--secondary); font-size: 11px;"><strong>Giá trị:</strong> ${item.value}</p>
    `;
    div.addEventListener('click', () => {
      document.getElementById('input-topic').value = `${item.title}: ${item.description}`;
      box.classList.add('hidden');
      autosaveDraftInputs();
    });
    container.appendChild(div);
  });

  box.classList.remove('hidden');
}

// ================= AI ACTION: SUGGEST TECH STACK =================
async function suggestTechStack() {
  const topic = document.getElementById('input-topic').value.trim();
  if (!topic) {
    alert("Vui lòng nhập chủ đề website trước để AI có thể gợi ý công nghệ phù hợp!");
    return;
  }

  toggleLoading(true, "AI đang lựa chọn Tech Stack tối ưu...");
  const prompt = `Dựa vào chủ đề website: "${topic}", hãy gợi ý một bộ công nghệ (Tech Stack) hiện đại, hiệu quả và tối ưu nhất cho nhà phát triển độc lập (solopreneur) hoặc đội ngũ nhỏ để làm nhanh và hiệu quả.
Trả về dữ liệu dưới định dạng JSON là một mảng các chuỗi công nghệ (ví dụ: ["React", "FastAPI", "PostgreSQL", ...]):
["Tech1", "Tech2", "Tech3", ...]`;

  const responseText = await callGemini(prompt, true);
  toggleLoading(false);

  if (!responseText) return;

  try {
    const techArray = JSON.parse(responseText);
    if (Array.isArray(techArray)) {
      // Clear existing check boxes and reconstruct them based on AI + default options
      const grid = document.getElementById('tech-checkboxes');
      grid.innerHTML = '';
      
      techArray.forEach(tech => {
        const label = document.createElement('label');
        label.className = 'tech-chip';
        label.innerHTML = `<input type="checkbox" value="${tech}" checked> <span>${tech}</span>`;
        grid.appendChild(label);
      });
      autosaveDraftInputs();
    }
  } catch (e) {
    console.error("Failed to parse Tech Stack JSON:", responseText, e);
  }
}

function addCustomTech() {
  const input = document.getElementById('input-custom-tech');
  const val = input.value.trim();
  if (!val) return;

  const grid = document.getElementById('tech-checkboxes');
  
  // Check if exists
  const existing = Array.from(grid.querySelectorAll('input')).map(i => i.value.toLowerCase());
  if (existing.includes(val.toLowerCase())) {
    input.value = '';
    return;
  }

  const label = document.createElement('label');
  label.className = 'tech-chip';
  label.innerHTML = `<input type="checkbox" value="${val}" checked> <span>${val}</span>`;
  grid.appendChild(label);
  
  input.value = '';
  autosaveDraftInputs();
}

// ================= AI ACTION: SUGGEST FEATURES =================
async function suggestFeatures() {
  const topic = document.getElementById('input-topic').value.trim();
  if (!topic) {
    alert("Vui lòng nhập chủ đề website để AI đề xuất tính năng!");
    return;
  }

  toggleLoading(true, "AI đang phân tích các tính năng đột phá...");
  const prompt = `Dựa vào chủ đề website: "${topic}", hãy đề xuất các tính năng tốt nhất bao gồm:
1) Must-Have Features (Các tính năng cơ bản, bắt buộc phải có để hệ thống hoạt động).
2) Nice-to-Have Features (Các tính năng gia tăng giá trị, nâng cao trải nghiệm, độc đáo, hoặc ứng dụng AI mới nhất).

Trả về dữ liệu dưới định dạng JSON có cấu trúc như sau (ngôn ngữ: ${appState.language}):
{
  "mustHave": ["tính năng 1", "tính năng 2", ...],
  "niceToHave": ["tính năng 1", "tính năng 2", ...]
}`;

  const responseText = await callGemini(prompt, true);
  toggleLoading(false);

  if (!responseText) return;

  try {
    const data = JSON.parse(responseText);
    
    // Populate textareas
    if (data.mustHave) {
      document.getElementById('features-must').value = data.mustHave.map(f => `• ${f}`).join('\n');
    }
    if (data.niceToHave) {
      document.getElementById('features-nice').value = data.niceToHave.map(f => `• ${f}`).join('\n');
    }
    autosaveDraftInputs();
  } catch (e) {
    console.error("Failed to parse Features JSON:", responseText, e);
  }
}

// Helper to extract technologies selected
function getSelectedTech() {
  const checkedBoxes = document.querySelectorAll('#tech-checkboxes input:checked');
  return Array.from(checkedBoxes).map(cb => cb.value);
}

// Helper to parse mermaid diagram out of Markdown content
function extractMermaidCode(markdown) {
  const regex = /```mermaid([\s\S]*?)```/g;
  const match = regex.exec(markdown);
  if (match && match[1]) {
    return match[1].trim();
  }
  return "";
}

// Global zoom state
let diagramZoom = 100;

function updateZoom(delta) {
  diagramZoom = Math.min(300, Math.max(20, diagramZoom + delta));
  applyZoom();
}

function resetZoom() {
  diagramZoom = 100;
  applyZoom();
}

function applyZoom() {
  const svgElement = document.querySelector('#mermaid-render-box svg');
  const zoomBadge = document.getElementById('zoom-badge');
  if (svgElement) {
    svgElement.style.width = `${diagramZoom}%`;
  }
  if (zoomBadge) {
    zoomBadge.textContent = `${diagramZoom}%`;
  }
}

// Helper to render Mermaid diagram safely
async function drawDiagram(mermaidCode) {
  const container = document.getElementById('mermaid-render-box');
  const emptyState = document.getElementById('diagram-empty-state');
  const input = document.getElementById('mermaid-code-input');
  
  if (!mermaidCode || mermaidCode.trim() === '') {
    container.innerHTML = '';
    emptyState.classList.remove('hidden');
    if (input) input.value = '';
    return;
  }

  emptyState.classList.add('hidden');
  container.innerHTML = '<div class="loading-sub" style="text-align:center;">Đang vẽ sơ đồ...</div>';
  
  const cleanCode = mermaidCode
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');

  if (input && input.value !== cleanCode) {
    input.value = cleanCode;
  }

  try {
    if (typeof mermaid.parse === 'function') {
      try {
        await mermaid.parse(cleanCode);
      } catch (parseErr) {
        throw new Error(parseErr.message || "Lỗi cú pháp Mermaid");
      }
    }

    const id = 'mermaid-svg-' + Math.floor(Math.random() * 100000);
    const { svg } = await mermaid.render(id, cleanCode);
    container.innerHTML = svg;
    
    const svgElement = container.querySelector('svg');
    if (svgElement) {
      svgElement.style.maxWidth = 'none';
      svgElement.style.height = 'auto';
    }
    
    appState.currentMermaidCode = cleanCode;
    applyZoom();
  } catch (err) {
    console.error("Mermaid Render Error:", err);
    const errElements = document.querySelectorAll('[id^="dmermaid-svg"]');
    errElements.forEach(el => el.remove());
    
    container.innerHTML = `
      <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 8px; padding: 16px; color: #fca5a5; font-size: 13px; text-align: left; width: 100%;">
        <strong>Lỗi cú pháp sơ đồ Mermaid:</strong> AI đã tạo ra một sơ đồ bị lỗi ngữ pháp hoặc bạn đang chỉnh sửa làm sai cú pháp. Vui lòng sửa lại mã nguồn bên trái và bấm Cập nhật.<br>
        <pre style="margin-top: 10px; background: rgba(0,0,0,0.5); padding: 8px; border-radius: 4px; overflow: auto; max-height: 200px; font-family: monospace; white-space: pre-wrap; word-break: break-all;">${err.message || err}</pre>
      </div>
    `;
    appState.currentMermaidCode = cleanCode;
  }
}



// ================= AI ACTION: GENERATE ENTIRE BLUEPRINT =================
async function generateBlueprint() {
  const topic = document.getElementById('input-topic').value.trim();
  const tech = getSelectedTech().join(', ');
  const mustHave = document.getElementById('features-must').value.trim();
  const niceHave = document.getElementById('features-nice').value.trim();

  if (!topic) {
    alert("Vui lòng nhập chủ đề dự án trước khi tạo nghiệp vụ!");
    return;
  }

  appState.currentTopic = topic;
  appState.selectedTech = getSelectedTech();
  appState.featuresMust = mustHave;
  appState.featuresNice = niceHave;

  toggleLoading(true, "AI đang kiến trúc toàn bộ hệ thống web...");

  const prompt = `Bạn là một Chuyên viên phân tích nghiệp vụ phần mềm (Business Analyst) kiêm Kiến trúc sư hệ thống (Solution Architect). 
Hãy thiết kế tài liệu nghiệp vụ chi tiết và sơ đồ hệ thống cho dự án web sau:
- Tên/Chủ đề: "${topic}"
- Công nghệ: "${tech}"
- Tính năng Must-Have: 
${mustHave}
- Tính năng Nice-to-Have: 
${niceHave}

Hãy viết một tài liệu nghiệp vụ hoàn chỉnh bằng ${appState.language} với định dạng Markdown bao gồm các phần:
1. **Tổng Quan Dự Án & Mục Tiêu (Project Overview)**
2. **Kiến Trúc Hệ Thống (Architecture Overview)**
3. **Phân Tích Nghiệp Vụ Chi Tiết (Functional Requirements)**: Chia chi tiết thành từng Module chính. Mỗi Module hãy viết rõ các luồng xử lý chính, các quy tắc nghiệp vụ (Business Rules) cần lưu ý.
4. **Thiết Kế Cơ Sở Dữ Liệu (Database Schema Design)**: Liệt kê các bảng cần thiết, các trường chính, kiểu dữ liệu, và quan hệ. Trình bày dạng bảng Markdown trực quan.
5. **Sơ Đồ Luồng (System Workflow Diagram)**:
Hãy tạo một sơ đồ Mermaid.js miêu tả luồng đi của dữ liệu hoặc người dùng khi sử dụng web (user journey). 
Yêu cầu bắt buộc: Đóng gói sơ đồ Mermaid trong cặp thẻ:
\`\`\`mermaid
[Code sơ đồ Mermaid viết tại đây]
\`\`\`
Đảm bảo cú pháp Mermaid hợp lệ (ví dụ: bọc nhãn trong dấu ngoặc kép khi có ký tự lạ/dấu cách/dấu ngoặc như: A["Nhãn nút (chi tiết)"], không dùng các ký tự lạ làm lỗi parser).

Vui lòng biên soạn tài liệu rõ ràng, chuyên nghiệp để Antigravity AI có thể hiểu và tự động code được toàn bộ website dựa trên tài liệu này.`;

  const responseText = await callGemini(prompt);
  toggleLoading(false);

  if (!responseText) return;

  appState.currentRequirements = responseText;
  
  // Render markdown
  document.getElementById('requirements-rendered').innerHTML = marked.parse(responseText, { breaks: true });
  
  // Render mermaid
  const mermaidCode = extractMermaidCode(responseText);
  appState.currentMermaidCode = mermaidCode;
  
  // Render the diagram, reset zoom, and update code editor
  diagramZoom = 100;
  drawDiagram(mermaidCode);
  
  // Enable Nav to tab-requirements
  showTab('tab-requirements');
  showSubTab('subtab-doc');

  // Trigger loading market leads in background
  generateMarketLeads(topic);
  
  await saveActiveProjectState();
  await saveCurrentProject(false);
}

// ================= AI ACTION: UPGRADE REQUIREMENTS =================
async function upgradeRequirements() {
  if (!appState.currentRequirements) {
    alert("Chưa có nghiệp vụ gốc để nâng cấp. Vui lòng tạo dự án trước!");
    return;
  }

  toggleLoading(true, "AI đang nâng cấp, mở rộng và đào sâu nghiệp vụ...");

  const prompt = `Bạn là Chuyên gia phân tích nghiệp vụ cao cấp. Dưới đây là tài liệu nghiệp vụ hiện tại của dự án:
---
${appState.currentRequirements}
---

Hãy nâng cấp tài liệu nghiệp vụ này lên một tầm cao mới. 
YÊU CẦU QUAN TRỌNG:
1. GIỮ NGUYÊN các nghiệp vụ và tính năng cũ của hệ thống, không lược bỏ.
2. THÊM các nghiệp vụ mới, chi tiết hơn, thông minh hơn (ví dụ: giải pháp bảo mật nâng cao, tối ưu hóa database, cơ chế logging/monitoring, tích hợp AI tự động hóa sâu hơn, xử lý lỗi hệ thống & edge cases).
3. Cập nhật thiết kế Database nếu cần.
4. Cập nhật và nâng cấp Sơ đồ Mermaid.js để phản ánh đúng quy mô hệ thống nâng cấp mới (Đảm bảo bọc nhãn nút trong dấu ngoặc kép nếu chứa dấu cách hoặc ký tự đặc biệt). Đảm bảo sơ đồ Mermaid hợp lệ nằm trong:
\`\`\`mermaid
[Code sơ đồ Mermaid]
\`\`\`
Trả về toàn bộ tài liệu nghiệp vụ đã được cập nhật hoàn chỉnh dưới định dạng Markdown (bằng ${appState.language}).`;

  const responseText = await callGemini(prompt);
  toggleLoading(false);

  if (!responseText) return;

  appState.currentRequirements = responseText;
  
  // Re-render
  document.getElementById('requirements-rendered').innerHTML = marked.parse(responseText, { breaks: true });
  const mermaidCode = extractMermaidCode(responseText);
  appState.currentMermaidCode = mermaidCode;

  // Auto-save the updated blueprint
  await saveCurrentProject(false);
  await saveActiveProjectState();

  // Notify
  alert("Nâng cấp nghiệp vụ thành công! Tài liệu đã được cập nhật thêm các tính năng cao cấp.");
  showSubTab('subtab-doc');
}

// ================= ACTION: EXPORT IMPLEMENTATION PLAN =================
async function exportImplementationPlan() {
  if (!appState.currentRequirements) {
    alert("Chưa có tài liệu nghiệp vụ để xuất Implementation Plan!");
    return;
  }

  const techList = appState.selectedTech.join(', ');
  
  // Compose full implementation plan file content
  const planContent = `# IMPLEMENTATION PLAN: WEB DEVELOPMENT BLUEPRINT
## Dự án: ${appState.currentTopic}
## Tech Stack: ${techList}

> [!NOTE]
> Tài liệu này được tạo tự động bởi DevBlueprint AI. Hãy cung cấp toàn bộ tài liệu này cho Antigravity AI để sinh mã nguồn đầy đủ và chính xác nhất cho hệ thống.

---

${appState.currentRequirements}

---

## HƯỚNG DẪN DÀNH CHO ANTIGRAVITY AI:
1. Đọc và hiểu toàn bộ tài liệu nghiệp vụ cũng như cấu trúc database ở trên.
2. Xây dựng cấu trúc dự án dựa trên Tech Stack: ${techList}.
3. Triển khai các tính năng bắt buộc (Must-Have) và tính năng nâng cao (Nice-to-Have) đã được nêu rõ.
4. Kiểm tra các ràng buộc nghiệp vụ (Business Rules) để đảm bảo ứng dụng chạy chính xác.
5. Tạo tất cả các trang, backend routes, database connections, và migrations phù hợp.
`;

  toggleLoading(true, "Đang chuẩn bị file...");
  
  // Save locally in workspace as 'implementation_plan.md'
  const workspaceResult = await window.api.saveToWorkspace('implementation_plan.md', planContent);
  
  // Trigger native Save Dialog as well for safety
  const filename = `${appState.currentTopic.toLowerCase().replace(/[^a-z0-9]/g, '_')}_implementation_plan.md`;
  const result = await window.api.saveFile(filename, planContent);
  
  toggleLoading(false);

  if (result.success || workspaceResult.success) {
    let msg = "Đã lưu thành công Implementation Plan!\n";
    if (workspaceResult.success) {
      msg += `- Đã lưu vào Workspace: implementation_plan.md\n`;
    }
    if (result.success) {
      msg += `- Đã lưu file theo vị trí bạn chọn: ${result.filePath}\n`;
    }
    alert(msg + "\nBạn chỉ việc kéo file này vào Antigravity để sinh web đầy đủ!");
  } else {
    alert("Có lỗi khi lưu file: " + (result.error || workspaceResult.error));
  }
}

// Copy Mermaid code to clipboard
function copyMermaidCode() {
  if (!appState.currentMermaidCode) {
    alert("Không tìm thấy mã Mermaid nào để sao chép!");
    return;
  }
  
  navigator.clipboard.writeText(appState.currentMermaidCode)
    .then(() => {
      alert("Đã sao chép mã Mermaid vào clipboard thành công!");
    })
    .catch(err => {
      console.error("Copy error:", err);
      alert("Lỗi khi sao chép mã!");
    });
}

// ================= AI ACTION: GENERATE MARKET LEADS & SIMILAR WEBS =================
async function generateMarketLeads(topic) {
  const prompt = `Dựa trên chủ đề website: "${topic}", hãy gợi ý:
1) 3 Website tương tự đã thành công trên thế giới hoặc Việt Nam kèm mô tả và link thật (hoặc link tìm kiếm dịch vụ đó).
2) 3 Nhóm đối tượng doanh nghiệp/cửa hàng/cơ sở kinh doanh đang rất cần loại website này, kèm theo từ khóa tìm kiếm Google Maps tương ứng để developer có thể trực tiếp tìm kiếm khách hàng tiềm năng.

Trả về kết quả dưới định dạng JSON có cấu trúc sau (ngôn ngữ: Tiếng Việt):
{
  "similar": [
    {
      "name": "Tên website tham khảo",
      "description": "Tại sao nên tham khảo trang này",
      "url": "https://url-tham-khao.com"
    }
  ],
  "leads": [
    {
      "businessType": "Nhóm đối tượng khách hàng (ví dụ: Phòng khám Nha khoa tư nhân)",
      "reason": "Tại sao họ lại cần website này",
      "searchQuery": "Từ khóa tìm kiếm (ví dụ: phòng khám nha khoa tại Hà Nội)"
    }
  ]
}`;

  const responseText = await callGemini(prompt, true);
  if (!responseText) return;

  try {
    const data = JSON.parse(responseText);
    
    if (data.similar) {
      appState.similarWebs = data.similar;
      renderSimilarWebs();
    }
    
    if (data.leads) {
      appState.targetBusinesses = data.leads;
      renderTargetBusinesses();
    }
    
    // Auto-save project to history once leads are generated
    saveCurrentProject(false);
    saveActiveProjectState();
  } catch (e) {
    console.error("Failed to parse market leads JSON:", responseText, e);
  }
}

function renderSimilarWebs() {
  const container = document.getElementById('similar-webs-list');
  container.innerHTML = '';

  if (appState.similarWebs.length === 0) {
    container.innerHTML = `<div class="empty-leads"><p>Chưa có dữ liệu gợi ý.</p></div>`;
    return;
  }

  appState.similarWebs.forEach(web => {
    const div = document.createElement('div');
    div.className = 'lead-item';
    div.innerHTML = `
      <div class="lead-item-header">
        <h3>${web.name}</h3>
        <button class="btn btn-secondary btn-sm link-btn" data-url="${web.url}">
          <i data-lucide="external-link"></i> Truy cập
        </button>
      </div>
      <p>${web.description}</p>
      <span style="font-size: 11px; color: var(--primary); text-decoration: underline; cursor: pointer;" class="raw-url">${web.url}</span>
    `;

    // Click events to open in browser
    div.querySelector('.link-btn').addEventListener('click', () => {
      window.api.openLink(web.url);
    });
    div.querySelector('.raw-url').addEventListener('click', () => {
      window.api.openLink(web.url);
    });

    container.appendChild(div);
  });
  
  lucide.createIcons();
}

function renderTargetBusinesses() {
  const container = document.getElementById('target-businesses-list');
  container.innerHTML = '';

  if (appState.targetBusinesses.length === 0) {
    container.innerHTML = `<div class="empty-leads"><p>Chưa có dữ liệu gợi ý.</p></div>`;
    return;
  }

  appState.targetBusinesses.forEach(lead => {
    // Construct Google Maps URL based on searchQuery
    const encodedQuery = encodeURIComponent(lead.searchQuery);
    const mapsUrl = `https://www.google.com/maps/search/${encodedQuery}`;

    const div = document.createElement('div');
    div.className = 'lead-item';
    div.innerHTML = `
      <div class="lead-item-header">
        <h3>${lead.businessType}</h3>
        <button class="btn btn-primary-gradient btn-sm maps-btn" data-url="${mapsUrl}">
          <i data-lucide="map"></i> Tìm trên Maps
        </button>
      </div>
      <p><strong>Nhu cầu:</strong> ${lead.reason}</p>
      <p style="font-size: 11px; color: var(--text-muted);">
        <strong>Từ khóa tìm kiếm:</strong> <code style="color: var(--secondary); background: rgba(0,0,0,0.2); padding: 2px 4px; border-radius: 4px;">${lead.searchQuery}</code>
      </p>
    `;

    div.querySelector('.maps-btn').addEventListener('click', () => {
      window.api.openLink(mapsUrl);
    });

    container.appendChild(div);
  });

  lucide.createIcons();
}

// ================= PROJECT HISTORY MANAGEMENT & FILE SYSTEM PERSISTENCE =================

// File storage helper
async function loadSavedProjectsFromFile() {
  try {
    const res = await window.api.readFromWorkspace('saved_projects.json');
    if (res.success && res.content) {
      return JSON.parse(res.content);
    }
  } catch (e) {
    console.error("Error reading saved_projects.json:", e);
  }
  
  // Fallback to localStorage
  try {
    const data = localStorage.getItem('saved_projects');
    if (data) return JSON.parse(data);
  } catch (e) {
    console.error(e);
  }
  return [];
}

async function saveSavedProjectsToFile(projects) {
  try {
    await window.api.saveToWorkspace('saved_projects.json', JSON.stringify(projects, null, 2));
  } catch (e) {
    console.error("Error saving saved_projects.json:", e);
  }
  
  // Backup to localStorage
  localStorage.setItem('saved_projects', JSON.stringify(projects));
}

async function loadActiveSessionFromFile() {
  try {
    const res = await window.api.readFromWorkspace('active_session.json');
    if (res.success && res.content) {
      return JSON.parse(res.content);
    }
  } catch (e) {
    console.error("Error reading active_session.json:", e);
  }
  
  // Fallback to localStorage
  const activeTopic = localStorage.getItem('active_topic');
  if (activeTopic) {
    let selectedTech = [];
    try {
      selectedTech = JSON.parse(localStorage.getItem('active_selected_tech')) || [];
    } catch(e) {}
    return {
      topic: activeTopic,
      selectedTech: selectedTech,
      featuresMust: localStorage.getItem('active_features_must') || '',
      featuresNice: localStorage.getItem('active_features_nice') || '',
      requirements: localStorage.getItem('active_requirements') || '',
      mermaidCode: localStorage.getItem('active_mermaid_code') || '',
      similarWebs: JSON.parse(localStorage.getItem('active_similar_webs') || '[]'),
      targetBusinesses: JSON.parse(localStorage.getItem('active_target_businesses') || '[]')
    };
  }
  return null;
}

async function saveActiveSessionToFile() {
  const sessionData = {
    topic: appState.currentTopic || '',
    selectedTech: appState.selectedTech || [],
    featuresMust: appState.featuresMust || '',
    featuresNice: appState.featuresNice || '',
    requirements: appState.currentRequirements || '',
    mermaidCode: appState.currentMermaidCode || '',
    similarWebs: appState.similarWebs || [],
    targetBusinesses: appState.targetBusinesses || []
  };

  try {
    await window.api.saveToWorkspace('active_session.json', JSON.stringify(sessionData, null, 2));
  } catch (e) {
    console.error("Error saving active_session.json:", e);
  }

  // Backup to localStorage
  localStorage.setItem('active_topic', appState.currentTopic || '');
  localStorage.setItem('active_selected_tech', JSON.stringify(appState.selectedTech || []));
  localStorage.setItem('active_features_must', appState.featuresMust || '');
  localStorage.setItem('active_features_nice', appState.featuresNice || '');
  localStorage.setItem('active_requirements', appState.currentRequirements || '');
  localStorage.setItem('active_mermaid_code', appState.currentMermaidCode || '');
  localStorage.setItem('active_similar_webs', JSON.stringify(appState.similarWebs || []));
  localStorage.setItem('active_target_businesses', JSON.stringify(appState.targetBusinesses || []));
}

async function saveCurrentProject(showToast = true) {
  if (!appState.currentTopic) {
    const inputVal = document.getElementById('input-topic')?.value.trim();
    if (inputVal) {
      appState.currentTopic = inputVal;
      appState.selectedTech = getSelectedTech();
      appState.featuresMust = document.getElementById('features-must')?.value.trim() || '';
      appState.featuresNice = document.getElementById('features-nice')?.value.trim() || '';
    } else {
      if (showToast) {
        alert("Không có dự án hoạt động nào để lưu. Vui lòng tạo dự án trước!");
      }
      return;
    }
  }

  let projects = await loadSavedProjectsFromFile();
  const existingIndex = projects.findIndex(p => p.topic.toLowerCase() === appState.currentTopic.toLowerCase());

  const newProject = {
    id: existingIndex !== -1 ? projects[existingIndex].id : 'proj_' + Date.now(),
    createdAt: existingIndex !== -1 ? projects[existingIndex].createdAt : new Date().toLocaleString('vi-VN'),
    updatedAt: new Date().toLocaleString('vi-VN'),
    topic: appState.currentTopic,
    techStack: appState.selectedTech,
    featuresMust: appState.featuresMust,
    featuresNice: appState.featuresNice,
    requirements: appState.currentRequirements,
    mermaidCode: appState.currentMermaidCode,
    similarWebs: appState.similarWebs,
    targetBusinesses: appState.targetBusinesses
  };

  if (existingIndex !== -1) {
    projects[existingIndex] = newProject;
  } else {
    projects.unshift(newProject);
  }

  await saveSavedProjectsToFile(projects);
  
  if (showToast) {
    alert(`Đã lưu dự án "${appState.currentTopic}" thành công!`);
  }
  
  await renderHistoryProjects();
}

async function renderHistoryProjects() {
  const projects = await loadSavedProjectsFromFile();
  const container = document.getElementById('history-grid-container');
  const emptyState = document.getElementById('history-list-empty');

  if (projects.length === 0) {
    container.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  container.innerHTML = '';

  projects.forEach(proj => {
    const card = document.createElement('div');
    card.className = 'card glass-card history-card';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.justifyContent = 'space-between';
    card.style.padding = '20px';
    card.style.border = '1px solid rgba(255, 255, 255, 0.05)';
    card.style.borderRadius = '12px';
    card.style.background = 'rgba(255, 255, 255, 0.02)';
    
    const techChipsHtml = proj.techStack.map(t => `<span class="tech-badge" style="background: rgba(147, 51, 234, 0.1); color: #c084fc; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-right: 4px; display: inline-block; margin-top: 4px;">${t}</span>`).join('');

    card.innerHTML = `
      <div>
        <h4 style="margin: 0 0 8px 0; font-size: 1.1rem; font-weight: 600; color: #fff;">${proj.topic}</h4>
        <p style="font-size: 12px; color: var(--text-muted); margin: 0 0 12px 0;">Lưu lúc: ${proj.updatedAt || proj.createdAt}</p>
        <div style="margin-bottom: 15px;">
          ${techChipsHtml}
        </div>
      </div>
      <div style="display: flex; gap: 8px; margin-top: 15px;">
        <button class="btn btn-primary btn-sm restore-btn" style="flex: 1; height: 35px; font-size: 12px;">
          <i data-lucide="folder-open" style="width: 14px; height: 14px;"></i> Khôi phục
        </button>
        <button class="btn btn-secondary btn-sm delete-btn" style="border-color: rgba(239, 68, 68, 0.2); color: #f87171; height: 35px; font-size: 12px;">
          <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i> Xóa
        </button>
      </div>
    `;

    card.querySelector('.restore-btn').addEventListener('click', () => {
      restoreProject(proj.id);
    });

    card.querySelector('.delete-btn').addEventListener('click', () => {
      if (confirm(`Bạn có chắc chắn muốn xóa dự án "${proj.topic}"?`)) {
        deleteProject(proj.id);
      }
    });

    container.appendChild(card);
  });

  lucide.createIcons();
}

async function restoreProject(id) {
  const projects = await loadSavedProjectsFromFile();
  const proj = projects.find(p => p.id === id);
  if (!proj) {
    alert("Không tìm thấy dự án này!");
    return;
  }

  appState.currentTopic = proj.topic;
  appState.selectedTech = proj.techStack;
  appState.featuresMust = proj.featuresMust;
  appState.featuresNice = proj.featuresNice;
  appState.currentRequirements = proj.requirements;
  appState.currentMermaidCode = proj.mermaidCode;
  appState.similarWebs = proj.similarWebs || [];
  appState.targetBusinesses = proj.targetBusinesses || [];

  document.getElementById('input-topic').value = proj.topic;
  document.getElementById('features-must').value = proj.featuresMust;
  document.getElementById('features-nice').value = proj.featuresNice;

  const grid = document.getElementById('tech-checkboxes');
  grid.querySelectorAll('input').forEach(input => {
    input.checked = false;
  });
  
  proj.techStack.forEach(tech => {
    let checkbox = grid.querySelector(`input[value="${tech}"]`);
    if (!checkbox) {
      const label = document.createElement('label');
      label.className = 'tech-chip';
      label.innerHTML = `<input type="checkbox" value="${tech}" checked> <span>${tech}</span>`;
      grid.appendChild(label);
    } else {
      checkbox.checked = true;
    }
  });

  if (proj.requirements) {
    document.getElementById('requirements-rendered').innerHTML = marked.parse(proj.requirements, { breaks: true });
  } else {
    document.getElementById('requirements-rendered').innerHTML = `
      <div class="empty-state">
        <i data-lucide="file-question" class="empty-icon"></i>
        <h3>Chưa có dữ liệu nghiệp vụ</h3>
      </div>`;
  }

  drawDiagram(proj.mermaidCode);
  renderSimilarWebs();
  renderTargetBusinesses();

  if (proj.requirements) {
    showTab('tab-requirements');
    showSubTab('subtab-doc');
  } else {
    showTab('tab-create');
  }

  await saveActiveProjectState();

  alert(`Đã khôi phục thành công dự án "${proj.topic}"!`);
}

async function deleteProject(id) {
  let projects = await loadSavedProjectsFromFile();
  projects = projects.filter(p => p.id !== id);
  await saveSavedProjectsToFile(projects);
  await renderHistoryProjects();
}

async function saveActiveProjectState() {
  await saveActiveSessionToFile();
}

async function loadActiveProjectState() {
  let session = await loadActiveSessionFromFile();
  
  if (!session) {
    try {
      const projects = await loadSavedProjectsFromFile();
      if (projects && projects.length > 0) {
        session = projects[0];
      }
    } catch (e) {
      console.error("Error loading most recent project from history file:", e);
    }
  }

  if (!session) {
    appState.selectedTech = getSelectedTech();
    return;
  }

  appState.currentTopic = session.topic || '';
  appState.selectedTech = session.selectedTech || session.techStack || [];
  appState.featuresMust = session.featuresMust || '';
  appState.featuresNice = session.featuresNice || '';
  appState.currentRequirements = session.requirements || '';
  appState.currentMermaidCode = session.mermaidCode || '';
  appState.similarWebs = session.similarWebs || [];
  appState.targetBusinesses = session.targetBusinesses || [];

  document.getElementById('input-topic').value = appState.currentTopic;
  document.getElementById('features-must').value = appState.featuresMust;
  document.getElementById('features-nice').value = appState.featuresNice;

  const grid = document.getElementById('tech-checkboxes');
  if (grid) {
    grid.querySelectorAll('input').forEach(input => {
      input.checked = false;
    });
    appState.selectedTech.forEach(tech => {
      let checkbox = grid.querySelector(`input[value="${tech}"]`);
      if (!checkbox) {
        const label = document.createElement('label');
        label.className = 'tech-chip';
        label.innerHTML = `<input type="checkbox" value="${tech}" checked> <span>${tech}</span>`;
        grid.appendChild(label);
      } else {
        checkbox.checked = true;
      }
    });
  }

  if (appState.currentRequirements) {
    document.getElementById('requirements-rendered').innerHTML = marked.parse(appState.currentRequirements, { breaks: true });
  } else {
    document.getElementById('requirements-rendered').innerHTML = `
      <div class="empty-state">
        <i data-lucide="file-question" class="empty-icon"></i>
        <h3>Chưa có dữ liệu nghiệp vụ</h3>
        <p>Vui lòng điền thông tin và bấm nút <strong>"Tự Động Tạo Nghiệp Vụ & Sơ Đồ"</strong> ở tab Tạo dự án.</p>
      </div>`;
  }

  if (appState.currentMermaidCode) {
    drawDiagram(appState.currentMermaidCode);
  } else {
    const container = document.getElementById('mermaid-render-box');
    const emptyState = document.getElementById('diagram-empty-state');
    if (container) container.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
  }

  renderSimilarWebs();
  renderTargetBusinesses();
  
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  const activeTab = localStorage.getItem('active_tab');
  if (activeTab) {
    showTab(activeTab);
  } else {
    if (appState.currentRequirements) {
      showTab('tab-requirements');
      showSubTab('subtab-doc');
    } else {
      showTab('tab-create');
    }
  }
  const activeSubTab = localStorage.getItem('active_subtab');
  if (activeSubTab) {
    showSubTab(activeSubTab);
  }
}

function copyRequirements() {
  if (!appState.currentRequirements) {
    alert("Không tìm thấy tài liệu nghiệp vụ nào để sao chép!");
    return;
  }
  
  navigator.clipboard.writeText(appState.currentRequirements)
    .then(() => {
      alert("Đã sao chép tài liệu nghiệp vụ vào clipboard thành công!");
    })
    .catch(err => {
      console.error("Copy error:", err);
      alert("Lỗi khi sao chép tài liệu nghiệp vụ!");
    });
}

async function updateDiagramFromEditor() {
  const updatedCode = document.getElementById('mermaid-code-input').value;
  appState.currentMermaidCode = updatedCode;
  drawDiagram(updatedCode);
  updateMermaidCodeInRequirements(updatedCode);
  await saveActiveProjectState();
  await saveCurrentProject(false);
}

function updateMermaidCodeInRequirements(newMermaidCode) {
  if (!appState.currentRequirements) return;
  
  const regex = /(```mermaid\s*)([\s\S]*?)(\s*```)/;
  if (regex.test(appState.currentRequirements)) {
    appState.currentRequirements = appState.currentRequirements.replace(regex, `$1${newMermaidCode.trim()}$3`);
  } else {
    appState.currentRequirements += `\n\n### Sơ đồ hệ thống\n\`\`\`mermaid\n${newMermaidCode.trim()}\n\`\`\``;
  }
  
  // Re-render markdown body
  document.getElementById('requirements-rendered').innerHTML = marked.parse(appState.currentRequirements, { breaks: true });
}

async function saveProjectDraft() {
  const topic = document.getElementById('input-topic').value.trim();
  if (!topic) {
    alert("Vui lòng nhập chủ đề website trước khi lưu!");
    return;
  }

  // Update appState with current form values
  appState.currentTopic = topic;
  appState.selectedTech = getSelectedTech();
  appState.featuresMust = document.getElementById('features-must').value.trim();
  appState.featuresNice = document.getElementById('features-nice').value.trim();

  // Call the main save current project function
  await saveCurrentProject(true);
  
  // Also save active project state
  await saveActiveProjectState();
}

async function autosaveDraftInputs() {
  appState.currentTopic = document.getElementById('input-topic').value.trim();
  appState.selectedTech = getSelectedTech();
  appState.featuresMust = document.getElementById('features-must').value.trim();
  appState.featuresNice = document.getElementById('features-nice').value.trim();
  
  await saveActiveProjectState();
}

function setupDraftAutosave() {
  const topicInput = document.getElementById('input-topic');
  const featuresMust = document.getElementById('features-must');
  const featuresNice = document.getElementById('features-nice');
  
  if (topicInput) topicInput.addEventListener('input', autosaveDraftInputs);
  if (featuresMust) featuresMust.addEventListener('input', autosaveDraftInputs);
  if (featuresNice) featuresNice.addEventListener('input', autosaveDraftInputs);
  
  // Listen for changes in tech checkboxes
  const techContainer = document.getElementById('tech-checkboxes');
  if (techContainer) {
    techContainer.addEventListener('change', autosaveDraftInputs);
  }
}

// Popularity Analysis Modal Logic
async function showPopularityAnalysis(type) {
  const topic = document.getElementById('input-topic').value.trim();
  const tech = getSelectedTech().join(', ');
  const mustHave = document.getElementById('features-must').value.trim();
  const niceHave = document.getElementById('features-nice').value.trim();

  let subject = '';
  let prompt = '';
  let searchTrendQuery = '';

  switch (type) {
    case 'topic':
    case 'blueprint':
      subject = topic || 'Web đặt lịch nha khoa thông minh';
      searchTrendQuery = subject;
      prompt = `Bạn là một chuyên gia nghiên cứu thị trường phần mềm. Hãy đánh giá độ phổ biến và tiềm năng phát triển của chủ đề/ý tưởng website sau: "${subject}".
Trả về duy nhất một chuỗi JSON chuẩn có dạng:
{
  "searchVolume": 85,
  "marketSize": 75,
  "competition": 60,
  "growthTrend": 80,
  "competitors": "Liệt kê 2-3 đối thủ hoặc dạng sản phẩm tương tự",
  "insights": "Đưa ra nhận xét ngắn gọn 3-4 câu về xu hướng, tiềm năng và lời khuyên phát triển."
}`;
      break;
    case 'tech':
      subject = tech || 'Next.js, React, Node.js, PostgreSQL';
      searchTrendQuery = getSelectedTech()[0] || 'Next.js';
      prompt = `Đánh giá mức độ phổ biến và xu hướng phát triển của bộ công nghệ (Tech Stack) sau: "${subject}".
Trả về duy nhất một chuỗi JSON chuẩn có dạng:
{
  "searchVolume": 90,
  "marketSize": 85,
  "competition": 70,
  "growthTrend": 95,
  "competitors": "Liệt kê 2-3 công nghệ đối thủ tương đương",
  "insights": "Nhận xét ngắn gọn 3-4 câu về ưu điểm, nhược điểm và sự phù hợp của stack này."
}`;
      break;
    case 'features':
      subject = 'Các tính năng đề xuất';
      searchTrendQuery = topic || 'web app';
      prompt = `Đánh giá mức độ phổ biến và độ yêu thích của người dùng đối với các tính năng sau:
Must-Have: ${mustHave || 'Cơ bản'}
Nice-to-Have: ${niceHave || 'Nâng cao'}
Trả về duy nhất một chuỗi JSON chuẩn có dạng:
{
  "searchVolume": 70,
  "marketSize": 80,
  "competition": 50,
  "growthTrend": 85,
  "competitors": "Tính năng thay thế hoặc bổ trợ khác",
  "insights": "Nhận xét ngắn gọn 3-4 câu về việc các tính năng này có thu hút người dùng hay không và lời khuyên."
}`;
      break;
    case 'upgrade':
      subject = 'Nghiệp vụ nâng cấp dự án';
      searchTrendQuery = topic || 'web development';
      prompt = `Đánh giá mức độ phổ biến và giá trị thương mại của việc nâng cấp các tính năng nâng cao (bảo mật, log, tối ưu) cho dự án: "${topic || 'Web app'}".
Trả về duy nhất một chuỗi JSON chuẩn có dạng:
{
  "searchVolume": 75,
  "marketSize": 70,
  "competition": 45,
  "growthTrend": 90,
  "competitors": "Giải pháp bảo mật/tối ưu tiêu chuẩn",
  "insights": "Nhận xét ngắn gọn 3-4 câu về tầm quan trọng của việc nâng cấp đối với doanh nghiệp."
}`;
      break;
  }

  toggleLoading(true, "AI đang phân tích độ phổ biến thị trường...");

  let data = null;
  let isMock = false;

  if (appState.apiKey) {
    const responseText = await callGemini(prompt, true);
    if (responseText) {
      try {
        // Clean markdown block wrappers if present
        let cleanText = responseText.trim();
        if (cleanText.startsWith('```json')) {
          cleanText = cleanText.substring(7);
        } else if (cleanText.startsWith('```')) {
          cleanText = cleanText.substring(3);
        }
        if (cleanText.endsWith('```')) {
          cleanText = cleanText.substring(0, cleanText.length - 3);
        }
        data = JSON.parse(cleanText.trim());
      } catch (e) {
        console.error("Parse JSON error in popularity:", responseText, e);
      }
    }
  }

  // Fallback to mock data if Gemini call failed or API Key is missing
  if (!data) {
    isMock = true;
    data = {
      searchVolume: Math.floor(Math.random() * 30) + 60,
      marketSize: Math.floor(Math.random() * 30) + 60,
      competition: Math.floor(Math.random() * 40) + 40,
      growthTrend: Math.floor(Math.random() * 30) + 65,
      competitors: type === 'tech' ? 'SvelteKit, NestJS, MySQL' : 'Các trang web thương mại truyền thống, giải pháp thủ công',
      insights: `[BẢN MẪU] Chủ đề "${subject}" đang có xu hướng tăng trưởng ổn định trên thị trường Việt Nam và quốc tế. Người dùng ngày càng tìm kiếm các giải pháp tự động hóa và thông minh hơn. Lời khuyên: Tập trung vào trải nghiệm người dùng mượt mà và tối ưu hóa tốc độ tải trang.`
    };
  }

  toggleLoading(false);

  // Show Modal and render content
  const modal = document.getElementById('popularity-modal');
  const modalTitle = document.getElementById('popularity-modal-title');
  const modalBody = document.getElementById('popularity-modal-body');

  modalTitle.textContent = `Phân Tích Độ Phổ Biến: ${subject.length > 30 ? subject.substring(0, 30) + '...' : subject}`;

  modalBody.innerHTML = `
    ${isMock ? `<div style="background: rgba(234, 179, 8, 0.1); border: 1px solid rgba(234, 179, 8, 0.2); padding: 8px 12px; border-radius: 6px; color: #fef08a; font-size: 11px; margin-bottom: 15px; text-align: center;"><i data-lucide="alert-triangle" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:4px;"></i> Đang hiển thị phân tích mẫu. Hãy kết nối Gemini API Key ở Cài đặt để có kết quả thực tế.</div>` : ''}
    
    <div class="pop-metric-row">
      <div class="pop-metric-label">
        <span><i data-lucide="search" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:4px;"></i> Lượng tìm kiếm (Search Volume)</span>
        <span>${data.searchVolume}%</span>
      </div>
      <div class="pop-progress-bar">
        <div class="pop-progress-fill bg-trend-high" style="width: ${data.searchVolume}%"></div>
      </div>
    </div>

    <div class="pop-metric-row">
      <div class="pop-metric-label">
        <span><i data-lucide="users" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:4px;"></i> Quy mô thị trường (Market Size)</span>
        <span>${data.marketSize}%</span>
      </div>
      <div class="pop-progress-bar">
        <div class="pop-progress-fill bg-trend-med" style="width: ${data.marketSize}%"></div>
      </div>
    </div>

    <div class="pop-metric-row">
      <div class="pop-metric-label">
        <span><i data-lucide="shield-alert" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:4px;"></i> Độ cạnh tranh (Competition)</span>
        <span>${data.competition}%</span>
      </div>
      <div class="pop-progress-bar">
        <div class="pop-progress-fill bg-trend-low" style="width: ${data.competition}%"></div>
      </div>
    </div>

    <div class="pop-metric-row">
      <div class="pop-metric-label">
        <span><i data-lucide="trending-up" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:4px;"></i> Xu hướng tăng trưởng (Growth Trend)</span>
        <span>${data.growthTrend}%</span>
      </div>
      <div class="pop-progress-bar">
        <div class="pop-progress-fill bg-trend-high" style="width: ${data.growthTrend}%"></div>
      </div>
    </div>

    <div style="margin-top: 20px;">
      <h3 style="font-size: 13px; font-weight: 600; margin-bottom: 6px; color: var(--text-highlight);">Các đối thủ / Giải pháp tương đương:</h3>
      <p style="font-size: 13px; color: var(--text-muted); margin: 0; background: rgba(0,0,0,0.15); padding: 8px 12px; border-radius: 6px;">${data.competitors}</p>
    </div>

    <div class="pop-insight-card">
      <strong style="display: block; margin-bottom: 4px; color: var(--primary);"><i data-lucide="lightbulb" style="width:13px;height:13px;display:inline-block;vertical-align:middle;margin-right:4px;"></i> Đánh giá từ chuyên gia AI:</strong>
      <p style="margin: 0; font-size: 13px; line-height: 1.5;">${data.insights}</p>
    </div>
  `;

  // Bind Google Trends link
  const trendsBtn = document.getElementById('btn-popularity-google-trends');
  trendsBtn.onclick = () => {
    const url = `https://trends.google.com/trends/explore?q=${encodeURIComponent(searchTrendQuery)}`;
    window.api.openLink(url);
  };

  modal.classList.remove('hidden');
  lucide.createIcons();
}


