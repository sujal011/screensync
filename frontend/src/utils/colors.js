// utils/colors.js
const CURSOR_COLORS = [
  '#FF4466', '#00D4FF', '#00E599', '#FFB800',
  '#FF6B35', '#A855F7', '#EC4899', '#14B8A6',
  '#F97316', '#8B5CF6',
];

const colorMap = new Map();
let colorIndex = 0;

export function getCursorColor(userId) {
  if (!colorMap.has(userId)) {
    colorMap.set(userId, CURSOR_COLORS[colorIndex % CURSOR_COLORS.length]);
    colorIndex++;
  }
  return colorMap.get(userId);
}

export function clearCursorColor(userId) {
  colorMap.delete(userId);
}
