/* ============================================================
 * VigorexiApp - Formato compacto de almacenamiento (v2)
 * ------------------------------------------------------------
 * Capa pura de serialización. Convierte el estado canónico que
 * usa la app (sessions/exerciseHistory completos) en un objeto
 * compacto para localStorage y lo reconstruye sin pérdidas.
 *
 * Reglas de oro:
 *  - En memoria y en las exportaciones el formato NO cambia.
 *  - Solo se escribe una clave si existía (presencia estricta).
 *  - No se recalcula nada (1RM, best*, duración, nombres...).
 *  - No se inventan valores ni se usan defaults por truthiness.
 * ============================================================ */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VigorexiStorage = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const FORMAT_VERSION = 2;

  function hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  function isObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  // Una clave existe para JSON si es propia y no es undefined.
  // (JSON.stringify elimina undefined, así que no se puede preservar.)
  function present(obj, key) {
    return hasOwn(obj, key) && obj[key] !== undefined;
  }

  function cloneJson(value) {
    if (Array.isArray(value)) {
      const out = new Array(value.length);
      for (let i = 0; i < value.length; i++) out[i] = cloneJson(value[i]);
      return out;
    }
    if (isObject(value)) {
      const out = {};
      const keys = Object.keys(value);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (value[key] !== undefined) out[key] = cloneJson(value[key]);
      }
      return out;
    }
    return value;
  }

  function copyInto(target, source) {
    if (!isObject(source)) return;
    Object.keys(source).forEach(function (key) {
      if (source[key] !== undefined) target[key] = cloneJson(source[key]);
    });
  }

  function collectUnknown(source, known) {
    const out = {};
    let count = 0;
    Object.keys(source).forEach(function (key) {
      if (known[key] || source[key] === undefined) return;
      out[key] = cloneJson(source[key]);
      count++;
    });
    return count ? out : null;
  }

  function nameKey(value) {
    if (typeof value === 'string') return 's:' + value;
    if (value === null) return 'n:null';
    return 'j:' + JSON.stringify(value);
  }

  function makeNamePool() {
    const names = [];
    const index = new Map();
    return {
      names: names,
      add: function (value) {
        if (value === undefined) return -1;
        const key = nameKey(value);
        if (index.has(key)) return index.get(key);
        const idx = names.length;
        names.push(cloneJson(value));
        index.set(key, idx);
        return idx;
      }
    };
  }

  // Las series idénticas (misma tupla) se guardan una sola vez en un pool
  // y se referencian por índice. Es una deduplicación de almacenamiento:
  // al decodificar cada referencia se clona, así que no se comparten objetos.
  function makeSetPool() {
    const list = [];
    const index = new Map();
    return {
      list: list,
      add: function (encodedSet) {
        const key = JSON.stringify(encodedSet);
        if (index.has(key)) return index.get(key);
        const idx = list.length;
        list.push(encodedSet);
        index.set(key, idx);
        return idx;
      }
    };
  }

  // ------------------------------------------------------------
  // Series
  // ------------------------------------------------------------
  const SET_KNOWN = {
    kg: 1,
    reps: 1,
    est1RM: 1,
    set: 1,
    completed: 1,
    timestamp: 1,
    completedAt: 1,
    notes: 1
  };

  function encodeSet(set) {
    if (!isObject(set)) return { __raw: cloneJson(set) };

    let p = 0;
    const values = [null, null, null];
    if (present(set, 'kg')) { p |= 1; values[0] = cloneJson(set.kg); }
    if (present(set, 'reps')) { p |= 2; values[1] = cloneJson(set.reps); }
    if (present(set, 'est1RM')) { p |= 4; values[2] = cloneJson(set.est1RM); }

    const extra = {};
    if (p !== 7) extra.p = p;
    if (present(set, 'set')) extra.st = cloneJson(set.set);
    if (present(set, 'completed')) {
      if (typeof set.completed === 'boolean') extra.c = set.completed ? 1 : 0;
      else {
        extra.z = extra.z || {};
        extra.z.completed = cloneJson(set.completed);
      }
    }
    if (present(set, 'timestamp')) extra.ts = cloneJson(set.timestamp);
    if (present(set, 'completedAt')) extra.ca = cloneJson(set.completedAt);
    if (present(set, 'notes')) extra.n = cloneJson(set.notes);

    const unknown = collectUnknown(set, SET_KNOWN);
    if (unknown) {
      extra.z = extra.z || {};
      copyInto(extra.z, unknown);
    }

    const tuple = [values[0], values[1], values[2]];
    if (Object.keys(extra).length) tuple.push(extra);
    return tuple;
  }

  function decodeSet(tuple) {
    if (!Array.isArray(tuple)) {
      if (isObject(tuple) && hasOwn(tuple, '__raw')) return cloneJson(tuple.__raw);
      return cloneJson(tuple);
    }

    const out = {};
    const extra = (tuple.length > 3 && isObject(tuple[3])) ? tuple[3] : null;
    if (extra && isObject(extra.z)) copyInto(out, extra.z);

    const p = (extra && hasOwn(extra, 'p')) ? extra.p : 7;
    if (p & 1) out.kg = cloneJson(tuple[0]);
    if (p & 2) out.reps = cloneJson(tuple[1]);
    if (p & 4) out.est1RM = cloneJson(tuple[2]);

    if (extra) {
      if (hasOwn(extra, 'st')) out.set = cloneJson(extra.st);
      if (hasOwn(extra, 'c')) out.completed = extra.c === 0 ? false : (extra.c === 1 ? true : cloneJson(extra.c));
      if (hasOwn(extra, 'ts')) out.timestamp = cloneJson(extra.ts);
      if (hasOwn(extra, 'ca')) out.completedAt = cloneJson(extra.ca);
      if (hasOwn(extra, 'n')) out.notes = cloneJson(extra.n);
    }
    return out;
  }

  // ------------------------------------------------------------
  // Mejores marcas (bestKg / bestReps / best1RM)
  // ------------------------------------------------------------
  function encodeBests(source, out) {
    let bp = 0;
    const b = [null, null, null];

    if (present(source, 'bestKg')) { bp |= 1; b[0] = cloneJson(source.bestKg); }
    if (present(source, 'bestReps')) { bp |= 2; b[1] = cloneJson(source.bestReps); }
    if (present(source, 'best1RM')) { bp |= 4; b[2] = cloneJson(source.best1RM); }

    if (bp) {
      out.b = b;
      if (bp !== 7) out.bp = bp;
    }
  }

  function decodeBests(compact, out) {
    if (!Array.isArray(compact.b)) return;
    const bp = hasOwn(compact, 'bp') ? compact.bp : 7;
    if (bp & 1) out.bestKg = cloneJson(compact.b[0]);
    if (bp & 2) out.bestReps = cloneJson(compact.b[1]);
    if (bp & 4) out.best1RM = cloneJson(compact.b[2]);
  }

  // ------------------------------------------------------------
  // Ejercicios de sesión e historial
  // ------------------------------------------------------------
  const EXERCISE_KNOWN = {
    slotId: 1,
    exId: 1,
    name: 1,
    sets: 1,
    bestKg: 1,
    bestReps: 1,
    best1RM: 1,
    notes: 1
  };

  function encodeSets(sets, setPool) {
    if (Array.isArray(sets)) {
      return sets.map(function (set) { return setPool.add(encodeSet(set)); });
    }
    return { __raw: cloneJson(sets) };
  }

  function decodeSets(value, setPool) {
    if (Array.isArray(value)) {
      return value.map(function (ref) {
        if (typeof ref === 'number') {
          if (!setPool) throw new Error('Referencia de serie sin pool');
          if (ref < 0 || ref >= setPool.length) throw new Error('Índice de serie fuera de rango');
          return decodeSet(cloneJson(setPool[ref]));
        }
        return decodeSet(ref);
      });
    }
    if (isObject(value) && hasOwn(value, '__raw')) return cloneJson(value.__raw);
    return cloneJson(value);
  }

  function encodeExercise(exercise, namePool, setPool) {
    if (!isObject(exercise)) return { __raw: cloneJson(exercise) };

    const out = {};
    if (present(exercise, 'slotId')) out.sl = cloneJson(exercise.slotId);
    if (present(exercise, 'exId')) out.x = cloneJson(exercise.exId);
    if (present(exercise, 'name')) out.n = namePool.add(exercise.name);
    if (present(exercise, 'sets')) out.t = encodeSets(exercise.sets, setPool);
    encodeBests(exercise, out);
    if (present(exercise, 'notes')) out.note = cloneJson(exercise.notes);

    const unknown = collectUnknown(exercise, EXERCISE_KNOWN);
    if (unknown) out.z = unknown;
    return out;
  }

  function decodeExercise(compact, names, setPool) {
    if (!isObject(compact)) return cloneJson(compact);
    if (hasOwn(compact, '__raw')) return cloneJson(compact.__raw);

    const out = {};
    if (isObject(compact.z)) copyInto(out, compact.z);

    if (present(compact, 'sl')) out.slotId = cloneJson(compact.sl);
    if (present(compact, 'x')) out.exId = cloneJson(compact.x);
    if (present(compact, 'n')) {
      if (!Array.isArray(names) || compact.n < 0 || compact.n >= names.length) {
        throw new Error('Índice de nombre fuera de rango en ejercicio');
      }
      out.name = cloneJson(names[compact.n]);
    }
    if (present(compact, 't')) out.sets = decodeSets(compact.t, setPool);
    decodeBests(compact, out);
    if (present(compact, 'note')) out.notes = cloneJson(compact.note);
    return out;
  }

  const HISTORY_KNOWN = {
    date: 1,
    sets: 1,
    bestKg: 1,
    bestReps: 1,
    best1RM: 1,
    notes: 1
  };

  function encodeHistoryEntry(entry, setPool) {
    if (!isObject(entry)) return { __raw: cloneJson(entry) };

    const out = {};
    if (present(entry, 'date')) out.d = cloneJson(entry.date);
    if (present(entry, 'sets')) out.t = encodeSets(entry.sets, setPool);
    encodeBests(entry, out);
    if (present(entry, 'notes')) out.note = cloneJson(entry.notes);

    const unknown = collectUnknown(entry, HISTORY_KNOWN);
    if (unknown) out.z = unknown;
    return out;
  }

  function decodeHistoryEntry(compact, setPool) {
    if (!isObject(compact)) return cloneJson(compact);
    if (hasOwn(compact, '__raw')) return cloneJson(compact.__raw);

    const out = {};
    if (isObject(compact.z)) copyInto(out, compact.z);

    if (present(compact, 'd')) out.date = cloneJson(compact.d);
    if (present(compact, 't')) out.sets = decodeSets(compact.t, setPool);
    decodeBests(compact, out);
    if (present(compact, 'note')) out.notes = cloneJson(compact.note);
    return out;
  }

  // ------------------------------------------------------------
  // Sesiones
  // ------------------------------------------------------------
  const SESSION_KNOWN = {
    id: 1,
    sessionId: 1,
    date: 1,
    dayId: 1,
    dayName: 1,
    durationMinutes: 1,
    durationFormatted: 1,
    exercises: 1
  };

  function encodeSession(session, namePool, setPool) {
    if (!isObject(session)) return { __raw: cloneJson(session) };

    const out = {};
    if (present(session, 'id')) out.i = cloneJson(session.id);
    if (present(session, 'sessionId')) out.si = cloneJson(session.sessionId);
    if (present(session, 'date')) out.d = cloneJson(session.date);
    if (present(session, 'dayId')) out.day = cloneJson(session.dayId);
    if (present(session, 'dayName')) out.dn = namePool.add(session.dayName);
    if (present(session, 'durationMinutes')) out.m = cloneJson(session.durationMinutes);
    if (present(session, 'durationFormatted')) out.df = cloneJson(session.durationFormatted);

    if (present(session, 'exercises')) {
      out.ex = Array.isArray(session.exercises)
        ? session.exercises.map(function (exercise) { return encodeExercise(exercise, namePool, setPool); })
        : { __raw: cloneJson(session.exercises) };
    }

    const unknown = collectUnknown(session, SESSION_KNOWN);
    if (unknown) out.z = unknown;
    return out;
  }

  function decodeSession(compact, names, setPool) {
    if (!isObject(compact)) return cloneJson(compact);
    if (hasOwn(compact, '__raw')) return cloneJson(compact.__raw);

    const out = {};
    if (isObject(compact.z)) copyInto(out, compact.z);

    if (present(compact, 'i')) out.id = cloneJson(compact.i);
    if (present(compact, 'si')) out.sessionId = cloneJson(compact.si);
    if (present(compact, 'd')) out.date = cloneJson(compact.d);
    if (present(compact, 'day')) out.dayId = cloneJson(compact.day);
    if (present(compact, 'dn')) {
      if (!Array.isArray(names) || compact.dn < 0 || compact.dn >= names.length) {
        throw new Error('Índice de nombre de día fuera de rango');
      }
      out.dayName = cloneJson(names[compact.dn]);
    }
    if (present(compact, 'm')) out.durationMinutes = cloneJson(compact.m);
    if (present(compact, 'df')) out.durationFormatted = cloneJson(compact.df);

    if (present(compact, 'ex')) {
      out.exercises = Array.isArray(compact.ex)
        ? compact.ex.map(function (exercise) { return decodeExercise(exercise, names, setPool); })
        : (isObject(compact.ex) && hasOwn(compact.ex, '__raw') ? cloneJson(compact.ex.__raw) : cloneJson(compact.ex));
    }
    return out;
  }

  // ------------------------------------------------------------
  // Estado completo
  // ------------------------------------------------------------
  function encodeState(state) {
    const source = isObject(state) ? state : {};
    const namePool = makeNamePool();
    const setPool = makeSetPool();
    const out = { v: FORMAT_VERSION };
    const stateOut = {};

    Object.keys(source).forEach(function (key) {
      if (key === 'sessions' || key === 'exerciseHistory') return;
      if (source[key] === undefined) return;
      stateOut[key] = cloneJson(source[key]);
    });
    out.state = stateOut;

    if (Array.isArray(source.sessions)) {
      out.sessions = source.sessions.map(function (session) { return encodeSession(session, namePool, setPool); });
    } else if (present(source, 'sessions')) {
      out.sessionsRaw = cloneJson(source.sessions);
    }

    if (isObject(source.exerciseHistory)) {
      const hist = {};
      let histRaw = null;
      Object.keys(source.exerciseHistory).forEach(function (exId) {
        const entries = source.exerciseHistory[exId];
        if (Array.isArray(entries)) hist[exId] = entries.map(function (entry) { return encodeHistoryEntry(entry, setPool); });
        else if (entries !== undefined) {
          histRaw = histRaw || {};
          histRaw[exId] = cloneJson(entries);
        }
      });
      out.hist = hist;
      if (histRaw) out.histRaw = histRaw;
    } else if (present(source, 'exerciseHistory')) {
      out.exerciseHistoryRaw = cloneJson(source.exerciseHistory);
    }

    out.names = namePool.names;
    out.pool = setPool.list;
    return out;
  }

  function decodeState(payload) {
    if (!isV2(payload)) throw new Error('Formato v2 inválido');
    if (present(payload, 'state') && !isObject(payload.state)) throw new Error('state inválido');
    if (present(payload, 'names') && !Array.isArray(payload.names)) throw new Error('names inválido');
    if (present(payload, 'sessions') && !Array.isArray(payload.sessions)) throw new Error('sessions inválido');
    if (present(payload, 'hist') && !isObject(payload.hist)) throw new Error('hist inválido');
    if (present(payload, 'histRaw') && !isObject(payload.histRaw)) throw new Error('histRaw inválido');
    if (present(payload, 'pool') && !Array.isArray(payload.pool)) throw new Error('pool inválido');

    const names = Array.isArray(payload.names) ? payload.names.map(cloneJson) : [];
    const setPool = present(payload, 'pool') ? payload.pool.map(cloneJson) : null;
    const state = isObject(payload.state) ? cloneJson(payload.state) : {};

    if (present(payload, 'sessions')) {
      state.sessions = payload.sessions.map(function (session) { return decodeSession(session, names, setPool); });
    } else if (present(payload, 'sessionsRaw')) {
      state.sessions = cloneJson(payload.sessionsRaw);
    }

    if (present(payload, 'hist')) {
      const hist = {};
      Object.keys(payload.hist).forEach(function (exId) {
        const entries = payload.hist[exId];
        hist[exId] = Array.isArray(entries)
          ? entries.map(function (entry) { return decodeHistoryEntry(entry, setPool); })
          : (isObject(entries) && hasOwn(entries, '__raw') ? cloneJson(entries.__raw) : cloneJson(entries));
      });
      if (isObject(payload.histRaw)) {
        Object.keys(payload.histRaw).forEach(function (exId) {
          hist[exId] = cloneJson(payload.histRaw[exId]);
        });
      }
      state.exerciseHistory = hist;
    } else if (present(payload, 'exerciseHistoryRaw')) {
      state.exerciseHistory = cloneJson(payload.exerciseHistoryRaw);
    }

    return state;
  }

  function isV2(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value) && value.v === FORMAT_VERSION;
  }

  /**
   * Normaliza y decodifica una carga almacenada.
   * Devuelve { ok, v, state, reason, error, payload }.
   *  - v2 válido  -> ok:true, state canónico decodificado
   *  - v1 válido  -> ok:true, state canónico copiado
   *  - v2 dañado  -> ok:false, reason:'invalid_v2' (no se inventa estado)
   */
  function decodePayload(input) {
    let payload = input;
    let raw = null;
    if (typeof input === 'string') {
      raw = input;
      try {
        payload = JSON.parse(input);
      } catch (error) {
        return { ok: false, v: 0, reason: 'parse_error', error: error, raw: raw };
      }
    }

    if (isV2(payload)) {
      try {
        return { ok: true, v: 2, state: decodeState(payload), payload: payload };
      } catch (error) {
        return { ok: false, v: 2, reason: 'invalid_v2', error: error, payload: payload, raw: raw };
      }
    }

    if (isObject(payload)) {
      return { ok: true, v: 1, state: cloneJson(payload), payload: payload };
    }

    return { ok: false, v: 0, reason: 'invalid_payload', payload: payload, raw: raw };
  }

  function deepEqual(a, b) {
    if (a === b) return true;
    if (a === null || b === null) return false;
    if (typeof a !== typeof b) return false;

    if (Array.isArray(a) || Array.isArray(b)) {
      if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!deepEqual(a[i], b[i])) return false;
      }
      return true;
    }

    if (isObject(a) && isObject(b)) {
      const ka = Object.keys(a).filter(function (k) { return a[k] !== undefined; });
      const kb = Object.keys(b).filter(function (k) { return b[k] !== undefined; });
      if (ka.length !== kb.length) return false;
      for (let i = 0; i < ka.length; i++) {
        const key = ka[i];
        if (!hasOwn(b, key) || !deepEqual(a[key], b[key])) return false;
      }
      return true;
    }

    if (typeof a === 'number' && typeof b === 'number' && Number.isNaN(a) && Number.isNaN(b)) return true;
    return false;
  }

  // Devuelve la primera ruta distinta (útil para diagnosticar la autocomprobación).
  function firstDifference(a, b, path) {
    const at = path || '$';
    if (a === b) return null;
    if (a === null || b === null) return at;
    if (typeof a !== typeof b) return at;
    if (Array.isArray(a) || Array.isArray(b)) {
      if (!Array.isArray(a) || !Array.isArray(b)) return at;
      if (a.length !== b.length) return at + '.length';
      for (let i = 0; i < a.length; i++) {
        const diff = firstDifference(a[i], b[i], at + '[' + i + ']');
        if (diff) return diff;
      }
      return null;
    }
    if (isObject(a) && isObject(b)) {
      const keys = {};
      Object.keys(a).forEach(function (k) { if (a[k] !== undefined) keys[k] = 1; });
      Object.keys(b).forEach(function (k) { if (b[k] !== undefined) keys[k] = 1; });
      const list = Object.keys(keys);
      for (let i = 0; i < list.length; i++) {
        const key = list[i];
        if (!hasOwn(a, key) || !hasOwn(b, key)) return at + '.' + key;
        const diff = firstDifference(a[key], b[key], at + '.' + key);
        if (diff) return diff;
      }
      return null;
    }
    return at;
  }

  function estimateBytes(value) {
    try {
      return JSON.stringify(value).length;
    } catch (error) {
      return Infinity;
    }
  }

  return {
    FORMAT_VERSION: FORMAT_VERSION,
    encodeState: encodeState,
    decodeState: decodeState,
    decodePayload: decodePayload,
    isV2: isV2,
    deepEqual: deepEqual,
    firstDifference: firstDifference,
    estimateBytes: estimateBytes
  };
});
