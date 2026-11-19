import crypto from 'node:crypto';
import fs from 'node:fs';

const BLOCK_SIZE = 4 * 1024 * 1024; // ASAR 默认 4MB 分块校验大小

/**
 * 解析 ASAR 归档文件头与文件索引。
 * @param {string} asarPath
 */
export function readAsar(asarPath) {
  const buf = fs.readFileSync(asarPath);
  if (buf.length < 16) {
    throw new Error(`Invalid ASAR file (too small): ${asarPath}`);
  }
  const magic = buf.readUInt32LE(0);
  const headerSize = buf.readUInt32LE(4);
  const jsonLen = buf.readUInt32LE(12);
  if (magic !== 4 || 16 + jsonLen > buf.length) {
    throw new Error(`Invalid ASAR header: ${asarPath}`);
  }
  const header = JSON.parse(buf.subarray(16, 16 + jsonLen).toString('utf8'));
  const baseOffset = 8 + headerSize;
  return { buf, header, baseOffset };
}

/**
 * 计算 ASAR 文件节点所需的 SHA-256 integrity 元数据。
 * @param {Buffer} data
 */
export function computeIntegrity(data) {
  const hash = crypto.createHash('sha256').update(data).digest('hex');
  const blocks = [];
  if (data.length === 0) {
    blocks.push(hash);
  } else {
    for (let offset = 0; offset < data.length; offset += BLOCK_SIZE) {
      const slice = data.subarray(offset, offset + BLOCK_SIZE);
      blocks.push(crypto.createHash('sha256').update(slice).digest('hex'));
    }
  }
  return {
    algorithm: 'SHA256',
    hash,
    blockSize: BLOCK_SIZE,
    blocks,
  };
}

/**
 * 从已读取的 ASAR 中提取单个文件 Buffer。
 */
export function getAsarFile(asar, relPath) {
  const node = findNode(asar.header, relPath);
  if (!node || node.files) {
    return null;
  }
  if (node.unpacked) {
    throw new Error(`Cannot read unpacked file from asar payload: ${relPath}`);
  }
  const start = asar.baseOffset + Number(node.offset);
  return asar.buf.subarray(start, start + node.size);
}

/**
 * 写入修改后的 ASAR 文件：保留未改动的原始文件与 unpacked/executable 属性，仅替换 overrides 中指定的路径。
 * @param {string} asarPath 原始 ASAR 路径
 * @param {string} outPath 输出路径
 * @param {Record<string, Buffer>} overrides 相对路径（使用 `/` 分隔）到新 Buffer 的映射
 * @param {string[]} [removals] 需要从索引中移除的相对路径
 */
export function writePatchedAsar(asarPath, outPath, overrides, removals = []) {
  const asar = readAsar(asarPath);
  const overrideMap = new Map(Object.entries(overrides));
  const removalSet = new Set(removals);

  const newHeader = cloneAndStripOffsets(asar.header, removalSet);
  for (const [relPath] of overrideMap) {
    ensureFileSlot(newHeader, relPath);
  }

  const payloads = [];
  let cursor = 0;

  function populate(node, prefix = '') {
    if (!node.files) {
      return;
    }
    for (const [name, child] of Object.entries(node.files)) {
      const rel = prefix ? `${prefix}/${name}` : name;
      if (child.files) {
        populate(child, rel);
        continue;
      }
      if (child.unpacked) {
        continue;
      }
      let data;
      if (overrideMap.has(rel)) {
        data = overrideMap.get(rel);
      } else {
        const origNode = findNode(asar.header, rel);
        if (!origNode) {
          throw new Error(`Missing original payload for: ${rel}`);
        }
        const start = asar.baseOffset + Number(origNode.offset);
        data = asar.buf.subarray(start, start + origNode.size);
      }
      child.size = data.length;
      child.offset = String(cursor);
      child.integrity = computeIntegrity(data);
      payloads.push(data);
      cursor += data.length;
    }
  }

  populate(newHeader);

  const jsonBuf = Buffer.from(JSON.stringify(newHeader), 'utf8');
  const paddedJsonLen = (jsonBuf.length + 3) & ~3;
  const headerBuf = Buffer.alloc(16 + paddedJsonLen, 0);
  headerBuf.writeUInt32LE(4, 0);
  headerBuf.writeUInt32LE(paddedJsonLen + 8, 4);
  headerBuf.writeUInt32LE(paddedJsonLen + 4, 8);
  headerBuf.writeUInt32LE(jsonBuf.length, 12);
  jsonBuf.copy(headerBuf, 16);

  const outBuf = Buffer.concat([headerBuf, ...payloads]);
  fs.writeFileSync(outPath, outBuf);
}

function findNode(root, relPath) {
  const parts = relPath.split('/').filter(Boolean);
  let cur = root;
  for (const part of parts) {
    if (!cur?.files || !Object.prototype.hasOwnProperty.call(cur.files, part)) {
      return null;
    }
    cur = cur.files[part];
  }
  return cur;
}

function ensureFileSlot(root, relPath) {
  const parts = relPath.split('/').filter(Boolean);
  let cur = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const dir = parts[i];
    if (!cur.files[dir]) {
      cur.files[dir] = { files: {} };
    }
    cur = cur.files[dir];
  }
  const leaf = parts[parts.length - 1];
  if (!cur.files[leaf]) {
    cur.files[leaf] = {};
  }
}

function cloneAndStripOffsets(node, removalSet, prefix = '') {
  if (!node.files) {
    const copy = { ...node };
    delete copy.offset;
    return copy;
  }
  const files = {};
  for (const [name, child] of Object.entries(node.files)) {
    const rel = prefix ? `${prefix}/${name}` : name;
    if (removalSet.has(rel)) {
      continue;
    }
    files[name] = cloneAndStripOffsets(child, removalSet, rel);
  }
  return { files };
}
