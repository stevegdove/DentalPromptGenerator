export function djb2(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h * 33) & 0xffffffff) ^ s.charCodeAt(i);
  }
  return (h >>> 0).toString(16);
}
