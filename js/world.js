// Builds the Omaha Beach environment: terrain, sea, sky, obstacles, bunkers, landing craft.
import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { ASSETS, WORLD } from './config.js';

// ---------- Terrain height function (shared by player, enemies and effects) ----------
// +Z = English Channel, -Z = bluffs. Water level is y = 0.
function noise(x, z) {
  return Math.sin(x * 0.05) * Math.cos(z * 0.07) * 0.6 +
         Math.sin(x * 0.13 + z * 0.11) * 0.3 +
         Math.sin(x * 0.31 - z * 0.27) * 0.12;
}

export function getHeight(x, z) {
  let h;
  if (z > 40) {                       // sea floor, gently sloping down
    h = -0.6 - (z - 40) * 0.03;
  } else if (z > -45) {               // tidal flat -> dry sand
    const t = (40 - z) / 85;
    h = -0.6 + t * 2.8;
  } else if (z > -55) {               // shingle bank at seawall
    h = 2.2 + (-45 - z) * 0.15;
  } else {                            // bluffs
    const t = Math.min(1, (-55 - z) / 45);
    h = 3.7 + (t * t * (3 - 2 * t)) * 30;
  }
  const bluffNoise = z < -50 ? 2.5 : 0.35;
  return h + noise(x, z) * bluffNoise;
}

// Procedural sand/grass texture so we don't depend on a copyrighted image.
function makeGroundTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const img = g.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 200 + Math.random() * 55;
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(80, 50);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.colliders = [];     // { x, z, r } circles for player/enemy collision
    this.hitMeshes = [];     // meshes bullets can hit
    this.water = null;
    this.sun = new THREE.Vector3();
  }

  build() {
    this.buildSky();
    this.buildTerrain();
    this.buildWater();
    this.buildObstacles();
    this.buildBunkers();
    this.buildLandingCraft();
  }

  buildSky() {
    const sky = new Sky();
    sky.scale.setScalar(10000);
    const u = sky.material.uniforms;
    u.turbidity.value = 12;
    u.rayleigh.value = 1.2;
    u.mieCoefficient.value = 0.01;
    u.mieDirectionalG.value = 0.85;
    // Overcast early morning: low sun from the east
    const phi = THREE.MathUtils.degToRad(80);
    const theta = THREE.MathUtils.degToRad(120);
    this.sun.setFromSphericalCoords(1, phi, theta);
    u.sunPosition.value.copy(this.sun);
    this.scene.add(sky);

    this.scene.fog = new THREE.FogExp2(0x9a9a92, 0.0065);

    const hemi = new THREE.HemisphereLight(0xc8ccd0, 0x5a5040, 0.9);
    this.scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xfff0d8, 1.6);
    dir.position.copy(this.sun).multiplyScalar(150);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    const s = dir.shadow.camera;
    s.left = -120; s.right = 120; s.top = 120; s.bottom = -120; s.near = 1; s.far = 400;
    dir.shadow.bias = -0.0005;
    this.scene.add(dir);
    this.sunLight = dir;
  }

  buildTerrain() {
    const { beachLength, shoreDepth } = WORLD;
    const geo = new THREE.PlaneGeometry(beachLength, shoreDepth, 200, 130);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = [];
    const wet = new THREE.Color(0x6e6450), dry = new THREE.Color(0xc2b280),
          shingle = new THREE.Color(0x7a746a), grass = new THREE.Color(0x5b6b35);
    const col = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = getHeight(x, z);
      pos.setY(i, h);
      if (z > 10) col.copy(wet);
      else if (z > -45) col.copy(wet).lerp(dry, Math.min(1, (10 - z) / 30));
      else if (z > -58) col.copy(shingle);
      else col.copy(shingle).lerp(grass, Math.min(1, (-58 - z) / 10));
      col.offsetHSL(0, 0, (Math.random() - 0.5) * 0.04);
      colors.push(col.r, col.g, col.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: makeGroundTexture(), roughness: 0.95 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.userData.surface = 'sand';
    this.scene.add(mesh);
    this.hitMeshes.push(mesh);
    this.terrain = mesh;
  }

  buildWater() {
    const geo = new THREE.PlaneGeometry(2000, 2000);
    const water = new Water(geo, {
      textureWidth: 512, textureHeight: 512,
      waterNormals: new THREE.TextureLoader().load(ASSETS.waterNormals, t => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
      }),
      sunDirection: this.sun.clone().normalize(),
      sunColor: 0xffffff,
      waterColor: 0x2c3a38,
      distortionScale: 2.5,
      fog: true,
    });
    water.rotation.x = -Math.PI / 2;
    water.position.y = WORLD.waterLevel;
    water.userData.surface = 'water';
    this.scene.add(water);
    this.hitMeshes.push(water);
    this.water = water;
  }

  // Czech hedgehogs and wooden stakes scattered across the tidal flat
  buildObstacles() {
    const steel = new THREE.MeshStandardMaterial({ color: 0x3a3632, metalness: 0.6, roughness: 0.7 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x4a3a28, roughness: 1 });
    const beam = new THREE.BoxGeometry(0.2, 0.2, 2.6);
    const rng = mulberry32(1944);

    for (let i = 0; i < 70; i++) {
      const x = (rng() - 0.5) * 360;
      const z = -30 + rng() * 90;
      if (Math.abs(x) < 4 && z > 55) continue; // keep spawn clear
      const y = getHeight(x, z);
      if (rng() < 0.75) {
        const hog = new THREE.Group();
        const a = new THREE.Mesh(beam, steel); a.rotation.set(0.6, 0, 0);
        const b = new THREE.Mesh(beam, steel); b.rotation.set(0, 0.6, Math.PI / 2); b.rotation.order = 'YXZ';
        const c = new THREE.Mesh(beam, steel); c.rotation.set(Math.PI / 2, 0, 0.6);
        [a, b, c].forEach(m => { m.castShadow = true; m.receiveShadow = true; hog.add(m); this.hitMeshes.push(m); m.userData.surface = 'metal'; });
        hog.position.set(x, y + 0.8, z);
        hog.rotation.y = rng() * Math.PI;
        this.scene.add(hog);
        this.colliders.push({ x, z, r: 1.1 });
      } else {
        const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 3.2, 6), wood);
        stake.position.set(x, y + 1.2, z);
        stake.rotation.z = 0.5;
        stake.castShadow = true;
        stake.userData.surface = 'wood';
        this.scene.add(stake);
        this.hitMeshes.push(stake);
        this.colliders.push({ x, z, r: 0.4 });
      }
    }

    // Seawall / shingle embankment
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x6b6358, roughness: 1 });
    for (let x = -190; x < 190; x += 8) {
      const z = -50;
      const wall = new THREE.Mesh(new THREE.BoxGeometry(8.2, 1.4, 1.2), wallMat);
      wall.position.set(x + 4, getHeight(x + 4, z) + 0.5, z);
      wall.castShadow = wall.receiveShadow = true;
      wall.userData.surface = 'concrete';
      this.scene.add(wall);
      this.hitMeshes.push(wall);
    }
  }

  buildBunkers() {
    const concrete = new THREE.MeshStandardMaterial({ color: 0x8a867c, roughness: 0.9 });
    const dark = new THREE.MeshBasicMaterial({ color: 0x0a0a0a });
    this.bunkers = [];
    [-110, -40, 30, 95].forEach(x => {
      const z = -78;
      const y = getHeight(x, z);
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(9, 4, 7), concrete);
      body.position.y = 1.5;
      const roof = new THREE.Mesh(new THREE.BoxGeometry(10, 1, 8), concrete);
      roof.position.y = 3.8;
      const slit = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.6), dark);
      slit.position.set(0, 2.3, 3.51);
      [body, roof].forEach(m => { m.castShadow = m.receiveShadow = true; m.userData.surface = 'concrete'; this.hitMeshes.push(m); g.add(m); });
      g.add(slit);
      g.position.set(x, y, z);
      this.scene.add(g);
      this.colliders.push({ x, z, r: 5.5 });
      this.bunkers.push(g);
    });
  }

  // LCVP "Higgins boat" behind the player spawn
  buildLandingCraft() {
    const hull = new THREE.MeshStandardMaterial({ color: 0x55604a, roughness: 0.8, metalness: 0.2 });
    const g = new THREE.Group();
    const floor = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.3, 10), hull);
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.8, 10), hull); left.position.set(-1.6, 0.9, 0);
    const right = left.clone(); right.position.x = 1.6;
    const back = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.2, 0.3), hull); back.position.set(0, 1.1, 5);
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.2, 2.6), hull);
    ramp.position.set(0, -0.35, -6.1); ramp.rotation.x = -0.25;
    [floor, left, right, back, ramp].forEach(m => { m.castShadow = m.receiveShadow = true; m.userData.surface = 'metal'; this.hitMeshes.push(m); g.add(m); });
    g.position.set(0, -0.3, WORLD.playerStart[2] + 11);
    this.scene.add(g);
    this.landingCraft = g;
  }

  update(dt, time) {
    if (this.water) this.water.material.uniforms.time.value += dt * 0.6;
    if (this.landingCraft) {
      this.landingCraft.position.y = -0.3 + Math.sin(time * 1.1) * 0.12;
      this.landingCraft.rotation.z = Math.sin(time * 0.8) * 0.02;
    }
  }
}

// Small deterministic RNG so the level layout is the same every load
export function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
