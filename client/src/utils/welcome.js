const WELCOME_KEY = 'opus_show_welcome';

export function triggerWelcome() {
  sessionStorage.setItem(WELCOME_KEY, '1');
  window.dispatchEvent(new Event('opus-welcome'));
}

export function consumeWelcome() {
  if (sessionStorage.getItem(WELCOME_KEY) === '1') {
    sessionStorage.removeItem(WELCOME_KEY);
    return true;
  }
  return false;
}
