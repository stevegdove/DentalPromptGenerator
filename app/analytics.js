export function eventName(vertical, action, target) {
  return target ? `${vertical}-${action}-${target}` : `${vertical}-${action}`;
}

export function track(name) {
  const gc = typeof window !== "undefined" && window.goatcounter;
  if (gc && gc.count) gc.count({ path: name, event: true });
}
