const state = { user: null, projects: [], query: '' };
const elements = {
  loading: document.getElementById('loading-panel'),
  login: document.getElementById('login-panel'),
  setup: document.getElementById('setup-panel'),
  setupMessage: document.getElementById('setup-message'),
  app: document.getElementById('manager-app'),
  userArea: document.getElementById('user-area'),
  userName: document.getElementById('user-name'),
  userAvatar: document.getElementById('user-avatar'),
  createPanel: document.getElementById('create-panel'),
  createForm: document.getElementById('create-project'),
  list: document.getElementById('project-list'),
  status: document.getElementById('manager-status'),
  search: document.getElementById('project-search')
};

const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
const selected = (value, expected) => value === expected ? ' selected' : '';

async function api(path, options = {}) {
  const response = await fetch(`/api/${path}`, {
    ...options,
    headers: options.body instanceof FormData ? (options.headers || {}) : { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || 'The request could not be completed.');
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

function showOnly(panel) {
  [elements.loading, elements.login, elements.setup].forEach(element => { element.hidden = element !== panel; });
  elements.app.hidden = true;
  elements.userArea.hidden = true;
}

function setStatus(message = '', type = '') {
  elements.status.textContent = message;
  elements.status.className = `manager-status${type ? ` ${type}` : ''}`;
}

function categoryLabel(category) {
  return ({ residential: 'Residential', kitchens: 'Kitchen', commercial: 'Commercial' })[category] || category;
}

function imageItem(image, index, total) {
  return `<div class="image-item${image.deleted ? ' is-deleted' : ''}" data-image-id="${escapeHtml(image.id)}">
    <img src="${escapeHtml(image.file)}" alt="" loading="lazy">
    <div class="image-fields">
      <input class="image-alt" value="${escapeHtml(image.alt)}" maxlength="250" aria-label="Image description" placeholder="Describe the image" ${image.deleted ? 'disabled' : ''}>
      <input class="image-caption" value="${escapeHtml(image.caption)}" maxlength="160" aria-label="Image caption" placeholder="Short caption" ${image.deleted ? 'disabled' : ''}>
      <div class="image-actions">
        <button class="mini-button move-image" type="button" data-direction="up" ${index === 0 || image.deleted ? 'disabled' : ''}>Move up</button>
        <button class="mini-button move-image" type="button" data-direction="down" ${index === total - 1 || image.deleted ? 'disabled' : ''}>Move down</button>
        <button class="mini-button danger toggle-image" type="button">${image.deleted ? 'Restore image' : 'Remove image'}</button>
      </div>
    </div>
  </div>`;
}

function projectCard(project) {
  const statusClass = project.archived ? 'archived' : project.status;
  const imageMarkup = project.images?.length ? project.images.map((image, index) => imageItem(image, index, project.images.length)).join('') : '<p class="upload-note">No images yet. Upload the first project image below.</p>';
  const statusControl = state.user.canPublish ? `<label>Status<select name="status"><option value="draft"${selected(project.status, 'draft')}>Draft</option><option value="published"${selected(project.status, 'published')}>Published</option></select></label>` : `<p class="project-meta">Status changes require publishing permission.</p>`;
  return `<article class="project-card${project.archived ? ' is-archived' : ''}" data-project-id="${escapeHtml(project.id)}">
    <div class="project-card-heading">
      <div><span class="status-pill ${statusClass}">${project.archived ? 'Archived' : escapeHtml(project.status)}</span><h3>${escapeHtml(project.title)}</h3><div class="project-meta">${escapeHtml(categoryLabel(project.category))}${project.location ? ` · ${escapeHtml(project.location)}` : ''}${project.updatedBy?.name ? ` · Last changed by ${escapeHtml(project.updatedBy.name)}` : ''}</div></div>
      <button class="quiet-button toggle-editor" type="button" aria-expanded="false">Edit project</button>
    </div>
    <div class="project-body" hidden>
      <div class="project-layout">
        <form class="manager-form project-editor">
          <div class="field-row"><label>Project name<input name="title" value="${escapeHtml(project.title)}" required maxlength="120"></label><label>Category<select name="category"><option value="residential"${selected(project.category, 'residential')}>Residential</option><option value="kitchens"${selected(project.category, 'kitchens')}>Kitchen</option><option value="commercial"${selected(project.category, 'commercial')}>Commercial</option></select></label></div>
          <label>Location<input name="location" value="${escapeHtml(project.location)}" maxlength="160"></label>
          <label>Description<textarea name="description" maxlength="1500" rows="5">${escapeHtml(project.description)}</textarea></label>
          ${statusControl}
          <div class="form-actions"><button class="primary-button save-project" type="submit">Save project changes</button></div>
        </form>
        <div class="project-images">
          <h4>Project images</h4>
          <div class="image-list">${imageMarkup}</div>
          ${project.archived ? '' : `<form class="upload-box upload-image"><label>Choose a new image<input name="image" type="file" accept="image/jpeg,image/png,image/webp" required></label><img class="upload-preview" alt="Selected image preview"><label>Image description<input name="alt" required maxlength="250" placeholder="Example: Warm living room with timber wall panels"></label><label>Short caption<input name="caption" maxlength="160" placeholder="Example: Custom living area"></label><p class="upload-note">The image will be resized and compressed automatically before upload.</p><button class="quiet-button" type="submit">Upload image</button></form>`}
        </div>
      </div>
      <div class="danger-zone"><p>Archived projects disappear from the public gallery but remain recoverable.</p>${project.archived ? '<button class="quiet-button restore-project" type="button">Restore project</button>' : '<button class="danger-button archive-project" type="button">Archive project</button>'}</div>
    </div>
  </article>`;
}

function renderProjects() {
  const query = state.query.trim().toLowerCase();
  const projects = state.projects.filter(project => !query || `${project.title} ${project.location} ${project.description}`.toLowerCase().includes(query));
  elements.list.innerHTML = projects.length ? projects.map(projectCard).join('') : '<div class="empty-state">No matching projects found.</div>';
  bindProjectEvents();
}

function getProject(card) {
  return state.projects.find(project => project.id === card.dataset.projectId);
}

function collectImages(card, project) {
  return [...card.querySelectorAll('.image-item')].map(item => {
    const existing = project.images.find(image => image.id === item.dataset.imageId);
    return {
      ...existing,
      alt: item.querySelector('.image-alt')?.value.trim() || existing.alt,
      caption: item.querySelector('.image-caption')?.value.trim() || ''
    };
  });
}

function updateProjectInState(updated) {
  const index = state.projects.findIndex(project => project.id === updated.id);
  if (index >= 0) state.projects[index] = updated;
  else state.projects.unshift(updated);
  renderProjects();
}

function bindProjectEvents() {
  elements.list.querySelectorAll('.toggle-editor').forEach(button => button.addEventListener('click', () => {
    const body = button.closest('.project-card').querySelector('.project-body');
    const opening = body.hidden;
    body.hidden = !opening;
    button.textContent = opening ? 'Close editor' : 'Edit project';
    button.setAttribute('aria-expanded', String(opening));
  }));

  elements.list.querySelectorAll('.project-editor').forEach(form => form.addEventListener('submit', async event => {
    event.preventDefault();
    const card = form.closest('.project-card');
    const project = getProject(card);
    const submit = form.querySelector('.save-project');
    submit.disabled = true;
    setStatus(`Saving ${project.title}…`, 'busy');
    try {
      const fields = new FormData(form);
      const payload = {
        title: fields.get('title'), category: fields.get('category'), location: fields.get('location'),
        description: fields.get('description'), status: fields.get('status') || project.status,
        archived: project.archived, images: collectImages(card, project)
      };
      const result = await api(`projects/${encodeURIComponent(project.id)}`, { method: 'PUT', body: JSON.stringify(payload) });
      updateProjectInState(result.project);
      setStatus('Project changes saved. GitHub and Cloudflare are publishing the update.', 'success');
    } catch (error) {
      setStatus(error.message, 'error');
    } finally {
      submit.disabled = false;
    }
  }));

  elements.list.querySelectorAll('.toggle-image').forEach(button => button.addEventListener('click', () => {
    const card = button.closest('.project-card');
    const project = getProject(card);
    project.images = collectImages(card, project);
    const imageId = button.closest('.image-item').dataset.imageId;
    const image = project.images.find(item => item.id === imageId);
    image.deleted = !image.deleted;
    renderProjects();
    const reopened = elements.list.querySelector(`[data-project-id="${CSS.escape(project.id)}"] .project-body`);
    if (reopened) reopened.hidden = false;
    setStatus('Image change is ready. Select “Save project changes” to publish it.', 'busy');
  }));

  elements.list.querySelectorAll('.move-image').forEach(button => button.addEventListener('click', () => {
    const card = button.closest('.project-card');
    const project = getProject(card);
    project.images = collectImages(card, project);
    const imageId = button.closest('.image-item').dataset.imageId;
    const index = project.images.findIndex(item => item.id === imageId);
    const destination = button.dataset.direction === 'up' ? index - 1 : index + 1;
    if (destination < 0 || destination >= project.images.length) return;
    [project.images[index], project.images[destination]] = [project.images[destination], project.images[index]];
    renderProjects();
    const reopened = elements.list.querySelector(`[data-project-id="${CSS.escape(project.id)}"] .project-body`);
    if (reopened) reopened.hidden = false;
    setStatus('Image order is ready. Select “Save project changes” to publish it.', 'busy');
  }));

  elements.list.querySelectorAll('.upload-image').forEach(form => {
    const input = form.elements.image;
    const preview = form.querySelector('.upload-preview');
    input.addEventListener('change', () => {
      if (!input.files[0]) return preview.removeAttribute('src');
      preview.src = URL.createObjectURL(input.files[0]);
    });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const card = form.closest('.project-card');
      const project = getProject(card);
      const submit = form.querySelector('button[type=submit]');
      submit.disabled = true;
      setStatus('Preparing and uploading the image…', 'busy');
      try {
        const compressed = await compressImage(input.files[0]);
        const payload = new FormData();
        payload.append('image', compressed, 'project-image.jpg');
        payload.append('alt', form.elements.alt.value.trim());
        payload.append('caption', form.elements.caption.value.trim());
        const result = await api(`projects/${encodeURIComponent(project.id)}/images`, { method: 'POST', body: payload });
        updateProjectInState(result.project);
        setStatus('Image uploaded. Cloudflare is publishing the gallery update.', 'success');
      } catch (error) {
        setStatus(error.message, 'error');
      } finally {
        submit.disabled = false;
      }
    });
  });

  elements.list.querySelectorAll('.archive-project').forEach(button => button.addEventListener('click', async () => {
    const project = getProject(button.closest('.project-card'));
    if (!confirm(`Archive “${project.title}”? It will disappear from the public gallery but can be restored.`)) return;
    button.disabled = true;
    setStatus(`Archiving ${project.title}…`, 'busy');
    try {
      const result = await api(`projects/${encodeURIComponent(project.id)}`, { method: 'DELETE', body: '{}' });
      updateProjectInState(result.project);
      setStatus('Project archived safely.', 'success');
    } catch (error) { setStatus(error.message, 'error'); button.disabled = false; }
  }));

  elements.list.querySelectorAll('.restore-project').forEach(button => button.addEventListener('click', async () => {
    const project = getProject(button.closest('.project-card'));
    button.disabled = true;
    setStatus(`Restoring ${project.title}…`, 'busy');
    try {
      const result = await api(`projects/${encodeURIComponent(project.id)}/restore`, { method: 'POST', body: '{}' });
      updateProjectInState(result.project);
      setStatus('Project restored as a draft. Review it before publishing.', 'success');
    } catch (error) { setStatus(error.message, 'error'); button.disabled = false; }
  }));
}

async function compressImage(file) {
  if (!file) throw new Error('Choose an image first.');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Use a JPG, PNG or WebP image.');
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, 1800 / bitmap.width, 1200 / bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d', { alpha: false });
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const toBlob = quality => new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
  let blob = await toBlob(0.84);
  for (const quality of [0.76, 0.68, 0.6]) {
    if (blob.size <= 700000) break;
    blob = await toBlob(quality);
  }
  if (!blob || blob.size > 800000) throw new Error('This image could not be compressed below 800 KB. Choose a smaller image.');
  return new File([blob], 'project-image.jpg', { type: 'image/jpeg' });
}

async function loadProjects() {
  const payload = await api('projects');
  state.projects = payload.projects || [];
  renderProjects();
}

async function initialize() {
  try {
    const session = await api('session');
    state.user = session.user;
    elements.loading.hidden = true;
    elements.app.hidden = false;
    elements.userArea.hidden = false;
    elements.userName.textContent = state.user.name;
    if (state.user.avatar) elements.userAvatar.src = state.user.avatar;
    await loadProjects();
  } catch (error) {
    if (error.status === 401) return showOnly(elements.login);
    if (error.status === 503) {
      showOnly(elements.setup);
      const missing = error.payload?.missing?.join(', ');
      if (missing) elements.setupMessage.textContent = `Cloudflare still needs these settings: ${missing}.`;
      return;
    }
    showOnly(elements.setup);
    elements.setupMessage.textContent = error.message;
  }
}

document.getElementById('show-create').addEventListener('click', () => { elements.createPanel.hidden = false; elements.createForm.elements.title.focus(); });
document.getElementById('cancel-create').addEventListener('click', () => { elements.createPanel.hidden = true; });
elements.search.addEventListener('input', () => { state.query = elements.search.value; renderProjects(); });
elements.createForm.addEventListener('submit', async event => {
  event.preventDefault();
  const submit = elements.createForm.querySelector('button[type=submit]');
  submit.disabled = true;
  setStatus('Creating the draft project…', 'busy');
  try {
    const data = Object.fromEntries(new FormData(elements.createForm));
    const result = await api('projects', { method: 'POST', body: JSON.stringify(data) });
    updateProjectInState(result.project);
    elements.createForm.reset();
    elements.createPanel.hidden = true;
    setStatus('Draft project created. Open it to add images.', 'success');
  } catch (error) { setStatus(error.message, 'error'); } finally { submit.disabled = false; }
});
document.getElementById('logout').addEventListener('click', async () => {
  await api('auth/logout', { method: 'POST', body: '{}' }).catch(() => {});
  location.reload();
});

initialize();
