// Trang ẩn chỉ dùng để phát file mp3 phát âm.
const player = new Audio();

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.target !== 'offscreen' || msg.type !== 'play') return false;
  player.pause();
  player.src = msg.url;
  player
    .play()
    .then(() => sendResponse({ ok: true }))
    .catch((err) => sendResponse({ ok: false, error: err.message }));
  return true;
});
