import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Fusiona mallas estáticas que comparten material para reducir draw calls
 * (clave en un visor autónomo). Los objetos interactivos deben excluirse.
 */
export function mergeStatic(root, exclude = new Set()) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  const remove = [];

  root.traverse((o) => {
    if (!o.isMesh || !o.geometry || o.isInstancedMesh) return;
    let p = o;
    while (p) {
      if (exclude.has(p) || p.userData.noMerge) return;
      p = p.parent;
    }
    if (Array.isArray(o.material) || !o.material || o.material.transparent) return;
    if (!o.geometry.attributes.position || !o.geometry.attributes.uv) return;
    const key = `${o.material.uuid}|${o.castShadow ? 1 : 0}|${o.receiveShadow ? 1 : 0}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { material: o.material, cast: o.castShadow, receive: o.receiveShadow, meshes: [] };
      buckets.set(key, bucket);
    }
    bucket.meshes.push(o);
  });

  for (const bucket of buckets.values()) {
    if (bucket.meshes.length < 2) continue;
    const geos = [];
    for (const m of bucket.meshes) {
      m.updateWorldMatrix(true, false);
      const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      // descarta atributos que no comparte todo el grupo
      for (const name of Object.keys(g.attributes)) {
        if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
      }
      geos.push(g);
    }
    let merged = null;
    try {
      merged = mergeGeometries(geos, false);
    } catch (e) {
      merged = null;
    }
    if (!merged) {
      for (const g of geos) g.dispose();
      continue;
    }
    for (const g of geos) g.dispose();
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, bucket.material);
    mesh.castShadow = bucket.cast;
    mesh.receiveShadow = bucket.receive;
    mesh.matrixAutoUpdate = false;
    root.add(mesh);
    for (const m of bucket.meshes) remove.push(m);
  }

  for (const m of remove) {
    m.parent?.remove(m);
  }
  return remove.length;
}
