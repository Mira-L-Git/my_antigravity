/**
 * transport-tap：只读旁路监听 WebSocket (/connect-websocket) 与 fetch (GetCascadeTrajectory)，
 * 提取会话运行状态跃迁事件，绝不修改请求参数或响应流。
 */

const STREAM_AGENT_STATE_PROC = 'StreamAgentStateUpdates';
const GET_CASCADE_TRAJECTORY_PROC = 'GetCascadeTrajectory';

export function createConnectEnvelopeParser(onMessage) {
  let buffer = new Uint8Array(0);
  const decoder = new TextDecoder();

  function append(chunk) {
    if (!chunk || chunk.byteLength === 0) return;
    const next = new Uint8Array(buffer.byteLength + chunk.byteLength);
    next.set(buffer, 0);
    next.set(chunk, buffer.byteLength);
    buffer = next;
  }

  return {
    push(chunk) {
      append(chunk);
      while (buffer.byteLength >= 5) {
        const flags = buffer[0];
        const len =
          ((buffer[1] << 24) >>> 0) |
          (buffer[2] << 16) |
          (buffer[3] << 8) |
          buffer[4];
        const total = 5 + len;
        if (len > 32 * 1024 * 1024) {
          buffer = new Uint8Array(0);
          return;
        }
        if (buffer.byteLength < total) {
          return;
        }
        const payloadBytes = buffer.subarray(5, total);
        buffer = buffer.subarray(total);

        if ((flags & 128) !== 0 || (flags & 1) !== 0) {
          continue;
        }
        try {
          const text = decoder.decode(payloadBytes);
          if (text && text[0] === '{') {
            onMessage(JSON.parse(text));
          }
        } catch {
          // 忽略非 JSON 或损坏帧
        }
      }
    },
    reset() {
      buffer = new Uint8Array(0);
    },
  };
}

function extractRequestConversationId(initBody) {
  if (!initBody) return null;
  try {
    let text = '';
    if (typeof initBody === 'string') {
      text = initBody;
    } else if (initBody instanceof Uint8Array) {
      const slice =
        initBody.byteLength > 5 && (initBody[0] === 0 || initBody[0] === 1)
          ? initBody.subarray(5)
          : initBody;
      text = new TextDecoder().decode(slice);
    }
    if (!text || text[0] !== '{') return null;
    const obj = JSON.parse(text);
    return obj.conversationId || obj.cascadeId || null;
  } catch {
    return null;
  }
}

export function installAttentionTransportTap(win, handlers = {}) {
  const { onAgentStateUpdate, onTrajectory } = handlers;
  if (!win || win.__myAntigravityTaskbarBadgeTapInstalled) {
    return () => {};
  }
  win.__myAntigravityTaskbarBadgeTapInstalled = true;

  const activeStreams = new Map();
  const OrigWebSocket = win.WebSocket;
  const origFetch = typeof win.fetch === 'function' ? win.fetch.bind(win) : null;

  function handleOutboundText(raw, socket) {
    if (typeof raw !== 'string' || raw[0] !== '{') return;
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (!msg || typeof msg.streamId !== 'string') return;
    if (msg.type === 'cancel') {
      activeStreams.delete(msg.streamId);
      return;
    }
    if (msg.type === 'start' && typeof msg.procedure === 'string') {
      if (msg.procedure.includes(STREAM_AGENT_STATE_PROC)) {
        const cid = msg.payload?.conversationId || msg.payload?.cascadeId || null;
        activeStreams.set(msg.streamId, {
          kind: 'state',
          conversationId: cid,
          socket,
          receivedFirstFrame: false,
        });
      } else if (
        msg.procedure.includes(GET_CASCADE_TRAJECTORY_PROC) &&
        !msg.procedure.includes('GeneratorMetadata') &&
        !msg.procedure.includes('Steps')
      ) {
        const cid = msg.payload?.cascadeId || msg.payload?.conversationId || null;
        activeStreams.set(msg.streamId, {
          kind: 'trajectory',
          conversationId: cid,
          socket,
          receivedFirstFrame: false,
        });
      }
    }
  }

  function handleInboundText(raw) {
    if (typeof raw !== 'string' || raw[0] !== '{') return;
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (!msg || typeof msg.streamId !== 'string') return;
    const meta = activeStreams.get(msg.streamId);
    if (!meta) return;

    if (msg.type === 'end') {
      activeStreams.delete(msg.streamId);
      return;
    }
    if (msg.type !== 'data' || !msg.payload || typeof msg.payload !== 'object') {
      return;
    }

    const isFirst = !meta.receivedFirstFrame;
    meta.receivedFirstFrame = true;

    if (meta.kind === 'state' && msg.payload.update) {
      onAgentStateUpdate?.(msg.payload.update, { isInitialHydration: isFirst });
    } else if (meta.kind === 'trajectory' && msg.payload.trajectory) {
      const cid = meta.conversationId || msg.payload.trajectory?.cascadeId || null;
      if (cid) {
        onTrajectory?.(cid, msg.payload, { isInitialHydration: isFirst });
      }
    }
  }

  if (typeof OrigWebSocket === 'function') {
    class BadgeTapWebSocket extends OrigWebSocket {
      constructor(url, protocols) {
        if (protocols !== undefined) {
          super(url, protocols);
        } else {
          super(url);
        }
        try {
          const urlStr = String(url || '');
          if (urlStr.includes('/connect-websocket')) {
            this.addEventListener('message', (event) => {
              handleInboundText(event?.data);
            });
            this.addEventListener('close', () => {
              for (const [id, meta] of activeStreams.entries()) {
                if (meta.socket === this) {
                  activeStreams.delete(id);
                }
              }
            });
          }
        } catch {
          // 忽略监听器异常，不影响原生 WebSocket
        }
      }

      send(data) {
        try {
          handleOutboundText(data, this);
        } catch {
          // 旁路失败绝不阻断原发送
        }
        return super.send(data);
      }
    }
    try {
      win.WebSocket = BadgeTapWebSocket;
    } catch {
      // 严禁在不可覆写环境崩溃
    }
  }

  if (origFetch) {
    win.fetch = function patchedFetch(input, init) {
      const url = typeof input === 'string' ? input : input?.url || '';
      const isStateStream = url.includes(STREAM_AGENT_STATE_PROC);
      const isTrajectory =
        url.includes(GET_CASCADE_TRAJECTORY_PROC) &&
        !url.includes('GeneratorMetadata') &&
        !url.includes('Steps');
      const fallbackCid = isTrajectory ? extractRequestConversationId(init?.body) : null;

      const resPromise = origFetch(input, init);
      if (!isStateStream && !isTrajectory) {
        return resPromise;
      }

      resPromise
        .then((response) => {
          try {
            if (!response || !response.ok || typeof response.clone !== 'function') {
              return;
            }
            const cloned = response.clone();
            const ct = String(cloned.headers?.get?.('content-type') || '').toLowerCase();

            if (ct.includes('application/json') && !ct.includes('connect')) {
              void cloned
                .json()
                .then((obj) => {
                  if (isStateStream && obj?.update) {
                    onAgentStateUpdate?.(obj.update, { isInitialHydration: false });
                  } else if (isTrajectory && obj?.trajectory) {
                    const cid = fallbackCid || obj?.trajectory?.cascadeId || null;
                    if (cid) {
                      onTrajectory?.(cid, obj, { isInitialHydration: false });
                    }
                  }
                })
                .catch(() => {});
              return;
            }

            if (cloned.body?.getReader) {
              let first = true;
              const reader = cloned.body.getReader();
              const parser = createConnectEnvelopeParser((obj) => {
                const isFirst = first;
                first = false;
                if (isStateStream && obj?.update) {
                  onAgentStateUpdate?.(obj.update, { isInitialHydration: isFirst });
                } else if (isTrajectory && obj?.trajectory) {
                  const cid = fallbackCid || obj.trajectory?.cascadeId || null;
                  if (cid) {
                    onTrajectory?.(cid, obj, { isInitialHydration: isFirst });
                  }
                }
              });
              (async () => {
                try {
                  while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    if (value) parser.push(value);
                  }
                } catch {
                  // 忽略流读取中断
                }
              })();
            }
          } catch {
            // 旁路 clone 失败不影响原响应
          }
        })
        .catch(() => {});

      return resPromise;
    };
  }

  return () => {
    activeStreams.clear();
  };
}
