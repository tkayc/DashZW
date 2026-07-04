/**
 * File-backed JSON store (dev / demo persistence).
 * TODO(postgresql): Replace getCollection/saveCollection with PostgreSQL access layer.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.join(__dirname, '../../data');

const listeners = new Set();

export function notifyListeners(collectionName) {
  listeners.forEach((fn) => fn(collectionName));
}

export function subscribeToDbChanges(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function filePath(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

export function getCollection(name) {
  try {
    const raw = fs.readFileSync(filePath(name), 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveCollection(name, data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(filePath(name), JSON.stringify(data, null, 2));
  notifyListeners(name);
}

export function getMeta(key) {
  try {
    const raw = fs.readFileSync(path.join(DATA_DIR, '_meta.json'), 'utf8');
    return JSON.parse(raw)[key];
  } catch {
    return undefined;
  }
}

export function setMeta(key, value) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  let meta = {};
  try {
    meta = JSON.parse(fs.readFileSync(path.join(DATA_DIR, '_meta.json'), 'utf8'));
  } catch {}
  meta[key] = value;
  fs.writeFileSync(path.join(DATA_DIR, '_meta.json'), JSON.stringify(meta, null, 2));
}

export function getUsersFile() {
  const p = path.join(DATA_DIR, 'users.json');
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return [];
  }
}

export function saveUsersFile(users) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, 'users.json'), JSON.stringify(users, null, 2));
}
