// Tuning numbers and colours for Neon Harbor. The world is 2400x1800 world units;
// the camera shows a window-sized slice of it, so no rule depends on screen size.
export const STEP = 1 / 60;
export const WORLD = { width: 2400, height: 1800 };
export const ROADS_V = [300, 900, 1500, 2100];
export const ROADS_H = [300, 800, 1300];
export const ROAD_W = 110;
export const BEACH_Y = 1600; // sand starts here
export const WATER_Y = 1680; // water starts here (south edge)

export const PLAYER = {
  walk: 170, run: 270, radius: 14, health: 100,
  punchRange: 52, punchArc: 1.1, punchCd: 0.35, punchDmg: 50,
  shootCd: 0.22, bulletSpeed: 760, bulletRange: 460, bulletDmg: 34,
};
export const CAR = {
  width: 46, length: 78, accel: 420, brake: 620, reverse: 220,
  maxSpeed: 560, maxReverse: 160, grip: 2.6, turnRate: 2.9, hp: 100,
};
export const TRAFFIC_COUNT = 14;
export const PED_COUNT = 20;
export const WANTED_DECAY = 20; // seconds without crime and far from police to lose a star
export const ARREST_TIME = 2; // seconds of police touch on foot to get busted

export const MISSIONS = [
  { name: 'The Package', text: 'Pick up the package at the docks', target: { x: 92, y: 800 }, reward: 150 },
  { name: 'Hot Pursuit', text: 'Lose the heat — reach the hideout or drop to 0 stars', target: { x: 150, y: 150 }, reward: 500 },
  { name: 'The Lighthouse Run', text: 'Deliver the package to the lighthouse before time runs out', target: { x: 2270, y: 1560 }, reward: 1000, time: 90 },
];

export const PALETTE = {
  grass: '#5d8a4a', grass2: '#547e43', sand: '#d9c27a', water: '#2e6f8e', water2: '#35799c',
  road: '#3a3a44', roadEdge: '#2c2c34', lane: '#e8d44d', sidewalk: '#8f8f9a', sidewalk2: '#83838e',
  park: '#4c7a3e', tree: '#2f6b2a', tree2: '#3d7f33',
  panel: 'rgba(12, 10, 24, 0.82)', panelEdge: '#ff9e57',
  text: '#f5efe4', muted: '#c9bda6', gold: '#ffd166', neon: '#ff5e78', cyan: '#4de8e8',
  health: '#58d68d', danger: '#ff4d4d',
};
export const BUILDING_COLORS = ['#e07856', '#e8a04c', '#7fb069', '#5b8dd9', '#9b7ede', '#d95f7e', '#4fb3a9', '#c96f4a', '#8a6fc0', '#6fae5e'];
export const CAR_COLORS = ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1', '#2ecc71', '#fd79a8', '#fdcb6e'];

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const SAVE_KEY = 'neon-harbor.save.v1';
