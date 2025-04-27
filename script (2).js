const videoData = [ // <-- بيانات الفيديو الخاصة بك
    { id: "dwh3T2AVTYU" }, // إضافة الفيديو الجديد من الشورتس
    { id: "uYPbbksJxIg" }, { id: "kPRA0W1kECg" }, { id: "LXb3EKWsInQ" },
    { id: "TVR2MXUwRZE" }, { id: "EJxwWpaGoQM" }, { id: "9Sc-ir2UwGU" }
];

// تم إزالة هذا السطر لأنه مكرر لما هو موجود بالفعل في HTML
// var tag = document.createElement('script');
// tag.src = "https://www.youtube.com/iframe_api";
// var firstScriptTag = document.getElementsByTagName('script')[0];
// firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

const reelsContainer = document.getElementById('reels-container');
let players = {}; // { playerId: { player: YT.Player, reelElement: HTMLElement, isReady: boolean, isMuted: boolean } }
let activePlayerId = null; // من يجب أن يعمل (يُحدد عند نهاية التمرير)
let intersectionObserver;
let scrollEndTimeout = null;
const SCROLL_END_DELAY = 100; // تم تقليل تأخير اكتشاف نهاية التمرير لأداء أفضل

function onYouTubeIframeAPIReady() {
    console.log("API جاهز");
    createReelElements();
    setupLazyLoader(); // Observer لإنشاء المشغلات فقط
    setupScrollEndDetector(); // مستمع لاكتشاف نهاية التمرير
    
    // تحسين محاولة تشغيل الفيديو الأول
    setTimeout(() => {
        // التأكد من أن الصفحة جاهزة تماماً
        if (document.readyState === "complete") {
            onScrollEnd();
        } else {
            // الاستماع لحدث اكتمال تحميل الصفحة
            window.addEventListener('load', onScrollEnd);
        }
    }, 300); // تقليل مدة الانتظار لتجربة أسرع
}

function createReelElements() {
    videoData.forEach((video, index) => {
        const reelDiv = document.createElement('div');
        reelDiv.classList.add('reel');
        const playerId = `player-${video.id}-${index}`;
        reelDiv.dataset.playerId = playerId;
        reelDiv.dataset.videoId = video.id;

        const playerContainerDiv = document.createElement('div');
        playerContainerDiv.classList.add('player-container');
        playerContainerDiv.addEventListener('click', () => togglePlayPause(playerId));

        // إضافة مؤشر تحميل دوار
        const placeholderDiv = document.createElement('div');
        placeholderDiv.id = playerId;
        placeholderDiv.classList.add('player-placeholder');
        
        const spinner = document.createElement('div');
        spinner.classList.add('spinner');
        placeholderDiv.appendChild(spinner);
        
        const loadingText = document.createElement('span');
        loadingText.textContent = 'جاري التحميل...';
        placeholderDiv.appendChild(loadingText);

        // إضافة أزرار التحكم
        const controlsDiv = document.createElement('div');
        controlsDiv.classList.add('controls-container');
        
        // زر كتم الصوت
        const volumeButton = document.createElement('button');
        volumeButton.classList.add('volume-control');
        volumeButton.innerHTML = '<span class="control-icon">🔊</span>';
        volumeButton.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMute(playerId);
        });
        
        // شريط التقدم
        const progressBar = document.createElement('div');
        progressBar.classList.add('progress-bar');
        progressBar.dataset.playerId = playerId;
        
        controlsDiv.appendChild(volumeButton);
        playerContainerDiv.appendChild(controlsDiv);
        playerContainerDiv.appendChild(progressBar);
        playerContainerDiv.appendChild(placeholderDiv);
        reelDiv.appendChild(playerContainerDiv);
        reelsContainer.appendChild(reelDiv);

        players[playerId] = { player: null, reelElement: reelDiv, isReady: false, isMuted: true };
    });
    console.log("تم إنشاء العناصر");
}

// Observer فقط لإنشاء المشغلات عند الاقتراب منها
function setupLazyLoader() {
    const options = {
        root: reelsContainer,
        rootMargin: '100px 0px', // ابدأ التحميل قبل أن يصبح مرئيًا تمامًا
        threshold: 0.01 // يكفي ظهور جزء بسيط جدًا
    };
    intersectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const playerId = entry.target.dataset.playerId;
                initiatePlayerCreation(playerId, entry.target);
                // لا تشغل أي شيء هنا
                // يمكن إلغاء المراقبة بعد الإنشاء لتحسين الأداء (اختياري)
                // intersectionObserver.unobserve(entry.target);
            }
        });
    }, options);

    document.querySelectorAll('.reel').forEach(reel => {
        intersectionObserver.observe(reel);
    });
    console.log("Lazy Loader Observer مُفعّل");
}

// إعداد مستمع التمرير لاكتشاف التوقف
function setupScrollEndDetector() {
    reelsContainer.addEventListener('scroll', handleScroll);
    console.log("Scroll End Detector مُفعّل");
}

function handleScroll() {
    clearTimeout(scrollEndTimeout);
    scrollEndTimeout = setTimeout(onScrollEnd, SCROLL_END_DELAY);
}

// *** يتم استدعاؤها عند توقف التمرير ***
function onScrollEnd() {
    console.log("Scroll Ended.");
    const centeredPlayerId = findCenteredPlayerId();
    console.log(`Centered player identified: ${centeredPlayerId}`);
    playCenteredVideoAndPauseOthers(centeredPlayerId);
}

// تحديد الفيديو المركزي
function findCenteredPlayerId() {
    let minDistance = Infinity;
    let centeredPlayerId = null;
    const viewportCenterY = window.innerHeight / 2;

    document.querySelectorAll('.reel').forEach(reel => {
        const rect = reel.getBoundingClientRect();
        // تأكد أن العنصر داخل حدود العرض تقريبًا
        if (rect.top < window.innerHeight && rect.bottom > 0) {
            const reelCenterY = rect.top + rect.height / 2;
            const distance = Math.abs(viewportCenterY - reelCenterY);

            if (distance < minDistance) {
                minDistance = distance;
                centeredPlayerId = reel.dataset.playerId;
            }
        }
    });
    return centeredPlayerId;
}

// *** المنطق الرئيسي: أوقف الجميع، شغل المركزي ***
function playCenteredVideoAndPauseOthers(centeredPlayerId) {
    console.log(`Executing Play/Pause Logic. Target: ${centeredPlayerId}`);
    activePlayerId = centeredPlayerId; // تحديث الهدف فوراً

    Object.keys(players).forEach(pid => {
        const playerInfo = players[pid];
        if (pid === centeredPlayerId) {
            // --- هذا هو الفيديو المركزي ---
            if (playerInfo.player && playerInfo.isReady) {
                 console.log(`Attempting to play centered & ready player: ${pid}`);
                 playerInfo.player.unMute(); // تشغيل بدون كتم الصوت
                 playerInfo.player.playVideo();
                 // تحديث أيقونة الصوت
                 const volumeButton = playerInfo.reelElement.querySelector('.volume-control .control-icon');
                 if (volumeButton) volumeButton.textContent = '🔊';
                 playerInfo.isMuted = false;
             } else if (!playerInfo.player) {
                 // إذا لم يتم إنشاؤه بعد (قد يحدث عند التحميل الأول)، قم بإنشائه
                 console.log(`Player ${pid} not created yet, initiating.`);
                 initiatePlayerCreation(pid, playerInfo.reelElement);
                 // onReady سيتولى التشغيل عند الجاهزية لأنه الآن activePlayerId
             } else {
                 // موجود ولكنه ليس جاهزًا، onReady سيتولى الأمر
                 console.log(`Player ${pid} exists but not ready. Waiting for onReady.`);
             }
        } else {
            // --- هذا الفيديو ليس المركزي، أوقفه ---
            pauseVideo(pid);
        }
    });
}

function initiatePlayerCreation(playerId, reelElement) {
    if (players[playerId] && players[playerId].player) return;
    console.log(`Initiating player creation for: ${playerId}`);
    const videoId = reelElement.dataset.videoId;
    // تأكد من أن الكائن موجود قبل تعيين المشغل
    if (!players[playerId]) {
         players[playerId] = { player: null, reelElement: reelElement, isReady: false };
    }
    players[playerId].player = new YT.Player(playerId, {
        height: '100%', width: '100%', videoId: videoId,
        playerVars: { 
            'playsinline': 1, 
            'autoplay': 0, 
            'controls': 0, 
            'showinfo': 0, 
            'rel': 0, 
            'modestbranding': 1, 
            'loop': 1, 
            'playlist': videoId,
            'enablejsapi': 1,
            'origin': window.location.origin
        },
        events: {
            'onReady': (event) => onPlayerReady(event, playerId),
            'onStateChange': (event) => onPlayerStateChange(event, playerId)
        }
    });
}

function onPlayerReady(event, playerId) {
    console.log(`Player Ready: ${playerId}`);
    const playerInfo = players[playerId];
    if (!playerInfo) return;

    playerInfo.isReady = true;
    const placeholder = playerInfo.reelElement.querySelector('.player-placeholder');
    if (placeholder) placeholder.classList.add('hidden');

    // تكوين الفيديو لعرضه بشكل صحيح
    // تعديل حجم الفيديو ليناسب الحاوية
    const container = playerInfo.reelElement.querySelector('.player-container');
    if (container) {
        const rect = container.getBoundingClientRect();
        event.target.setSize(rect.width, rect.height);
    }

    // تأكد من عرض الفيديو
    const iframe = event.target.getIframe();
    if (iframe) {
        iframe.style.display = 'block';
        iframe.style.opacity = '1';
        iframe.style.visibility = 'visible';
        iframe.style.zIndex = '10';
    }

    // *** التحقق: هل هذا هو الفيديو الذي *يجب* أن يعمل الآن؟ ***
    if (playerId === activePlayerId) {
        console.log(`onReady: Player ${playerId} IS the active target. Playing without mute.`);
        event.target.unMute(); // تشغيل بدون كتم الصوت
        event.target.playVideo();
        // تحديث أيقونة الصوت
        const volumeButton = playerInfo.reelElement.querySelector('.volume-control .control-icon');
        if (volumeButton) volumeButton.textContent = '🔊';
        playerInfo.isMuted = false;
    } else {
        console.log(`onReady: Player ${playerId} IS NOT the active target (${activePlayerId}). Ensuring pause.`);
         // تأكد من إيقافه احتياطياً
         pauseVideo(playerId);
    }
}

// إيقاف بسيط ومباشر
function pauseVideo(playerId) {
    const playerInfo = players[playerId];
    if (playerInfo && playerInfo.player && playerInfo.isReady && typeof playerInfo.player.pauseVideo === 'function') {
        const state = playerInfo.player.getPlayerState();
        if (state === YT.PlayerState.PLAYING || state === YT.PlayerState.BUFFERING) {
             // لا تطبع رسالة الإيقاف بشكل مفرط إذا لم يكن يعمل أصلاً
            console.log(`Pausing video: ${playerId}`);
            playerInfo.player.pauseVideo();
        }
    }
}

// تبديل التشغيل/الإيقاف اليدوي
function togglePlayPause(playerId) {
     console.log(`Manual toggle requested for: ${playerId}`);
    const playerInfo = players[playerId];
    if (!playerInfo || !playerInfo.player || !playerInfo.isReady) {
         console.warn(`ManualToggle: Player ${playerId} not ready.`);
         if (!playerInfo.player) initiatePlayerCreation(playerId, playerInfo.reelElement);
        return;
    }
    const player = playerInfo.player;
    const currentState = player.getPlayerState();

    if (currentState === YT.PlayerState.PLAYING) {
        console.log(`ManualToggle: Pausing ${playerId}`);
        pauseVideo(playerId);
        // إذا أوقف المستخدم الفيديو النشط، لم يعد هناك فيديو نشط تلقائي
        if (activePlayerId === playerId) {
            activePlayerId = null;
        }
    } else {
         console.log(`ManualToggle: Playing ${playerId}. Pausing others...`);
         // --- طبق نفس المنطق الصارم ---
         activePlayerId = playerId; // اجعله هو النشط
         Object.keys(players).forEach(pid => {
             if (pid !== playerId) {
                 pauseVideo(pid);
             }
         });
         // إلغاء كتم الصوت وتشغيل المطلوب
         player.unMute();
         player.playVideo();
    }
}

function onPlayerStateChange(event, playerId) {
    const state = event.data;
    const playerStateStr = getPlayerState(state);
    console.log(`State Change: ${playerId}, State: ${playerStateStr} (${state})`);

    // التحقق الأمني الأخير
    if (state === YT.PlayerState.PLAYING && playerId !== activePlayerId) {
        console.warn(`Safety Check: ${playerId} playing but IS NOT active (${activePlayerId}). Forcing pause!`);
        pauseVideo(playerId);
    }

    // تحديث شريط التقدم عندما يكون الفيديو قيد التشغيل
    if (state === YT.PlayerState.PLAYING) {
        updateProgressBar(playerId);
    } 
    // إيقاف تحديث شريط التقدم عندما يكون الفيديو متوقفًا
    else if (state === YT.PlayerState.PAUSED || state === YT.PlayerState.ENDED) {
        stopProgressUpdate(playerId);
    }
}

function getPlayerState(stateCode) {
    switch(stateCode) {
        case -1: return 'UNSTARTED';
        case YT.PlayerState.ENDED: return 'ENDED';
        case YT.PlayerState.PLAYING: return 'PLAYING';
        case YT.PlayerState.PAUSED: return 'PAUSED';
        case YT.PlayerState.BUFFERING: return 'BUFFERING';
        case YT.PlayerState.CUED: return 'VIDEO CUED';
        default: return 'UNKNOWN';
    }
}

// وظيفة للتبديل بين الصوت والكتم
function toggleMute(playerId) {
    const playerInfo = players[playerId];
    if (!playerInfo || !playerInfo.player || !playerInfo.isReady) return;
    
    const player = playerInfo.player;
    const volumeButton = playerInfo.reelElement.querySelector('.volume-control .control-icon');
    
    if (player.isMuted()) {
        player.unMute();
        volumeButton.textContent = '🔊';
        playerInfo.isMuted = false;
    } else {
        player.mute();
        volumeButton.textContent = '🔇';
        playerInfo.isMuted = true;
    }
    
    // منع انتشار الحدث حتى لا يتم تشغيل/إيقاف الفيديو
    event.stopPropagation();
}

// تنفيذ شريط التقدم الفعلي
let progressIntervals = {};

function updateProgressBar(playerId) {
    // إلغاء أي تحديث سابق للشريط
    stopProgressUpdate(playerId);
    
    const playerInfo = players[playerId];
    if (!playerInfo || !playerInfo.player || !playerInfo.isReady) return;
    
    const player = playerInfo.player;
    const progressBar = playerInfo.reelElement.querySelector('.progress-bar');
    
    if (!progressBar) return;
    
    progressIntervals[playerId] = setInterval(() => {
        if (player && typeof player.getCurrentTime === 'function' && typeof player.getDuration === 'function') {
            const currentTime = player.getCurrentTime();
            const duration = player.getDuration();
            if (duration > 0) {
                const progressPercent = (currentTime / duration) * 100;
                progressBar.style.width = progressPercent + '%';
            }
        }
    }, 100); // تحديث كل 100 مللي ثانية
}

function stopProgressUpdate(playerId) {
    if (progressIntervals[playerId]) {
        clearInterval(progressIntervals[playerId]);
        delete progressIntervals[playerId];
    }
}

// ميزة التحديث بالسحب
let startY;
let pullDistance = 0;
const PULL_THRESHOLD = 80; // المسافة اللازمة للتحديث

function setupPullToRefresh() {
    reelsContainer.addEventListener('touchstart', (e) => {
        startY = e.touches[0].clientY;
        pullDistance = 0;
    }, { passive: true });
    
    reelsContainer.addEventListener('touchmove', (e) => {
        if (reelsContainer.scrollTop <= 0) {
            pullDistance = e.touches[0].clientY - startY;
            
            if (pullDistance > 0) {
                // إظهار مؤشر السحب للتحديث
                let refreshIndicator = document.getElementById('pull-refresh-indicator');
                if (!refreshIndicator) {
                    refreshIndicator = document.createElement('div');
                    refreshIndicator.id = 'pull-refresh-indicator';
                    refreshIndicator.innerHTML = '<div class="spinner"></div><span>اسحب للتحديث...</span>';
                    document.body.appendChild(refreshIndicator);
                }
                
                const openAmount = Math.min(pullDistance * 0.5, PULL_THRESHOLD);
                refreshIndicator.style.transform = `translateY(${openAmount}px)`;
                refreshIndicator.style.opacity = pullDistance / PULL_THRESHOLD;
                
                // تغيير النص عند الوصول للحد المطلوب
                if (pullDistance >= PULL_THRESHOLD) {
                    refreshIndicator.querySelector('span').textContent = 'حرر للتحديث';
                } else {
                    refreshIndicator.querySelector('span').textContent = 'اسحب للتحديث...';
                }
            }
        }
    }, { passive: true });
    
    reelsContainer.addEventListener('touchend', () => {
        const refreshIndicator = document.getElementById('pull-refresh-indicator');
        
        if (pullDistance >= PULL_THRESHOLD) {
            // إجراء التحديث
            if (refreshIndicator) {
                refreshIndicator.querySelector('span').textContent = 'جاري التحديث...';
                refreshIndicator.querySelector('.spinner').style.animation = 'spin 1s linear infinite';
            }
            
            // محاكاة إعادة تحميل المحتوى
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } else if (refreshIndicator) {
            // إخفاء المؤشر
            refreshIndicator.style.transform = 'translateY(-100px)';
            refreshIndicator.style.opacity = '0';
        }
    });
}

// تحسين أداء التمرير بتغيير تأخير نهاية التمرير
function setupScrollEndDetector() {
    reelsContainer.addEventListener('scroll', handleScroll);
    // إضافة وظيفة السحب للتحديث
    setupPullToRefresh();
    console.log("Scroll End Detector مُفعّل");
}

// تعديل منطق الكشف عن نهاية التمرير
function handleScroll() {
    clearTimeout(scrollEndTimeout);
    // تقليل وقت الانتظار لاكتشاف نهاية التمرير لأداء أفضل
    scrollEndTimeout = setTimeout(onScrollEnd, 100); // تقليل من 150 إلى 100
}