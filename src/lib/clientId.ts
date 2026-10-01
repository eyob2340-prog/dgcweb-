/**
 * Anonymous persistent client token for shared NAT / WiFi disambiguation.
 * Ensures 100+ concurrent citizens on the same public IP address (such as Ethio Telecom / Safaricom CGNAT
 * or government office local networks) do not collide with each other when submitting surveys.
 */
export function getAnonymousClientId(): string {
  if (typeof window === 'undefined' || !window.localStorage) {
    return 'anon_guest_' + Math.random().toString(36).substring(2, 10);
  }

  const STORAGE_KEY = 'dgc_anonymous_device_id';
  let clientId = localStorage.getItem(STORAGE_KEY);
  if (!clientId || clientId.length < 8) {
    clientId = 'dgc_dev_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    try {
      localStorage.setItem(STORAGE_KEY, clientId);
    } catch {
      // LocalStorage access restricted (e.g. private browsing with strict settings)
    }
  }
  return clientId;
}
