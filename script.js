import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, onValue, remove, onDisconnect } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyAjE-2q6PONBkCin9ZN22gDp9Q8pAH9ZW8",
    authDomain: "story-97cf7.firebaseapp.com",
    databaseURL: "https://story-97cf7-default-rtdb.firebaseio.com",
    projectId: "story-97cf7",
    storageBucket: "story-97cf7.firebasestorage.app",
    messagingSenderId: "742801388214",
    appId: "1:742801388214:web:32a305a8057b0582c5ec17"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let user = JSON.parse(localStorage.getItem('vf_user')) || { id: 'u' + Math.random().toString(36).substr(2,9), code: Math.floor(100+Math.random()*900) };
localStorage.setItem('vf_user', JSON.stringify(user));

let localStream, peer, myPeerId, activeRoom;
let audioCtx, audioSource, audioDestination, currentFilter;
let isMuted = false;
let calls = {};
let roomRef = null;
let deferredPrompt;

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('install-popup').classList.add('show');
});

window.triggerInstall = async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
        document.getElementById('install-popup').classList.remove('show');
    }
};

window.closeInstallPopup = () => {
    document.getElementById('install-popup').classList.remove('show');
};

window.onload = () => {
    document.getElementById('id-text').innerHTML = `هويتك: <b>${user.code}</b>`;
    const urlRoom = new URLSearchParams(location.search).get('room');
    if(urlRoom) { activeRoom = urlRoom; document.getElementById('audio-gate').classList.add('show'); }
    updateUI();
};

function updateUI() {
    const last = localStorage.getItem('last_room');
    const btn = document.getElementById('btn-rejoin');
    if(last) { btn.style.opacity = '1'; document.getElementById('last-room-txt').innerText = "غرفة: " + last; btn.onclick = rejoinLastRoom; }
    else { btn.style.opacity = '0.5'; btn.onclick = null; }
}

window.showToast = (msg) => {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = msg;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 3000);
};

window.openShareSheet = () => { document.getElementById('share-overlay').classList.add('show'); document.getElementById('share-sheet').classList.add('show'); };
window.closeShareSheet = () => { document.getElementById('share-overlay').classList.remove('show'); document.getElementById('share-sheet').classList.remove('show'); };

window.copyLinkAction = () => {
    const link = `${location.origin}${location.pathname}?room=${activeRoom}`;
    navigator.clipboard.writeText(link).then(() => {
        showToast("تم نسخ الرابط");
        closeShareSheet();
    });
};

window.shareTo = (platform) => {
    const link = `${location.origin}${location.pathname}?room=${activeRoom}`;
    const text = `انضم إلي في منبر الأحرار: `;
    let url = '';
    if(platform === 'whatsapp') url = `https://wa.me/?text=${encodeURIComponent(text + link)}`;
    else if(platform === 'telegram') url = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
    else if(platform === 'facebook') url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`;
    window.open(url, '_blank');
    closeShareSheet();
};

window.createNewRoom = () => { activeRoom = Math.random().toString(36).substr(2,8); localStorage.setItem('last_room', activeRoom); document.getElementById('audio-gate').classList.add('show'); };
window.rejoinLastRoom = () => { activeRoom = localStorage.getItem('last_room'); document.getElementById('audio-gate').classList.add('show'); };

window.confirmEntry = async () => {
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if(audioCtx.state === 'suspended') await audioCtx.resume();
        localStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        audioSource = audioCtx.createMediaStreamSource(localStream);
        audioDestination = audioCtx.createMediaStreamDestination();
        audioSource.connect(audioDestination);
        
        const peerConfig = {
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' },
                    { urls: 'stun:stun3.l.google.com:19302' },
                    { urls: 'stun:stun4.l.google.com:19302' }
                ],
                sdpSemantics: 'unified-plan'
            }
        };

        peer = new Peer(user.id, peerConfig);

        peer.on('open', id => { myPeerId = id; startRoom(); });
        peer.on('call', call => {
            call.answer(audioDestination.stream);
            call.on('stream', stream => handleRemoteStream(stream, call.peer));
        });
        peer.on('error', err => console.log(err));

        document.getElementById('audio-gate').classList.remove('show');
        document.getElementById('v-home').classList.remove('active');
        document.getElementById('v-room').classList.add('active');
    } catch(e) { showToast("يرجى السماح باستخدام الميكروفون"); }
};

function startRoom() {
    roomRef = ref(db, `rooms/${activeRoom}/users/${user.id}`);
    set(roomRef, { code: user.code, peerId: myPeerId });
    onDisconnect(roomRef).remove();

    onValue(ref(db, `rooms/${activeRoom}/users`), (snap) => {
        const users = snap.val() || {};
        renderUsers(users);
        Object.values(users).forEach(u => {
            if(u.peerId !== myPeerId && !calls[u.peerId]) {
                const call = peer.call(u.peerId, audioDestination.stream);
                call.on('stream', stream => handleRemoteStream(stream, u.peerId));
                calls[u.peerId] = call;
            }
        });
    });
}

function handleRemoteStream(stream, peerId) {
    let audio = document.getElementById('audio-' + peerId);
    if(!audio) {
        audio = document.createElement('audio');
        audio.id = 'audio-' + peerId;
        audio.autoplay = true;
        audio.playsInline = true;
        document.getElementById('audio-container').appendChild(audio);
    }
    audio.srcObject = stream;
    
    const remoteCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = remoteCtx.createMediaStreamSource(stream);
    monitorVolume(source, peerId);
}

function monitorVolume(source, id) {
    const analyser = (source.context || audioCtx).createAnalyser();
    analyser.fftSize = 32;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    
    const check = () => {
        if(!document.getElementById('v-room').classList.contains('active')) return;
        analyser.getByteFrequencyData(data);
        const vol = data.reduce((a,b) => a+b) / data.length;
        
        const waveContainer = document.getElementById('wave-' + id);
        if(waveContainer) {
            if(vol > 15) {
                waveContainer.classList.add('speaking');
            } else {
                waveContainer.classList.remove('speaking');
            }
        }
        requestAnimationFrame(check);
    };
    check();
}

function renderUsers(users) {
    const grid = document.getElementById('grid');
    grid.innerHTML = '';
    const list = Object.values(users);
    grid.className = 'grid-container ' + (list.length <= 1 ? 'layout-1' : list.length === 2 ? 'layout-2' : 'layout-more');
    
    list.forEach(u => {
        const isMe = u.peerId === myPeerId;
        grid.innerHTML += `
            <div class="user-card">
                <div class="card-avatar">${u.code}</div>
                
                <div class="voice-wave-container" id="wave-${u.peerId}">
                    <div class="wave-bar"></div>
                    <div class="wave-bar"></div>
                    <div class="wave-bar"></div>
                    <div class="wave-bar"></div>
                </div>

                <div style="font-size:0.75rem; color:#888; margin-top:5px;">${isMe ? 'أنت' : 'مشارك'}</div>
            </div>
        `;
    });
    if(audioSource) monitorVolume(audioSource, myPeerId);
}

window.toggleMic = () => {
    isMuted = !isMuted;
    localStream.getAudioTracks()[0].enabled = !isMuted;
    const btn = document.getElementById('mic-btn');
    btn.innerHTML = isMuted ? '<i class="fas fa-microphone-slash"></i>' : '<i class="fas fa-microphone"></i>';
    btn.style.background = isMuted ? '#444' : '#fff';
    btn.style.color = isMuted ? '#fff' : '#000';
    showToast(isMuted ? "تم كتم الميكروفون" : "الميكروفون يعمل");
};

window.exitToMenu = () => {
    window.open('https://www.effectivegatecpm.com/k8fisnjjc?key=afa7ea920578f74cea5997d670bbe78e', '_blank');

    if (roomRef) {
        remove(roomRef);
        roomRef = null;
    }

    if(localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    if (peer) {
        peer.destroy();
        peer = null;
    }

    calls = {};
    myPeerId = null;
    activeRoom = null;
    isMuted = false;
    
    document.getElementById('audio-container').innerHTML = '';

    document.getElementById('v-room').classList.remove('active');
    document.getElementById('v-home').classList.add('active');
    
    const btn = document.getElementById('mic-btn');
    btn.innerHTML = '<i class="fas fa-microphone"></i>';
    btn.style.background = '#fff';
    btn.style.color = '#000';

    window.history.replaceState({}, document.title, window.location.pathname);
    updateUI();
};

window.toggleFilters = () => document.getElementById('filter-menu').classList.toggle('show');

window.applyFilter = (type, el) => {
    document.querySelectorAll('.filter-opt').forEach(opt => opt.classList.remove('selected'));
    el.classList.add('selected');
    document.getElementById('filter-menu').classList.remove('show');
    
    audioSource.disconnect();
    if(currentFilter) currentFilter.disconnect();
    
    if(type === 'none') {
        audioSource.connect(audioDestination);
    } else if(type === 'deep') {
        const f = audioCtx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
        audioSource.connect(f); f.connect(audioDestination); currentFilter = f;
    } else if(type === 'echo') {
        const delay = audioCtx.createDelay(); delay.delayTime.value = 0.3;
        const feedback = audioCtx.createGain(); feedback.gain.value = 0.3;
        delay.connect(feedback); feedback.connect(delay);
        
        audioSource.connect(audioDestination);
        audioSource.connect(delay); delay.connect(audioDestination);
        currentFilter = delay;
    }
    showToast("تم تحديث الفلتر");
};
