import { jwtDecode } from "jwt-decode";
import { KJUR } from "jsrsasign";

export function normalizeJwtToken(token) {
  if (typeof token !== "string") return "";

  return token
    .trim()
    .replace(/^Bearer\s+/i, "")
    .replace(/^["']|["']$/g, "");
}

export function decodeJwtPayload(token) {
  const normalizedToken = normalizeJwtToken(token);

  if (!normalizedToken) return null;

  try {
    return jwtDecode(normalizedToken);
  } catch {
    return null;
  }
}

export async function verifyJwt(token, secret) {
  const normalizedToken = normalizeJwtToken(token);

  if (!normalizedToken || !secret || typeof secret !== "string") {
    return { ok: false, reason: "Malformed token" };
  }

  const payload = decodeJwtPayload(normalizedToken);
  if (!payload) {
    return { ok: false, reason: "Malformed token" };
  }

  if (typeof payload.exp === "number" && payload.exp * 1000 <= Date.now()) {
    return { ok: false, reason: "Token expired" };
  }

  try {
    const isValid = KJUR.jws.JWS.verifyJWT(normalizedToken, secret, {
      alg: ["HS256"],
    });

    if (!isValid) {
      return { ok: false, reason: "Invalid token signature" };
    }

    return { ok: true, reason: null };
  } catch {
    return { ok: false, reason: "Malformed token" };
  }
}
