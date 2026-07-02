export function isPlatformAdminHost(): boolean {
  return window.location.hostname.split('.')[0] === 'admin'
}
