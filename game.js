const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const selectedBlockUI = document.getElementById('selected-block');

// Resize canvas to full window
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// --- GAME CONFIG & CONSTANTS ---
const TILE_SIZE = 32;
const WORLD_WIDTH = 200;  // Tiles wide
const WORLD_HEIGHT = 100; // Tiles tall
const GRAVITY = 0.5;

const BLOCKS = {
    0: { name: 'Air', color: null, solid: false },
    1: { name: 'Dirt', color: '#8B5A2B', solid: true },
    2: { name: 'Grass', color: '#4CAF50', solid: true },
    3: { name: 'Stone', color: '#757575', solid: true },
    4: { name: 'Wood', color: '#A0522D', solid: true },
    5: { name: 'Leaves', color: '#2E7D32', solid: false }
};

let selectedBlock = 1;

// --- WORLD GENERATION ---
const world = Array.from({ length: WORLD_HEIGHT }, () => Array(WORLD_WIDTH).fill(0));

function generateWorld() {
    let surfaceHeight = 35;
    for (let x = 0; x < WORLD_WIDTH; x++) {
        // Simple 1D random walk for hills
        surfaceHeight += Math.floor(Math.random() * 3) - 1;
        surfaceHeight = Math.max(25, Math.min(45, surfaceHeight));

        for (let y = 0; y < WORLD_HEIGHT; y++) {
            if (y === surfaceHeight) {
                world[y][x] = 2; // Grass
            } else if (y > surfaceHeight && y <= surfaceHeight + 4) {
                world[y][x] = 1; // Dirt
            } else if (y > surfaceHeight + 4) {
                world[y][x] = 3; // Stone
            }
        }

        // Spawn basic trees occasionally
        if (x > 10 && x < WORLD_WIDTH - 10 && Math.random() < 0.08 && world[surfaceHeight][x] === 2) {
            const treeHeight = 4 + Math.floor(Math.random() * 3);
            for (let ty = 1; ty <= treeHeight; ty++) {
                world[surfaceHeight - ty][x] = 4; // Wood trunk
            }
            // Tree canopy
            for (let lx = -2; lx <= 2; lx++) {
                for (let ly = -2; ly <= 0; ly++) {
                    if (world[surfaceHeight - treeHeight + ly][x + lx] === 0) {
                        world[surfaceHeight - treeHeight + ly][x + lx] = 5; // Leaves
                    }
                }
            }
        }
    }
}
generateWorld();

// --- PLAYER SETUP ---
const player = {
    x: (WORLD_WIDTH / 2) * TILE_SIZE,
    y: 15 * TILE_SIZE,
    width: 24,
    height: 48,
    vx: 0,
    vy: 0,
    speed: 4,
    jumpStrength: -10,
    grounded: false,
    color: '#FF5252'
};

const camera = { x: 0, y: 0 };
const keys = {};

// --- INPUT HANDLING ---
window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(e.code)) {
        selectedBlock = parseInt(e.code.replace('Digit', ''));
        selectedBlockUI.innerText = BLOCKS[selectedBlock].name;
    }
});
window.addEventListener('keyup', (e) => keys[e.code] = false);

// Prevent right-click menu
window.addEventListener('contextmenu', e => e.preventDefault());

window.addEventListener('mousedown', (e) => {
    const mouseWorldX = e.clientX + camera.x;
    const mouseWorldY = e.clientY + camera.y;
    const tileX = Math.floor(mouseWorldX / TILE_SIZE);
    const tileY = Math.floor(mouseWorldY / TILE_SIZE);

    // Check bounds and reach distance (max 5 tiles away from player center)
    const playerCenterX = player.x + player.width / 2;
    const playerCenterY = player.y + player.height / 2;
    const dist = Math.hypot(mouseWorldX - playerCenterX, mouseWorldY - playerCenterY);

    if (dist > TILE_SIZE * 5) return;
    if (tileX < 0 || tileX >= WORLD_WIDTH || tileY < 0 || tileY >= WORLD_HEIGHT) return;

    if (e.button === 0) {
        // Left click: Mine block
        world[tileY][tileX] = 0;
    } else if (e.button === 2) {
        // Right click: Place block (avoid placing inside player)
        const blockRect = { x: tileX * TILE_SIZE, y: tileY * TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE };
        if (world[tileY][tileX] === 0 && !rectIntersect(player, blockRect)) {
            world[tileY][tileX] = selectedBlock;
        }
    }
});

// --- PHYSICS & COLLISIONS ---
function rectIntersect(r1, r2) {
    return !(r2.x >= r1.x + r1.width ||
             r2.x + r2.width <= r1.x ||
             r2.y >= r1.y + r1.height ||
             r2.y + r2.height <= r1.y);
}

function resolveCollisions(axis) {
    const startX = Math.floor(player.x / TILE_SIZE) - 1;
    const endX = Math.floor((player.x + player.width) / TILE_SIZE) + 1;
    const startY = Math.floor(player.y / TILE_SIZE) - 1;
    const endY = Math.floor((player.y + player.height) / TILE_SIZE) + 1;

    for (let y = startY; y <= endY; y++) {
        for (let x = startX; x <= endX; x++) {
            if (y >= 0 && y < WORLD_HEIGHT && x >= 0 && x < WORLD_WIDTH) {
                const blockId = world[y][x];
                if (BLOCKS[blockId] && BLOCKS[blockId].solid) {
                    const tileRect = { x: x * TILE_SIZE, y: y * TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE };
                    if (rectIntersect(player, tileRect)) {
                        if (axis === 'x') {
                            if (player.vx > 0) player.x = tileRect.x - player.width;
                            else if (player.vx < 0) player.x = tileRect.x + tileRect.width;
                            player.vx = 0;
                        } else if (axis === 'y') {
                            if (player.vy > 0) {
                                player.y = tileRect.y - player.height;
                                player.vy = 0;
                                player.grounded = true;
                            } else if (player.vy < 0) {
                                player.y = tileRect.y + tileRect.height;
                                player.vy = 0;
                            }
                        }
                    }
                }
            }
        }
    }
}

function update() {
    // Horizontal Movement
    player.vx = 0;
    if (keys['KeyA'] || keys['ArrowLeft']) player.vx = -player.speed;
    if (keys['KeyD'] || keys['ArrowRight']) player.vx = player.speed;

    player.x += player.vx;
    resolveCollisions('x');

    // Vertical Movement & Gravity
    if ((keys['Space'] || keys['KeyW'] || keys['ArrowUp']) && player.grounded) {
        player.vy = player.jumpStrength;
        player.grounded = false;
    }

    player.vy += GRAVITY;
    if (player.vy > 12) player.vy = 12; // Terminal velocity

    player.grounded = false;
    player.y += player.vy;
    resolveCollisions('y');

    // Update Camera to center on player
    camera.x = player.x + player.width / 2 - canvas.width / 2;
    camera.y = player.y + player.height / 2 - canvas.height / 2;
}

// --- RENDERING ---
function draw() {
    // Sky Background
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Only render visible tiles (Frustum Culling)
    const startCol = Math.max(0, Math.floor(camera.x / TILE_SIZE));
    const endCol = Math.min(WORLD_WIDTH - 1, Math.ceil((camera.x + canvas.width) / TILE_SIZE));
    const startRow = Math.max(0, Math.floor(camera.y / TILE_SIZE));
    const endRow = Math.min(WORLD_HEIGHT - 1, Math.ceil((camera.y + canvas.height) / TILE_SIZE));

    for (let y = startRow; y <= endRow; y++) {
        for (let x = startCol; x <= endCol; x++) {
            const blockId = world[y][x];
            if (blockId !== 0) {
                const screenX = Math.floor(x * TILE_SIZE - camera.x);
                const screenY = Math.floor(y * TILE_SIZE - camera.y);

                ctx.fillStyle = BLOCKS[blockId].color;
                ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);

                // Subtle pixel border for tile grid look
                ctx.strokeStyle = 'rgba(0,0,0,0.15)';
                ctx.strokeRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
            }
        }
    }

    // Draw Player
    ctx.fillStyle = player.color;
    ctx.fillRect(
        Math.floor(player.x - camera.x),
        Math.floor(player.y - camera.y),
        player.width,
        player.height
    );
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

gameLoop();
