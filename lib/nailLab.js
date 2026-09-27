// Nail Lab generation output size — shared between the generator request
// (app/api/generate-nail-design/route.js) and every surface that renders a
// generation and needs its aspect ratio (e.g. /nail-lab/history). Change it
// here and both sides move together; hardcoding either side lets them drift.
export const GENERATION_WIDTH = 1536
export const GENERATION_HEIGHT = 1024
export const GENERATION_SIZE = `${GENERATION_WIDTH}x${GENERATION_HEIGHT}`
