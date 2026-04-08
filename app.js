import {
  addDoc,
  auth,
  collection,
  db,
  deleteDoc,
  doc,
  onAuthStateChanged,
  onSnapshot,
  orderBy,
  provider,
  query,
  serverTimestamp,
  setDoc,
  signInWithPopup,
  signOut,
  updateDoc,
} from "./firebase-config.js";

const STORAGE_KEY = "freshfaces-v3";
const MODELS_URL = "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js/weights";

const state = {
  currentUser: null,
  users: [],
  lunchPosts: [],
  suggestionId: null,
  memorizedIds: [],
  lunchParticipantCounts: {},
  registerStream: null,
  recognitionStream: null,
  faceApiReady: false,
};

const els = {
  app: document.querySelector("#app"),
  authStatus: document.querySelector("#authStatus"),
  cameraCaptureButton: document.querySelector("#cameraCaptureButton"),
  cameraPreview: document.querySelector("#cameraPreview"),
  cameraStartButton: document.querySelector("#cameraStartButton"),
  captureCanvas: document.querySelector("#captureCanvas"),
  deleteProfileButton: document.querySelector("#deleteProfileButton"),
  directoryList: document.querySelector("#directoryList"),
  directorySearch: document.querySelector("#directorySearch"),
  exportButton: document.querySelector("#exportButton"),
  importInput: document.querySelector("#importInput"),
  loginPanel: document.querySelector("#loginPanel"),
  loginPanelButton: document.querySelector("#loginPanelButton"),
  loginButton: document.querySelector("#loginButton"),
  logoutButton: document.querySelector("#logoutButton"),
  lunchDate: document.querySelector("#lunchDate"),
  lunchFeed: document.querySelector("#lunchFeed"),
  lunchForm: document.querySelector("#lunchForm"),
  lunchSlot: document.querySelector("#lunchSlot"),
  photoUpload: document.querySelector("#photoUpload"),
  profileForm: document.querySelector("#profileForm"),
  profileGallery: document.querySelector("#profileGallery"),
  profileKana: document.querySelector("#profileKana"),
  profileName: document.querySelector("#profileName"),
  profileNickname: document.querySelector("#profileNickname"),
  recognitionCanvas: document.querySelector("#recognitionCanvas"),
  recognitionPreview: document.querySelector("#recognitionPreview"),
  recognitionResults: document.querySelector("#recognitionResults"),
  recognitionStartButton: document.querySelector("#recognitionStartButton"),
  recognizeButton: document.querySelector("#recognizeButton"),
  refreshSuggestionButton: document.querySelector("#refreshSuggestionButton"),
  suggestionCard: document.querySelector("#suggestionCard"),
  welcomeName: document.querySelector("#welcomeName"),
};

const lunchCollection = collection(db, "lunchPosts");
const usersCollection = collection(db, "profiles");

boot();

async function boot() {
  bindEvents();
  loadLocalState();
  await loadFaceApi();
  els.lunchDate.valueAsDate = new Date();
  subscribeProfiles();
  subscribeLunchPosts();
  onAuthStateChanged(auth, handleAuthChange);
}

function bindEvents() {
  els.loginButton.addEventListener("click", handleLogin);
  els.loginPanelButton.addEventListener("click", handleLogin);
  els.logoutButton.addEventListener("click", async () => {
    await signOut(auth);
  });
  els.cameraStartButton.addEventListener("click", () => startCamera("register"));
  els.recognitionStartButton.addEventListener("click", () => startCamera("recognition"));
  els.cameraCaptureButton.addEventListener("click", captureFromCamera);
  els.photoUpload.addEventListener("change", handlePhotoUpload);
  els.profileForm.addEventListener("submit", saveProfile);
  els.recognizeButton.addEventListener("click", recognizeFace);
  els.refreshSuggestionButton.addEventListener("click", () => {
    state.suggestionId = null;
    renderSuggestion();
  });
  els.directorySearch.addEventListener("input", renderDirectory);
  els.exportButton.addEventListener("click", exportJson);
  els.importInput.addEventListener("change", importJson);
  els.deleteProfileButton.addEventListener("click", deleteMyProfile);
  els.lunchForm.addEventListener("submit", createLunchPost);
}

async function handleLogin() {
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    setStatus(`ログインに失敗しました: ${error.message}`);
  }
}

function handleAuthChange(user) {
  state.currentUser = user;
  const allowed = Boolean(user?.email?.endsWith("@kamiyama.ac.jp"));
  const canUseApp = Boolean(user) && allowed;

  els.app.hidden = !canUseApp;
  els.loginPanel.hidden = canUseApp;
  els.logoutButton.hidden = !user;
  els.loginButton.hidden = Boolean(user);

  if (!user) {
    els.welcomeName.textContent = "ようこそ";
    setStatus("学内アカウントでログインしてください。");
    return;
  }

  if (user && !allowed) {
    setStatus("`@kamiyama.ac.jp` の Google アカウントのみ利用できます。");
    void signOut(auth);
    return;
  }

  els.welcomeName.textContent = `${user.displayName ?? "学内ユーザー"} さん`;
  setStatus("ログインできました。プロフィールを登録すると使い始められます。");

  hydrateProfileForm();
  renderAll();
  requestNotificationPermission();
}

function setStatus(message) {
  els.authStatus.textContent = message;
}

function loadLocalState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    state.users = Array.isArray(parsed.users) ? parsed.users : [];
    state.suggestionId = parsed.suggestionId ?? null;
    state.memorizedIds = Array.isArray(parsed.memorizedIds) ? parsed.memorizedIds : [];
  } catch (error) {
    console.error(error);
  }
}

function persistLocalState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      users: state.users,
      suggestionId: state.suggestionId,
      memorizedIds: state.memorizedIds,
    }),
  );
}

function getActiveProfileId() {
  if (state.currentUser) return state.currentUser.uid;
  return null;
}

function getMyProfile() {
  const id = getActiveProfileId();
  if (!id) return null;
  return state.users.find((user) => user.id === id) ?? null;
}

function subscribeProfiles() {
  onSnapshot(usersCollection, (snapshot) => {
    state.users = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    persistLocalState();
    hydrateProfileForm();
    renderAll();
  });
}

function hydrateProfileForm() {
  const profile = getMyProfile();
  els.profileName.value = profile?.name ?? "";
  els.profileKana.value = profile?.kana ?? "";
  els.profileNickname.value = profile?.nickname ?? "";
  renderProfileGallery();
}

async function saveProfile(event) {
  event.preventDefault();
  const activeProfileId = getActiveProfileId();
  if (!activeProfileId) return;

  const existing = getMyProfile();
  const nextProfile = {
    id: activeProfileId,
    email: state.currentUser?.email ?? "guest@local",
    name: els.profileName.value.trim(),
    kana: els.profileKana.value.trim(),
    nickname: els.profileNickname.value.trim(),
    faces: existing?.faces ?? [],
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (!nextProfile.name || !nextProfile.kana || !nextProfile.nickname) {
    setStatus("名前、ふりがな、あだ名を入力してください。");
    return;
  }
  if (nextProfile.faces.length === 0) {
    setStatus("顔写真を1枚以上登録してください。");
    return;
  }

  upsertLocalProfile(nextProfile);
  if (state.currentUser) await setDoc(doc(db, "profiles", nextProfile.id), nextProfile, { merge: true });
  persistLocalState();
  renderAll();
  setStatus("プロフィールを保存しました。");
}

async function handlePhotoUpload(event) {
  const files = [...(event.target.files ?? [])];
  for (const file of files) {
    const imageData = await fileToDataUrl(file);
    await addFaceToMyProfile(imageData);
  }
  event.target.value = "";
}

async function captureFromCamera() {
  if (!state.registerStream) {
    setStatus("先に「カメラ開始」を押してください。");
    return;
  }
  const imageData = captureVideoFrame(els.cameraPreview, els.captureCanvas);
  await addFaceToMyProfile(imageData);
}

async function addFaceToMyProfile(imageData) {
  const activeProfileId = getActiveProfileId();
  if (!activeProfileId) {
    setStatus("先にログインしてください。");
    return;
  }
  if (!state.faceApiReady) {
    setStatus("顔認識モデルの準備中です。");
    return;
  }

  const descriptor = await detectDescriptor(imageData);
  if (!descriptor) {
    setStatus("顔を検出できませんでした。正面の写真で再度試してください。");
    return;
  }

  const existing = getMyProfile() ?? {
    id: activeProfileId,
    email: state.currentUser?.email ?? "guest@local",
    name: els.profileName.value.trim(),
    kana: els.profileKana.value.trim(),
    nickname: els.profileNickname.value.trim(),
    faces: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  existing.name = els.profileName.value.trim();
  existing.kana = els.profileKana.value.trim();
  existing.nickname = els.profileNickname.value.trim();
  existing.faces.push({
    imageData,
    descriptor,
    createdAt: new Date().toISOString(),
  });
  existing.updatedAt = new Date().toISOString();

  upsertLocalProfile(existing);
  if (state.currentUser) await setDoc(doc(db, "profiles", existing.id), existing, { merge: true });
  persistLocalState();
  renderProfileGallery();
  renderDirectory();
  renderSuggestion();
  setStatus("顔写真を追加しました。");
}

function upsertLocalProfile(profile) {
  const index = state.users.findIndex((user) => user.id === profile.id);
  if (index >= 0) state.users[index] = profile;
  else state.users.push(profile);
}

function renderProfileGallery() {
  const profile = getMyProfile();
  els.profileGallery.innerHTML = "";
  for (const face of profile?.faces ?? []) {
    const image = document.createElement("img");
    image.src = face.imageData;
    image.alt = "登録写真";
    els.profileGallery.append(image);
  }
}

async function loadFaceApi() {
  if (!window.faceapi) {
    setStatus("face-api.js を読み込めませんでした。");
    return;
  }
  try {
    await Promise.all([
      window.faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL),
      window.faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODELS_URL),
      window.faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL),
    ]);
    state.faceApiReady = true;
    setStatus("顔認識モデルの準備ができました。");
  } catch (error) {
    console.warn(error);
    setStatus("顔認識モデルの読み込みに失敗しました。");
  }
}

async function startCamera(kind) {
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("getUserMedia が使えません");
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });

    if (kind === "register") {
      stopStream(state.registerStream);
      state.registerStream = stream;
      els.cameraPreview.srcObject = stream;
      await els.cameraPreview.play().catch(() => {});
      setStatus("登録用カメラを起動しました。");
      return;
    }

    stopStream(state.recognitionStream);
    state.recognitionStream = stream;
    els.recognitionPreview.srcObject = stream;
    await els.recognitionPreview.play().catch(() => {});
    setStatus("認識用カメラを起動しました。");
  } catch (error) {
    console.warn(error);
    setStatus(`カメラを起動できませんでした。 ${error.message ?? ""}`.trim());
  }
}

async function recognizeFace() {
  if (!state.recognitionStream) {
    setStatus("先に「認識カメラ開始」を押してください。");
    return;
  }
  if (!state.faceApiReady) {
    setStatus("顔認識モデルの準備中です。");
    return;
  }

  const imageData = captureVideoFrame(els.recognitionPreview, els.recognitionCanvas);
  const descriptor = await detectDescriptor(imageData);
  if (!descriptor) {
    els.recognitionResults.className = "stack results empty-state";
    els.recognitionResults.textContent = "顔を検出できませんでした。";
    return;
  }

  const matches = state.users
    .filter((user) => user.faces?.length)
    .flatMap((user) =>
      user.faces.map((face) => ({
        id: user.id,
        user,
        distance: calculateDistance(descriptor, face.descriptor),
      })),
    )
    .sort((a, b) => a.distance - b.distance);

  const topUnique = [];
  for (const match of matches) {
    if (topUnique.some((item) => item.id === match.id)) continue;
    topUnique.push(match);
    if (topUnique.length === 3) break;
  }

  els.recognitionResults.className = "stack results";
  els.recognitionResults.innerHTML = "";

  if (topUnique.length === 0) {
    els.recognitionResults.className = "stack results empty-state";
    els.recognitionResults.textContent = "候補が見つかりませんでした。";
    return;
  }

  for (const [index, match] of topUnique.entries()) {
    const card = document.createElement("article");
    card.className = "result-card";
    card.innerHTML = `
      <div class="lunch-meta">
        <span class="chip">候補 ${index + 1}</span>
        <span class="chip">距離 ${match.distance.toFixed(3)}</span>
      </div>
      <h4>${escapeHtml(match.user.name)}</h4>
      <p class="muted">${escapeHtml(match.user.kana)}</p>
      <p>${escapeHtml(match.user.nickname)}</p>
    `;
    els.recognitionResults.append(card);
  }
}

function renderAll() {
  renderProfileGallery();
  renderDirectory();
  renderSuggestion();
}

function renderSuggestion() {
  const currentId = getActiveProfileId();
  const candidates = state.users.filter(
    (user) => user.id !== currentId && user.faces?.length && !state.memorizedIds.includes(user.id),
  );

  if (candidates.length === 0) {
    els.suggestionCard.className = "suggestion-card empty-state";
    els.suggestionCard.textContent = "まだ覚えていない人がいません。";
    return;
  }

  if (!state.suggestionId || !candidates.some((user) => user.id === state.suggestionId)) {
    state.suggestionId = candidates[Math.floor(Math.random() * candidates.length)].id;
    persistLocalState();
  }

  const suggested = candidates.find((user) => user.id === state.suggestionId) ?? candidates[0];
  els.suggestionCard.className = "";
  els.suggestionCard.innerHTML = `
    <div class="suggestion-wrap">
      <img class="suggestion-photo" src="${suggested.faces[0].imageData}" alt="${escapeHtml(suggested.name)}" />
      <div class="stack">
        <div>
          <h4>${escapeHtml(suggested.name)}</h4>
          <p class="muted">${escapeHtml(suggested.kana)}</p>
          <p>${escapeHtml(suggested.nickname)}</p>
        </div>
        <div class="inline-actions">
          <button class="primary" data-action="memorize" type="button">覚えた</button>
          <button class="ghost" data-action="next" type="button">次の人</button>
        </div>
      </div>
    </div>
  `;
  els.suggestionCard.querySelector("[data-action='memorize']").addEventListener("click", () => markMemorized(suggested.id));
  els.suggestionCard.querySelector("[data-action='next']").addEventListener("click", () => {
    state.suggestionId = null;
    renderSuggestion();
  });
}

function renderDirectory() {
  const queryText = els.directorySearch.value.trim().toLowerCase();
  els.directoryList.innerHTML = "";
  const template = document.querySelector("#directoryItemTemplate");

  const filtered = state.users.filter((user) => {
    if (!queryText) return true;
    return [user.name, user.kana, user.nickname].some((value) => value?.toLowerCase().includes(queryText));
  });

  if (filtered.length === 0) {
    els.directoryList.innerHTML = `<div class="empty-state">一致するプロフィールがありません。</div>`;
    return;
  }

  for (const user of filtered) {
    const node = template.content.firstElementChild.cloneNode(true);
    node.querySelector("img").src = user.faces?.[0]?.imageData ?? "";
    node.querySelector("img").alt = `${user.name} の写真`;
    node.querySelector("h4").textContent = user.name;
    node.querySelector(".kana").textContent = user.kana;
    node.querySelector(".nickname").textContent = user.nickname;
    const button = node.querySelector(".memorize-button");
    const memorized = state.memorizedIds.includes(user.id);
    button.textContent = memorized ? "覚えた済み" : "覚えた";
    button.disabled = memorized;
    button.addEventListener("click", () => markMemorized(user.id));
    els.directoryList.append(node);
  }
}

function markMemorized(id) {
  if (state.memorizedIds.includes(id)) return;
  state.memorizedIds.push(id);
  if (state.suggestionId === id) state.suggestionId = null;
  persistLocalState();
  renderDirectory();
  renderSuggestion();
}

function exportJson() {
  const blob = new Blob([JSON.stringify({ users: state.users, memorizedIds: state.memorizedIds }, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "freshfaces-backup.json";
  link.click();
  URL.revokeObjectURL(url);
}

async function importJson(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (!Array.isArray(parsed.users)) throw new Error("users 配列が必要です");
    if (!window.confirm("既存データを上書きしますか？")) return;
    state.users = parsed.users;
    state.memorizedIds = Array.isArray(parsed.memorizedIds) ? parsed.memorizedIds : [];
    persistLocalState();
    for (const user of state.users) {
      if (state.currentUser) {
        await setDoc(doc(db, "profiles", user.id), user, { merge: true });
      }
    }
    hydrateProfileForm();
    renderAll();
    setStatus("JSONを読み込みました。");
  } catch (error) {
    setStatus(`インポートに失敗しました: ${error.message}`);
  } finally {
    event.target.value = "";
  }
}

async function deleteMyProfile() {
  const profile = getMyProfile();
  if (!profile) return;
  if (!window.confirm("自分のプロフィールを削除しますか？")) return;
  state.users = state.users.filter((user) => user.id !== profile.id);
  persistLocalState();
  if (state.currentUser) await deleteDoc(doc(db, "profiles", profile.id)).catch(() => {});
  hydrateProfileForm();
  renderAll();
  setStatus("プロフィールを削除しました。");
}

async function createLunchPost(event) {
  event.preventDefault();
  if (!state.currentUser) {
    setStatus("相席募集はログイン後に使えます。");
    return;
  }
  const myProfile = getMyProfile();
  if (!myProfile) {
    setStatus("先にプロフィールを保存してください。");
    return;
  }
  const date = els.lunchDate.value;
  const slot = els.lunchSlot.value;
  await addDoc(lunchCollection, {
    ownerId: state.currentUser.uid,
    ownerName: myProfile.name,
    date,
    slot,
    title: "今、食堂で一緒に食べる人募集",
    participants: [],
    expiresAt: createExpiryIso(date, slot),
    createdAt: serverTimestamp(),
  });
  els.lunchForm.reset();
  els.lunchDate.valueAsDate = new Date();
  setStatus("相席募集を作成しました。");
}

function subscribeLunchPosts() {
  const q = query(lunchCollection, orderBy("date", "asc"));
  onSnapshot(q, async (snapshot) => {
    const now = new Date().toISOString();
    const items = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    state.lunchPosts = items.filter((item) => item.expiresAt > now);
    maybeNotifyLunchChanges(state.lunchPosts);
    renderLunchFeed();

    for (const item of items.filter((entry) => entry.expiresAt <= now)) {
      await deleteDoc(doc(db, "lunchPosts", item.id)).catch(() => {});
    }
  });
}

function renderLunchFeed() {
  els.lunchFeed.innerHTML = "";
  if (state.lunchPosts.length === 0) {
    els.lunchFeed.innerHTML = `<div class="empty-state">現在募集中の相席はありません。</div>`;
    return;
  }
  for (const post of state.lunchPosts) {
    const participants = Array.isArray(post.participants) ? post.participants : [];
    const card = document.createElement("article");
    card.className = "lunch-card";
    card.innerHTML = `
      <div class="lunch-meta">
        <span class="chip">${escapeHtml(post.date)}</span>
        <span class="chip">${post.slot === "lunch" ? "昼" : "夜"}</span>
      </div>
      <h4>${escapeHtml(post.title)}</h4>
      <p class="muted">募集者: ${escapeHtml(post.ownerName)}</p>
      <div class="participants">
        ${
          participants.length
            ? participants.map((participant) => `<span class="participant">${escapeHtml(participant.name)}</span>`).join("")
            : '<span class="muted">まだ参加者はいません。</span>'
        }
      </div>
      <button class="primary" type="button">参加する</button>
    `;
    card.querySelector("button").addEventListener("click", () => joinLunch(post));
    els.lunchFeed.append(card);
  }
}

async function joinLunch(post) {
  if (!state.currentUser) {
    setStatus("相席募集への参加はログイン後に使えます。");
    return;
  }
  const myProfile = getMyProfile();
  if (!myProfile) {
    setStatus("先にプロフィールを保存してください。");
    return;
  }
  const participants = Array.isArray(post.participants) ? [...post.participants] : [];
  if (participants.some((participant) => participant.id === state.currentUser.uid)) {
    setStatus("すでに参加しています。");
    return;
  }
  participants.push({ id: state.currentUser.uid, name: myProfile.name });
  await updateDoc(doc(db, "lunchPosts", post.id), { participants });
  setStatus("相席募集に参加しました。");
}

function maybeNotifyLunchChanges(posts) {
  if (!state.currentUser || Notification.permission !== "granted") {
    state.lunchParticipantCounts = Object.fromEntries(
      posts.map((post) => [post.id, Array.isArray(post.participants) ? post.participants.length : 0]),
    );
    return;
  }

  for (const post of posts) {
    const count = Array.isArray(post.participants) ? post.participants.length : 0;
    const previous = state.lunchParticipantCounts[post.id] ?? count;
    if (post.ownerId === state.currentUser.uid && count > previous) {
      const latest = post.participants.at(-1);
      if (latest) {
        new Notification("FreshFaces", {
          body: `${latest.name} さんがあなたの相席募集に参加しました。`,
        });
      }
    }
    state.lunchParticipantCounts[post.id] = count;
  }
}

async function requestNotificationPermission() {
  if (!("Notification" in window) || Notification.permission !== "default") return;
  await Notification.requestPermission().catch(() => {});
}

async function detectDescriptor(imageData) {
  if (!state.faceApiReady || !window.faceapi) return null;
  const image = await loadImage(imageData);
  const result = await window.faceapi
    .detectSingleFace(
      image,
      new window.faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }),
    )
    .withFaceLandmarks(true)
    .withFaceDescriptor();
  return result ? Array.from(result.descriptor) : null;
}

function stopStream(stream) {
  for (const track of stream?.getTracks?.() ?? []) track.stop();
}

function captureVideoFrame(video, canvas) {
  const width = video.videoWidth || 640;
  const height = video.videoHeight || 480;
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.drawImage(video, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.92);
}

function createExpiryIso(dateText, slot) {
  const date = new Date(`${dateText}T00:00:00`);
  date.setHours(slot === "lunch" ? 14 : 21, 0, 0, 0);
  return date.toISOString();
}

function calculateDistance(a, b) {
  return Math.sqrt(a.reduce((total, value, index) => total + (value - b[index]) ** 2, 0));
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
